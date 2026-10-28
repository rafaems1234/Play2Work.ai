"""
Regra do nome de exibição dos alunos, sem dependências do resto do backend --
importada tanto pelos serviços quanto pela migração que preenche os alunos
já existentes.
"""


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
