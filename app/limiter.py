"""
Limite de requisições por IP (login, primeiro acesso, código da escola...).

Com REDIS_URL no .env, o contador fica no Redis e é o MESMO pra todas as
instâncias/workers da API: quem erra a senha em uma não ganha tentativas novas
na outra. Sem REDIS_URL, fica na memória do processo (desenvolvimento ou um
servidor só).

Se o Redis cair, o limite continua valendo na memória de cada instância até
ele voltar (in_memory_fallback) -- o login não sai do ar por causa do Redis.

O bloqueio por CONTA (5 erros travam a conta por 15 minutos) não depende
disto: fica no próprio Postgres (login_falhas / login_bloqueado_ate), então
já é compartilhado entre instâncias.
"""
import logging
import os

from slowapi import Limiter
from slowapi.util import get_remote_address

import config  # noqa: F401  (carrega o .env antes de ler REDIS_URL)

logger = logging.getLogger(__name__)


def criar_limiter(redis_url: str | None) -> Limiter:
    if not redis_url:
        return Limiter(key_func=get_remote_address)
    return Limiter(
        key_func=get_remote_address,
        storage_uri=redis_url,
        key_prefix="first2work",
        in_memory_fallback_enabled=True,
        # Se o Redis estiver fora no meio de uma requisição, não derruba a rota com 500
        swallow_errors=True,
    )


REDIS_URL = (os.environ.get("REDIS_URL") or "").strip() or None
limiter = criar_limiter(REDIS_URL)
if REDIS_URL:
    logger.info("Limite de tentativas compartilhado no Redis")
