import secrets
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Estudante, Vaga, Candidatura, Turma
from database import get_db
from services import ITINERARIOS_QUIZ, calcular_desempenho_para_vaga, taxas_de_acerto_quiz, gerar_nome_exibicao
from auth import ADMIN_SENHA, criar_token_admin, get_admin_atual, normalizar_cpf, cpf_valido
from limiter import limiter

# Painel da escola: gestão de turmas/alunos/itinerários e seleção dos alunos
# com melhor desempenho pra indicar a uma vaga de empresa parceira.
# Login separado do app do aluno (que continua sem login).
router = APIRouter(prefix="/admin", tags=["Play2Work.AI - Painel da Escola"])
protegido = [Depends(get_admin_atual)]


class AdminLoginRequest(BaseModel):
    senha: str


class TurmaRequest(BaseModel):
    nome: str = Field(min_length=1, max_length=60)
    turno: Optional[str] = Field(default=None, max_length=20)


class NovoEstudanteRequest(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    cpf: str = Field(min_length=11, max_length=14)
    data_nascimento: Optional[date] = None
    email: EmailStr
    turma_id: Optional[int] = None
    itinerario: Optional[str] = None
    habilidades: list[str] = []


class AtualizarEstudanteRequest(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=2, max_length=100)
    cpf: Optional[str] = Field(default=None, min_length=11, max_length=14)
    data_nascimento: Optional[date] = None
    email: Optional[EmailStr] = None
    turma_id: Optional[int] = None
    itinerario: Optional[str] = None
    habilidades: Optional[list[str]] = None


class NovaVagaRequest(BaseModel):
    titulo_vaga: str = Field(min_length=2, max_length=150)
    empresa: str = Field(min_length=2, max_length=100)
    localizacao: str = Field(min_length=2, max_length=100)
    tipo_modalidade: str = Field(min_length=2, max_length=50)
    habilidades_exigidas: list[str] = Field(min_length=1)
    area_itinerario: Optional[str] = None
    descricao_completa: Optional[str] = None


class IndicarRequest(BaseModel):
    estudante_ids: list[int] = Field(min_length=1)


def _validar_itinerario(itinerario: Optional[str]) -> None:
    if itinerario is not None and itinerario not in ITINERARIOS_QUIZ:
        raise HTTPException(status_code=400, detail="Itinerário inválido")


def _validar_turma(turma_id: Optional[int], db: Session) -> None:
    if turma_id is not None and not db.query(Turma).filter(Turma.id == turma_id).first():
        raise HTTPException(status_code=400, detail="Turma não encontrada")


def _validar_cpf_unico(cpf_digitado: str, db: Session, ignorar_id: Optional[int] = None) -> str:
    cpf = normalizar_cpf(cpf_digitado)
    if not cpf_valido(cpf):
        raise HTTPException(status_code=400, detail="CPF inválido — confira os números")
    existente = db.query(Estudante).filter(Estudante.cpf == cpf).first()
    if existente and existente.id != ignorar_id:
        raise HTTPException(status_code=409, detail=f"Esse CPF já está cadastrado ({existente.nome})")
    return cpf


def _validar_email_unico(email: str, db: Session, ignorar_id: Optional[int] = None) -> None:
    existente = db.query(Estudante).filter(Estudante.email == email).first()
    if existente and existente.id != ignorar_id:
        raise HTTPException(status_code=409, detail="Já existe um aluno com esse e-mail")


def _limpar_habilidades(habilidades: list[str]) -> list[str]:
    vistas, limpas = set(), []
    for h in habilidades:
        h = h.strip()
        if h and h.lower() not in vistas:
            vistas.add(h.lower())
            limpas.append(h)
    return limpas


@router.post("/login")
@limiter.limit("10/minute")
def admin_login(request: Request, data: AdminLoginRequest):
    if not ADMIN_SENHA:
        raise HTTPException(status_code=503, detail="Painel da escola desativado: defina ADMIN_SENHA no .env do backend.")
    if not secrets.compare_digest(data.senha.encode("utf-8"), ADMIN_SENHA.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Senha incorreta")
    return {"token": criar_token_admin()}


@router.get("/resumo", dependencies=protegido)
def resumo(db: Session = Depends(get_db)):
    por_itinerario = dict(
        db.query(Estudante.itinerario, func.count(Estudante.id)).group_by(Estudante.itinerario).all()
    )
    return {
        "total_alunos": db.query(Estudante).count(),
        "total_turmas": db.query(Turma).count(),
        "total_vagas": db.query(Vaga).count(),
        "total_indicacoes": db.query(Candidatura).filter(Candidatura.indicada_pela_escola.is_(True)).count(),
        "alunos_por_itinerario": [
            {"itinerario": nome, "total": por_itinerario.get(nome, 0)} for nome in ITINERARIOS_QUIZ
        ] + ([{"itinerario": None, "total": por_itinerario[None]}] if por_itinerario.get(None) else []),
    }


@router.get("/itinerarios", dependencies=protegido)
def listar_itinerarios():
    return {"itinerarios": list(ITINERARIOS_QUIZ.keys())}


# ---------------------------------------------------------------- turmas
@router.get("/turmas", dependencies=protegido)
def listar_turmas(db: Session = Depends(get_db)):
    contagem = dict(db.query(Estudante.turma_id, func.count(Estudante.id)).group_by(Estudante.turma_id).all())
    turmas = db.query(Turma).order_by(Turma.nome).all()
    return [{"id": t.id, "nome": t.nome, "turno": t.turno, "total_alunos": contagem.get(t.id, 0)} for t in turmas]


@router.post("/turmas", status_code=status.HTTP_201_CREATED, dependencies=protegido)
def criar_turma(data: TurmaRequest, db: Session = Depends(get_db)):
    nome = data.nome.strip()
    if db.query(Turma).filter(func.lower(Turma.nome) == nome.lower()).first():
        raise HTTPException(status_code=409, detail="Já existe uma turma com esse nome")
    turma = Turma(nome=nome, turno=data.turno)
    db.add(turma)
    db.commit()
    db.refresh(turma)
    return {"id": turma.id, "nome": turma.nome, "turno": turma.turno, "total_alunos": 0}


# ---------------------------------------------------------------- alunos
def _estudante_para_dict(est: Estudante, taxa_acerto: float | None, total_candidaturas: int, total_indicacoes: int) -> dict:
    return {
        "id": est.id,
        "nome": est.nome,
        "nome_exibicao": est.nome_exibicao or est.nome,
        "cpf": est.cpf,
        "data_nascimento": est.data_nascimento.isoformat() if est.data_nascimento else None,
        "email": est.email,
        "turma_id": est.turma_id,
        "turma": est.turma.nome if est.turma else None,
        "itinerario": est.itinerario,
        "habilidades": est.habilidades or [],
        "xp_total": est.xp_total or 0,
        "nivel": est.nivel_gamificacao or 1,
        "liga": est.liga or "Bronze",
        "ofensiva_dias": est.ofensiva_dias or 0,
        "taxa_acerto_quiz": round(taxa_acerto * 100) if taxa_acerto is not None else None,
        "total_candidaturas": total_candidaturas,
        "total_indicacoes": total_indicacoes,
    }


@router.get("/estudantes", dependencies=protegido)
def listar_estudantes(
    turma_id: Optional[int] = Query(None),
    itinerario: Optional[str] = Query(None),
    busca: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    consulta = db.query(Estudante)
    if turma_id is not None:
        consulta = consulta.filter(Estudante.turma_id == turma_id)
    if itinerario:
        consulta = consulta.filter(Estudante.itinerario == itinerario)
    if busca:
        termo = f"%{busca.strip().lower()}%"
        filtro = func.lower(Estudante.nome).like(termo) | func.lower(Estudante.email).like(termo)
        cpf_busca = normalizar_cpf(busca)
        if cpf_busca:
            filtro = filtro | Estudante.cpf.like(f"%{cpf_busca}%")
        consulta = consulta.filter(filtro)
    estudantes = consulta.order_by(Estudante.xp_total.desc(), Estudante.nome).all()

    ids = [e.id for e in estudantes]
    taxas = taxas_de_acerto_quiz(db, ids)
    candidaturas = dict(
        db.query(Candidatura.estudante_id, func.count(Candidatura.id))
        .filter(Candidatura.estudante_id.in_(ids)).group_by(Candidatura.estudante_id).all()
    ) if ids else {}
    indicacoes = dict(
        db.query(Candidatura.estudante_id, func.count(Candidatura.id))
        .filter(Candidatura.estudante_id.in_(ids), Candidatura.indicada_pela_escola.is_(True))
        .group_by(Candidatura.estudante_id).all()
    ) if ids else {}

    return [_estudante_para_dict(e, taxas[e.id], candidaturas.get(e.id, 0), indicacoes.get(e.id, 0)) for e in estudantes]


@router.post("/estudantes", status_code=status.HTTP_201_CREATED, dependencies=protegido)
def cadastrar_estudante(data: NovoEstudanteRequest, db: Session = Depends(get_db)):
    _validar_itinerario(data.itinerario)
    _validar_turma(data.turma_id, db)
    cpf = _validar_cpf_unico(data.cpf, db)
    _validar_email_unico(data.email, db)

    nome = data.nome.strip()
    estudante = Estudante(
        nome=nome,
        nome_exibicao=gerar_nome_exibicao(db, nome),
        cpf=cpf,
        data_nascimento=data.data_nascimento,
        email=data.email,
        turma_id=data.turma_id,
        itinerario=data.itinerario,
        habilidades=_limpar_habilidades(data.habilidades),
    )
    db.add(estudante)
    db.commit()
    db.refresh(estudante)
    return _estudante_para_dict(estudante, None, 0, 0)


@router.put("/estudantes/{estudante_id}", dependencies=protegido)
def atualizar_estudante(estudante_id: int, data: AtualizarEstudanteRequest, db: Session = Depends(get_db)):
    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    campos = data.model_dump(exclude_unset=True)
    if campos.get("nome") and data.nome.strip() != estudante.nome:
        estudante.nome = data.nome.strip()
        estudante.nome_exibicao = gerar_nome_exibicao(db, estudante.nome, ignorar_id=estudante.id)
    if campos.get("cpf"):
        estudante.cpf = _validar_cpf_unico(data.cpf, db, ignorar_id=estudante.id)
    if campos.get("data_nascimento"):
        estudante.data_nascimento = data.data_nascimento
    if campos.get("email"):
        _validar_email_unico(data.email, db, ignorar_id=estudante.id)
        estudante.email = data.email
    if "itinerario" in campos:
        _validar_itinerario(data.itinerario)
        estudante.itinerario = data.itinerario
    if "turma_id" in campos:
        _validar_turma(data.turma_id, db)
        estudante.turma_id = data.turma_id
    if "habilidades" in campos and data.habilidades is not None:
        estudante.habilidades = _limpar_habilidades(data.habilidades)
    db.commit()
    db.refresh(estudante)
    return {
        "id": estudante.id,
        "nome": estudante.nome,
        "nome_exibicao": estudante.nome_exibicao or estudante.nome,
        "cpf": estudante.cpf,
        "data_nascimento": estudante.data_nascimento.isoformat() if estudante.data_nascimento else None,
        "email": estudante.email,
        "turma_id": estudante.turma_id,
        "turma": estudante.turma.nome if estudante.turma else None,
        "itinerario": estudante.itinerario,
        "habilidades": estudante.habilidades or [],
    }


# ---------------------------------------------------------------- vagas e indicação
def _vaga_para_dict(vaga: Vaga, total_indicados: int = 0) -> dict:
    return {
        "id": vaga.id,
        "titulo_vaga": vaga.titulo_vaga,
        "empresa": vaga.empresa,
        "localizacao": vaga.localizacao,
        "tipo_modalidade": vaga.tipo_modalidade,
        "habilidades_exigidas": vaga.habilidades_exigidas,
        "area_itinerario": vaga.area_itinerario,
        "descricao_completa": vaga.descricao_completa,
        "total_indicados": total_indicados,
    }


@router.get("/vagas", dependencies=protegido)
def listar_vagas(db: Session = Depends(get_db)):
    indicados = dict(
        db.query(Candidatura.vaga_id, func.count(Candidatura.id))
        .filter(Candidatura.indicada_pela_escola.is_(True)).group_by(Candidatura.vaga_id).all()
    )
    return [_vaga_para_dict(v, indicados.get(v.id, 0)) for v in db.query(Vaga).order_by(Vaga.id.desc()).all()]


@router.post("/vagas", status_code=status.HTTP_201_CREATED, dependencies=protegido)
def cadastrar_vaga(data: NovaVagaRequest, db: Session = Depends(get_db)):
    _validar_itinerario(data.area_itinerario)
    vaga = Vaga(
        titulo_vaga=data.titulo_vaga.strip(),
        empresa=data.empresa.strip(),
        localizacao=data.localizacao.strip(),
        tipo_modalidade=data.tipo_modalidade.strip(),
        habilidades_exigidas=_limpar_habilidades(data.habilidades_exigidas),
        area_itinerario=data.area_itinerario,
        descricao_completa=data.descricao_completa,
    )
    db.add(vaga)
    db.commit()
    db.refresh(vaga)
    return _vaga_para_dict(vaga)


@router.get("/vagas/{vaga_id}/ranking", dependencies=protegido)
def ranking_para_vaga(
    vaga_id: int,
    turma_id: Optional[int] = Query(None),
    somente_itinerario_da_vaga: bool = Query(False),
    limite: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Ranqueia os alunos pela nota de desempenho pra essa vaga (ver
    calcular_desempenho_para_vaga), com a composição da nota de cada um --
    é o que a escola usa pra decidir quem indicar.
    """
    vaga = db.query(Vaga).filter(Vaga.id == vaga_id).first()
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    consulta = db.query(Estudante)
    if turma_id is not None:
        consulta = consulta.filter(Estudante.turma_id == turma_id)
    if somente_itinerario_da_vaga and vaga.area_itinerario:
        consulta = consulta.filter(Estudante.itinerario == vaga.area_itinerario)
    estudantes = consulta.all()

    # Engajamento é relativo a toda a base (não só ao filtro), pra a nota de
    # um aluno não mudar só porque a escola filtrou por turma.
    xp_maximo = db.query(func.max(Estudante.xp_total)).scalar() or 0
    taxas = taxas_de_acerto_quiz(db, [e.id for e in estudantes])
    candidaturas = {
        c.estudante_id: c for c in db.query(Candidatura).filter(Candidatura.vaga_id == vaga_id).all()
    }

    ranking = []
    for est in estudantes:
        desempenho = calcular_desempenho_para_vaga(est, vaga, taxas[est.id], xp_maximo)
        candidatura = candidaturas.get(est.id)
        ranking.append({
            "estudante_id": est.id,
            "nome": est.nome,
            "nome_exibicao": est.nome_exibicao or est.nome,
            "turma": est.turma.nome if est.turma else None,
            "itinerario": est.itinerario,
            "xp_total": est.xp_total or 0,
            "ofensiva_dias": est.ofensiva_dias or 0,
            "taxa_acerto_quiz": round(taxas[est.id] * 100) if taxas[est.id] is not None else None,
            **desempenho,
            "candidatou_se": candidatura is not None,
            "indicado": bool(candidatura and candidatura.indicada_pela_escola),
        })
    ranking.sort(key=lambda r: (r["pontuacao"], r["xp_total"]), reverse=True)
    for posicao, item in enumerate(ranking, start=1):
        item["posicao"] = posicao

    return {"vaga": _vaga_para_dict(vaga), "ranking": ranking[:limite], "total_avaliados": len(ranking)}


@router.post("/vagas/{vaga_id}/indicar", dependencies=protegido)
def indicar_para_vaga(vaga_id: int, data: IndicarRequest, db: Session = Depends(get_db)):
    """
    Registra a indicação da escola como candidatura do aluno (marcada como
    indicada_pela_escola). Se o aluno já tinha se candidatado sozinho, só
    marca a indicação na candidatura existente -- não duplica.
    """
    vaga = db.query(Vaga).filter(Vaga.id == vaga_id).first()
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    estudantes = db.query(Estudante).filter(Estudante.id.in_(data.estudante_ids)).all()
    if len(estudantes) != len(set(data.estudante_ids)):
        raise HTTPException(status_code=400, detail="Algum aluno selecionado não existe")

    xp_maximo = db.query(func.max(Estudante.xp_total)).scalar() or 0
    taxas = taxas_de_acerto_quiz(db, [e.id for e in estudantes])
    existentes = {
        c.estudante_id: c for c in db.query(Candidatura).filter(
            Candidatura.vaga_id == vaga_id, Candidatura.estudante_id.in_(data.estudante_ids),
        ).all()
    }

    novas = 0
    for est in estudantes:
        pontuacao = calcular_desempenho_para_vaga(est, vaga, taxas[est.id], xp_maximo)["pontuacao"]
        candidatura = existentes.get(est.id)
        if candidatura is None:
            candidatura = Candidatura(estudante_id=est.id, vaga_id=vaga_id, status="em_analise")
            db.add(candidatura)
        if not candidatura.indicada_pela_escola:
            novas += 1
        candidatura.indicada_pela_escola = True
        candidatura.pontuacao_indicacao = pontuacao
    db.commit()

    return {
        "sucesso": True,
        "indicados": len(estudantes),
        "novas_indicacoes": novas,
        "mensagem": f"{len(estudantes)} aluno(s) indicado(s) para {vaga.titulo_vaga} — {vaga.empresa}.",
    }
