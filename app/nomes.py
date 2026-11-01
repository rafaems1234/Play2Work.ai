"""
Regras do nome de exibição e do usuário de login dos alunos, sem dependências
do resto do backend -- importadas tanto pelos serviços quanto pelas migrações
que preenchem os alunos já existentes.
"""
import unicodedata


def escolher_nome_exibicao(nome_completo: str, ocupados: set[str]) -> str:
    """
    Nome curto e ÚNICO pra aparecer no ranking e no painel: "Rafael S.".
    Se já houver outro igual, vai detalhando o sobrenome ("Rafael So.",
    "Rafael Sozza"), depois usa o nome do meio ("Rafael V. Sozza") e, só
    em último caso, numera ("Rafael Sozza 2"). 'ocupados' em minúsculas.
    """
    partes = nome_completo.split()
    primeiro = partes[0].capitalize() if partes else "Aluno"
    candidatos = [primeiro] if len(partes) <= 1 else []
    if len(partes) > 1:
        ultimo = partes[-1].capitalize()
        candidatos += [f"{primeiro} {ultimo[:n]}." for n in range(1, len(ultimo))]
        candidatos.append(f"{primeiro} {ultimo}")
        for meio in partes[1:-1]:
            if len(meio) > 2:  # pula "da", "de", "dos"
                candidatos.append(f"{primeiro} {meio[0].upper()}. {ultimo}")
    for candidato in candidatos:
        if candidato.lower() not in ocupados:
            return candidato
    base = candidatos[-1]
    numero = 2
    while f"{base} {numero}".lower() in ocupados:
        numero += 1
    return f"{base} {numero}"


PARTICULAS = {"da", "de", "do", "das", "dos", "e"}
TAMANHO_MAXIMO_USUARIO = 40


def _so_letras_minusculas(texto: str) -> str:
    """'Sézar' -> 'sezar': tira acento e tudo que não for letra (o usuário vai ser digitado no celular)."""
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return "".join(ch for ch in sem_acento.lower() if "a" <= ch <= "z")


def escolher_usuario(nome_completo: str, ocupados: set[str]) -> str:
    """
    Usuário de login do aluno, ÚNICO e sem acento: "rafael.sozza". Se já
    existir, usa a inicial do nome do meio ("rafael.v.sozza"), depois o nome
    do meio inteiro ("rafael.vieira.sozza") e, só por último, numera
    ("rafael.sozza2"). 'ocupados' em minúsculas.
    """
    partes = [p for p in (_so_letras_minusculas(p) for p in nome_completo.split()) if p]
    if not partes:
        partes = ["aluno"]
    primeiro = partes[0]
    candidatos = [primeiro] if len(partes) == 1 else []
    if len(partes) > 1:
        ultimo = partes[-1]
        meios = [p for p in partes[1:-1] if p not in PARTICULAS]
        candidatos.append(f"{primeiro}.{ultimo}")
        candidatos += [f"{primeiro}.{meio[0]}.{ultimo}" for meio in meios]
        candidatos += [f"{primeiro}.{meio}.{ultimo}" for meio in meios]
    candidatos = [c[:TAMANHO_MAXIMO_USUARIO] for c in candidatos]
    for candidato in candidatos:
        if candidato not in ocupados:
            return candidato
    base = candidatos[0][:TAMANHO_MAXIMO_USUARIO - 4]
    numero = 2
    while f"{base}{numero}" in ocupados:
        numero += 1
    return f"{base}{numero}"
