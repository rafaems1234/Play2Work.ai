"""
Rotas de acesso do aluno (login, primeiro acesso, pedido de senha nova, troca
de senha) e do painel (códigos de acesso e aprovação dos pedidos). Regras em
acesso.py.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import acesso
from acesso import AcessoNegado
from auth import criar_token, get_admin_atual, get_estudante_atual, verificar_senha
from database import get_db
from fuso import agora_utc
from limiter import limiter
from models import Estudante, PedidoNovaSenha, Turma

router_aluno = APIRouter(tags=["Play2Work.AI - Acesso do aluno"])
router_admin = APIRouter(prefix="/admin", tags=["Play2Work.AI - Painel da Escola"], dependencies=[Depends(get_admin_atual)])


class LoginRequest(BaseModel):
    usuario: str = Field(max_length=60)
    senha: str = Field(max_length=200)


class CodigoRequest(BaseModel):
    cpf: str = Field(max_length=20)
    codigo: str = Field(max_length=20)


class PrimeiroAcessoRequest(CodigoRequest):
    nova_senha: str = Field(max_length=200)


class EsqueciSenhaRequest(BaseModel):
    identificador: str = Field(min_length=3, max_length=60)


class TrocarSenhaRequest(BaseModel):
    senha_atual: str = Field(max_length=200)
    nova_senha: str = Field(max_length=200)


class RecusarPedidoRequest(BaseModel):
    motivo: Optional[str] = Field(None, max_length=200)


class CodigosTurmaRequest(BaseModel):
    apenas_sem_acesso: bool = True  # False = gera pra turma inteira (quem já tinha senha continua com ela até usar o código)


def _erro(e: AcessoNegado) -> HTTPException:
    return HTTPException(status_code=e.status_code, detail=e.mensagem)


def _sessao(estudante: Estudante) -> dict:
    return {
        "token": criar_token(estudante.id, estudante.sessao_versao or 0),
        "estudante": {"id": estudante.id, "nome": estudante.nome, "usuario": estudante.usuario},
    }


def _iso(valor) -> Optional[str]:
    return valor.isoformat() if valor else None


# ====================================================================== aluno

# Limite por IP folgado: no laboratório a turma inteira sai pelo mesmo IP e
# entra ao mesmo tempo. Quem segura chute de senha é a trava por conta.
@router_aluno.post("/auth/login")
@limiter.limit("60/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    try:
        estudante = acesso.autenticar(db, data.usuario, data.senha, agora_utc())
    except AcessoNegado as e:
        raise _erro(e)
    db.commit()
    return _sessao(estudante)


@router_aluno.post("/auth/primeiro-acesso/conferir")
@limiter.limit("20/minute")
def conferir_codigo(request: Request, data: CodigoRequest, db: Session = Depends(get_db)):
    """Passo 1: CPF + código certos mostram o usuário do aluno (sem logar ainda)."""
    try:
        estudante = acesso.conferir_codigo(db, data.cpf, data.codigo, agora_utc())
    except AcessoNegado as e:
        raise _erro(e)
    return {
        "usuario": estudante.usuario,
        "primeiro_nome": (estudante.nome or "").split()[0] if estudante.nome else "",
        "ja_tinha_senha": bool(estudante.senha_hash),
    }


@router_aluno.post("/auth/primeiro-acesso")
@limiter.limit("20/minute")
def primeiro_acesso(request: Request, data: PrimeiroAcessoRequest, db: Session = Depends(get_db)):
    """Passo 2: confere CPF + código de novo, cria a senha e já entra."""
    agora = agora_utc()
    try:
        estudante = acesso.conferir_codigo(db, data.cpf, data.codigo, agora)
        acesso.definir_senha(db, estudante, data.nova_senha, agora)
    except AcessoNegado as e:
        raise _erro(e)
    db.commit()
    return _sessao(estudante)


@router_aluno.post("/auth/esqueci-senha")
@limiter.limit("5/minute")
def esqueci_senha(request: Request, data: EsqueciSenhaRequest, db: Session = Depends(get_db)):
    # A resposta é sempre a mesma, exista o usuário/CPF ou não.
    acesso.registrar_pedido(db, data.identificador)
    return {
        "mensagem": "Pedido enviado para a coordenação. Quando for aprovado, a escola entrega um código "
                    "pra você: use em \"Tenho um código\" na tela de entrada, com o seu CPF.",
    }


@router_aluno.post("/auth/trocar-senha")
@limiter.limit("10/minute")
def trocar_senha(request: Request, data: TrocarSenhaRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """Troca pela tela "Minha conta", sabendo a senha atual. Devolve um token novo: as outras sessões caem."""
    if not estudante.senha_hash or not verificar_senha(data.senha_atual, estudante.senha_hash):
        # 403, não 401: o front trata 401 como sessão expirada e deslogaria o aluno
        raise HTTPException(status_code=403, detail="Senha atual incorreta.")
    if data.nova_senha == data.senha_atual:
        raise HTTPException(status_code=422, detail="A senha nova precisa ser diferente da atual.")
    try:
        acesso.definir_senha(db, estudante, data.nova_senha, agora_utc())
    except AcessoNegado as e:
        raise _erro(e)
    db.commit()
    return {"token": criar_token(estudante.id, estudante.sessao_versao or 0)}


# ====================================================================== painel

def _buscar_aluno(estudante_id: int, db: Session) -> Estudante:
    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    return estudante


def _codigo_para_dict(estudante: Estudante, codigo: str, expira) -> dict:
    return {
        "estudante_id": estudante.id,
        "nome": estudante.nome,
        "turma": estudante.turma.nome if estudante.turma else None,
        "usuario": estudante.usuario,
        "codigo": codigo,
        "expira_em": _iso(expira),
        "ja_tinha_senha": bool(estudante.senha_hash),
    }


def _aprovar_pendentes(db: Session, estudante_id: int, agora) -> None:
    """Gerar código pra quem tem pedido pendente já responde o pedido."""
    for pedido in db.query(PedidoNovaSenha).filter(
        PedidoNovaSenha.estudante_id == estudante_id, PedidoNovaSenha.status == "pendente",
    ).all():
        pedido.status = "aprovado"
        pedido.decidido_em = agora


def _emitir(db: Session, estudante: Estudante, agora) -> dict:
    if not estudante.usuario:
        estudante.usuario = acesso.gerar_usuario(db, estudante.nome)
    if not estudante.cpf:
        raise HTTPException(status_code=422, detail=f"{estudante.nome} não tem CPF cadastrado: o primeiro acesso é com CPF + código.")
    codigo, expira = acesso.emitir_codigo(estudante, agora)
    _aprovar_pendentes(db, estudante.id, agora)
    return _codigo_para_dict(estudante, codigo, expira)


@router_admin.post("/estudantes/{estudante_id}/codigo-acesso")
def gerar_codigo_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    """Código novo pra um aluno (primeiro acesso ou senha esquecida). O código anterior deixa de valer."""
    resultado = _emitir(db, _buscar_aluno(estudante_id, db), agora_utc())
    db.commit()
    return resultado


@router_admin.post("/turmas/{turma_id}/codigos-acesso")
def gerar_codigos_da_turma(turma_id: int, data: CodigosTurmaRequest, db: Session = Depends(get_db)):
    """Códigos da turma inteira de uma vez, pra imprimir e entregar em sala."""
    turma = db.query(Turma).filter(Turma.id == turma_id).first()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    consulta = db.query(Estudante).filter(Estudante.turma_id == turma_id, Estudante.cpf.isnot(None))
    if data.apenas_sem_acesso:
        consulta = consulta.filter(Estudante.senha_hash.is_(None))
    agora = agora_utc()
    codigos = [_emitir(db, est, agora) for est in consulta.order_by(Estudante.nome).all()]
    db.commit()
    return {"turma": turma.nome, "codigos": codigos, "validade_dias": acesso.CODIGO_VALIDADE_DIAS}


@router_admin.get("/pedidos-senha")
def listar_pedidos(situacao: str = Query("pendente", pattern="^(pendente|todos)$"), db: Session = Depends(get_db)):
    consulta = db.query(PedidoNovaSenha)
    if situacao == "pendente":
        consulta = consulta.filter(PedidoNovaSenha.status == "pendente")
    pedidos = consulta.order_by(PedidoNovaSenha.criado_em.desc()).limit(200).all()
    return [
        {
            "id": p.id,
            "estudante_id": p.estudante_id,
            "nome": p.estudante.nome,
            "usuario": p.estudante.usuario,
            "turma": p.estudante.turma.nome if p.estudante.turma else None,
            "telefone": p.estudante.telefone,
            "responsavel_telefone": p.estudante.responsavel_telefone,
            "status": p.status,
            "status_rotulo": acesso.STATUS_PEDIDO.get(p.status, p.status),
            "criado_em": _iso(p.criado_em),
            "decidido_em": _iso(p.decidido_em),
            "concluido_em": _iso(p.concluido_em),
            "motivo_recusa": p.motivo_recusa,
        }
        for p in pedidos
    ]


def _pedido_pendente(pedido_id: int, db: Session) -> PedidoNovaSenha:
    pedido = db.query(PedidoNovaSenha).filter(PedidoNovaSenha.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if pedido.status != "pendente":
        raise HTTPException(status_code=409, detail="Esse pedido já foi respondido.")
    return pedido


@router_admin.post("/pedidos-senha/{pedido_id}/aprovar")
def aprovar_pedido(pedido_id: int, db: Session = Depends(get_db)):
    """Aprova e gera o código que a escola entrega em mãos. A senha antiga vale até o aluno criar a nova."""
    pedido = _pedido_pendente(pedido_id, db)
    resultado = _emitir(db, pedido.estudante, agora_utc())
    db.commit()
    return resultado


@router_admin.post("/pedidos-senha/{pedido_id}/recusar")
def recusar_pedido(pedido_id: int, data: RecusarPedidoRequest, db: Session = Depends(get_db)):
    pedido = _pedido_pendente(pedido_id, db)
    pedido.status = "recusado"
    pedido.decidido_em = agora_utc()
    pedido.motivo_recusa = (data.motivo or "").strip() or None
    db.commit()
    return {"sucesso": True}
