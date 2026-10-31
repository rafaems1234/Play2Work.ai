import json
import os
import re
import unicodedata
from typing import Callable, Optional

# Simulador de entrevista: regras que NÃO dependem da IA.
#
# A IA só faz o papel da entrevistadora e dá notas por critério; quem decide
# o XP é o servidor, com a fórmula daqui. Antes de chamar a IA, uma triagem
# local barra o que é claramente fora de uma entrevista (conta, pedido de
# lição de casa, "ignore as instruções", palavrão, texto sem sentido,
# resposta repetida, dados pessoais) -- isso vale 0 XP e a entrevistadora
# responde com uma fala fixa, sem nunca responder a pergunta aleatória.
# Se a IA também classificar a resposta como fora do tema, vale o mesmo.
#
# As regras ficam em frontend/src/data/entrevista.json porque o modo
# demonstração (mockApi.js) aplica as mesmas -- uma fonte só pras duas pontas.

CAMINHO_REGRAS = os.path.join(os.path.dirname(__file__), "frontend", "src", "data", "entrevista.json")
with open(CAMINHO_REGRAS, encoding="utf-8") as _arquivo:
    REGRAS = json.load(_arquivo)

PERGUNTA_INICIAL = REGRAS["pergunta_inicial"]
PERGUNTA_RECOMECO = REGRAS["pergunta_recomeco"]
PERGUNTAS = REGRAS["perguntas"]
CRITERIOS = tuple(REGRAS["pesos"])  # relevancia, clareza, exemplos, postura
CATEGORIAS_SEM_XP = tuple(REGRAS["mensagens"])  # fora_do_tema, sem_conteudo, repetida, inadequada, dados_pessoais, precisa_de_ajuda
TAMANHO_MAXIMO_RESPOSTA = 1500

CONTA = re.compile(r"\d+\s*[+*x×÷^]\s*\d+|quanto (e|da|que e) \d")
CPF = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
TELEFONE = re.compile(r"\(?\b\d{2}\)?\s?9\d{4}-?\d{4}\b")


def normalizar(texto: str) -> str:
    """Minúsculas, sem acento e com espaços simples -- 'Você é' e 'voce  e' comparam igual."""
    sem_acento = unicodedata.normalize("NFD", texto or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", sem_acento.lower()).strip()


def _palavras(texto_normalizado: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", texto_normalizado)


def _tem_expressao(texto_normalizado: str, expressoes: list[str]) -> bool:
    """Expressão inteira (com borda de palavra), não pedaço: 'cu' não pega 'curso'."""
    return any(re.search(rf"\b{re.escape(e)}\b", texto_normalizado) for e in expressoes)


def triagem(mensagem: str, respostas_anteriores: list[str]) -> Optional[str]:
    """Categoria que dispensa a IA (e vale 0 XP), ou None se a resposta segue pra avaliação."""
    texto = normalizar(mensagem)
    palavras = _palavras(texto)
    if _tem_expressao(texto, REGRAS["sinais_de_ajuda"]) or "suicid" in texto:
        return "precisa_de_ajuda"
    if _tem_expressao(texto, REGRAS["palavras_inadequadas"]):
        return "inadequada"
    if CPF.search(texto) or TELEFONE.search(texto) or "minha senha" in texto:
        return "dados_pessoais"
    if CONTA.search(texto) or _tem_expressao(texto, REGRAS["pedidos_fora_do_tema"]):
        return "fora_do_tema"
    letras = re.sub(r"[^a-z]", "", texto)
    vogais = sum(letras.count(v) for v in "aeiou")
    if len(palavras) < 3 or len(letras) < 10 or vogais / len(letras) < 0.25 or re.search(r"([a-z])\1{3,}", letras):
        return "sem_conteudo"
    if texto in {normalizar(r) for r in respostas_anteriores}:
        return "repetida"
    return None


def xp_das_notas(notas: dict) -> int:
    """XP decidido pelo servidor: média ponderada das notas (0-10). Fugiu da pergunta = 0."""
    limpas = {c: max(0, min(10, int(notas.get(c) or 0))) for c in CRITERIOS}
    if limpas["relevancia"] < REGRAS["relevancia_minima"]:
        return 0
    media = sum(REGRAS["pesos"][c] * limpas[c] for c in CRITERIOS) / 10
    return round(media * REGRAS["xp_maximo"])


def avaliar_sem_ia(mensagem: str) -> dict:
    """
    Avaliação de reserva (sem GEMINI_API_KEY, cota estourada ou modo demo):
    tamanho, exemplos concretos e gírias. Sem IA não dá pra conferir se a
    resposta bate com a pergunta, então a relevância fica num meio-termo.
    """
    texto = normalizar(mensagem)
    n = len(_palavras(texto))
    marcas = sum(1 for m in REGRAS["marcas_de_exemplo"] if re.search(rf"\b{re.escape(m)}\b", texto))
    girias = sum(1 for g in REGRAS["girias"] if re.search(rf"\b{re.escape(g)}\b", texto))
    pontuada = any(p in mensagem for p in ".,;!?")
    curta = n < 8  # "sou legal e quero a vaga": não dá pra mostrar nada
    notas = {
        "relevancia": 3 if curta else 7 if n >= 15 else 6,
        "clareza": 3 if curta else 6 if n < 20 else 6 if n > 180 else 8 + (1 if pontuada else 0),
        "exemplos": min(10 if n >= 15 else 6, (1 if curta else 2) + 3 * marcas),
        "postura": min(5 if curta else 9, max(2, 9 - 3 * girias)),
    }
    if girias >= 2:
        notas["clareza"] = min(notas["clareza"], 5)
    dicas = REGRAS["dicas"]
    pior = min(CRITERIOS, key=lambda c: (notas[c], CRITERIOS.index(c)))
    if notas[pior] >= 8:
        feedback = dicas["otima"]
    elif pior == "clareza":
        feedback = dicas["clareza_longa"] if n > 180 else dicas["clareza_curta"]
    else:
        feedback = dicas[pior]
    return {"categoria": "resposta", "notas": notas, "analise_feedback": feedback, "proxima_pergunta": None}


def proxima_pergunta_do_banco(perguntas_ja_feitas: int) -> str:
    return PERGUNTAS[perguntas_ja_feitas % len(PERGUNTAS)]


def _pergunta_valida(texto: Optional[str]) -> bool:
    return bool(texto) and texto.strip().endswith("?") and 15 <= len(texto.strip()) <= 400


def conduzir(
    mensagem: str,
    pergunta_atual: str,
    respostas_anteriores: list[str],
    perguntas_ja_feitas: int,
    avaliar_com_ia: Callable[[str, str], Optional[dict]],
) -> dict:
    """
    Uma rodada da entrevista. Retorna o que a entrevistadora fala, o feedback,
    a categoria, as notas por critério e o XP (sempre calculado aqui).
    avaliar_com_ia(mensagem, pergunta_atual) -> avaliação da IA ou None (sem IA/erro).
    """
    categoria = triagem(mensagem, respostas_anteriores)
    avaliacao = None
    if categoria is None:
        avaliacao = avaliar_com_ia(mensagem, pergunta_atual) or avaliar_sem_ia(mensagem)
        categoria = avaliacao.get("categoria") if avaliacao.get("categoria") in ("resposta", *CATEGORIAS_SEM_XP) else "resposta"

    if categoria != "resposta":
        # Fala fixa e a mesma pergunta de novo: a entrevistadora nunca responde
        # o assunto aleatório nem dá XP. Pedido de ajuda pausa a entrevista.
        mensagem_fixa = REGRAS["mensagens"][categoria]
        fala = mensagem_fixa["fala"] if categoria == "precisa_de_ajuda" else f'{mensagem_fixa["fala"]} {REGRAS["fala_volta_pergunta"]} {pergunta_atual}'
        return {
            "categoria": categoria, "notas": None, "xp_concedido": 0,
            "analise_feedback": mensagem_fixa["feedback"], "fala": fala, "pergunta": pergunta_atual,
        }

    notas = {c: max(0, min(10, int((avaliacao.get("notas") or {}).get(c) or 0))) for c in CRITERIOS}
    proxima = avaliacao.get("proxima_pergunta")
    if not _pergunta_valida(proxima):
        proxima = proxima_pergunta_do_banco(perguntas_ja_feitas)
    feedback = (avaliacao.get("analise_feedback") or "").strip()[:600] or REGRAS["dicas"]["exemplos"]
    return {
        "categoria": "resposta", "notas": notas, "xp_concedido": xp_das_notas(notas),
        "analise_feedback": feedback, "fala": proxima, "pergunta": proxima,
    }
