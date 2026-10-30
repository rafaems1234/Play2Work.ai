import os
import secrets
import logging
import datetime
import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Estudante

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
# Sessão do aluno: curta de propósito. Nos laboratórios da escola o mesmo
# computador passa de aluno pra aluno -- com 7 dias, quem sentasse depois
# entrava na conta de quem usou antes. 4h cobre um turno de aula; o front
# ainda guarda o token só na aba (sessionStorage), então fechar o navegador
# já encerra a sessão. Ajustável por JWT_EXPIRA_HORAS_ALUNO no .env.
JWT_EXPIRA_HORAS = int(os.environ.get("JWT_EXPIRA_HORAS_ALUNO") or 4)

# Mesmo padrão de DATABASE_URL em database.py: falha explicitamente no
# import se não estiver configurada, em vez de gerar um segredo aleatório
# por processo. Um segredo por processo parece funcionar em dev (um único
# `uvicorn --reload`), mas com mais de um worker cada processo teria seu
# próprio segredo e tokens emitidos por um worker virariam 401 aleatório
# nos outros -- um jeito de mascarar em vez de resolver a configuração.
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]

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
        "papel": "aluno",
        "iat": agora,
        "exp": agora + datetime.timedelta(hours=JWT_EXPIRA_HORAS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# Senha do painel da escola (admin). Opcional: sem ela, POST /admin/login
# responde 503 e o painel fica fechado -- melhor que subir com uma senha
# padrão conhecida.
ADMIN_SENHA = os.environ.get("ADMIN_SENHA")
JWT_EXPIRA_HORAS_ADMIN = 12


def normalizar_cpf(cpf: str) -> str:
    """Aceita com ou sem pontuação ('123.456.789-09' ou '12345678909') e devolve só os dígitos."""
    return "".join(ch for ch in cpf if ch.isdigit())


def cpf_valido(cpf: str) -> bool:
    """Confere os dois dígitos verificadores -- pega erro de digitação no cadastro."""
    if len(cpf) != 11 or not cpf.isdigit() or cpf == cpf[0] * 11:
        return False
    for tamanho in (9, 10):
        soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digito = (soma * 10) % 11 % 10
        if digito != int(cpf[tamanho]):
            return False
    return True


def criar_token_admin() -> str:
    agora = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": "admin",
        "papel": "admin",
        "iat": agora,
        "exp": agora + datetime.timedelta(hours=JWT_EXPIRA_HORAS_ADMIN),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _payload_do_token(authorization: str | None) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        return jwt.decode(authorization[7:], JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def get_admin_atual(authorization: str | None = Header(default=None)) -> None:
    """
    Protege as rotas /admin/*: exige 'Authorization: Bearer <token>' emitido
    por /admin/login, com papel 'admin' (token de aluno não serve).
    """
    payload = _payload_do_token(authorization)
    if not payload or payload.get("papel") != "admin":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Acesso restrito à escola. Faça login no painel.")


def get_estudante_atual(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Estudante:
    """
    Aluno identificado pelo token emitido em /auth/entrar (CPF como senha)
    ou /auth/login. Token de admin não serve aqui.
    """
    erro = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada. Entre de novo com seu CPF.")
    payload = _payload_do_token(authorization)
    if not payload or payload.get("papel", "aluno") != "aluno":
        raise erro
    try:
        estudante_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise erro

    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante:
        raise erro
    return estudante
