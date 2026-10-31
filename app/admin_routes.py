import json
import secrets
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models import Estudante, Vaga, Candidatura, Turma, Curriculo, HistoricoEntrevista, ObservacaoEstudante, MudancaStatusContratacao, EvidenciaCompetencia, RespostaSituacao, Canal, Mensagem, ContratoAprendizagem
from database import get_db
from services import ITINERARIOS_QUIZ, AIService, calcular_desempenho_para_vaga, taxas_de_acerto_quiz, gerar_nome_exibicao
from auth import ADMIN_SENHA, criar_token_admin, get_admin_atual, normalizar_cpf, cpf_valido
from limiter import limiter
from fuso import hoje as hoje_na_escola, agora_utc, data_local
from competencias import mapas_de_varios, nota_de_competencias, mapa_para_tela
from atividades import SITUACOES
from aulas import certificados_dos_alunos
import ficha_pap
from fotos import FotoRequest, salvar_foto, remover_foto, resposta_da_foto, resposta_da_foto_curriculo

# Painel da escola: gestão de turmas/alunos/itinerários e seleção dos alunos
# com melhor desempenho pra indicar a uma vaga de empresa parceira.
# Login separado do app do aluno (que continua sem login).
router = APIRouter(prefix="/admin", tags=["Play2Work.AI - Painel da Escola"])
protegido = [Depends(get_admin_atual)]

# Status de contratação do aluno (fila do PAP) e status de uma candidatura
# Status do aprendiz como na planilha do PAP ("disponivel" é o "No aguardo")
STATUS_CONTRATACAO = ficha_pap.STATUS_APRENDIZ
STATUS_CANDIDATURA = {"enviada": "Enviada", "em_analise": "Em análise", "aprovada": "Aprovada", "recusada": "Recusada"}


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
    telefone: Optional[str] = Field(default=None, max_length=20)
    responsavel_nome: Optional[str] = Field(default=None, max_length=100)
    responsavel_telefone: Optional[str] = Field(default=None, max_length=20)
    ficha: Optional[dict] = None  # campos da planilha do PAP (data/ficha_pap.json)


class AtualizarEstudanteRequest(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=2, max_length=100)
    cpf: Optional[str] = Field(default=None, min_length=11, max_length=14)
    data_nascimento: Optional[date] = None
    email: Optional[EmailStr] = None
    turma_id: Optional[int] = None
    itinerario: Optional[str] = None
    habilidades: Optional[list[str]] = None
    telefone: Optional[str] = Field(default=None, max_length=20)
    responsavel_nome: Optional[str] = Field(default=None, max_length=100)
    responsavel_telefone: Optional[str] = Field(default=None, max_length=20)
    ja_trabalhou: Optional[bool] = None
    experiencia_previa: Optional[str] = Field(default=None, max_length=2000)
    ficha: Optional[dict] = None  # campos da planilha do PAP (data/ficha_pap.json)


class StatusContratacaoRequest(BaseModel):
    status: str
    empresa: Optional[str] = Field(default=None, max_length=100)
    contratado_em: Optional[date] = None


class ObservacaoRequest(BaseModel):
    texto: str = Field(min_length=1, max_length=2000)


class AtualizarCandidaturaRequest(BaseModel):
    status: Optional[str] = None
    resposta_empresa: Optional[str] = Field(default=None, max_length=2000)


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


def _buscar_estudante(estudante_id: int, db: Session) -> Estudante:
    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    return estudante


def _idade(nascimento: Optional[date], hoje: Optional[date] = None) -> Optional[int]:
    if not nascimento:
        return None
    hoje = hoje or hoje_na_escola()
    return hoje.year - nascimento.year - ((hoje.month, hoje.day) < (nascimento.month, nascimento.day))


def _normalizar_telefone(telefone: Optional[str]) -> Optional[str]:
    """Só dígitos, com DDD (10 = fixo, 11 = celular). Vazio vira None."""
    digitos = "".join(c for c in (telefone or "") if c.isdigit())
    if not digitos:
        return None
    if digitos.startswith("55") and len(digitos) in (12, 13):
        digitos = digitos[2:]
    if len(digitos) not in (10, 11):
        raise HTTPException(status_code=400, detail="Telefone inválido — use DDD + número, ex: (67) 99999-0000")
    return digitos


def _iso(valor) -> Optional[str]:
    return valor.isoformat() if valor else None


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
        "total_contratados": db.query(Estudante).filter(Estudante.status_contratacao == "contratado").count(),
        "total_sem_foto": db.query(Estudante).filter(Estudante.foto_atualizada_em.is_(None)).count(),
        "total_turmas": db.query(Turma).count(),
        # Mensagens de alunos que a coordenação ainda não abriu (contador da aba Mensagens)
        "mensagens_nao_lidas": db.query(Mensagem).join(Canal, Canal.id == Mensagem.canal_id).filter(
            Mensagem.autor_tipo == "aluno", or_(Canal.escola_leu_em.is_(None), Mensagem.enviada_em > Canal.escola_leu_em),
        ).count(),
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
def _estudante_para_dict(est: Estudante, taxa_acerto: float | None, total_candidaturas: int, total_indicacoes: int, curriculo_em: Optional[datetime] = None, certificados: Optional[list[dict]] = None, contrato_atual=None) -> dict:
    return {
        "id": est.id,
        "nome": est.nome,
        "nome_exibicao": est.nome_exibicao or est.nome,
        "cpf": est.cpf,
        "data_nascimento": est.data_nascimento.isoformat() if est.data_nascimento else None,
        "email": est.email,
        "linkedin": est.linkedin,
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
        "telefone": est.telefone,
        "responsavel_nome": est.responsavel_nome,
        "responsavel_telefone": est.responsavel_telefone,
        "idade": _idade(est.data_nascimento),
        "status_contratacao": est.status_contratacao or "disponivel",
        "empresa_contratante": est.empresa_contratante,
        "contratado_em": _iso(est.contratado_em),
        "ja_trabalhou": est.ja_trabalhou,
        "experiencia_previa": est.experiencia_previa,
        "tem_foto": est.foto_atualizada_em is not None,
        "foto_no_curriculo": bool(est.foto_no_curriculo),
        "tem_foto_curriculo": est.foto_curriculo_atualizada_em is not None,
        "foto_curriculo_atualizada_em": _iso(est.foto_curriculo_atualizada_em),
        "foto_atualizada_em": _iso(est.foto_atualizada_em),
        "curriculo_atualizado_em": _iso(curriculo_em),
        # Certificado de conclusão da trilha EAD: retirado em mãos na escola
        "certificados_a_retirar": sum(1 for c in certificados or [] if not c["retirado_em"]),
        "certificados_retirados": sum(1 for c in certificados or [] if c["retirado_em"]),
        # Ficha do PAP (colunas da planilha) e o contrato mais recente
        **ficha_pap.para_dict(est, "aluno"),
        "cadastro_atualizado_em": _iso(est.cadastro_atualizado_em),
        "contrato_atual": ficha_pap.contrato_para_dict(contrato_atual),
    }


@router.get("/estudantes", dependencies=protegido)
def listar_estudantes(
    turma_id: Optional[int] = Query(None),
    itinerario: Optional[str] = Query(None),
    status_contratacao: Optional[str] = Query(None),
    busca: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    consulta = db.query(Estudante)
    if turma_id is not None:
        consulta = consulta.filter(Estudante.turma_id == turma_id)
    if status_contratacao:
        consulta = consulta.filter(Estudante.status_contratacao == status_contratacao)
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
    curriculos = dict(
        db.query(Curriculo.estudante_id, func.max(Curriculo.gerado_em))
        .filter(Curriculo.estudante_id.in_(ids)).group_by(Curriculo.estudante_id).all()
    ) if ids else {}

    certificados = certificados_dos_alunos(db, estudantes)
    contratos_atuais = {}
    for contrato in (db.query(ContratoAprendizagem).filter(ContratoAprendizagem.estudante_id.in_(ids))
                     .order_by(ContratoAprendizagem.data_inicial.desc(), ContratoAprendizagem.id.desc()).all() if ids else []):
        contratos_atuais.setdefault(contrato.estudante_id, contrato)

    return [
        _estudante_para_dict(e, taxas[e.id], candidaturas.get(e.id, 0), indicacoes.get(e.id, 0), curriculos.get(e.id), certificados[e.id], contratos_atuais.get(e.id))
        for e in estudantes
    ]


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
        telefone=_normalizar_telefone(data.telefone),
        responsavel_nome=(data.responsavel_nome or "").strip() or None,
        responsavel_telefone=_normalizar_telefone(data.responsavel_telefone),
        cadastro_atualizado_em=hoje_na_escola(),
        **ficha_pap.validar("aluno", data.ficha or {}, parcial=True),
    )
    db.add(estudante)
    db.commit()
    db.refresh(estudante)
    return _estudante_para_dict(estudante, None, 0, 0)


@router.put("/estudantes/{estudante_id}", dependencies=protegido)
def atualizar_estudante(estudante_id: int, data: AtualizarEstudanteRequest, db: Session = Depends(get_db)):
    estudante = _buscar_estudante(estudante_id, db)

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
    if "telefone" in campos:
        estudante.telefone = _normalizar_telefone(data.telefone)
    if "responsavel_nome" in campos:
        estudante.responsavel_nome = (data.responsavel_nome or "").strip() or None
    if "responsavel_telefone" in campos:
        estudante.responsavel_telefone = _normalizar_telefone(data.responsavel_telefone)
    if "ja_trabalhou" in campos:
        estudante.ja_trabalhou = data.ja_trabalhou
    if "experiencia_previa" in campos:
        estudante.experiencia_previa = (data.experiencia_previa or "").strip() or None
    if data.ficha is not None:
        for campo, valor in ficha_pap.validar("aluno", data.ficha, parcial=True).items():
            setattr(estudante, campo, valor)
    estudante.cadastro_atualizado_em = hoje_na_escola()  # "data atualização" da planilha
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
        **ficha_pap.para_dict(estudante, "aluno"),
        "cadastro_atualizado_em": _iso(estudante.cadastro_atualizado_em),
    }


# ---------------------------------------------------------------- contratos (planilha do PAP)
def _marcar_contratado_pelo_contrato(estudante: Estudante, contrato: ContratoAprendizagem, db: Session) -> None:
    """Contrato ativo = aluno contratado por aquela empresa (e o selo do app acompanha)."""
    mudou = estudante.status_contratacao != "contratado" or estudante.empresa_contratante != contrato.empresa
    estudante.status_contratacao = "contratado"
    estudante.empresa_contratante = contrato.empresa
    estudante.contratado_em = contrato.data_inicial
    estudante.categoria_status = AIService.calcular_categoria_status(estudante.xp_total or 0, True)
    if mudou:
        db.add(MudancaStatusContratacao(estudante_id=estudante.id, status="contratado", empresa=contrato.empresa))


@router.get("/estudantes/{estudante_id}/contratos", dependencies=protegido)
def contratos_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    _buscar_estudante(estudante_id, db)
    contratos = (db.query(ContratoAprendizagem).filter(ContratoAprendizagem.estudante_id == estudante_id)
                 .order_by(ContratoAprendizagem.data_inicial.desc(), ContratoAprendizagem.id.desc()).all())
    return [ficha_pap.contrato_para_dict(c) for c in contratos]


@router.post("/estudantes/{estudante_id}/contratos", status_code=status.HTTP_201_CREATED, dependencies=protegido)
def criar_contrato(estudante_id: int, dados: dict, db: Session = Depends(get_db)):
    estudante = _buscar_estudante(estudante_id, db)
    limpos = ficha_pap.validar("contrato", dados)
    ficha_pap.conferir_contrato(limpos)
    contrato = ContratoAprendizagem(estudante_id=estudante.id, **limpos)
    db.add(contrato)
    if contrato.status == "Ativo":
        _marcar_contratado_pelo_contrato(estudante, contrato, db)
    estudante.cadastro_atualizado_em = hoje_na_escola()
    db.commit()
    db.refresh(contrato)
    return ficha_pap.contrato_para_dict(contrato)


@router.put("/contratos/{contrato_id}", dependencies=protegido)
def atualizar_contrato(contrato_id: int, dados: dict, db: Session = Depends(get_db)):
    contrato = db.query(ContratoAprendizagem).filter(ContratoAprendizagem.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    limpos = ficha_pap.validar("contrato", dados)
    ficha_pap.conferir_contrato(limpos)
    for campo, valor in limpos.items():
        setattr(contrato, campo, valor)
    estudante = _buscar_estudante(contrato.estudante_id, db)
    if contrato.status == "Ativo":
        _marcar_contratado_pelo_contrato(estudante, contrato, db)
    # Contrato finalizado não muda o status sozinho: a escola escolhe se o aluno volta
    # pro "No aguardo", se foi desistência ou expirou (bloco de status da ficha)
    estudante.cadastro_atualizado_em = hoje_na_escola()
    db.commit()
    return ficha_pap.contrato_para_dict(contrato)


@router.delete("/contratos/{contrato_id}", dependencies=protegido)
def apagar_contrato(contrato_id: int, db: Session = Depends(get_db)):
    """Pra corrigir um cadastro errado."""
    contrato = db.query(ContratoAprendizagem).filter(ContratoAprendizagem.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    db.delete(contrato)
    db.commit()
    return {"sucesso": True}


@router.put("/estudantes/{estudante_id}/status", dependencies=protegido)
def mudar_status_contratacao(estudante_id: int, data: StatusContratacaoRequest, db: Session = Depends(get_db)):
    """
    Status do aprendiz como na planilha: contratado (com a empresa), no aguardo
    (fila), desistência ou expirado.
    Toda mudança fica registrada em mudancas_status_contratacao.
    """
    if data.status not in STATUS_CONTRATACAO:
        raise HTTPException(status_code=400, detail="Status inválido")
    estudante = _buscar_estudante(estudante_id, db)
    empresa = (data.empresa or "").strip() or None
    if data.status == "contratado":
        if not empresa:
            raise HTTPException(status_code=400, detail="Informe a empresa que contratou o aluno")
        estudante.empresa_contratante = empresa
        estudante.contratado_em = data.contratado_em or hoje_na_escola()
    else:
        estudante.empresa_contratante = None
        estudante.contratado_em = None
    estudante.status_contratacao = data.status
    # O selo do app vira "Contratado" (ou volta pro nível do XP) junto com a marcação da escola
    estudante.categoria_status = AIService.calcular_categoria_status(estudante.xp_total or 0, data.status == "contratado")
    db.add(MudancaStatusContratacao(estudante_id=estudante.id, status=data.status, empresa=empresa))
    db.commit()
    return {
        "status_contratacao": estudante.status_contratacao,
        "empresa_contratante": estudante.empresa_contratante,
        "contratado_em": _iso(estudante.contratado_em),
    }


# ---------------------------------------------------------------- foto
@router.get("/estudantes/{estudante_id}/foto", dependencies=protegido)
def foto_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    return resposta_da_foto(_buscar_estudante(estudante_id, db))


@router.get("/estudantes/{estudante_id}/foto-curriculo", dependencies=protegido)
def foto_do_curriculo_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    """Só leitura: a foto do currículo quem escolhe e envia é o aluno."""
    return resposta_da_foto_curriculo(_buscar_estudante(estudante_id, db))


@router.put("/estudantes/{estudante_id}/foto", dependencies=protegido)
def enviar_foto_do_aluno(estudante_id: int, data: FotoRequest, db: Session = Depends(get_db)):
    """A coordenação também pode cadastrar a foto (ex: tirada na secretaria)."""
    estudante = _buscar_estudante(estudante_id, db)
    salvar_foto(db, estudante, data.imagem_base64, enviada_por="escola")
    db.commit()
    return {"sucesso": True, "foto_atualizada_em": _iso(estudante.foto_atualizada_em)}


@router.delete("/estudantes/{estudante_id}/foto", dependencies=protegido)
def apagar_foto_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    estudante = _buscar_estudante(estudante_id, db)
    remover_foto(estudante)
    db.commit()
    return {"sucesso": True}


# ---------------------------------------------------------------- currículo e histórico
def _curriculo_para_dict(curriculo: Curriculo) -> dict:
    return {
        "id": curriculo.id,
        "curriculo": json.loads(curriculo.texto_curriculo_formatado),
        "texto_original": curriculo.texto_original,
        "gerado_em": _iso(curriculo.gerado_em),
    }


@router.get("/estudantes/{estudante_id}/curriculo", dependencies=protegido)
def curriculo_do_aluno(estudante_id: int, versao_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    """
    Currículo do aluno -- por padrão a versão mais recente (a que o aluno
    gerou por último), com a lista de versões anteriores pra consulta.
    """
    estudante = _buscar_estudante(estudante_id, db)
    versoes = (
        db.query(Curriculo).filter(Curriculo.estudante_id == estudante.id)
        .order_by(Curriculo.gerado_em.desc(), Curriculo.id.desc()).all()
    )
    if not versoes:
        return {"atual": None, "versoes": []}
    escolhida = next((v for v in versoes if v.id == versao_id), None) if versao_id else versoes[0]
    if escolhida is None:
        raise HTTPException(status_code=404, detail="Versão do currículo não encontrada")
    return {
        "atual": _curriculo_para_dict(escolhida),
        "versoes": [{"id": v.id, "gerado_em": _iso(v.gerado_em), "mais_recente": i == 0} for i, v in enumerate(versoes)],
    }


def _entrevistas_por_dia(mensagens: list[HistoricoEntrevista]) -> list[dict]:
    """
    Agrupa as respostas do aluno no simulador por dia, cada uma com a pergunta
    que ela respondeu (a última mensagem da IA antes dela), o feedback e a nota.
    Espera as mensagens em ordem cronológica.
    """
    dias: dict[date, list[dict]] = {}
    ultima_pergunta = None
    for msg in mensagens:
        if msg.remetente == "ai":
            ultima_pergunta = msg.mensagem
            continue
        dia = data_local(msg.enviado_em) or hoje_na_escola()  # dia em Três Lagoas, não em UTC
        dias.setdefault(dia, []).append({
            "pergunta": ultima_pergunta,
            "resposta": msg.mensagem,
            "feedback": msg.feedback_ia,
            "nota": msg.xp_concedido,
        })
    resultado = []
    for dia in sorted(dias, reverse=True):
        itens = dias[dia]
        notas = [i["nota"] for i in itens if i["nota"] is not None]
        resultado.append({
            "data": dia.isoformat(),
            "total_respostas": len(itens),
            "nota_media": round(sum(notas) / len(notas)) if notas else None,
            "itens": itens,
        })
    return resultado


@router.get("/estudantes/{estudante_id}/historico", dependencies=protegido)
def historico_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    """
    Portfólio de evolução do aluno pra ficha da escola: experiência prévia,
    simulador de entrevista, candidaturas/indicações com o retorno das
    empresas, mudanças de status e observações da coordenação.
    """
    estudante = _buscar_estudante(estudante_id, db)
    mensagens = (
        db.query(HistoricoEntrevista).filter(HistoricoEntrevista.estudante_id == estudante.id)
        .order_by(HistoricoEntrevista.enviado_em.desc(), HistoricoEntrevista.id.desc()).limit(400).all()
    )
    candidaturas = (
        db.query(Candidatura).filter(Candidatura.estudante_id == estudante.id)
        .order_by(Candidatura.criada_em.desc()).all()
    )
    return {
        "experiencia": {"ja_trabalhou": estudante.ja_trabalhou, "experiencia_previa": estudante.experiencia_previa},
        "entrevistas": _entrevistas_por_dia(list(reversed(mensagens))),
        "candidaturas": [
            {
                "id": c.id,
                "vaga_id": c.vaga_id,
                "titulo_vaga": c.vaga.titulo_vaga if c.vaga else None,
                "empresa": c.vaga.empresa if c.vaga else None,
                "status": c.status or "enviada",
                "indicada_pela_escola": bool(c.indicada_pela_escola),
                "pontuacao_indicacao": c.pontuacao_indicacao,
                "resposta_empresa": c.resposta_empresa,
                "criada_em": _iso(c.criada_em),
                "atualizada_em": _iso(c.atualizada_em),
            }
            for c in candidaturas
        ],
        "mudancas_status": [
            {"status": m.status, "empresa": m.empresa, "registrada_em": _iso(m.registrada_em)}
            for m in estudante.mudancas_status
        ],
        "observacoes": [
            {"id": o.id, "texto": o.texto, "autor": o.autor, "criada_em": _iso(o.criada_em)}
            for o in estudante.observacoes
        ],
    }


# ---------------------------------------------------------------- mapa de competências
ORIGENS_EVIDENCIA = {"quiz": "Quiz do dia", "entrevista": "Simulador de entrevista", "situacao": "O que você faria?", "aula": "Aula EAD (fixação)"}


@router.get("/estudantes/{estudante_id}/competencias", dependencies=protegido)
def competencias_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    """
    Mapa de competências do aluno (os 10 eixos da BNCC, com a média da turma)
    e de onde veio cada pontuação: as últimas evidências e as escolhas no
    "O que você faria?" -- é o que a escola mostra na prestação de contas.
    """
    estudante = _buscar_estudante(estudante_id, db)
    evidencias = (
        db.query(EvidenciaCompetencia).filter(EvidenciaCompetencia.estudante_id == estudante.id)
        .order_by(EvidenciaCompetencia.criada_em.desc(), EvidenciaCompetencia.id.desc()).limit(30).all()
    )
    situacoes = (
        db.query(RespostaSituacao).filter(RespostaSituacao.estudante_id == estudante.id)
        .order_by(RespostaSituacao.criada_em.desc()).limit(20).all()
    )
    return {
        **mapa_para_tela(db, estudante),
        "evidencias": [
            {"competencia": e.competencia, "pontos": e.pontos, "origem": ORIGENS_EVIDENCIA.get(e.origem, e.origem), "criada_em": _iso(e.criada_em)}
            for e in evidencias
        ],
        "situacoes": [
            {
                "titulo": SITUACOES[r.situacao_id]["titulo"] if r.situacao_id in SITUACOES else r.situacao_id,
                "escolha": SITUACOES[r.situacao_id]["opcoes"][r.opcao_index]["texto"] if r.situacao_id in SITUACOES else None,
                "criada_em": _iso(r.criada_em),
            }
            for r in situacoes
        ],
    }


# ---------------------------------------------------------------- observações internas
@router.post("/estudantes/{estudante_id}/observacoes", status_code=status.HTTP_201_CREATED, dependencies=protegido)
def adicionar_observacao(estudante_id: int, data: ObservacaoRequest, db: Session = Depends(get_db)):
    estudante = _buscar_estudante(estudante_id, db)
    texto = data.texto.strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Escreva a observação")
    observacao = ObservacaoEstudante(estudante_id=estudante.id, texto=texto, autor="Coordenação")
    db.add(observacao)
    db.commit()
    db.refresh(observacao)
    return {"id": observacao.id, "texto": observacao.texto, "autor": observacao.autor, "criada_em": _iso(observacao.criada_em)}


@router.delete("/observacoes/{observacao_id}", dependencies=protegido)
def apagar_observacao(observacao_id: int, db: Session = Depends(get_db)):
    observacao = db.query(ObservacaoEstudante).filter(ObservacaoEstudante.id == observacao_id).first()
    if not observacao:
        raise HTTPException(status_code=404, detail="Observação não encontrada")
    db.delete(observacao)
    db.commit()
    return {"sucesso": True}


# ---------------------------------------------------------------- retorno da empresa
@router.put("/candidaturas/{candidatura_id}", dependencies=protegido)
def atualizar_candidatura(candidatura_id: int, data: AtualizarCandidaturaRequest, db: Session = Depends(get_db)):
    """
    A escola registra o que a empresa parceira respondeu (empresas ainda não
    têm login próprio). Aprovar aqui não marca o aluno como contratado -- isso
    é uma ação separada na ficha, porque aprovação nem sempre vira contrato.
    """
    candidatura = db.query(Candidatura).filter(Candidatura.id == candidatura_id).first()
    if not candidatura:
        raise HTTPException(status_code=404, detail="Candidatura não encontrada")
    campos = data.model_dump(exclude_unset=True)
    if "status" in campos:
        if data.status not in STATUS_CANDIDATURA:
            raise HTTPException(status_code=400, detail="Status inválido")
        candidatura.status = data.status
    if "resposta_empresa" in campos:
        candidatura.resposta_empresa = (data.resposta_empresa or "").strip() or None
    candidatura.atualizada_em = agora_utc()
    db.commit()
    return {
        "id": candidatura.id,
        "status": candidatura.status,
        "resposta_empresa": candidatura.resposta_empresa,
        "atualizada_em": _iso(candidatura.atualizada_em),
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

    taxas = taxas_de_acerto_quiz(db, [e.id for e in estudantes])
    mapas = mapas_de_varios(db, [e.id for e in estudantes])
    candidaturas = {
        c.estudante_id: c for c in db.query(Candidatura).filter(Candidatura.vaga_id == vaga_id).all()
    }

    ranking = []
    for est in estudantes:
        desempenho = calcular_desempenho_para_vaga(est, vaga, taxas[est.id], nota_de_competencias(mapas[est.id]))
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

    taxas = taxas_de_acerto_quiz(db, [e.id for e in estudantes])
    mapas = mapas_de_varios(db, [e.id for e in estudantes])
    existentes = {
        c.estudante_id: c for c in db.query(Candidatura).filter(
            Candidatura.vaga_id == vaga_id, Candidatura.estudante_id.in_(data.estudante_ids),
        ).all()
    }

    novas = 0
    for est in estudantes:
        pontuacao = calcular_desempenho_para_vaga(est, vaga, taxas[est.id], nota_de_competencias(mapas[est.id]))["pontuacao"]
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
