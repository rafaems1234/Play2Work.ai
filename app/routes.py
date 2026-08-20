import json
import logging
import random
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

# Importações do ecossistema do projeto
from models import Estudante, Vaga, HistoricoEntrevista, Curriculo, Candidatura, QuizSessao
from database import get_db
from services import (
    AIService,
    ITINERARIOS_QUIZ,
    VIDAS_MAXIMAS,
    QUIZZES_PERFEITOS_PARA_VIDA_BONUS,
    DICAS_POR_QUIZ,
    PULOS_POR_QUIZ,
)
from auth import hash_senha, verificar_senha, criar_token, get_estudante_atual, gerar_senha_temporaria
from limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Play2Work.AI - Endpoints"]
)

# ----------------------------------------------------------------------
# SCHEMAS DE VALIDAÇÃO (Pydantic)
# ----------------------------------------------------------------------
class RegistroRequest(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    email: EmailStr
    linkedin: Optional[str] = None
    senha: str = Field(min_length=6, max_length=100)
    pergunta_seguranca: str = Field(min_length=4, max_length=200)
    resposta_seguranca: str = Field(min_length=2, max_length=200)

class LoginRequest(BaseModel):
    nome: str
    senha: str

class PerguntaSegurancaRequest(BaseModel):
    email: EmailStr

class ResetarSenhaRequest(BaseModel):
    email: EmailStr
    resposta_seguranca: str

class TrocarSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str = Field(min_length=6, max_length=100)

class AtualizarContaRequest(BaseModel):
    linkedin: Optional[str] = None

class ResumeRequest(BaseModel):
    habilidades_texto: str

class ChatMessageRequest(BaseModel):
    mensagem_usuario: str

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

def _normalizar_resposta(resposta: str) -> str:
    """Uniformiza a resposta de segurança (case/espaços) pra não travar por causa de maiúscula."""
    return resposta.strip().lower()


@router.post("/auth/registrar", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def registrar(request: Request, data: RegistroRequest, db: Session = Depends(get_db)):
    if db.query(Estudante).filter(Estudante.email == data.email).first():
        raise HTTPException(status_code=409, detail="Já existe uma conta com esse e-mail")

    # Nome de login não é único de propósito: pode existir mais de um "João Silva".
    # O que desempata na hora de entrar é a senha (ver /auth/login).
    novo_estudante = Estudante(
        nome=data.nome,
        email=data.email,
        linkedin=data.linkedin,
        senha_hash=hash_senha(data.senha),
        pergunta_seguranca=data.pergunta_seguranca,
        resposta_seguranca_hash=hash_senha(_normalizar_resposta(data.resposta_seguranca)),
        habilidades=[],
    )
    db.add(novo_estudante)
    db.commit()
    db.refresh(novo_estudante)

    token = criar_token(novo_estudante.id)
    return {"token": token, "estudante": {"id": novo_estudante.id, "nome": novo_estudante.nome, "email": novo_estudante.email}}


@router.post("/auth/login")
@limiter.limit("15/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    # O nome de login não é único -- se houver mais de uma conta com o mesmo
    # nome, quem desempata é a senha: testamos contra cada uma até achar a
    # que bate.
    candidatos = db.query(Estudante).filter(Estudante.nome == data.nome).all()
    estudante = next(
        (c for c in candidatos if c.senha_hash and verificar_senha(data.senha, c.senha_hash)),
        None,
    )
    if not estudante:
        raise HTTPException(status_code=401, detail="Nome ou senha incorretos")

    token = criar_token(estudante.id)
    return {
        "token": token,
        "estudante": {"id": estudante.id, "nome": estudante.nome, "email": estudante.email},
        "deve_trocar_senha": bool(estudante.precisa_trocar_senha),
    }


@router.get("/auth/me")
def me(estudante: Estudante = Depends(get_estudante_atual)):
    return {
        "id": estudante.id,
        "nome": estudante.nome,
        "email": estudante.email,
        "linkedin": estudante.linkedin,
        "deve_trocar_senha": bool(estudante.precisa_trocar_senha),
    }


@router.post("/auth/pergunta-seguranca")
@limiter.limit("10/minute")
def buscar_pergunta_seguranca(request: Request, data: PerguntaSegurancaRequest, db: Session = Depends(get_db)):
    """
    Primeiro passo do reset: devolve a pergunta de segurança cadastrada pra
    esse e-mail, pra o front poder perguntar a resposta antes de liberar a
    senha temporária. Sem isso, resetar a senha de qualquer conta bastaria
    saber o e-mail (que não é segredo nenhum) -- essa era exatamente a
    falha que esse fluxo corrige.
    """
    estudante = db.query(Estudante).filter(Estudante.email == data.email).first()
    if not estudante or not estudante.pergunta_seguranca:
        raise HTTPException(status_code=404, detail="E-mail não encontrado ou sem pergunta de segurança cadastrada.")
    return {"pergunta": estudante.pergunta_seguranca}


@router.post("/auth/resetar-senha")
@limiter.limit("5/minute")
def resetar_senha(request: Request, data: ResetarSenhaRequest, db: Session = Depends(get_db)):
    """
    Sem servidor de e-mail configurado, a senha temporária é devolvida
    direto na resposta (mostrada uma única vez na tela) em vez de enviada
    por e-mail. No próximo login com ela, o front força a troca por uma
    senha definitiva antes de liberar o resto do app.

    A resposta de segurança é exigida aqui porque e-mail sozinho não é
    segredo -- sem essa checagem, qualquer pessoa que soubesse o e-mail de
    alguém conseguiria derrubar a senha da conta na hora.
    """
    estudante = db.query(Estudante).filter(Estudante.email == data.email).first()
    if not estudante or not estudante.resposta_seguranca_hash:
        # Não revela se o e-mail existe ou não, pra não ajudar enumeração de contas
        return {"mensagem": "Se esse e-mail existir e a resposta estiver correta, uma senha temporária foi gerada."}

    if not verificar_senha(_normalizar_resposta(data.resposta_seguranca), estudante.resposta_seguranca_hash):
        raise HTTPException(status_code=401, detail="Resposta de segurança incorreta.")

    senha_temp = gerar_senha_temporaria()
    estudante.senha_hash = hash_senha(senha_temp)
    estudante.precisa_trocar_senha = True
    db.commit()

    return {
        "mensagem": "Senha temporária gerada. Use-a pra entrar e depois defina uma nova.",
        "nome_login": estudante.nome,
        "senha_temporaria": senha_temp,
    }


@router.post("/auth/trocar-senha")
def trocar_senha(data: TrocarSenhaRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    if not estudante.senha_hash or not verificar_senha(data.senha_atual, estudante.senha_hash):
        raise HTTPException(status_code=401, detail="Senha atual incorreta")

    estudante.senha_hash = hash_senha(data.nova_senha)
    estudante.precisa_trocar_senha = False
    db.commit()
    return {"sucesso": True}


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

    ja_candidatado = db.query(Candidatura).filter(
        Candidatura.estudante_id == estudante.id,
        Candidatura.vaga_id == vaga_id,
    ).first() is not None

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
        "ja_candidatado": ja_candidatado,
    }


# --- Rota 2: Gerador de Currículo Dinâmico com IA ---
@router.post("/resume/generate", status_code=status.HTTP_201_CREATED)
def generate_resume(data: ResumeRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """
    Envia o texto informal do aluno para o Gemini estruturar um currículo profissional real.
    """
    curriculo_ia_dados = AIService.gerar_curriculo_ia(data.habilidades_texto, estudante.nome)

    novo_curriculo = Curriculo(
        estudante_id=estudante.id,
        texto_curriculo_formatado=json.dumps(curriculo_ia_dados)
    )

    try:
        db.add(novo_curriculo)
        db.commit()
        return {"sucesso": True, "curriculo": curriculo_ia_dados}
    except Exception:
        db.rollback()
        logger.exception("Erro ao salvar currículo do estudante %s", estudante.id)
        raise HTTPException(status_code=500, detail="Erro ao salvar currículo. Tente novamente mais tarde.")


# --- Rota 3: Simulador de Entrevistas Inteligente ---
@router.post("/chat/message")
def chat_interview(data: ChatMessageRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """
    Processa o chat avaliando a resposta do usuário.
    """
    historico = db.query(HistoricoEntrevista).filter(
        HistoricoEntrevista.estudante_id == estudante.id
    ).order_by(HistoricoEntrevista.enviado_em.desc()).limit(4).all()

    historico_texto = " ".join([f"{m.remetente}: {m.mensagem}" for m in reversed(historico)])

    resultado_ia = AIService.processar_entrevista_ia(data.mensagem_usuario, historico_texto, estudante.itinerario)

    feedback_gerado = resultado_ia.get("analise_feedback")
    xp_concedido = resultado_ia.get("xp_concedido", 0)
    proxima_pergunta = resultado_ia.get("proxima_pergunta")

    try:
        msg_usuario = HistoricoEntrevista(
            estudante_id=estudante.id,
            remetente="user",
            mensagem=data.mensagem_usuario,
            feedback_ia=feedback_gerado
        )
        db.add(msg_usuario)

        msg_ia = HistoricoEntrevista(
            estudante_id=estudante.id,
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
            "novos_pontos_totais": estudante.xp_total,
            "nivel_atual": estudante.nivel_gamificacao,
            "ofensiva_dias": estudante.ofensiva_dias,
            "categoria_status": estudante.categoria_status,
            "missoes_diarias": estudante.missoes_diarias_concluidas,
            "moedas": estudante.moedas,
        }
    except Exception:
        db.rollback()
        logger.exception("Erro no processamento do chat do estudante %s", estudante.id)
        raise HTTPException(status_code=500, detail="Erro no processamento do chat. Tente novamente mais tarde.")


# --- Rota Nova: Leaderboard / Ranking Semanal (pública) ---
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


# --- Rota Nova: Itinerários formativos disponíveis (funcionam como "cursos", pública) ---
@router.get("/quiz/itinerarios")
def get_itinerarios():
    return {
        "itinerarios": [
            {"nome": nome, "descricao": dados["descricao"]}
            for nome, dados in ITINERARIOS_QUIZ.items()
        ]
    }


# --- Rota Nova: Escolher (ou trocar de) itinerário formativo ---
@router.post("/itinerario/escolher")
def escolher_itinerario(data: EscolherItinerarioRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    if data.itinerario not in ITINERARIOS_QUIZ:
        raise HTTPException(status_code=400, detail="Itinerário inválido")

    estudante.itinerario = data.itinerario
    db.commit()
    return {"itinerario": estudante.itinerario}


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
                "mensagem": "Você está sem vidas. Espere regenerar ou compre com moedas.",
                "proxima_vida_em": estudante.proxima_vida_em.isoformat() if estudante.proxima_vida_em else None,
            },
        )
    db.commit()

    tema = AIService.tema_quiz_do_dia(estudante.itinerario)
    quiz = AIService.gerar_quiz_ia(tema, estudante.itinerario)

    sessao = QuizSessao(
        estudante_id=estudante.id,
        tema=quiz["tema"],
        gabarito=[
            {
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
    db.commit()

    gabarito_pergunta = sessao.gabarito[data.indice_pergunta]
    return {
        "correta": None if registro["pulou"] else registro["correta"],
        "resposta_correta_index": gabarito_pergunta["resposta_correta_index"],
        "explicacao": gabarito_pergunta["explicacao"],
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
    errados = max(0, total - acertos - pulos)  # pular não conta como erro nem custa vida
    xp_concedido = acertos * 8  # 8 XP por acerto, mesma ordem de grandeza do simulador

    try:
        sessao.concluido = True
        AIService.regenerar_vidas(estudante)
        for _ in range(errados):
            AIService.perder_vida(estudante)

        vida_bonus_ganha = AIService.avaliar_bonus_por_desempenho(estudante, acertos, total)
        AIService.processar_gamificacao_pos_atividade(estudante, db, xp_concedido)
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
            "moedas": estudante.moedas,
            "congelamentos_disponiveis": estudante.congelamentos_disponiveis,
            "quizzes_perfeitos_seguidos": estudante.quizzes_perfeitos_seguidos,
            "vida_bonus_ganha": vida_bonus_ganha,
        }
    except Exception:
        db.rollback()
        logger.exception("Erro ao processar resultado do quiz do estudante %s", estudante.id)
        raise HTTPException(status_code=500, detail="Erro ao processar resultado do quiz. Tente novamente mais tarde.")


# --- Rota Nova: Status consolidado de gamificação (vidas, moedas, congelamentos) ---
@router.get("/estudante/me/status")
def get_status_gamificacao(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    AIService.regenerar_vidas(estudante)
    db.commit()

    return {
        "vidas": estudante.vidas,
        "vidas_maximas": VIDAS_MAXIMAS,
        "proxima_vida_em": estudante.proxima_vida_em.isoformat() if estudante.proxima_vida_em else None,
        "moedas": estudante.moedas,
        "congelamentos_disponiveis": estudante.congelamentos_disponiveis,
        "quizzes_perfeitos_seguidos": estudante.quizzes_perfeitos_seguidos,
        "quizzes_perfeitos_para_bonus": QUIZZES_PERFEITOS_PARA_VIDA_BONUS,
        "ofensiva_dias": estudante.ofensiva_dias,
        "itinerario": estudante.itinerario,
        "nome": estudante.nome,
        "xp_total": estudante.xp_total,
        "nivel_gamificacao": estudante.nivel_gamificacao,
        "categoria_status": estudante.categoria_status,
    }


# --- Rota Nova: Calendário de ofensiva do mês ---
@router.get("/estudante/me/calendario")
def get_calendario(ano: int = Query(...), mes: int = Query(..., ge=1, le=12), estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    return {"dias": AIService.calendario_do_mes(estudante.id, ano, mes, db)}


# --- Rota Nova: Comprar 1 vida com moedas ---
@router.post("/vidas/comprar")
def comprar_vida(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
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
def export_to_linkedin(data: LinkedInExportRequest, estudante: Estudante = Depends(get_estudante_atual)):
    return {
        "status": "sucesso",
        "provedor": "LinkedIn Partner API v2 (2026 Sandbox)",
        "mensagem": f"Sucesso! O perfil de {estudante.nome} foi sincronizado de forma automática.",
        "secoes_atualizadas": ["Summary", "Skills", "TargetJobs"]
    }


# --- Rota 5: Envio de Candidaturas (persistido de verdade, não é mais fake) ---
@router.post("/jobs/apply-meta", status_code=status.HTTP_201_CREATED)
def apply_to_job_meta(data: MetaEmpresaRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
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
