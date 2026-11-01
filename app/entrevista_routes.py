"""
Rotas do simulador de entrevista contínua (regras em entrevista.py):

  GET  /entrevista/sessao-atual            retoma a entrevista aberta (ou null)
  POST /entrevista/sessoes                 começa uma entrevista nova
  POST /entrevista/sessoes/{id}/mensagens  uma troca com a entrevistadora
  POST /entrevista/sessoes/{id}/laudo      encerra e gera o laudo final (uma chamada à IA)
"""
import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

import entrevista
from auth import get_estudante_atual
from competencias import registrar_evidencias
from database import get_db
from fuso import agora_utc, inicio_do_dia_utc
from models import Estudante, HistoricoEntrevista, RodadaEntrevista, SessaoEntrevista
from services import AIService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["First2Work.AI - Simulador de entrevista"])

ABERTAS = ("em_andamento", "aguardando_laudo")


class NovaSessaoRequest(BaseModel):
    # Só o nome da abertura: o texto da pergunta vem do servidor
    abertura: Literal["inicial", "recomeco"] = "inicial"


class MensagemRequest(BaseModel):
    mensagem: str = Field(min_length=1, max_length=entrevista.TAMANHO_MAXIMO_RESPOSTA)


def _iso(valor) -> Optional[str]:
    return valor.isoformat() if valor else None


def laudo_para_dict(sessao: SessaoEntrevista) -> dict:
    return {
        "sessao_id": sessao.id,
        "nota_geral": sessao.nota_geral,
        "notas": sessao.notas,
        "pontos_fortes": sessao.pontos_fortes or [],
        "pontos_melhoria": sessao.pontos_melhoria or [],
        "parecer_recrutador": sessao.parecer_recrutador,
        "resumo": sessao.resumo,
        "rodada_id": sessao.rodada_id,
        "xp_concedido": sessao.xp_concedido or 0,
        "respostas": sessao.respostas,
        "por_ia": bool(sessao.laudo_por_ia),
        "laudo_em": _iso(sessao.laudo_em),
    }


def rodada_para_dict(rodada: RodadaEntrevista, notas: list[int]) -> dict:
    return {
        "id": rodada.id,
        "numero": rodada.numero,
        "status": rodada.status,
        "feitas": len(notas),
        "total": entrevista.ENTREVISTAS_POR_RODADA,
        "media": rodada.media if rodada.media is not None else (round(sum(notas) / len(notas)) if notas else None),
        "meta": entrevista.META_DA_RODADA,
        "concluida_em": _iso(rodada.concluida_em),
        "confirmada_em": _iso(rodada.confirmada_em),
    }


def registrar_na_rodada(db: Session, estudante_id: int, sessao: SessaoEntrevista) -> Optional[dict]:
    """
    Põe a entrevista na rodada aberta (ou abre a próxima). Na 5ª, fecha a
    rodada: média >= meta vira 'meta_atingida' (a coordenação confirma);
    abaixo disso, a próxima entrevista começa a rodada seguinte. Depois da
    meta, as entrevistas são treino livre (sem rodada).
    """
    rodadas = db.query(RodadaEntrevista).filter(RodadaEntrevista.estudante_id == estudante_id).order_by(RodadaEntrevista.numero.desc()).with_for_update().all()
    if any(r.status == "meta_atingida" for r in rodadas):
        return None
    aberta = next((r for r in rodadas if r.status == "em_andamento"), None)
    if aberta is None:
        aberta = RodadaEntrevista(estudante_id=estudante_id, numero=(rodadas[0].numero + 1) if rodadas else 1, status="em_andamento")
        db.add(aberta)
        db.flush()
    sessao.rodada_id = aberta.id
    anteriores = db.query(SessaoEntrevista.nota_geral).filter(
        SessaoEntrevista.rodada_id == aberta.id, SessaoEntrevista.status == "concluida", SessaoEntrevista.id != sessao.id,
    ).all()
    notas = [n for (n,) in anteriores if n is not None] + [sessao.nota_geral]
    fechou = entrevista.fechar_rodada(notas)
    if fechou:
        aberta.status = fechou["status"]
        aberta.media = fechou["media"]
        aberta.concluida_em = agora_utc()
    return rodada_para_dict(aberta, notas)


def _sessao_para_dict(sessao: SessaoEntrevista, mensagens: list[HistoricoEntrevista]) -> dict:
    return {
        "id": sessao.id,
        "status": sessao.status,
        "respostas": sessao.respostas,
        "minimo": entrevista.RESPOSTAS_MINIMAS,
        "maximo": entrevista.RESPOSTAS_MAXIMAS,
        "mensagens": [{"remetente": m.remetente, "mensagem": m.mensagem, "categoria": m.categoria} for m in mensagens],
        "laudo": laudo_para_dict(sessao) if sessao.status == "concluida" else None,
    }


def _mensagens(db: Session, sessao_id: int) -> list[HistoricoEntrevista]:
    return db.query(HistoricoEntrevista).filter(HistoricoEntrevista.sessao_id == sessao_id).order_by(HistoricoEntrevista.id).all()


def conversa_em_texto(mensagens: list[HistoricoEntrevista], extra: Optional[str] = None) -> str:
    linhas = [f"{'Entrevistadora' if m.remetente == 'ai' else 'Candidato'}: {m.mensagem}" for m in mensagens]
    if extra is not None:
        linhas.append(f"Candidato: {extra}")
    return "\n".join(linhas)


def _sessao_do_aluno(db: Session, sessao_id: int, estudante: Estudante, travar: bool = False) -> SessaoEntrevista:
    consulta = db.query(SessaoEntrevista).filter(SessaoEntrevista.id == sessao_id, SessaoEntrevista.estudante_id == estudante.id)
    if travar:
        # Dois cliques em "gerar laudo" não podem dar XP duas vezes
        consulta = consulta.with_for_update()
    sessao = consulta.first()
    if not sessao:
        raise HTTPException(status_code=404, detail="Entrevista não encontrada.")
    return sessao


@router.get("/entrevista/sessao-atual")
def sessao_atual(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    sessao = db.query(SessaoEntrevista).filter(
        SessaoEntrevista.estudante_id == estudante.id, SessaoEntrevista.status.in_(ABERTAS),
    ).order_by(SessaoEntrevista.id.desc()).first()
    return {"sessao": _sessao_para_dict(sessao, _mensagens(db, sessao.id)) if sessao else None}


@router.post("/entrevista/sessoes", status_code=201)
def nova_sessao(data: NovaSessaoRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """Começa uma entrevista. A que estava aberta (sem laudo) fica como abandonada."""
    for antiga in db.query(SessaoEntrevista).filter(
        SessaoEntrevista.estudante_id == estudante.id, SessaoEntrevista.status.in_(ABERTAS),
    ).all():
        antiga.status = "abandonada"
    sessao = SessaoEntrevista(estudante_id=estudante.id, status="em_andamento", respostas=0)
    db.add(sessao)
    db.flush()
    abertura = HistoricoEntrevista(
        estudante_id=estudante.id, sessao_id=sessao.id, remetente="ai",
        mensagem=entrevista.PERGUNTA_RECOMECO if data.abertura == "recomeco" else entrevista.PERGUNTA_INICIAL,
    )
    db.add(abertura)
    db.commit()
    return _sessao_para_dict(sessao, [abertura])


@router.post("/entrevista/sessoes/{sessao_id}/mensagens")
def enviar_mensagem(sessao_id: int, data: MensagemRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    sessao = _sessao_do_aluno(db, sessao_id, estudante, travar=True)
    if sessao.status != "em_andamento":
        raise HTTPException(status_code=409, detail="Essa entrevista já terminou. Gere o laudo ou comece outra.")
    mensagens = _mensagens(db, sessao.id)
    ultima_fala = next((m.mensagem for m in reversed(mensagens) if m.remetente == "ai"), entrevista.PERGUNTA_INICIAL)
    respostas_anteriores = [m.mensagem for m in mensagens if m.remetente == "user" and m.categoria == "resposta"]
    conversa = conversa_em_texto(mensagens, data.mensagem)

    troca = entrevista.rodada(
        data.mensagem, ultima_fala, respostas_anteriores,
        perguntas_ja_feitas=sum(1 for m in mensagens if m.remetente == "ai"),
        conversar_com_ia=lambda _mensagem, deve_encerrar: AIService.conversar_entrevista(
            conversa, estudante.itinerario, len(respostas_anteriores) + 1, deve_encerrar,
        ),
    )
    db.add(HistoricoEntrevista(estudante_id=estudante.id, sessao_id=sessao.id, remetente="user", mensagem=data.mensagem, categoria=troca["categoria"]))
    db.add(HistoricoEntrevista(estudante_id=estudante.id, sessao_id=sessao.id, remetente="ai", mensagem=troca["fala"]))
    if troca["conta"]:
        sessao.respostas = (sessao.respostas or 0) + 1
    if troca["encerrou"]:
        sessao.status = "aguardando_laudo"
        sessao.encerrada_em = agora_utc()
    db.commit()
    return {
        "fala": troca["fala"],
        "categoria": troca["categoria"],
        "contou": troca["conta"],
        "respostas": sessao.respostas,
        "minimo": entrevista.RESPOSTAS_MINIMAS,
        "maximo": entrevista.RESPOSTAS_MAXIMAS,
        "status": sessao.status,
    }


@router.post("/entrevista/sessoes/{sessao_id}/laudo")
def gerar_laudo(sessao_id: int, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """
    Uma chamada à IA com a conversa inteira. Nota geral e XP saem do servidor.
    Só as primeiras entrevistas do dia dão XP (o laudo sai sempre).
    """
    sessao = _sessao_do_aluno(db, sessao_id, estudante, travar=True)
    if sessao.status == "concluida":
        return {**laudo_para_dict(sessao), "ja_gerado": True}
    if sessao.status != "aguardando_laudo":
        raise HTTPException(status_code=409, detail="A entrevista ainda não terminou.")

    mensagens = _mensagens(db, sessao.id)
    respostas = [m.mensagem for m in mensagens if m.remetente == "user" and m.categoria == "resposta"]
    conversa = conversa_em_texto(mensagens)
    laudo = entrevista.montar_laudo(respostas, lambda: AIService.gerar_laudo_entrevista(conversa, estudante.itinerario))

    laudos_hoje = db.query(func.count(SessaoEntrevista.id)).filter(
        SessaoEntrevista.estudante_id == estudante.id, SessaoEntrevista.status == "concluida",
        SessaoEntrevista.laudo_em >= inicio_do_dia_utc(), SessaoEntrevista.xp_concedido > 0,
    ).scalar() or 0
    limite_diario = laudos_hoje >= entrevista.LAUDOS_COM_XP_POR_DIA
    xp = 0 if limite_diario else laudo["xp"]

    sessao.status = "concluida"
    sessao.laudo_em = agora_utc()
    sessao.nota_geral = laudo["nota_geral"]
    sessao.notas = laudo["notas"]
    sessao.pontos_fortes = laudo["pontos_fortes"]
    sessao.pontos_melhoria = laudo["pontos_melhoria"]
    sessao.parecer_recrutador = laudo["parecer_recrutador"]
    sessao.xp_concedido = xp
    sessao.laudo_por_ia = laudo["por_ia"]
    sessao.resumo = laudo["resumo"]
    rodada = registrar_na_rodada(db, estudante.id, sessao)

    # Entrevista concluída é treino do dia e vira evidência nos eixos que ela exercita
    mudanca_liga = AIService.processar_gamificacao_pos_atividade(estudante, db, xp)
    notas = laudo["notas"]
    registrar_evidencias(db, estudante.id, {
        "comunicacao": round((notas["clareza"] + notas["postura"]) / 2 * 10),
        "trabalho_projeto_vida": notas["relevancia"] * 10,
        "autoconhecimento": notas["exemplos"] * 10,
    }, origem="entrevista")
    db.commit()
    return {
        **laudo_para_dict(sessao),
        "limite_diario": limite_diario,
        "rodada": rodada,
        "novos_pontos_totais": estudante.xp_total,
        "nivel_atual": estudante.nivel_gamificacao,
        "ofensiva_dias": estudante.ofensiva_dias,
        "categoria_status": estudante.categoria_status,
        "missoes_diarias": estudante.missoes_diarias_concluidas,
        "liga": estudante.liga,
        "mudanca_liga": mudanca_liga,
    }
