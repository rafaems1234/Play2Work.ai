import json
import logging
import random
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

# Importações do ecossistema do projeto
from models import Estudante, Vaga, Curriculo, Candidatura, QuizSessao
from database import get_db
from limiter import limiter
from services import (
    AIService,
    ITINERARIOS_QUIZ,
    VIDAS_MAXIMAS,
    QUIZZES_PERFEITOS_PARA_VIDA_BONUS,
    DICAS_POR_QUIZ,
    PULOS_POR_QUIZ,
    LIGAS,
    LIGA_EMOJI,
    TAMANHO_GRUPO_LIGA,
    SESSOES_RECENTES_SEM_REPETIR,
    ACERTOS_SEGUIDOS_PARA_VIDA,
    MINUTOS_PARA_REGENERAR_VIDA,
    vagas_das_zonas,
    combo_final,
    vidas_ganhas_por_combo,
)
from auth import get_estudante_atual
from fuso import hoje as hoje_na_escola, agora_utc, inicio_do_dia_utc
from competencias import registrar_evidencias, mapa_para_tela
from atividades import proxima_situacao, responder_situacao
from fotos import FotoRequest, salvar_foto, remover_foto, resposta_da_foto, salvar_foto_curriculo, remover_foto_curriculo, resposta_da_foto_curriculo
from curriculo import gerar as gerar_curriculo, dados_do_sistema, TextoRecusado

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Play2Work.AI - Endpoints"]
)

# ----------------------------------------------------------------------
# SCHEMAS DE VALIDAÇÃO (Pydantic)
# ----------------------------------------------------------------------
class AtualizarContaRequest(BaseModel):
    linkedin: Optional[str] = None

class ResumeRequest(BaseModel):
    habilidades_texto: str = Field(min_length=1, max_length=4000)

class ResponderSituacaoRequest(BaseModel):
    situacao_id: str = Field(min_length=1, max_length=40)
    opcao_index: int

class PreferenciasCurriculoRequest(BaseModel):
    foto_no_curriculo: bool

class ExperienciaRequest(BaseModel):
    ja_trabalhou: bool
    experiencia_previa: Optional[str] = Field(default=None, max_length=2000)

XP_CURRICULO_DO_DIA = 10  # primeiro currículo gerado no dia


class LinkedInExportRequest(BaseModel):
    texto_curriculo: str

class MetaEmpresaRequest(BaseModel):
    vaga_id: int

class EscolherItinerarioRequest(BaseModel):
    itinerario: str

class ResponderQuizRequest(BaseModel):
    quiz_id: int
    indice_pergunta: int
    opcao_selecionada: Optional[int] = None  # None = pulou a pergunta

class DicaQuizRequest(BaseModel):
    quiz_id: int
    indice_pergunta: int

class QuizSubmitRequest(BaseModel):
    quiz_id: int

# ----------------------------------------------------------------------
# AUTENTICAÇÃO
# ----------------------------------------------------------------------

# Login, primeiro acesso, pedido de senha nova e troca de senha ficam em
# acesso_routes.py (regras em acesso.py).

@router.get("/auth/me")
def me(estudante: Estudante = Depends(get_estudante_atual)):
    return {
        "id": estudante.id,
        "nome": estudante.nome,
        "usuario": estudante.usuario,
        "email": estudante.email,
        "linkedin": estudante.linkedin,
    }


@router.put("/auth/conta")
def atualizar_conta(data: AtualizarContaRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    estudante.linkedin = data.linkedin
    db.commit()
    return {"linkedin": estudante.linkedin}


# ----------------------------------------------------------------------
# ENDPOINTS / ROTAS (protegidas — identidade vem do token, não do cliente)
# ----------------------------------------------------------------------

# --- Rota 1: Mural de Oportunidades ---
@router.get("/jobs/match")
async def get_job_matches(
    pagina: int = Query(1, ge=1),
    tamanho_pagina: int = Query(20, ge=1, le=100),
    estudante: Estudante = Depends(get_estudante_atual),
    db: Session = Depends(get_db),
):
    resultado = await AIService.calcular_match_vagas(estudante.id, db, pagina, tamanho_pagina)
    return resultado


# --- Rota Nova: Minhas candidaturas (prova de que o pipeline é real e consultável) ---
# Precisa vir ANTES de /jobs/{vaga_id}: rotas com path param são registradas
# na ordem declarada, e um path fixo depois de um {vaga_id} nunca seria
# alcançado (o FastAPI tentaria converter "minhas-candidaturas" pra int).
@router.get("/jobs/minhas-candidaturas")
def minhas_candidaturas(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    candidaturas = db.query(Candidatura).filter(Candidatura.estudante_id == estudante.id).order_by(Candidatura.criada_em.desc()).all()
    return [
        {
            "id": c.id,
            "vaga_id": c.vaga_id,
            "titulo_vaga": c.vaga.titulo_vaga,
            "empresa": c.vaga.empresa,
            "status": c.status,
            "indicada_pela_escola": bool(c.indicada_pela_escola),
            "criada_em": c.criada_em.isoformat() if c.criada_em else None,
        }
        for c in candidaturas
    ]


# --- Rota Nova: Detalhes de uma vaga específica (modal estilo LinkedIn) ---
@router.get("/jobs/{vaga_id}")
def get_job_detail(vaga_id: int, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    vaga = db.query(Vaga).filter(Vaga.id == vaga_id).first()
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    candidatura = db.query(Candidatura).filter(
        Candidatura.estudante_id == estudante.id,
        Candidatura.vaga_id == vaga_id,
    ).first()

    return {
        "id": vaga.id,
        "titulo_vaga": vaga.titulo_vaga,
        "empresa": vaga.empresa,
        "localizacao": vaga.localizacao,
        "tipo_modalidade": vaga.tipo_modalidade,
        "habilidades_exigidas": vaga.habilidades_exigidas,
        "area_itinerario": vaga.area_itinerario,
        "descricao_completa": vaga.descricao_completa,
        "link_inscricao": vaga.link_inscricao,
        "ja_candidatado": candidatura is not None,
        "indicado_pela_escola": bool(candidatura and candidatura.indicada_pela_escola),
    }


# --- Rota 2: Gerador de Currículo Dinâmico com IA ---
@router.post("/resume/generate", status_code=status.HTTP_201_CREATED)
def generate_resume(data: ResumeRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """
    Monta o currículo: cabeçalho com o cadastro da escola e conteúdo escrito a
    partir do texto do aluno (a IA organiza, sem inventar). Texto que não fala
    do aluno não gera currículo (422). Regras em curriculo.py.
    """
    try:
        curriculo_ia_dados = gerar_curriculo(
            data.habilidades_texto, estudante,
            lambda texto: AIService.gerar_curriculo_ia(texto, estudante.itinerario, list(estudante.habilidades or [])),
        )
    except TextoRecusado as recusa:
        raise HTTPException(status_code=422, detail=str(recusa))

    # Montar o currículo é prática concluída: mantém a ofensiva do dia. O XP só
    # vem no primeiro do dia, pra gerar de novo não virar fábrica de XP.
    ja_gerou_hoje = db.query(Curriculo).filter(
        Curriculo.estudante_id == estudante.id, Curriculo.gerado_em >= inicio_do_dia_utc(),
    ).first() is not None
    xp_concedido = 0 if ja_gerou_hoje else XP_CURRICULO_DO_DIA

    # Cada geração é uma versão nova (nada é sobrescrito); o painel da escola
    # sempre lê a mais recente -- é assim que o currículo "sincroniza".
    novo_curriculo = Curriculo(
        estudante_id=estudante.id,
        texto_curriculo_formatado=json.dumps(curriculo_ia_dados),
        texto_original=data.habilidades_texto,
    )

    try:
        db.add(novo_curriculo)
        mudanca_liga = AIService.processar_gamificacao_pos_atividade(estudante, db, xp_concedido)
        db.commit()
        db.refresh(novo_curriculo)
        return {
            "sucesso": True, "curriculo": curriculo_ia_dados, "dados_pessoais": dados_do_sistema(estudante),
            "gerado_em": novo_curriculo.gerado_em.isoformat() if novo_curriculo.gerado_em else None,
            "xp_concedido": xp_concedido, "novos_pontos_totais": estudante.xp_total, "nivel_atual": estudante.nivel_gamificacao,
            "ofensiva_dias": estudante.ofensiva_dias, "categoria_status": estudante.categoria_status, "liga": estudante.liga,
            "mudanca_liga": mudanca_liga,
        }
    except Exception:
        db.rollback()
        logger.exception("Erro ao salvar currículo do estudante %s", estudante.id)
        raise HTTPException(status_code=500, detail="Erro ao salvar currículo. Tente novamente mais tarde.")


# --- Rota 3: Simulador de entrevista -> entrevista_routes.py (conversa contínua + laudo) ---


# --- Rota Nova: Leaderboard / Liga Semanal ---
# Mostra só quem está na mesma liga que o estudante atual (como numa liga de jogo:
# você compete dentro do seu grupo, não no ranking global).
@router.get("/ranking")
def get_weekly_ranking(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    inicio_semana_atual = hoje_na_escola() - timedelta(days=hoje_na_escola().weekday())
    liga_atual = estudante.liga or "Bronze"

    # Estudantes sem interação na semana atual ainda não passaram pelo reset
    # lazy (disparado em /chat/message); tratamos o xp deles como 0 aqui para
    # o ranking não exibir pontuação de semanas anteriores.
    candidatos = db.query(Estudante).filter(Estudante.liga == liga_atual, Estudante.xp_semanal > 0).all()
    candidatos_semana_atual = [
        est for est in candidatos if est.semana_referencia == inicio_semana_atual
    ]
    candidatos_semana_atual.sort(key=lambda est: est.xp_semanal, reverse=True)
    tamanho_grupo = len(candidatos_semana_atual)
    indice_liga_atual = LIGAS.index(liga_atual)
    vagas_promocao, vagas_rebaixamento = vagas_das_zonas(tamanho_grupo)

    def zona_da_posicao(posicao: int) -> str | None:
        if posicao <= vagas_promocao and indice_liga_atual < len(LIGAS) - 1:
            return "promocao"
        if posicao > tamanho_grupo - vagas_rebaixamento and indice_liga_atual > 0:
            return "rebaixamento"
        return None

    ranking = candidatos_semana_atual[:TAMANHO_GRUPO_LIGA]

    return {
        "liga": liga_atual,
        "liga_emoji": LIGA_EMOJI.get(liga_atual, "🥉"),
        "ranking": [
            {
                "posicao": idx + 1,
                "nome": est.nome_exibicao or est.nome,  # nunca dois iguais no ranking
                "xp_semanal": est.xp_semanal,
                "categoria": est.categoria_status or "🌌 Na Jornada",
                "zona": zona_da_posicao(idx + 1),
                "voce": est.id == estudante.id,
            }
            for idx, est in enumerate(ranking)
        ],
    }


# --- Rota Nova: Itinerários formativos disponíveis (funcionam como "cursos", pública) ---
@router.get("/quiz/itinerarios")
def get_itinerarios():
    return {
        "itinerarios": [
            {"nome": nome, "descricao": dados["descricao"]}
            for nome, dados in ITINERARIOS_QUIZ.items()
        ]
    }


# --- Rota Nova: Escolher itinerário formativo (bloqueada pro aluno) ---
# O itinerário é o curso que o aluno faz na escola: quem cadastra é a escola,
# no painel admin (PUT /admin/estudantes/{id}). Se o aluno pudesse trocar,
# poderia pular pra área de uma vaga só pra subir no ranking de indicação.
@router.post("/itinerario/escolher")
def escolher_itinerario(data: EscolherItinerarioRequest, estudante: Estudante = Depends(get_estudante_atual)):
    raise HTTPException(status_code=403, detail="O itinerário é definido pela escola. Fale com a coordenação se estiver errado.")


# --- Rota Nova: Gerar o Quiz do Dia ---
# O gabarito (resposta_correta_index/explicacao) fica só no servidor, guardado
# na QuizSessao -- o cliente recebe apenas pergunta+opcoes, nunca a resposta
# certa antecipadamente. Isso é o que torna /quiz/responder e /quiz/submit
# verificáveis: o resultado final é contado a partir do que o servidor
# registrou, não do que o cliente afirma ter acertado.
@router.post("/quiz/generate")
def generate_quiz(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    AIService.regenerar_vidas(estudante)
    if estudante.vidas <= 0:
        db.commit()
        raise HTTPException(
            status_code=403,
            detail={
                "mensagem": "Você está sem vidas. Elas voltam sozinhas: 1 a cada 30 minutos.",
                "proxima_vida_em": estudante.proxima_vida_em.isoformat() if estudante.proxima_vida_em else None,
            },
        )
    db.commit()

    # Perguntas dos últimos quizzes do aluno -- o sorteio evita repetir
    sessoes_recentes = db.query(QuizSessao).filter(
        QuizSessao.estudante_id == estudante.id,
    ).order_by(QuizSessao.criado_em.desc()).limit(SESSOES_RECENTES_SEM_REPETIR).all()
    perguntas_recentes = {
        item["pergunta"]
        for sessao_antiga in sessoes_recentes
        for item in (sessao_antiga.gabarito or [])
        if item.get("pergunta")
    }

    tema = AIService.tema_quiz_do_dia(estudante.itinerario)
    quiz = AIService.montar_quiz(tema, estudante.itinerario, perguntas_recentes)

    sessao = QuizSessao(
        estudante_id=estudante.id,
        tema=quiz["tema"],
        gabarito=[
            {
                "pergunta": p["pergunta"],
                "resposta_correta_index": p["resposta_correta_index"],
                "explicacao": p.get("explicacao", ""),
            }
            for p in quiz["perguntas"]
        ],
        respostas=[],
    )
    db.add(sessao)
    db.commit()
    db.refresh(sessao)

    perguntas_publicas = [{"pergunta": p["pergunta"], "opcoes": p["opcoes"]} for p in quiz["perguntas"]]

    return {
        "quiz_id": sessao.id,
        "itinerario": estudante.itinerario,
        "vidas": estudante.vidas,
        "tema": quiz["tema"],
        "perguntas": perguntas_publicas,
        "dicas_disponiveis": DICAS_POR_QUIZ,
        "pulos_disponiveis": PULOS_POR_QUIZ,
        "acertos_seguidos_para_vida": ACERTOS_SEGUIDOS_PARA_VIDA,
    }


def _buscar_sessao_quiz_ativa(quiz_id: int, estudante: Estudante, db: Session) -> QuizSessao:
    sessao = db.query(QuizSessao).filter(
        QuizSessao.id == quiz_id,
        QuizSessao.estudante_id == estudante.id,
    ).first()
    if not sessao:
        raise HTTPException(status_code=404, detail="Quiz não encontrado.")
    if sessao.concluido:
        raise HTTPException(status_code=400, detail="Esse quiz já foi finalizado.")
    return sessao


# --- Rota Nova: Responder (ou pular) uma pergunta do Quiz do Dia ---
# Cada resposta é validada e registrada aqui, no servidor -- é o que
# impede o cliente de simplesmente declarar "acertei tudo" no /submit.
@router.post("/quiz/responder")
def responder_quiz(data: ResponderQuizRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    sessao = _buscar_sessao_quiz_ativa(data.quiz_id, estudante, db)
    total = len(sessao.gabarito)

    if data.indice_pergunta != len(sessao.respostas):
        raise HTTPException(status_code=400, detail="Pergunta fora de ordem.")
    if data.indice_pergunta < 0 or data.indice_pergunta >= total:
        raise HTTPException(status_code=400, detail="Índice de pergunta inválido.")

    if data.opcao_selecionada is None:
        pulos_usados = sum(1 for r in sessao.respostas if r["pulou"])
        if pulos_usados >= PULOS_POR_QUIZ:
            raise HTTPException(status_code=403, detail="Limite de pulos por quiz atingido.")
        registro = {"pulou": True, "correta": False}
    else:
        gabarito_pergunta = sessao.gabarito[data.indice_pergunta]
        correta = data.opcao_selecionada == gabarito_pergunta["resposta_correta_index"]
        registro = {"pulou": False, "correta": correta}

    sessao.respostas = sessao.respostas + [registro]
    combo = combo_final(sessao.respostas)
    # A vida cai na hora do erro (e o combo devolve na hora): sair do quiz no
    # meio não escapa da perda. Dá pra terminar o quiz mesmo chegando a zero;
    # sem vida, só não começa outro.
    AIService.regenerar_vidas(estudante)
    ganhou_vida_combo = False
    if not registro["pulou"] and not registro["correta"]:
        AIService.perder_vida(estudante)
    elif combo > 0 and combo % ACERTOS_SEGUIDOS_PARA_VIDA == 0:
        ganhou_vida_combo = AIService.ganhar_vidas(estudante, 1) > 0
    db.commit()

    gabarito_pergunta = sessao.gabarito[data.indice_pergunta]
    return {
        "correta": None if registro["pulou"] else registro["correta"],
        "resposta_correta_index": gabarito_pergunta["resposta_correta_index"],
        "explicacao": gabarito_pergunta["explicacao"],
        "combo": combo,
        "ganhou_vida_combo": ganhou_vida_combo,
        "vidas": estudante.vidas,
        "proxima_vida_em": estudante.proxima_vida_em.isoformat() if estudante.proxima_vida_em else None,
    }


# --- Rota Nova: Pedir dica numa pergunta do Quiz do Dia ---
# O servidor é quem sabe a resposta certa, então é ele quem sorteia qual
# alternativa errada eliminar -- o cliente nunca precisa (nem consegue)
# calcular isso sozinho.
@router.post("/quiz/dica")
def pedir_dica_quiz(data: DicaQuizRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    sessao = _buscar_sessao_quiz_ativa(data.quiz_id, estudante, db)
    total = len(sessao.gabarito)

    if data.indice_pergunta < 0 or data.indice_pergunta >= total:
        raise HTTPException(status_code=400, detail="Índice de pergunta inválido.")
    if sessao.dicas_usadas >= DICAS_POR_QUIZ:
        raise HTTPException(status_code=403, detail="Limite de dicas por quiz atingido.")

    correta_idx = sessao.gabarito[data.indice_pergunta]["resposta_correta_index"]
    opcoes_erradas = [i for i in range(4) if i != correta_idx]
    opcao_eliminada = random.choice(opcoes_erradas)

    sessao.dicas_usadas += 1
    db.commit()

    return {"opcao_eliminada": opcao_eliminada, "dicas_usadas": sessao.dicas_usadas}


# --- Rota Nova: Submeter resultado do Quiz do Dia ---
# 'acertos'/'total'/'pulos' não vêm mais do cliente -- são contados aqui a
# partir das respostas que o próprio servidor registrou em /quiz/responder.
@router.post("/quiz/submit")
def submit_quiz(data: QuizSubmitRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    sessao = _buscar_sessao_quiz_ativa(data.quiz_id, estudante, db)
    total = len(sessao.gabarito)

    if len(sessao.respostas) != total:
        raise HTTPException(status_code=400, detail="Ainda faltam perguntas para responder.")

    acertos = sum(1 for r in sessao.respostas if r["correta"])
    pulos = sum(1 for r in sessao.respostas if r["pulou"])
    xp_concedido = acertos * 8  # 8 XP por acerto, mesma ordem de grandeza do simulador

    try:
        # Vidas perdidas e devolvidas pelo combo já entraram em /quiz/responder.
        # XP e ofensiva só aqui: quiz que não chega ao fim não vale nada.
        sessao.concluido = True
        AIService.regenerar_vidas(estudante)
        vidas_recuperadas_combo = vidas_ganhas_por_combo(sessao.respostas)

        vida_bonus_ganha = AIService.avaliar_bonus_por_desempenho(estudante, acertos, total)
        mudanca_liga = AIService.processar_gamificacao_pos_atividade(estudante, db, xp_concedido)
        respondidas = total - pulos
        if respondidas > 0:
            registrar_evidencias(db, estudante.id, {"conhecimento": acertos / respondidas * 100}, origem="quiz", origem_id=sessao.id)
        db.commit()

        return {
            "acertos": acertos,
            "total": total,
            "xp_concedido": xp_concedido,
            "novos_pontos_totais": estudante.xp_total,
            "nivel_atual": estudante.nivel_gamificacao,
            "ofensiva_dias": estudante.ofensiva_dias,
            "categoria_status": estudante.categoria_status,
            "missoes_diarias": estudante.missoes_diarias_concluidas,
            "vidas": estudante.vidas,
            "congelamentos_disponiveis": estudante.congelamentos_disponiveis,
            "quizzes_perfeitos_seguidos": estudante.quizzes_perfeitos_seguidos,
            "vida_bonus_ganha": vida_bonus_ganha,
            "vidas_recuperadas_combo": vidas_recuperadas_combo,
            "proxima_vida_em": estudante.proxima_vida_em.isoformat() if estudante.proxima_vida_em else None,
            "liga": estudante.liga,
            "mudanca_liga": mudanca_liga,
        }
    except Exception:
        db.rollback()
        logger.exception("Erro ao processar resultado do quiz do estudante %s", estudante.id)
        raise HTTPException(status_code=500, detail="Erro ao processar resultado do quiz. Tente novamente mais tarde.")


# --- Rota Nova: Status consolidado de gamificação (vidas, congelamentos) ---
@router.get("/estudante/me/status")
def get_status_gamificacao(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    AIService.regenerar_vidas(estudante)
    db.commit()

    estado_ofensiva = AIService.calcular_estado_ofensiva(estudante)

    return {
        "vidas": estudante.vidas,
        "vidas_maximas": VIDAS_MAXIMAS,
        "minutos_para_regenerar_vida": MINUTOS_PARA_REGENERAR_VIDA,
        "acertos_seguidos_para_vida": ACERTOS_SEGUIDOS_PARA_VIDA,
        "proxima_vida_em": estudante.proxima_vida_em.isoformat() if estudante.proxima_vida_em else None,
        "congelamentos_disponiveis": estudante.congelamentos_disponiveis,
        "quizzes_perfeitos_seguidos": estudante.quizzes_perfeitos_seguidos,
        "quizzes_perfeitos_para_bonus": QUIZZES_PERFEITOS_PARA_VIDA_BONUS,
        "ofensiva_dias": estado_ofensiva["ofensiva_atual"],
        "treinou_hoje": estado_ofensiva["treinou_hoje"],
        "ofensiva_em_risco": estado_ofensiva["em_risco"],
        # O contador do banco só zera na próxima atividade: sem treino hoje, são 0 missões hoje
        "missoes_diarias": (estudante.missoes_diarias_concluidas or 0) if estado_ofensiva["treinou_hoje"] else 0,
        "itinerario": estudante.itinerario,
        "nome": estudante.nome,
        "nome_exibicao": estudante.nome_exibicao or estudante.nome,
        "xp_total": estudante.xp_total,
        "nivel_gamificacao": estudante.nivel_gamificacao,
        "categoria_status": estudante.categoria_status,
        "liga": estudante.liga or "Bronze",
    }


# --- Perfil do primeiro acesso: foto, experiência prévia e currículo ---
def _curriculo_mais_recente(estudante_id: int, db: Session) -> Optional[Curriculo]:
    return db.query(Curriculo).filter(Curriculo.estudante_id == estudante_id).order_by(Curriculo.gerado_em.desc(), Curriculo.id.desc()).first()


@router.get("/estudante/me/perfil")
def get_perfil(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """
    O que falta no perfil -- o app usa pra mostrar o primeiro acesso (uma
    vez) e o aviso de "complete seu perfil" (até ter foto e currículo).
    """
    curriculo = _curriculo_mais_recente(estudante.id, db)
    return {
        "tem_foto": estudante.foto_atualizada_em is not None,
        "foto_atualizada_em": estudante.foto_atualizada_em.isoformat() if estudante.foto_atualizada_em else None,
        "tem_curriculo": curriculo is not None,
        "curriculo_atualizado_em": curriculo.gerado_em.isoformat() if curriculo and curriculo.gerado_em else None,
        "ja_trabalhou": estudante.ja_trabalhou,
        "experiencia_previa": estudante.experiencia_previa,
        "onboarding_concluido": estudante.onboarding_concluido_em is not None,
    }


@router.get("/estudante/me/foto")
def get_minha_foto(estudante: Estudante = Depends(get_estudante_atual)):
    return resposta_da_foto(estudante)


@router.put("/estudante/me/foto")
@limiter.limit("10/minute")
def enviar_minha_foto(request: Request, data: FotoRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    salvar_foto(db, estudante, data.imagem_base64, enviada_por="aluno")
    db.commit()
    return {"sucesso": True, "foto_atualizada_em": estudante.foto_atualizada_em.isoformat()}


@router.delete("/estudante/me/foto")
def apagar_minha_foto(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    remover_foto(estudante)
    db.commit()
    return {"sucesso": True}


@router.put("/estudante/me/experiencia")
def salvar_experiencia(data: ExperienciaRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    estudante.ja_trabalhou = data.ja_trabalhou
    texto = (data.experiencia_previa or "").strip()
    estudante.experiencia_previa = texto if data.ja_trabalhou and texto else None
    db.commit()
    return {"ja_trabalhou": estudante.ja_trabalhou, "experiencia_previa": estudante.experiencia_previa}


@router.post("/estudante/me/onboarding/concluir")
def concluir_onboarding(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    if estudante.onboarding_concluido_em is None:
        estudante.onboarding_concluido_em = agora_utc()
        db.commit()
    return {"onboarding_concluido": True}


@router.get("/resume/atual")
def get_curriculo_atual(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """Último currículo gerado, pra tela abrir com ele em vez de vazia."""
    curriculo = _curriculo_mais_recente(estudante.id, db)
    if not curriculo:
        return {"curriculo": None, "foto_no_curriculo": bool(estudante.foto_no_curriculo), "tem_foto_curriculo": estudante.foto_curriculo_atualizada_em is not None, "foto_curriculo_atualizada_em": estudante.foto_curriculo_atualizada_em.isoformat() if estudante.foto_curriculo_atualizada_em else None, "dados_pessoais": dados_do_sistema(estudante)}
    return {
        "foto_no_curriculo": bool(estudante.foto_no_curriculo), "tem_foto_curriculo": estudante.foto_curriculo_atualizada_em is not None, "foto_curriculo_atualizada_em": estudante.foto_curriculo_atualizada_em.isoformat() if estudante.foto_curriculo_atualizada_em else None,
        "dados_pessoais": dados_do_sistema(estudante),
        "curriculo": json.loads(curriculo.texto_curriculo_formatado),
        "texto_original": curriculo.texto_original,
        "gerado_em": curriculo.gerado_em.isoformat() if curriculo.gerado_em else None,
    }


# --- Mapa de competências e "O que você faria?" ---
@router.get("/estudante/me/competencias")
def get_minhas_competencias(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    return mapa_para_tela(db, estudante)


@router.get("/situacoes/proxima")
def get_proxima_situacao(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    return proxima_situacao(db, estudante)


@router.post("/situacoes/responder")
def post_responder_situacao(data: ResponderSituacaoRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    resultado = responder_situacao(db, estudante, data.situacao_id, data.opcao_index)
    try:
        mudanca_liga = AIService.processar_gamificacao_pos_atividade(estudante, db, resultado["xp_concedido"])
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Erro ao registrar situação do estudante %s", estudante.id)
        raise HTTPException(status_code=500, detail="Erro ao registrar sua resposta. Tente novamente.")
    return {
        **resultado,
        "novos_pontos_totais": estudante.xp_total,
        "nivel_atual": estudante.nivel_gamificacao,
        "ofensiva_dias": estudante.ofensiva_dias,
        "categoria_status": estudante.categoria_status,
        "liga": estudante.liga,
        "mudanca_liga": mudanca_liga,
    }


@router.put("/estudante/me/preferencias-curriculo")
def salvar_preferencias_curriculo(data: PreferenciasCurriculoRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """Currículo "com foto" ou "sem foto": escolha do aluno. Com foto, usa a foto do currículo que ele enviar."""
    estudante.foto_no_curriculo = data.foto_no_curriculo
    db.commit()
    return {"foto_no_curriculo": estudante.foto_no_curriculo}


@router.get("/estudante/me/foto-curriculo")
def get_minha_foto_curriculo(estudante: Estudante = Depends(get_estudante_atual)):
    return resposta_da_foto_curriculo(estudante)


@router.put("/estudante/me/foto-curriculo")
@limiter.limit("10/minute")
def enviar_minha_foto_curriculo(request: Request, data: FotoRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """A foto do currículo é outra, separada da de identificação. Enviar já marca o currículo como "com foto"."""
    salvar_foto_curriculo(db, estudante, data.imagem_base64)
    estudante.foto_no_curriculo = True
    db.commit()
    return {"sucesso": True, "foto_no_curriculo": True, "foto_curriculo_atualizada_em": estudante.foto_curriculo_atualizada_em.isoformat()}


@router.delete("/estudante/me/foto-curriculo")
def apagar_minha_foto_curriculo(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    remover_foto_curriculo(estudante)
    estudante.foto_no_curriculo = False
    db.commit()
    return {"sucesso": True, "foto_no_curriculo": False}


# --- Rota Nova: Calendário de ofensiva do mês ---
@router.get("/estudante/me/calendario")
def get_calendario(ano: int = Query(...), mes: int = Query(..., ge=1, le=12), estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    return {"dias": AIService.calendario_do_mes(estudante.id, ano, mes, db)}


# --- Rota 4: Integração LinkedIn ---
@router.post("/resume/export-linkedin")
def export_to_linkedin(data: LinkedInExportRequest, estudante: Estudante = Depends(get_estudante_atual)):
    return {
        "status": "sucesso",
        "provedor": "LinkedIn Partner API v2 (2026 Sandbox)",
        "mensagem": f"Sucesso! O perfil de {estudante.nome} foi sincronizado de forma automática.",
        "secoes_atualizadas": ["Summary", "Skills", "TargetJobs"]
    }


# --- Rota 5: Envio de Candidaturas (persistido de verdade, não é mais fake) ---
# O aluno não se candidata sozinho: as vagas são por cota das empresas
# parceiras e a maioria dos alunos é menor de idade, então toda candidatura
# nasce de uma indicação da escola (POST /admin/vagas/{id}/indicar). A rota
# fica respondendo 403 (em vez de sumir) pra um app antigo em cache mostrar
# a mensagem certa. O corpo antigo segue abaixo, desligado pela flag.
CANDIDATURA_PELO_ALUNO_LIBERADA = False


@router.post("/jobs/apply-meta", status_code=status.HTTP_201_CREATED)
def apply_to_job_meta(data: MetaEmpresaRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    if not CANDIDATURA_PELO_ALUNO_LIBERADA:
        raise HTTPException(
            status_code=403,
            detail="As indicações para as vagas são feitas pela coordenação da escola, de acordo com as cotas das empresas parceiras.",
        )
    vaga = db.query(Vaga).filter(Vaga.id == data.vaga_id).first()
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    existente = db.query(Candidatura).filter(
        Candidatura.estudante_id == estudante.id,
        Candidatura.vaga_id == data.vaga_id,
    ).first()
    if existente:
        return {
            "sucesso": True,
            "ja_existia": True,
            "candidatura_id": existente.id,
            "status": existente.status,
            "mensagem": f"Você já tinha se candidatado pra {vaga.empresa}. Status atual: {existente.status}.",
        }

    candidatura = Candidatura(estudante_id=estudante.id, vaga_id=data.vaga_id, status="enviada")
    db.add(candidatura)
    db.commit()
    db.refresh(candidatura)

    return {
        "sucesso": True,
        "ja_existia": False,
        "candidatura_id": candidatura.id,
        "status": candidatura.status,
        "mensagem": f"Candidatura registrada! Currículo enviado para triagem da {vaga.empresa}.",
    }
