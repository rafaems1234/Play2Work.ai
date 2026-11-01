import json
import os
import re
import unicodedata
from typing import Callable, Optional

# Simulador de entrevista: regras que NÃO dependem da IA.
#
# A entrevista é uma conversa contínua (entre 5 e 7 respostas) com uma
# entrevistadora que lembra de tudo o que o aluno disse na sessão. Durante a
# conversa não há nota nem XP. No fim, uma única chamada gera o LAUDO de
# desempenho (pontos fortes, pontos de melhoria, parecer e notas por critério).
# Quem decide a nota geral e o XP é o servidor, com as fórmulas daqui.
#
# Antes de chamar a IA, uma triagem local barra o que é claramente fora de uma
# entrevista (conta, lição de casa, "esquece a entrevista", palavrão, texto sem
# sentido, resposta repetida, dados pessoais): a entrevistadora adverte com uma
# fala fixa, repete a pergunta e isso não conta como resposta.
#
# As regras ficam em frontend/src/data/entrevista.json porque o modo
# demonstração (entrevistaDemo.js) aplica as mesmas -- uma fonte só pras duas pontas.

CAMINHO_REGRAS = os.path.join(os.path.dirname(__file__), "frontend", "src", "data", "entrevista.json")
with open(CAMINHO_REGRAS, encoding="utf-8") as _arquivo:
    REGRAS = json.load(_arquivo)

PERGUNTA_INICIAL = REGRAS["pergunta_inicial"]
PERGUNTA_RECOMECO = REGRAS["pergunta_recomeco"]
PERGUNTAS = REGRAS["perguntas"]
CRITERIOS = tuple(REGRAS["pesos"])  # relevancia, clareza, exemplos, postura
CATEGORIAS_SEM_XP = tuple(REGRAS["mensagens"])  # fora_do_tema, sem_conteudo, repetida, inadequada, dados_pessoais, precisa_de_ajuda
TAMANHO_MAXIMO_RESPOSTA = 1500

SESSAO = REGRAS["sessao"]
RESPOSTAS_MINIMAS = SESSAO["respostas_minimas"]
RESPOSTAS_MAXIMAS = SESSAO["respostas_maximas"]
XP_MAXIMO_SESSAO = SESSAO["xp_maximo"]
LAUDOS_COM_XP_POR_DIA = SESSAO["laudos_com_xp_por_dia"]
ENTREVISTAS_POR_RODADA = SESSAO["entrevistas_por_rodada"]
META_DA_RODADA = SESSAO["meta_da_rodada"]
TAMANHO_RESUMO = 140
ITENS_POR_LISTA = 5

# Padrões (regex) que pegam o desvio sem gastar chamada da IA: "esquece a
# entrevista", "finge que...", pedido de lição de alguma matéria, pergunta de
# conteúdo escolar ("o que é uma ligação covalente?"). O texto já chega
# normalizado (minúsculo, sem acento).
PADROES_FORA_DO_TEMA = [re.compile(p) for p in REGRAS["padroes_fora_do_tema"]]

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
    """Categoria que dispensa a IA (e não conta como resposta), ou None se a resposta segue pra conversa."""
    texto = normalizar(mensagem)
    palavras = _palavras(texto)
    if _tem_expressao(texto, REGRAS["sinais_de_ajuda"]) or "suicid" in texto:
        return "precisa_de_ajuda"
    if _tem_expressao(texto, REGRAS["palavras_inadequadas"]):
        return "inadequada"
    if CPF.search(texto) or TELEFONE.search(texto) or "minha senha" in texto:
        return "dados_pessoais"
    if CONTA.search(texto) or _tem_expressao(texto, REGRAS["pedidos_fora_do_tema"]) or any(p.search(texto) for p in PADROES_FORA_DO_TEMA):
        return "fora_do_tema"
    letras = re.sub(r"[^a-z]", "", texto)
    vogais = sum(letras.count(v) for v in "aeiou")
    if len(palavras) < 3 or len(letras) < 10 or vogais / len(letras) < 0.25 or re.search(r"([a-z])\1{3,}", letras):
        return "sem_conteudo"
    if texto in {normalizar(r) for r in respostas_anteriores}:
        return "repetida"
    return None


def limpar_notas(notas: Optional[dict]) -> dict:
    return {c: max(0, min(10, int((notas or {}).get(c) or 0))) for c in CRITERIOS}


def nota_geral(notas: dict) -> int:
    """Nota de 0 a 100 decidida pelo servidor: média ponderada dos critérios (0-10). Fugiu das perguntas = nota baixa."""
    limpas = limpar_notas(notas)
    media = sum(REGRAS["pesos"][c] * limpas[c] for c in CRITERIOS) * 10
    if limpas["relevancia"] < REGRAS["relevancia_minima"]:
        media = min(media, 20)
    return round(media)


def xp_da_nota(nota: int) -> int:
    return round(max(0, min(100, nota)) / 100 * XP_MAXIMO_SESSAO)


def avaliar_sem_ia(mensagem: str) -> dict:
    """
    Notas de reserva de UMA resposta (sem GEMINI_API_KEY, cota estourada ou
    modo demo): tamanho, exemplos concretos e gírias. Sem IA não dá pra
    conferir se a resposta bate com a pergunta, então a relevância fica num
    meio-termo. O laudo de reserva é a média disso nas respostas da sessão.
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
    return {"notas": notas, "palavras": n}


def proxima_pergunta_do_banco(perguntas_ja_feitas: int) -> str:
    return PERGUNTAS[perguntas_ja_feitas % len(PERGUNTAS)]


def pergunta_da_fala(fala: str) -> str:
    """
    A pergunta em si, sem a frase que vem antes ("Aqui eu estou como sua
    entrevistadora... Voltando à pergunta: X" -> "X"). O histórico guarda a
    fala inteira; sem isso, dois desvios seguidos aninhavam a frase.
    """
    marcador = REGRAS["fala_volta_pergunta"]
    texto = fala.rsplit(marcador, 1)[1].strip() if marcador in (fala or "") else (fala or "")
    # Só a frase da pergunta, sem o comentário que vinha antes ("Muito bom! Me conta: X?" -> "Me conta: X?")
    perguntas = re.findall(r"[^.!?]*\?", texto)
    return perguntas[-1].strip() if perguntas else texto


def _fala_valida(texto: Optional[str], pergunta: bool) -> bool:
    texto = (texto or "").strip()
    return 10 <= len(texto) <= 700 and (texto.endswith("?") if pergunta else True)


# ------------------------------------------------------------------ conversa

def rodada(
    mensagem: str,
    ultima_fala: str,
    respostas_anteriores: list[str],
    perguntas_ja_feitas: int,
    conversar_com_ia: Callable[[str, bool], Optional[dict]],
) -> dict:
    """
    Uma troca da entrevista. Devolve a fala da entrevistadora, a categoria,
    se contou como resposta e se a entrevista terminou (despedida).
    conversar_com_ia(mensagem, deve_encerrar) -> {categoria, fala, encerrar} ou None (sem IA/erro).
    Nada de nota nem XP aqui: isso é do laudo.
    """
    pergunta_atual = pergunta_da_fala(ultima_fala)
    categoria = triagem(mensagem, respostas_anteriores)
    resposta_ia = None
    if categoria is None:
        respostas = len(respostas_anteriores) + 1  # contando esta
        resposta_ia = conversar_com_ia(mensagem, respostas >= RESPOSTAS_MAXIMAS)
        if resposta_ia and resposta_ia.get("categoria") in CATEGORIAS_SEM_XP:
            categoria = resposta_ia["categoria"]

    if categoria is not None:
        # Advertência no papel e a mesma pergunta de novo: a entrevistadora
        # nunca responde o assunto aleatório (nem usa a fala da IA nesse caso).
        fixa = REGRAS["mensagens"][categoria]
        fala = fixa["fala"] if categoria == "precisa_de_ajuda" else f'{fixa["fala"]} {REGRAS["fala_volta_pergunta"]} {pergunta_atual}'
        return {"categoria": categoria, "conta": False, "fala": fala, "encerrou": False}

    respostas = len(respostas_anteriores) + 1
    if respostas >= RESPOSTAS_MAXIMAS:
        encerrar = True
    elif respostas >= RESPOSTAS_MINIMAS:
        encerrar = bool(resposta_ia and resposta_ia.get("encerrar"))
    else:
        encerrar = False

    fala = (resposta_ia or {}).get("fala")
    if encerrar:
        # Despedida da IA só se não for mais uma pergunta; senão, a fixa
        if not _fala_valida(fala, pergunta=False) or fala.strip().endswith("?"):
            fala = REGRAS["despedida"]
    elif not _fala_valida(fala, pergunta=True):
        ponte = REGRAS["pontes"][perguntas_ja_feitas % len(REGRAS["pontes"])]
        fala = f"{ponte} {proxima_pergunta_do_banco(perguntas_ja_feitas)}"
    return {"categoria": "resposta", "conta": True, "fala": fala.strip(), "encerrou": encerrar}


# ------------------------------------------------------------------ laudo

def _lista(itens, limite: int = ITENS_POR_LISTA, tamanho: int = 300) -> list[str]:
    limpos = []
    for item in itens or []:
        texto = str(item or "").strip()[:tamanho]
        if texto and texto not in limpos:
            limpos.append(texto)
    return limpos[:limite]


def laudo_sem_ia(respostas: list[str]) -> dict:
    """Laudo de reserva: média das notas de reserva de cada resposta e textos prontos."""
    avaliacoes = [avaliar_sem_ia(r)["notas"] for r in respostas] or [limpar_notas({})]
    notas = {c: round(sum(a[c] for a in avaliacoes) / len(avaliacoes)) for c in CRITERIOS}
    ordem = sorted(CRITERIOS, key=lambda c: (-notas[c], CRITERIOS.index(c)))
    fortes = [REGRAS["laudo_reserva"]["fortes"][c] for c in ordem if notas[c] >= 7][:3]
    dicas = REGRAS["dicas"]
    melhorias = [dicas["clareza_curta"] if c == "clareza" else dicas[c] for c in reversed(ordem) if notas[c] < 8][:3]
    nota = nota_geral(notas)
    faixa = "alto" if nota >= 70 else "medio" if nota >= 45 else "baixo"
    return {
        "notas": notas,
        "pontos_fortes": fortes or [REGRAS["laudo_reserva"]["fortes"]["postura"]],
        "pontos_melhoria": melhorias or [dicas["otima"]],
        "parecer_recrutador": REGRAS["laudo_reserva"]["parecer"][faixa],
        "resumo": REGRAS["laudo_reserva"]["resumo"][faixa],
    }


def montar_laudo(respostas: list[str], gerar_com_ia: Callable[[], Optional[dict]]) -> dict:
    """
    Laudo final da sessão. A IA (uma chamada, com a conversa inteira) escreve
    pontos fortes, de melhoria, o parecer e dá notas por critério; a nota geral
    e o XP saem daqui. Sem IA (ou se ela falhar), vale o laudo de reserva.
    """
    da_ia = gerar_com_ia()
    por_ia = bool(da_ia)
    bruto = da_ia or laudo_sem_ia(respostas)
    notas = limpar_notas(bruto.get("notas"))
    nota = nota_geral(notas)
    reserva = laudo_sem_ia(respostas) if por_ia else bruto
    return {
        "notas": notas,
        "nota_geral": nota,
        "xp": xp_da_nota(nota),
        "pontos_fortes": _lista(bruto.get("pontos_fortes")) or reserva["pontos_fortes"],
        "pontos_melhoria": _lista(bruto.get("pontos_melhoria")) or reserva["pontos_melhoria"],
        "parecer_recrutador": (str(bruto.get("parecer_recrutador") or "").strip()[:1500]) or reserva["parecer_recrutador"],
        "resumo": (str(bruto.get("resumo") or "").strip().rstrip(".")[:TAMANHO_RESUMO]) or reserva["resumo"],
        "por_ia": por_ia,
    }


# ------------------------------------------------------------------ rodadas

def fechar_rodada(notas_das_entrevistas: list[int]) -> Optional[dict]:
    """
    Rodada de ENTREVISTAS_POR_RODADA entrevistas. Completa, devolve a média e
    se bateu a meta; incompleta, None. Bater a meta não carimba nada sozinho:
    a coordenação confirma no painel (a decisão sobre o aluno é humana).
    """
    if len(notas_das_entrevistas) < ENTREVISTAS_POR_RODADA:
        return None
    media = round(sum(notas_das_entrevistas) / len(notas_das_entrevistas))
    return {"media": media, "status": "meta_atingida" if media >= META_DA_RODADA else "nao_atingida"}
