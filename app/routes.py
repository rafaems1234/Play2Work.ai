import json
import logging
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

# Importações do ecossistema do projeto
from models import Estudante, Vaga, HistoricoEntrevista, Curriculo
from database import get_db
from services import AIService, ITINERARIOS_QUIZ, VIDAS_MAXIMAS

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Play2Work.AI - Endpoints"]
)

# ----------------------------------------------------------------------
# SCHEMAS DE VALIDAÇÃO (Pydantic)
# ----------------------------------------------------------------------
class ResumeRequest(BaseModel):
    estudante_id: int
    habilidades_texto: str

class ChatMessageRequest(BaseModel):
    estudante_id: int
    mensagem_usuario: str

class LinkedInExportRequest(BaseModel):
    estudante_id: int
    texto_curriculo: str

class MetaEmpresaRequest(BaseModel):
    estudante_id: int
    vaga_id: int

class QuizGenerateRequest(BaseModel):
    estudante_id: int
    itinerario: Optional[str] = None

class QuizSubmitRequest(BaseModel):
    estudante_id: int
    tema: str
    acertos: int
    total: int

# ----------------------------------------------------------------------
# ENDPOINTS / ROTAS
# ----------------------------------------------------------------------

# --- Rota 1: Mural de Oportunidades ---
@router.get("/jobs/match/{estudante_id}")
async def get_job_matches(
    estudante_id: int,
    pagina: int = Query(1, ge=1),
    tamanho_pagina: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")

    resultado = await AIService.calcular_match_vagas(estudante_id, db, pagina, tamanho_pagina)
    return resultado


# --- Rota 2: Gerador de Currículo Dinâmico com IA ---
@router.post("/resume/generate", status_code=status.HTTP_201_CREATED)
def generate_resume(data: ResumeRequest, db: Session = Depends(get_db)):
    """
    Envia o texto informal do aluno para o Gemini estruturar um currículo profissional real.
    """
    estudante = db.query(Estudante).filter(Estudante.id == data.estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")

    curriculo_ia_dados = AIService.gerar_curriculo_ia(data.habilidades_texto, estudante.nome)

    novo_curriculo = Curriculo(
        estudante_id=data.estudante_id,
        texto_curriculo_formatado=json.dumps(curriculo_ia_dados)
    )
    
    try:
        db.add(novo_curriculo)
        db.commit()
        return {"sucesso": True, "curriculo": curriculo_ia_dados}
    except Exception:
        db.rollback()
        logger.exception("Erro ao salvar currículo do estudante %s", data.estudante_id)
        raise HTTPException(status_code=500, detail="Erro ao salvar currículo. Tente novamente mais tarde.")


# --- Rota 3: Simulador de Entrevistas Inteligente ---
@router.post("/chat/message")
def chat_interview(data: ChatMessageRequest, db: Session = Depends(get_db)):
    """
    Processa o chat avaliando a resposta do usuário.
    """
    estudante = db.query(Estudante).filter(Estudante.id == data.estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")

    historico = db.query(HistoricoEntrevista).filter(
        HistoricoEntrevista.estudante_id == data.estudante_id
    ).order_by(HistoricoEntrevista.enviado_em.desc()).limit(4).all()
    
    historico_texto = " ".join([f"{m.remetente}: {m.mensagem}" for m in reversed(historico)])

    resultado_ia = AIService.processar_entrevista_ia(data.mensagem_usuario, historico_texto, estudante.itinerario)
    
    feedback_gerado = resultado_ia.get("analise_feedback")
    xp_concedido = resultado_ia.get("xp_concedido", 0)
    proxima_pergunta = resultado_ia.get("proxima_pergunta")

    try:
        msg_usuario = HistoricoEntrevista(
            estudante_id=data.estudante_id,
            remetente="user",
            mensagem=data.mensagem_usuario,
            feedback_ia=feedback_gerado
        )
        db.add(msg_usuario)

        msg_ia = HistoricoEntrevista(
            estudante_id=data.estudante_id,
            remetente="ai",
            mensagem=proxima_pergunta
        )
        db.add(msg_ia)

        AIService.processar_gamificacao_pos_atividade(estudante, db, xp_concedido)
        db.commit()

        return {
            "feedback_ia": feedback_gerado,
            "resposta_ia": proxima_pergunta,
            "xp_concedido": xp_concedido,
            "novos_pontos_totais": estudante.xp_total, # Retorna o xp_total correto
            "nivel_atual": estudante.nivel_gamificacao,
            "ofensiva_dias": estudante.ofensiva_dias,
            "categoria_status": estudante.categoria_status,
            "missoes_diarias": estudante.missoes_diarias_concluidas,
            "moedas": estudante.moedas,
        }
    except Exception:
        db.rollback()
        logger.exception("Erro no processamento do chat do estudante %s", data.estudante_id)
        raise HTTPException(status_code=500, detail="Erro no processamento do chat. Tente novamente mais tarde.")


# --- Rota Nova: Leaderboard / Ranking Semanal ---
@router.get("/ranking")
def get_weekly_ranking(db: Session = Depends(get_db)):
    inicio_semana_atual = date.today() - timedelta(days=date.today().weekday())

    # Estudantes sem interação na semana atual ainda não passaram pelo reset
    # lazy (disparado em /chat/message); tratamos o xp deles como 0 aqui para
    # o ranking não exibir pontuação de semanas anteriores.
    candidatos = db.query(Estudante).filter(Estudante.xp_semanal > 0).all()
    candidatos_semana_atual = [
        est for est in candidatos if est.semana_referencia == inicio_semana_atual
    ]
    candidatos_semana_atual.sort(key=lambda est: est.xp_semanal, reverse=True)
    ranking = candidatos_semana_atual[:10]

    return [
        {
            "posicao": idx + 1,
            "nome": est.nome,
            "xp_semanal": est.xp_semanal,
            "categoria": est.categoria_status or "🌌 Na Jornada"
        }
        for idx, est in enumerate(ranking)
    ]


# --- Rota Nova: Itinerários formativos disponíveis ---
@router.get("/quiz/itinerarios")
def get_itinerarios():
    return {"itinerarios": list(ITINERARIOS_QUIZ.keys())}


# --- Rota Nova: Gerar o Quiz do Dia ---
@router.post("/quiz/generate")
def generate_quiz(data: QuizGenerateRequest, db: Session = Depends(get_db)):
    estudante = db.query(Estudante).filter(Estudante.id == data.estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")

    # Se o estudante escolheu (ou trocou) o itinerário agora, persiste a escolha
    if data.itinerario and data.itinerario != estudante.itinerario:
        if data.itinerario not in ITINERARIOS_QUIZ:
            raise HTTPException(status_code=400, detail="Itinerário inválido")
        estudante.itinerario = data.itinerario
        db.commit()

    AIService.regenerar_vidas(estudante)
    if estudante.vidas <= 0:
        db.commit()
        raise HTTPException(
            status_code=403,
            detail={
                "mensagem": "Você está sem vidas. Espere regenerar ou compre com moedas.",
                "proxima_vida_em": estudante.proxima_vida_em.isoformat() if estudante.proxima_vida_em else None,
            },
        )
    db.commit()

    tema = AIService.tema_quiz_do_dia(estudante.itinerario)
    quiz = AIService.gerar_quiz_ia(tema, estudante.itinerario)

    return {"itinerario": estudante.itinerario, "vidas": estudante.vidas, **quiz}


# --- Rota Nova: Submeter resultado do Quiz do Dia ---
@router.post("/quiz/submit")
def submit_quiz(data: QuizSubmitRequest, db: Session = Depends(get_db)):
    estudante = db.query(Estudante).filter(Estudante.id == data.estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")

    acertos = max(0, min(data.acertos, data.total))
    erros = data.total - acertos
    xp_concedido = acertos * 8  # 8 XP por acerto, mesma ordem de grandeza do simulador

    try:
        AIService.regenerar_vidas(estudante)
        for _ in range(erros):
            AIService.perder_vida(estudante)

        AIService.processar_gamificacao_pos_atividade(estudante, db, xp_concedido)
        db.commit()

        return {
            "acertos": acertos,
            "total": data.total,
            "xp_concedido": xp_concedido,
            "novos_pontos_totais": estudante.xp_total,
            "nivel_atual": estudante.nivel_gamificacao,
            "ofensiva_dias": estudante.ofensiva_dias,
            "categoria_status": estudante.categoria_status,
            "missoes_diarias": estudante.missoes_diarias_concluidas,
            "vidas": estudante.vidas,
            "moedas": estudante.moedas,
            "congelamentos_disponiveis": estudante.congelamentos_disponiveis,
        }
    except Exception:
        db.rollback()
        logger.exception("Erro ao processar resultado do quiz do estudante %s", data.estudante_id)
        raise HTTPException(status_code=500, detail="Erro ao processar resultado do quiz. Tente novamente mais tarde.")


# --- Rota Nova: Status consolidado de gamificação (vidas, moedas, congelamentos) ---
@router.get("/estudante/{estudante_id}/status")
def get_status_gamificacao(estudante_id: int, db: Session = Depends(get_db)):
    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")

    AIService.regenerar_vidas(estudante)
    db.commit()

    return {
        "vidas": estudante.vidas,
        "vidas_maximas": VIDAS_MAXIMAS,
        "proxima_vida_em": estudante.proxima_vida_em.isoformat() if estudante.proxima_vida_em else None,
        "moedas": estudante.moedas,
        "congelamentos_disponiveis": estudante.congelamentos_disponiveis,
        "ofensiva_dias": estudante.ofensiva_dias,
        "itinerario": estudante.itinerario,
    }


# --- Rota Nova: Calendário de ofensiva do mês ---
@router.get("/estudante/{estudante_id}/calendario")
def get_calendario(estudante_id: int, ano: int = Query(...), mes: int = Query(..., ge=1, le=12), db: Session = Depends(get_db)):
    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")

    return {"dias": AIService.calendario_do_mes(estudante_id, ano, mes, db)}


# --- Rota Nova: Comprar 1 vida com moedas ---
@router.post("/vidas/comprar")
def comprar_vida(data: QuizGenerateRequest, db: Session = Depends(get_db)):
    estudante = db.query(Estudante).filter(Estudante.id == data.estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")

    resultado = AIService.comprar_vida(estudante)
    if not resultado["sucesso"]:
        db.commit()
        raise HTTPException(status_code=400, detail=resultado["motivo"])

    db.commit()
    return {
        "sucesso": True,
        "vidas": estudante.vidas,
        "moedas": estudante.moedas,
    }


# --- Rota 4: Integração LinkedIn ---
@router.post("/resume/export-linkedin")
def export_to_linkedin(data: LinkedInExportRequest, db: Session = Depends(get_db)):
    estudante = db.query(Estudante).filter(Estudante.id == data.estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")

    return {
        "status": "sucesso",
        "provedor": "LinkedIn Partner API v2 (2026 Sandbox)",
        "mensagem": f"Sucesso! O perfil de {estudante.nome} foi sincronizado de forma automática.",
        "secoes_atualizadas": ["Summary", "Skills", "TargetJobs"]
    }


# --- Rota 5: Envio de Candidaturas ---
@router.post("/jobs/apply-meta")
def apply_to_job_meta(data: MetaEmpresaRequest, db: Session = Depends(get_db)):
    estudante = db.query(Estudante).filter(Estudante.id == data.estudante_id).first()
    vaga = db.query(Vaga).filter(Vaga.id == data.vaga_id).first()
    
    if not estudante or not vaga:
        raise HTTPException(status_code=404, detail="Estudante ou Vaga não mapeados na base")

    return {
        "sucesso": True,
        "transacao_id": f"tx_meta_{vaga.empresa.lower().replace(' ', '_')}_2026",
        "mensagem": f"Meta concluída! Currículo enviado para triagem da {vaga.empresa}."
    }