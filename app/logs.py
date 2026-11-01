"""
Logs sem dado pessoal.

O uvicorn grava no log de acesso a URL de toda requisição, com a query string.
Algumas telas do painel mandam a busca na URL (?busca=Maria Souza, ou um CPF),
então o log de acesso viraria uma lista de nomes e CPFs de alunos menores,
guardada fora do banco, sem auditoria e sem prazo de descarte.

Este filtro troca os VALORES da query string por "*" e mantém os nomes dos
parâmetros (dá pra depurar "a busca da auditoria está lenta" sem saber o que
foi buscado). Os logs do próprio código já só gravam ids, nunca nome, CPF ou
texto de aluno -- mantenha assim.
"""
import logging
from urllib.parse import parse_qsl, urlencode


def sem_valores(caminho: str) -> str:
    """'/api/x?busca=Maria&pagina=2' -> '/api/x?busca=*&pagina=*'"""
    if not isinstance(caminho, str) or "?" not in caminho:
        return caminho
    base, query = caminho.split("?", 1)
    nomes = [nome for nome, _ in parse_qsl(query, keep_blank_values=True)]
    return f"{base}?{urlencode([(nome, '*') for nome in nomes], safe='*')}" if nomes else base


class FiltroUrlSemDados(logging.Filter):
    """Pro logger 'uvicorn.access': args = (cliente, método, caminho, versão http, status)."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple) and len(record.args) >= 3:
            args = list(record.args)
            args[2] = sem_valores(args[2])
            record.args = tuple(args)
        return True


def proteger_logs_de_acesso() -> None:
    logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, FiltroUrlSemDados) for f in logger.filters):
        logger.addFilter(FiltroUrlSemDados())
