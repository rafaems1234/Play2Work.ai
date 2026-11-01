import os
import logging
import datetime
import bcrypt
import jwt
from dataclasses import dataclass
from typing import Optional
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from models import Estudante, UsuarioGestao

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

def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_senha(senha: str, senha_hash: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))
    except ValueError:
        return False


def criar_token(estudante_id: int, sessao_versao: int = 0) -> str:
    agora = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(estudante_id),
        "papel": "aluno",
        # Versão da sessão do aluno: senha nova soma 1 no banco e todo token
        # emitido antes (outro computador do laboratório, celular perdido) cai.
        "v": sessao_versao,
        "iat": agora,
        "exp": agora + datetime.timedelta(hours=JWT_EXPIRA_HORAS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# Senha de INSTALAÇÃO do painel. Só serve enquanto não existe nenhuma conta
# de Administrador ativa: é com ela que a escola entra a primeira vez pra criar
# o primeiro Administrador. Depois disso, cada pessoa entra com a própria conta
# (usuarios_gestao). Sem ADMIN_SENHA e sem contas, o painel fica fechado.
ADMIN_SENHA = os.environ.get("ADMIN_SENHA")
INSTALACAO = "instalacao"

# Perfis das contas da gestão (o que cada um pode):
PERFIS_GESTAO = {
    "administrador": {"rotulo": "Administrador", "alterar": True, "auditar": True, "contas": True},
    "auditor": {"rotulo": "Auditor", "alterar": False, "auditar": True, "contas": False},
    "alterar": {"rotulo": "Alterar", "alterar": True, "auditar": False, "contas": False},
    "visualizar": {"rotulo": "Visualizar", "alterar": False, "auditar": False, "contas": False},
}
# Ações que qualquer perfil pode fazer, mesmo sem poder alterar dados
ROTAS_LIVRES = {("POST", "/api/admin/auditoria/exportacao"), ("POST", "/api/admin/gestao/minha-senha")}


@dataclass
class GestorAtual:
    id: Optional[int]
    nome: str
    usuario: str
    papel: str
    instalacao: bool = False
    deve_trocar_senha: bool = False

    @property
    def permissoes(self) -> dict:
        return PERFIS_GESTAO.get(self.papel, PERFIS_GESTAO["visualizar"])
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


def criar_token_admin(gestor: Optional[UsuarioGestao] = None) -> str:
    """Token do painel: de uma conta da gestão ou, sem conta, o da instalação."""
    agora = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(gestor.id) if gestor else INSTALACAO,
        "papel": "admin",
        "v": (gestor.sessao_versao or 0) if gestor else 0,
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


def existe_administrador(db: Session) -> bool:
    return db.query(UsuarioGestao.id).filter(UsuarioGestao.papel == "administrador", UsuarioGestao.ativo.is_(True)).first() is not None


def carregar_gestor(db: Session, payload: dict) -> Optional[GestorAtual]:
    """Quem é o dono do token -- ou None se a conta sumiu, foi desativada ou mudou de senha/perfil."""
    if payload.get("sub") == INSTALACAO:
        if existe_administrador(db):
            return None  # a senha de instalação morre quando existe um Administrador
        return GestorAtual(id=None, nome="Instalação", usuario=INSTALACAO, papel="administrador", instalacao=True)
    try:
        gestor = db.query(UsuarioGestao).filter(UsuarioGestao.id == int(payload["sub"])).first()
    except (KeyError, ValueError):
        return None
    if not gestor or not gestor.ativo or payload.get("v", 0) != (gestor.sessao_versao or 0):
        return None
    return GestorAtual(id=gestor.id, nome=gestor.nome, usuario=gestor.usuario, papel=gestor.papel, deve_trocar_senha=bool(gestor.deve_trocar_senha))


def get_admin_atual(request: Request, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> GestorAtual:
    """
    Protege as rotas /admin/*: exige o token de uma conta da gestão (ou o da
    instalação). O servidor -- não a tela -- recusa alteração de quem não pode
    alterar e qualquer coisa de quem ainda está com senha temporária.
    O gestor fica em request.state pra auditoria saber quem fez.
    """
    erro = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Acesso restrito à escola. Faça login no painel.")
    payload = _payload_do_token(authorization)
    if not payload or payload.get("papel") != "admin":
        raise erro
    gestor = carregar_gestor(db, payload)
    if gestor is None:
        raise erro
    request.state.gestor = gestor
    metodo, caminho = request.method, request.url.path
    if gestor.deve_trocar_senha and caminho not in ("/api/admin/gestao/minha-senha", "/api/admin/gestao/eu"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Troque a senha temporária antes de continuar.")
    if metodo not in ("GET", "HEAD", "OPTIONS") and not gestor.permissoes["alterar"] and (metodo, caminho) not in ROTAS_LIVRES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"O seu perfil ({gestor.permissoes['rotulo']}) é só de visualização.")
    return gestor


def exigir_auditor(gestor: GestorAtual = Depends(get_admin_atual)) -> GestorAtual:
    if not gestor.permissoes["auditar"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Só os perfis Administrador e Auditor veem a auditoria.")
    return gestor


def exigir_administrador(gestor: GestorAtual = Depends(get_admin_atual)) -> GestorAtual:
    if not gestor.permissoes["contas"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Só o perfil Administrador gerencia as contas da gestão.")
    return gestor


def get_estudante_atual(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Estudante:
    """
    Aluno identificado pelo token emitido em /auth/login (usuário + senha) ou
    no fim do primeiro acesso. Token de admin não serve aqui, nem token de
    antes da última troca de senha (ver "v" em criar_token).
    """
    erro = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada. Entre de novo com seu usuário e senha.")
    payload = _payload_do_token(authorization)
    if not payload or payload.get("papel", "aluno") != "aluno":
        raise erro
    try:
        estudante_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise erro

    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante or payload.get("v", 0) != (estudante.sessao_versao or 0):
        raise erro
    return estudante
