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
from services import AIService

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

    resultado_ia = AIService.processar_entrevista_ia(data.mensagem_usuario, historico_texto)
    
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

        AIService.atualizar_ofensiva_duolingo(estudante, db)
        AIService.resetar_xp_semanal_se_necessario(estudante)

        # 🌟 CORRIGIDO: Modificado de '.pontos' para '.xp_total' para bater com o models.py
        estudante.xp_total += xp_concedido
        estudante.xp_semanal += xp_concedido
        
        # 🌟 CORRIGIDO: Modificado de '.pontos' para '.xp_total' no cálculo de level up
        if  estudante.xp_total >= 300 * estudante.nivel_gamificacao:
            estudante.nivel_gamificacao += 1 

        # 🌟 CORRIGIDO: Modificado de '.pontos' para '.xp_total' no cálculo da liga/status
        estudante.categoria_status = AIService.calcular_categoria_status(estudante.xp_total)

        db.commit()

        return {
            "feedback_ia": feedback_gerado,
            "resposta_ia": proxima_pergunta,
            "xp_concedido": xp_concedido,
            "novos_pontos_totais": estudante.xp_total, # Retorna o xp_total correto
            "nivel_atual": estudante.nivel_gamificacao,
            "ofensiva_dias": estudante.ofensiva_dias,
            "categoria_status": estudante.categoria_status,
            "missoes_diarias": estudante.missoes_diarias_concluidas
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