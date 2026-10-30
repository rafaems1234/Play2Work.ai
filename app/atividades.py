import json
import logging
import os
import random
from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import Estudante, RespostaSituacao
from competencias import CODIGOS_COMPETENCIAS, registrar_evidencias
from fuso import agora_utc, inicio_do_dia_utc

logger = logging.getLogger(__name__)

# Atividades de soft skills que alimentam o mapa de competências.
# Hoje: "O que você faria?" (situações de trabalho, pontuação fixa por opção).
# O conteúdo mora em frontend/src/data/ -- os mesmos arquivos que o modo
# demonstração usa, igual ao banco de questões do quiz.
PASTA_DADOS = os.path.join(os.path.dirname(__file__), "frontend", "src", "data")

with open(os.path.join(PASTA_DADOS, "situacoes.json"), encoding="utf-8") as _arquivo:
    SITUACOES = {s["id"]: s for s in json.load(_arquivo)}

SITUACOES_POR_DIA = 5          # evita "farmar" XP e competência respondendo em série
DIAS_SEM_REPETIR_SITUACAO = 30


def _validar_conteudo() -> None:
    """Erro de digitação no JSON (eixo inexistente) quebra na subida da API, não no meio de uma resposta."""
    for situacao in SITUACOES.values():
        for opcao in situacao["opcoes"]:
            desconhecidas = set(opcao["competencias"]) - set(CODIGOS_COMPETENCIAS)
            if desconhecidas:
                raise ValueError(f"Situação {situacao['id']}: competência desconhecida {desconhecidas}")


_validar_conteudo()


def xp_da_nota(nota: float) -> int:
    """0-100 -> 2 a 20 XP (participar sempre conta um pouco)."""
    return max(2, round(nota / 5))


# ---------------------------------------------------------------- O que você faria?
def _situacoes_hoje(db: Session, estudante_id: int) -> int:
    return db.query(RespostaSituacao).filter(
        RespostaSituacao.estudante_id == estudante_id, RespostaSituacao.criada_em >= inicio_do_dia_utc(),
    ).count()


def situacao_publica(situacao: dict) -> dict:
    """O que o aluno vê antes de responder: sem a pontuação nem a consequência das opções."""
    return {
        "id": situacao["id"],
        "titulo": situacao["titulo"],
        "cenario": situacao["cenario"],
        "opcoes": [o["texto"] for o in situacao["opcoes"]],
    }


def proxima_situacao(db: Session, estudante: Estudante) -> dict:
    feitas_hoje = _situacoes_hoje(db, estudante.id)
    restantes = max(0, SITUACOES_POR_DIA - feitas_hoje)
    if restantes == 0:
        return {"situacao": None, "restantes_hoje": 0, "limite_diario": SITUACOES_POR_DIA}

    recentes = {
        sid for (sid,) in db.query(RespostaSituacao.situacao_id).filter(
            RespostaSituacao.estudante_id == estudante.id,
            RespostaSituacao.criada_em >= agora_utc() - timedelta(days=DIAS_SEM_REPETIR_SITUACAO),
        ).all()
    }
    candidatas = [s for sid, s in SITUACOES.items() if sid not in recentes] or list(SITUACOES.values())
    return {"situacao": situacao_publica(random.choice(candidatas)), "restantes_hoje": restantes, "limite_diario": SITUACOES_POR_DIA}


def responder_situacao(db: Session, estudante: Estudante, situacao_id: str, opcao_index: int) -> dict:
    """
    Registra a escolha, gera as evidências de competência daquela opção e
    devolve a consequência -- e, se o aluno não escolheu a opção que mais
    desenvolve, mostra qual era e por quê (é atividade de aprendizagem,
    não prova). Quem chama processa a gamificação e faz o commit.
    """
    situacao = SITUACOES.get(situacao_id)
    if not situacao:
        raise HTTPException(status_code=404, detail="Situação não encontrada")
    if not 0 <= opcao_index < len(situacao["opcoes"]):
        raise HTTPException(status_code=400, detail="Opção inválida")
    if _situacoes_hoje(db, estudante.id) >= SITUACOES_POR_DIA:
        raise HTTPException(status_code=429, detail=f"Você já fez as {SITUACOES_POR_DIA} situações de hoje. Volte amanhã!")

    resposta = RespostaSituacao(estudante_id=estudante.id, situacao_id=situacao_id, opcao_index=opcao_index)
    db.add(resposta)
    db.flush()

    opcao = situacao["opcoes"][opcao_index]
    registrar_evidencias(db, estudante.id, opcao["competencias"], origem="situacao", origem_id=resposta.id)

    media = lambda o: sum(o["competencias"].values()) / len(o["competencias"])  # noqa: E731
    nota = media(opcao)
    indice_melhor = max(range(len(situacao["opcoes"])), key=lambda i: media(situacao["opcoes"][i]))
    melhor = situacao["opcoes"][indice_melhor]
    return {
        "nota": round(nota),
        "xp_concedido": xp_da_nota(nota),
        "consequencia": opcao["consequencia"],
        "competencias": [{"codigo": c, "pontos": p} for c, p in opcao["competencias"].items()],
        "escolheu_a_melhor": indice_melhor == opcao_index,
        "melhor_opcao": None if indice_melhor == opcao_index else {
            "indice": indice_melhor, "texto": melhor["texto"], "consequencia": melhor["consequencia"],
        },
    }
