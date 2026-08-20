import os
import secrets
import logging
import datetime
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models import Estudante

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
JWT_EXPIRA_HORAS = 24 * 7  # token válido por 7 dias

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    JWT_SECRET_KEY = secrets.token_hex(32)
    logger.warning(
        "JWT_SECRET_KEY não configurada no .env — usando um segredo temporário gerado "
        "agora. Todos os tokens serão invalidados quando o servidor reiniciar."
    )

_bearer_scheme = HTTPBearer(auto_error=False)


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
    credenciais: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> Estudante:
    """
    Dependência do FastAPI que valida o Bearer token e devolve o Estudante
    autenticado. Rotas que usam isso não confiam mais em um estudante_id
    enviado livremente pelo cliente -- a identidade vem só do token.
    """
    if credenciais is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")

    try:
        payload = jwt.decode(credenciais.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        estudante_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")

    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Estudante não encontrado")

    return estudante
