import os
import secrets
import logging
import datetime
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Estudante

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
JWT_EXPIRA_HORAS = 24 * 7  # token válido por 7 dias

# Mesmo padrão de DATABASE_URL em database.py: falha explicitamente no
# import se não estiver configurada, em vez de gerar um segredo aleatório
# por processo. Um segredo por processo parece funcionar em dev (um único
# `uvicorn --reload`), mas com mais de um worker cada processo teria seu
# próprio segredo e tokens emitidos por um worker virariam 401 aleatório
# nos outros -- um jeito de mascarar em vez de resolver a configuração.
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]

# Login foi removido: o app roda sem tela de autenticação, então todas as
# rotas passam a operar sempre sobre esse estudante único.
ESTUDANTE_UNICO_ID = 1


def gerar_senha_temporaria() -> str:
    """Senha temporária legível pra mostrar na tela no fluxo de 'esqueci minha senha'."""
    alfabeto = "abcdefghjkmnpqrstuvwxyz23456789"  # sem caracteres ambíguos (0/O, 1/l/I)
    return "".join(secrets.choice(alfabeto) for _ in range(10))


def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_senha(senha: str, senha_hash: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))
    except ValueError:
        return False


def criar_token(estudante_id: int) -> str:
    agora = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(estudante_id),
        "iat": agora,
        "exp": agora + datetime.timedelta(hours=JWT_EXPIRA_HORAS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_estudante_atual(
    db: Session = Depends(get_db),
) -> Estudante:
    """
    Não há mais tela de login: todas as rotas operam sempre sobre o mesmo
    estudante (ESTUDANTE_UNICO_ID), sem depender de token.
    """
    estudante = db.query(Estudante).filter(Estudante.id == ESTUDANTE_UNICO_ID).first()
    if not estudante:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Estudante não encontrado")

    return estudante
