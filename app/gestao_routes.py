"""
Contas da gestão e auditoria do Painel da Escola (perfis em auth.PERFIS_GESTAO).

  POST /admin/login                         usuário + senha (ou a senha de instalação, sem Administrador)
  POST /admin/login/2fa                     2º passo: código do app autenticador (contas com 2FA ativa)
  POST /admin/gestao/2fa/iniciar            gera o segredo e o QR Code pra ativar a verificação em duas etapas
  POST /admin/gestao/2fa/ativar             confirma o 1º código e liga a verificação
  POST /admin/gestao/usuarios/{id}/resetar-2fa    zera a de alguém (celular perdido) [Administrador]
  GET  /admin/gestao/eu                     quem está logado e o que pode
  POST /admin/gestao/minha-senha            troca a própria senha (obrigatório depois de senha temporária)
  GET  /admin/gestao/usuarios               contas da equipe                     [Administrador]
  POST /admin/gestao/usuarios               cria conta e escolhe o perfil        [Administrador]
  PUT  /admin/gestao/usuarios/{id}          muda nome, perfil, ativa/desativa    [Administrador]
  POST /admin/gestao/usuarios/{id}/resetar-senha  senha temporária           [Administrador]
  GET  /admin/auditoria                     o que cada um fez (filtros)          [Administrador, Auditor]
  GET  /admin/auditoria/exportar            CSV do que está filtrado             [Administrador, Auditor]
  POST /admin/auditoria/exportacao          o painel avisa que exportou uma lista (vira registro)
"""
import csv
import io
import secrets
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import auditoria
import dois_fatores
from auth import (
    ADMIN_SENHA, PERFIS_GESTAO, GestorAtual, criar_desafio_2fa, criar_token_admin, escola_de_instalacao, exigir_administrador,
    exigir_auditor, existe_administrador, get_admin_atual, gestor_da_conta, hash_senha, ler_desafio_2fa, verificar_senha,
)
from tenancy import todas_as_escolas
from database import get_db
from fuso import FUSO_ESCOLA, agora_utc
from limiter import limiter
from models import Escola, RegistroAuditoria, UsuarioGestao

router = APIRouter(prefix="/admin", tags=["First2Work.AI - Gestão e auditoria"])

Perfil = Literal["administrador", "auditor", "alterar", "visualizar"]
LOGIN_FALHAS_MAX = 5
LOGIN_BLOQUEIO_MINUTOS = 15
SENHA_MINIMA = 10


class LoginRequest(BaseModel):
    usuario: str = Field(default="", max_length=60)
    senha: str = Field(max_length=200)


class NovaContaRequest(BaseModel):
    nome: str = Field(min_length=3, max_length=100)
    usuario: str = Field(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9._-]+$")
    papel: Perfil


class AtualizarContaRequest(BaseModel):
    nome: Optional[str] = Field(None, min_length=3, max_length=100)
    papel: Optional[Perfil] = None
    ativo: Optional[bool] = None


class Login2faRequest(BaseModel):
    desafio: str = Field(max_length=2000)
    codigo: str = Field(max_length=12)


class Ativar2faRequest(BaseModel):
    codigo: str = Field(max_length=12)


class MinhaSenhaRequest(BaseModel):
    senha_atual: str = Field(max_length=200)
    nova_senha: str = Field(max_length=200)


class ExportacaoRequest(BaseModel):
    descricao: str = Field(min_length=3, max_length=200)  # "lista de alunos (CSV) — turma 3º A, 32 alunos"
    total: Optional[int] = None


def _iso(valor) -> Optional[str]:
    return valor.isoformat() if valor else None


def senha_temporaria() -> str:
    alfabeto = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alfabeto) for _ in range(12))


def _gestor_para_dict(g: GestorAtual) -> dict:
    return {"id": g.id, "nome": g.nome, "usuario": g.usuario, "papel": g.papel, "instalacao": g.instalacao,
            "deve_trocar_senha": g.deve_trocar_senha, "dois_fatores_ativo": g.dois_fatores_ativo,
            "dois_fatores_pendente": g.dois_fatores_pendente, "permissoes": g.permissoes, "perfis": PERFIS_GESTAO,
            "escola": {"id": g.escola_id, "nome": g.escola_nome}}


def _conta_para_dict(c: UsuarioGestao) -> dict:
    return {"id": c.id, "nome": c.nome, "usuario": c.usuario, "papel": c.papel, "ativo": bool(c.ativo),
            "deve_trocar_senha": bool(c.deve_trocar_senha), "dois_fatores_ativo": c.totp_ativado_em is not None,
            "ultimo_acesso_em": _iso(c.ultimo_acesso_em), "criado_em": _iso(c.criado_em)}


def _contar_falha(db: Session, conta: UsuarioGestao, agora) -> None:
    """Senha ou código errado: 5 seguidos travam a conta (os dois contam juntos)."""
    conta.login_falhas = (conta.login_falhas or 0) + 1
    if conta.login_falhas >= LOGIN_FALHAS_MAX:
        conta.login_falhas = 0
        conta.login_bloqueado_ate = agora + timedelta(minutes=LOGIN_BLOQUEIO_MINUTOS)
    db.commit()


# ------------------------------------------------------------------ login

@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    agora = agora_utc()
    usuario = data.usuario.strip().lower()
    escola_inst = escola_de_instalacao(db)
    if escola_inst is not None and not existe_administrador(db, escola_inst.id):
        # Instalação: escola sem nenhum Administrador -> entra-se com a ADMIN_SENHA pra criar o primeiro
        if not ADMIN_SENHA:
            raise HTTPException(status_code=503, detail="Painel ainda não configurado: defina ADMIN_SENHA no .env para criar o primeiro Administrador.")
        if secrets.compare_digest(data.senha.encode("utf-8"), ADMIN_SENHA.encode("utf-8")):
            gestor = GestorAtual(id=None, nome="Instalação", usuario="instalacao", papel="administrador", instalacao=True,
                                 escola_id=escola_inst.id, escola_nome=escola_inst.nome)
            request.state.gestor = gestor
            return {"token": criar_token_admin(), "gestor": _gestor_para_dict(gestor)}
    conta = db.query(UsuarioGestao).filter(UsuarioGestao.usuario == usuario).first() if usuario else None
    if conta and conta.login_bloqueado_ate and conta.login_bloqueado_ate > agora:
        raise HTTPException(status_code=429, detail=f"Muitas tentativas erradas. Espere {LOGIN_BLOQUEIO_MINUTOS} minutos.")
    escola = db.get(Escola, conta.escola_id) if conta else None
    if not conta or not conta.ativo or (escola is not None and not escola.ativa) or not verificar_senha(data.senha, conta.senha_hash):
        if conta:
            _contar_falha(db, conta, agora)
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")
    if conta.totp_ativado_em is not None:
        # Senha certa, mas ainda não entrou: falta o código do celular. As falhas
        # não zeram aqui, senão daria pra chutar o código acertando a senha de novo.
        request.state.login_parcial = True
        return {"precisa_2fa": True, "desafio": criar_desafio_2fa(conta)}
    return _concluir_login(request, db, conta, escola, agora)


def _concluir_login(request: Request, db: Session, conta: UsuarioGestao, escola, agora) -> dict:
    conta.login_falhas = 0
    conta.login_bloqueado_ate = None
    conta.ultimo_acesso_em = agora
    db.commit()
    gestor = gestor_da_conta(conta, escola)
    request.state.gestor = gestor  # a auditoria registra quem entrou
    return {"token": criar_token_admin(conta), "gestor": _gestor_para_dict(gestor)}


@router.post("/login/2fa")
@limiter.limit("10/minute")
def login_2fa(request: Request, data: Login2faRequest, db: Session = Depends(get_db)):
    agora = agora_utc()
    payload = ler_desafio_2fa(data.desafio)
    if not payload:
        raise HTTPException(status_code=401, detail="O tempo pra digitar o código acabou. Entre de novo com usuário e senha.")
    conta = db.query(UsuarioGestao).filter(UsuarioGestao.id == int(payload["sub"])).first()
    if conta:
        request.state.usuario_tentado = conta.usuario
    if not conta or not conta.ativo or payload.get("v", 0) != (conta.sessao_versao or 0) or conta.totp_ativado_em is None:
        raise HTTPException(status_code=401, detail="O tempo pra digitar o código acabou. Entre de novo com usuário e senha.")
    if conta.login_bloqueado_ate and conta.login_bloqueado_ate > agora:
        raise HTTPException(status_code=429, detail=f"Muitas tentativas erradas. Espere {LOGIN_BLOQUEIO_MINUTOS} minutos.")
    escola = db.get(Escola, conta.escola_id) if conta.escola_id else None
    if escola is not None and not escola.ativa:
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")
    passo = dois_fatores.verificar(conta.totp_segredo, data.codigo, conta.totp_ultimo_passo)
    if passo is None:
        _contar_falha(db, conta, agora)
        raise HTTPException(status_code=401, detail="Código incorreto ou já usado. Confira o app autenticador e tente o próximo código.")
    conta.totp_ultimo_passo = passo
    return _concluir_login(request, db, conta, escola, agora)


@router.get("/gestao/eu")
def eu(gestor: GestorAtual = Depends(get_admin_atual)):
    return _gestor_para_dict(gestor)


@router.post("/gestao/minha-senha")
def minha_senha(data: MinhaSenhaRequest, gestor: GestorAtual = Depends(get_admin_atual), db: Session = Depends(get_db)):
    if gestor.instalacao:
        raise HTTPException(status_code=400, detail="A conta de instalação não tem senha própria: crie a sua conta de Administrador.")
    conta = db.query(UsuarioGestao).filter(UsuarioGestao.id == gestor.id).first()
    if not conta or not verificar_senha(data.senha_atual, conta.senha_hash):
        raise HTTPException(status_code=403, detail="Senha atual incorreta.")
    nova = data.nova_senha
    if len(nova) < SENHA_MINIMA or not any(c.isalpha() for c in nova) or not any(c.isdigit() for c in nova):
        raise HTTPException(status_code=422, detail=f"A senha precisa de pelo menos {SENHA_MINIMA} caracteres, com letras e números.")
    if nova == data.senha_atual or conta.usuario in nova.lower():
        raise HTTPException(status_code=422, detail="Escolha uma senha diferente da atual e que não contenha o seu usuário.")
    conta.senha_hash = hash_senha(nova)
    conta.deve_trocar_senha = False
    conta.sessao_versao = (conta.sessao_versao or 0) + 1
    db.commit()
    return {"token": criar_token_admin(conta)}


# ------------------------------------------------------------------ verificação em duas etapas (a própria conta)

def _minha_conta(db: Session, gestor: GestorAtual) -> UsuarioGestao:
    if gestor.instalacao:
        raise HTTPException(status_code=400, detail="A conta de instalação é provisória: crie a sua conta de Administrador e ative nela.")
    conta = db.query(UsuarioGestao).filter(UsuarioGestao.id == gestor.id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    return conta


@router.post("/gestao/2fa/iniciar")
def iniciar_2fa(gestor: GestorAtual = Depends(get_admin_atual), db: Session = Depends(get_db)):
    """Novo segredo (ainda não vale). Chamar de novo troca o segredo e invalida o QR anterior."""
    conta = _minha_conta(db, gestor)
    if conta.totp_ativado_em is not None:
        raise HTTPException(status_code=409, detail="A verificação em duas etapas já está ativa nesta conta.")
    conta.totp_segredo = dois_fatores.novo_segredo()
    conta.totp_ultimo_passo = None
    db.commit()
    link = dois_fatores.uri(conta.totp_segredo, conta.usuario)
    return {"segredo": conta.totp_segredo, "uri": link, "qr": dois_fatores.qr_svg(link)}


@router.post("/gestao/2fa/ativar")
@limiter.limit("10/minute")
def ativar_2fa(request: Request, data: Ativar2faRequest, gestor: GestorAtual = Depends(get_admin_atual), db: Session = Depends(get_db)):
    """Confere o primeiro código e liga. As outras sessões abertas (sem 2FA) caem."""
    conta = _minha_conta(db, gestor)
    if conta.totp_ativado_em is not None:
        raise HTTPException(status_code=409, detail="A verificação em duas etapas já está ativa nesta conta.")
    if not conta.totp_segredo:
        raise HTTPException(status_code=409, detail="Gere o QR Code primeiro.")
    passo = dois_fatores.verificar(conta.totp_segredo, data.codigo, None)
    if passo is None:
        raise HTTPException(status_code=422, detail="Código incorreto. Confira se o relógio do celular está certo e digite o código que aparece agora.")
    conta.totp_ativado_em = agora_utc()
    conta.totp_ultimo_passo = passo
    conta.sessao_versao = (conta.sessao_versao or 0) + 1
    db.commit()
    return {"token": criar_token_admin(conta)}


# ------------------------------------------------------------------ contas da equipe (Administrador)

@router.get("/gestao/usuarios")
def listar_contas(_: GestorAtual = Depends(exigir_administrador), db: Session = Depends(get_db)):
    return [_conta_para_dict(c) for c in db.query(UsuarioGestao).order_by(UsuarioGestao.ativo.desc(), UsuarioGestao.nome).all()]


@router.post("/gestao/usuarios", status_code=201)
def criar_conta(data: NovaContaRequest, _: GestorAtual = Depends(exigir_administrador), db: Session = Depends(get_db)):
    usuario = data.usuario.strip().lower()
    # Usuário de login é único no sistema todo (todas as escolas): o login não pergunta a escola
    if usuario == "instalacao" or todas_as_escolas(db.query(UsuarioGestao.id).filter(UsuarioGestao.usuario == usuario)).first():
        raise HTTPException(status_code=409, detail="Esse usuário já existe. Escolha outro.")
    senha = senha_temporaria()
    conta = UsuarioGestao(nome=data.nome.strip(), usuario=usuario, senha_hash=hash_senha(senha), papel=data.papel, ativo=True, deve_trocar_senha=True)
    db.add(conta)
    db.commit()
    db.refresh(conta)
    # A senha temporária só aparece agora; no primeiro login a pessoa é obrigada a trocar
    return {**_conta_para_dict(conta), "senha_temporaria": senha}


def _restaria_administrador(db: Session, sem_conta_id: int) -> bool:
    return db.query(UsuarioGestao.id).filter(
        UsuarioGestao.papel == "administrador", UsuarioGestao.ativo.is_(True), UsuarioGestao.id != sem_conta_id,
    ).first() is not None


@router.put("/gestao/usuarios/{conta_id}")
def atualizar_conta(conta_id: int, data: AtualizarContaRequest, gestor: GestorAtual = Depends(exigir_administrador), db: Session = Depends(get_db)):
    conta = db.query(UsuarioGestao).filter(UsuarioGestao.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    tira_administrador = conta.papel == "administrador" and conta.ativo and (
        (data.papel is not None and data.papel != "administrador") or data.ativo is False
    )
    if tira_administrador and not _restaria_administrador(db, conta.id):
        raise HTTPException(status_code=409, detail="Precisa existir pelo menos um Administrador ativo. Crie outro antes.")
    if conta.id == gestor.id and data.ativo is False:
        raise HTTPException(status_code=409, detail="Você não pode desativar a sua própria conta.")
    mudou_acesso = (data.papel is not None and data.papel != conta.papel) or (data.ativo is not None and data.ativo != conta.ativo)
    if data.nome is not None:
        conta.nome = data.nome.strip()
    if data.papel is not None:
        conta.papel = data.papel
    if data.ativo is not None:
        conta.ativo = data.ativo
    if mudou_acesso:
        conta.sessao_versao = (conta.sessao_versao or 0) + 1  # derruba as sessões abertas: vale o perfil novo já
    db.commit()
    return _conta_para_dict(conta)


@router.post("/gestao/usuarios/{conta_id}/resetar-senha")
def resetar_senha(conta_id: int, _: GestorAtual = Depends(exigir_administrador), db: Session = Depends(get_db)):
    conta = db.query(UsuarioGestao).filter(UsuarioGestao.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    senha = senha_temporaria()
    conta.senha_hash = hash_senha(senha)
    conta.deve_trocar_senha = True
    conta.login_falhas = 0
    conta.login_bloqueado_ate = None
    conta.sessao_versao = (conta.sessao_versao or 0) + 1
    db.commit()
    return {"senha_temporaria": senha}


@router.post("/gestao/usuarios/{conta_id}/resetar-2fa")
def resetar_2fa(conta_id: int, _: GestorAtual = Depends(exigir_administrador), db: Session = Depends(get_db)):
    """Celular perdido ou trocado: a pessoa ativa de novo no próximo login."""
    conta = db.query(UsuarioGestao).filter(UsuarioGestao.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    conta.totp_segredo = None
    conta.totp_ativado_em = None
    conta.totp_ultimo_passo = None
    conta.sessao_versao = (conta.sessao_versao or 0) + 1
    db.commit()
    return _conta_para_dict(conta)


# ------------------------------------------------------------------ auditoria (Administrador, Auditor)

def _filtrar(db: Session, escola_id, usuario_id, acao, entidade, de, ate, busca):
    # A auditoria fica fora do filtro automático (tem registro sem escola): filtra aqui
    consulta = db.query(RegistroAuditoria).filter(RegistroAuditoria.escola_id == escola_id)
    if usuario_id:
        consulta = consulta.filter(RegistroAuditoria.usuario_gestao_id == usuario_id)
    if acao:
        consulta = consulta.filter(RegistroAuditoria.acao == acao)
    if entidade:
        consulta = consulta.filter(RegistroAuditoria.entidade == entidade)
    # Datas no fuso da escola, guardadas em UTC
    if de:
        consulta = consulta.filter(RegistroAuditoria.criado_em >= datetime.combine(de, time.min, FUSO_ESCOLA).astimezone(timezone.utc).replace(tzinfo=None))
    if ate:
        consulta = consulta.filter(RegistroAuditoria.criado_em < datetime.combine(ate + timedelta(days=1), time.min, FUSO_ESCOLA).astimezone(timezone.utc).replace(tzinfo=None))
    if busca:
        termo = f"%{busca.strip().lower()}%"
        consulta = consulta.filter(or_(func.lower(RegistroAuditoria.descricao).like(termo), func.lower(RegistroAuditoria.usuario_nome).like(termo)))
    return consulta


def _registro_para_dict(r: RegistroAuditoria) -> dict:
    return {
        "id": r.id, "criado_em": _iso(r.criado_em), "usuario_gestao_id": r.usuario_gestao_id, "usuario_nome": r.usuario_nome,
        "papel": r.papel, "acao": r.acao, "acao_rotulo": auditoria.ACOES.get(r.acao, r.acao), "entidade": r.entidade,
        "entidade_id": r.entidade_id, "descricao": r.descricao, "dados": r.dados, "antes": r.antes, "ip": r.ip,
    }


@router.get("/auditoria")
def listar_auditoria(
    usuario_id: Optional[int] = None, acao: Optional[str] = Query(None, max_length=15), entidade: Optional[str] = Query(None, max_length=40),
    de: Optional[date] = None, ate: Optional[date] = None, busca: Optional[str] = Query(None, max_length=100),
    pagina: int = Query(1, ge=1), por_pagina: int = Query(50, ge=1, le=200),
    gestor: GestorAtual = Depends(exigir_auditor), db: Session = Depends(get_db),
):
    if auditoria.purgar_antigos(db):  # o que passou de 2 anos sai
        db.commit()
    consulta = _filtrar(db, gestor.escola_id, usuario_id, acao, entidade, de, ate, busca)
    total = consulta.count()
    itens = consulta.order_by(RegistroAuditoria.criado_em.desc(), RegistroAuditoria.id.desc()).offset((pagina - 1) * por_pagina).limit(por_pagina).all()
    entidades = sorted(e for (e,) in db.query(RegistroAuditoria.entidade).filter(RegistroAuditoria.escola_id == gestor.escola_id).distinct().all() if e)
    pessoas = db.query(UsuarioGestao.id, UsuarioGestao.nome).order_by(UsuarioGestao.nome).all()
    return {
        "itens": [_registro_para_dict(r) for r in itens], "total": total, "pagina": pagina, "por_pagina": por_pagina,
        "acoes": auditoria.ACOES, "entidades": entidades, "pessoas": [{"id": i, "nome": n} for i, n in pessoas],
        "retencao_dias": auditoria.RETENCAO_DIAS,
    }


@router.get("/auditoria/exportar")
def exportar_auditoria(
    request: Request,
    usuario_id: Optional[int] = None, acao: Optional[str] = Query(None, max_length=15), entidade: Optional[str] = Query(None, max_length=40),
    de: Optional[date] = None, ate: Optional[date] = None, busca: Optional[str] = Query(None, max_length=100),
    gestor: GestorAtual = Depends(exigir_auditor), db: Session = Depends(get_db),
):
    registros = _filtrar(db, gestor.escola_id, usuario_id, acao, entidade, de, ate, busca).order_by(RegistroAuditoria.criado_em.desc()).limit(50_000).all()
    saida = io.StringIO()
    saida.write("﻿")  # BOM: o Excel em português abre com acento certo
    escritor = csv.writer(saida, delimiter=";")
    escritor.writerow(["Data e hora", "Quem", "Perfil", "Ação", "O quê", "Registro", "IP"])

    def celula(valor) -> str:
        texto = "" if valor is None else str(valor)
        return f"'{texto}" if texto[:1] in ("=", "+", "-", "@") else texto  # anti-injeção de fórmula

    for r in registros:
        quando = r.criado_em.replace(tzinfo=timezone.utc).astimezone(FUSO_ESCOLA).strftime("%d/%m/%Y %H:%M:%S") if r.criado_em else ""
        escritor.writerow([quando, celula(r.usuario_nome), celula(r.papel), auditoria.ACOES.get(r.acao, r.acao), celula(r.descricao),
                           celula(f"{r.entidade or ''} {r.entidade_id or ''}".strip()), celula(r.ip)])
    # Exportar a auditoria também é auditado (GET não passa pelo middleware)
    auditoria.gravar({
        "escola_id": gestor.escola_id, "usuario_gestao_id": gestor.id, "usuario_nome": gestor.nome, "papel": gestor.papel, "acao": "exportou", "entidade": "auditoria",
        "entidade_id": None, "metodo": "GET", "caminho": str(request.url.path), "status_http": 200, "dados": {"total": len(registros)},
        "antes": None, "ip": request.client.host if request.client else None, "ids": (), "modelo_descricao": f"Exportou a auditoria (CSV, {len(registros)} registros)",
    })
    nome = f"auditoria-{agora_utc().strftime('%Y%m%d-%H%M')}.csv"
    return StreamingResponse(iter([saida.getvalue()]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{nome}"'})


@router.post("/auditoria/exportacao")
def registrar_exportacao(data: ExportacaoRequest, _: GestorAtual = Depends(get_admin_atual)):
    """O painel avisa aqui quando exporta uma lista (CSV/PDF); quem grava o registro é o middleware de auditoria."""
    return {"registrado": True}
