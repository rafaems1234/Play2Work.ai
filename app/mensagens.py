from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from models import Estudante, Turma, Canal, Mensagem, LeituraCanal
from database import get_db
from auth import get_admin_atual, get_estudante_atual
from fuso import agora_utc
from limiter import limiter

# Mensagens do sistema ("um WhatsApp da escola"), com 3 tipos de canal:
#   - 'direto': aluno <-> coordenação, 1:1. Não existe conversa privada entre alunos.
#   - 'grupo':  empresa/turno ("Eldorado -- Aprendizes Manhã"): os aprendizes
#     contratados por aquela empresa (no turno, se houver) conversam entre si e
#     com a coordenação. Sem lista de membros: o vínculo vem do status de
#     contratação, então quem sai da empresa perde o acesso sozinho.
#   - 'geral':  a escola fala com todos. Alunos só leem (ALUNOS_ESCREVEM_NO_GERAL).
# Proteções (a maioria dos alunos é menor de idade): no grupo o aluno aparece
# só pelo nome curto do ranking; nada se edita nem se apaga; a coordenação
# pode ocultar uma mensagem imprópria e o original fica guardado.
router_admin = APIRouter(prefix="/admin", tags=["Play2Work.AI - Mensagens (escola)"], dependencies=[Depends(get_admin_atual)])
router_aluno = APIRouter(tags=["Play2Work.AI - Mensagens (aluno)"])

ALUNOS_ESCREVEM_NO_GERAL = False
NOME_CANAL_GERAL = "Geral da escola"
TAMANHO_MAXIMO_MENSAGEM = 1000
TEXTO_OCULTA = "Mensagem removida pela coordenação."


class TextoRequest(BaseModel):
    texto: str = Field(min_length=1, max_length=TAMANHO_MAXIMO_MENSAGEM)


class NovoDiretoRequest(BaseModel):
    estudante_id: int


class NovoGrupoRequest(BaseModel):
    empresa: str = Field(min_length=2, max_length=100)
    turno: Optional[str] = Field(default=None, max_length=20)
    nome: Optional[str] = Field(default=None, max_length=120)


class AtualizarGrupoRequest(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=2, max_length=120)
    arquivado: Optional[bool] = None


class OcultarRequest(BaseModel):
    motivo: str = Field(min_length=3, max_length=200)


def _iso(valor) -> Optional[str]:
    return valor.isoformat() if valor else None


# ---------------------------------------------------------------- regras de canal
def membros_do_grupo(db: Session, canal: Canal) -> list[Estudante]:
    consulta = db.query(Estudante).filter(Estudante.status_contratacao == "contratado", Estudante.empresa_contratante == canal.empresa)
    if canal.turno:
        consulta = consulta.join(Turma, Turma.id == Estudante.turma_id).filter(Turma.turno == canal.turno)
    return consulta.order_by(Estudante.nome).all()


def eh_membro(db: Session, canal: Canal, estudante: Estudante) -> bool:
    if canal.tipo == "geral":
        return True
    if canal.tipo == "direto":
        return canal.estudante_id == estudante.id
    if canal.arquivado or estudante.status_contratacao != "contratado" or estudante.empresa_contratante != canal.empresa:
        return False
    return not canal.turno or (estudante.turma is not None and estudante.turma.turno == canal.turno)


def canal_geral(db: Session) -> Canal:
    canal = db.query(Canal).filter(Canal.tipo == "geral").first()
    if canal is None:
        canal = Canal(tipo="geral", nome=NOME_CANAL_GERAL)
        db.add(canal)
        db.flush()
    return canal


def canal_direto(db: Session, estudante: Estudante) -> Canal:
    canal = db.query(Canal).filter(Canal.tipo == "direto", Canal.estudante_id == estudante.id).first()
    if canal is None:
        canal = Canal(tipo="direto", nome=estudante.nome, estudante_id=estudante.id)
        db.add(canal)
        db.flush()
    return canal


def _ultima(db: Session, canal_ids: list[int]) -> dict[int, Mensagem]:
    if not canal_ids:
        return {}
    ultimos = dict(db.query(Mensagem.canal_id, func.max(Mensagem.id)).filter(Mensagem.canal_id.in_(canal_ids)).group_by(Mensagem.canal_id).all())
    return {m.canal_id: m for m in db.query(Mensagem).filter(Mensagem.id.in_(list(ultimos.values()) or [0])).all()}


def _autor_para_aluno(m: Mensagem, eu: Estudante) -> str:
    if m.autor_tipo == "escola":
        return "Coordenação"
    if m.estudante_id == eu.id:
        return "Você"
    return (m.estudante.nome_exibicao or m.estudante.nome.split()[0]) if m.estudante else "Aluno"


def _mensagem_para_aluno(m: Mensagem, eu: Estudante) -> dict:
    return {
        "id": m.id,
        "autor": _autor_para_aluno(m, eu),
        "da_escola": m.autor_tipo == "escola",
        "minha": m.autor_tipo == "aluno" and m.estudante_id == eu.id,
        "texto": TEXTO_OCULTA if m.oculta_em else m.texto,
        "oculta": m.oculta_em is not None,
        "enviada_em": _iso(m.enviada_em),
    }


def _mensagem_para_escola(m: Mensagem) -> dict:
    return {
        "id": m.id,
        "autor": "Coordenação" if m.autor_tipo == "escola" else (m.estudante.nome if m.estudante else "Aluno"),
        "estudante_id": m.estudante_id,
        "da_escola": m.autor_tipo == "escola",
        "texto": m.texto,  # a escola sempre vê o original, mesmo oculto
        "oculta_em": _iso(m.oculta_em),
        "oculta_motivo": m.oculta_motivo,
        "enviada_em": _iso(m.enviada_em),
    }


def _previa(m: Optional[Mensagem], para_aluno: bool) -> Optional[dict]:
    if not m:
        return None
    texto = TEXTO_OCULTA if (m.oculta_em and para_aluno) else m.texto
    return {"texto": texto[:120], "da_escola": m.autor_tipo == "escola", "enviada_em": _iso(m.enviada_em)}


# ================================================================ ESCOLA
@router_admin.get("/mensagens/opcoes")
def opcoes_mensagens(db: Session = Depends(get_db)):
    """O que alimenta os filtros e a criação de grupos."""
    empresas = [
        nome for (nome,) in db.query(Estudante.empresa_contratante)
        .filter(Estudante.status_contratacao == "contratado", Estudante.empresa_contratante.isnot(None))
        .distinct().order_by(Estudante.empresa_contratante).all()
    ]
    turnos = [t for (t,) in db.query(Turma.turno).filter(Turma.turno.isnot(None)).distinct().order_by(Turma.turno).all()]
    return {"empresas": empresas, "turnos": turnos, "turmas": [{"id": t.id, "nome": t.nome} for t in db.query(Turma).order_by(Turma.nome).all()]}


@router_admin.get("/mensagens/canais")
def listar_canais_escola(
    tipo: Optional[str] = Query(None),
    empresa: Optional[str] = Query(None),
    turno: Optional[str] = Query(None),
    turma_id: Optional[int] = Query(None),
    busca: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    """
    Central de mensagens: todos os canais com a última mensagem e quantas
    mensagens de alunos a coordenação ainda não leu. Filtros: tipo, empresa,
    turno, turma e busca por nome (aluno da conversa direta ou nome do grupo).
    """
    canal_geral(db)
    db.commit()
    consulta = db.query(Canal).outerjoin(Estudante, Estudante.id == Canal.estudante_id).outerjoin(Turma, Turma.id == Estudante.turma_id)
    if tipo:
        consulta = consulta.filter(Canal.tipo == tipo)
    if empresa:
        consulta = consulta.filter(or_(Canal.empresa == empresa, Estudante.empresa_contratante == empresa))
    if turno:
        consulta = consulta.filter(or_(Canal.turno == turno, Turma.turno == turno))
    if turma_id is not None:
        consulta = consulta.filter(Estudante.turma_id == turma_id)
    if busca:
        termo = f"%{busca.strip().lower()}%"
        consulta = consulta.filter(or_(func.lower(Canal.nome).like(termo), func.lower(Estudante.nome).like(termo)))
    canais = consulta.all()

    ids = [c.id for c in canais]
    ultimas = _ultima(db, ids)
    nao_lidas = dict(
        db.query(Mensagem.canal_id, func.count()).join(Canal, Canal.id == Mensagem.canal_id)
        .filter(Mensagem.canal_id.in_(ids or [0]), Mensagem.autor_tipo == "aluno",
                or_(Canal.escola_leu_em.is_(None), Mensagem.enviada_em > Canal.escola_leu_em))
        .group_by(Mensagem.canal_id).all()
    )
    resultado = []
    for c in canais:
        resultado.append({
            "id": c.id, "tipo": c.tipo, "nome": c.nome, "empresa": c.empresa, "turno": c.turno, "arquivado": bool(c.arquivado),
            "aluno": {"id": c.estudante.id, "nome": c.estudante.nome, "turma": c.estudante.turma.nome if c.estudante.turma else None} if c.estudante else None,
            "total_membros": len(membros_do_grupo(db, c)) if c.tipo == "grupo" else None,
            "ultima_mensagem": _previa(ultimas.get(c.id), para_aluno=False),
            "nao_lidas": nao_lidas.get(c.id, 0),
        })
    # Geral primeiro; depois os com mensagem mais recente
    resultado.sort(key=lambda c: (c["tipo"] != "geral", -(ultimas[c["id"]].id if c["id"] in ultimas else 0)))
    return resultado


@router_admin.post("/mensagens/diretos")
def abrir_conversa_com_aluno(data: NovoDiretoRequest, db: Session = Depends(get_db)):
    estudante = db.query(Estudante).filter(Estudante.id == data.estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    canal = canal_direto(db, estudante)
    db.commit()
    return {"id": canal.id}


@router_admin.post("/mensagens/grupos", status_code=status.HTTP_201_CREATED)
def criar_grupo_empresa(data: NovoGrupoRequest, db: Session = Depends(get_db)):
    empresa = data.empresa.strip()
    turno = (data.turno or "").strip() or None
    if db.query(Canal).filter(Canal.tipo == "grupo", Canal.empresa == empresa, Canal.turno == turno if turno else Canal.turno.is_(None)).first():
        raise HTTPException(status_code=409, detail="Já existe um grupo dessa empresa nesse turno.")
    nome = (data.nome or "").strip() or f"{empresa} — Aprendizes{f' {turno}' if turno else ''}"
    canal = Canal(tipo="grupo", nome=nome, empresa=empresa, turno=turno)
    db.add(canal)
    db.commit()
    db.refresh(canal)
    return {"id": canal.id, "nome": canal.nome, "total_membros": len(membros_do_grupo(db, canal))}


@router_admin.put("/mensagens/grupos/{canal_id}")
def atualizar_grupo_empresa(canal_id: int, data: AtualizarGrupoRequest, db: Session = Depends(get_db)):
    canal = db.query(Canal).filter(Canal.id == canal_id, Canal.tipo == "grupo").first()
    if not canal:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    if data.nome is not None:
        canal.nome = data.nome.strip()
    if data.arquivado is not None:
        canal.arquivado = data.arquivado  # arquivado: alunos não veem nem escrevem; o histórico fica
    db.commit()
    return {"id": canal.id, "nome": canal.nome, "arquivado": canal.arquivado}


@router_admin.get("/mensagens/canais/{canal_id}")
def abrir_canal_escola(canal_id: int, depois_de: Optional[int] = Query(None), db: Session = Depends(get_db)):
    """Conversa completa (inclusive o original das ocultas) e membros do grupo. Marca como lido pela escola."""
    canal = db.query(Canal).filter(Canal.id == canal_id).first()
    if not canal:
        raise HTTPException(status_code=404, detail="Canal não encontrado")
    consulta = db.query(Mensagem).filter(Mensagem.canal_id == canal.id)
    if depois_de:
        consulta = consulta.filter(Mensagem.id > depois_de)
    mensagens = consulta.order_by(Mensagem.id).all()
    canal.escola_leu_em = agora_utc()
    aluno_leu_em = None
    if canal.tipo == "direto":
        leitura = db.query(LeituraCanal).filter(LeituraCanal.canal_id == canal.id, LeituraCanal.estudante_id == canal.estudante_id).first()
        aluno_leu_em = leitura.lida_em if leitura else None
    db.commit()
    return {
        "id": canal.id, "tipo": canal.tipo, "nome": canal.nome, "empresa": canal.empresa, "turno": canal.turno, "arquivado": bool(canal.arquivado),
        "aluno_leu_em": _iso(aluno_leu_em),
        "membros": [{"id": e.id, "nome": e.nome, "turma": e.turma.nome if e.turma else None} for e in membros_do_grupo(db, canal)] if canal.tipo == "grupo" else None,
        "mensagens": [_mensagem_para_escola(m) for m in mensagens],
    }


@router_admin.post("/mensagens/canais/{canal_id}/mensagens", status_code=status.HTTP_201_CREATED)
def escola_envia(canal_id: int, data: TextoRequest, db: Session = Depends(get_db)):
    canal = db.query(Canal).filter(Canal.id == canal_id).first()
    if not canal:
        raise HTTPException(status_code=404, detail="Canal não encontrado")
    texto = data.texto.strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Escreva a mensagem.")
    agora = agora_utc()
    mensagem = Mensagem(canal_id=canal.id, autor_tipo="escola", texto=texto, enviada_em=agora)
    canal.escola_leu_em = agora
    db.add(mensagem)
    db.commit()
    db.refresh(mensagem)
    return _mensagem_para_escola(mensagem)


@router_admin.post("/mensagens/{mensagem_id}/ocultar")
def ocultar_mensagem(mensagem_id: int, data: OcultarRequest, db: Session = Depends(get_db)):
    """Moderação: some pros alunos, o original continua guardado com o motivo."""
    mensagem = db.query(Mensagem).filter(Mensagem.id == mensagem_id).first()
    if not mensagem:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    if mensagem.oculta_em is None:
        mensagem.oculta_em = agora_utc()
        mensagem.oculta_motivo = data.motivo.strip()
        db.commit()
    return _mensagem_para_escola(mensagem)


@router_admin.get("/estudantes/{estudante_id}/mensagens")
def mensagens_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    """Pra ficha: a conversa direta com a coordenação e o que o aluno escreveu nos grupos."""
    estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
    if not estudante:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    direto = db.query(Canal).filter(Canal.tipo == "direto", Canal.estudante_id == estudante.id).first()
    conversa = db.query(Mensagem).filter(Mensagem.canal_id == direto.id).order_by(Mensagem.id).all() if direto else []
    nos_grupos = (
        db.query(Mensagem, Canal.nome).join(Canal, Canal.id == Mensagem.canal_id)
        .filter(Mensagem.estudante_id == estudante.id, Canal.tipo != "direto")
        .order_by(Mensagem.id.desc()).limit(100).all()
    )
    return {
        "canal_direto_id": direto.id if direto else None,
        "conversa_direta": [_mensagem_para_escola(m) for m in conversa],
        "nos_grupos": [{**_mensagem_para_escola(m), "canal": nome} for m, nome in nos_grupos],
    }


# ================================================================ ALUNO
def _canais_do_aluno(db: Session, estudante: Estudante) -> list[Canal]:
    canais = [canal_direto(db, estudante), canal_geral(db)]
    if estudante.status_contratacao == "contratado" and estudante.empresa_contratante:
        grupos = db.query(Canal).filter(Canal.tipo == "grupo", Canal.empresa == estudante.empresa_contratante, Canal.arquivado.is_(False)).all()
        canais += [g for g in grupos if eh_membro(db, g, estudante)]
    return canais


def _nao_lidas(db: Session, estudante: Estudante, canais: list[Canal]) -> dict[int, int]:
    leituras = dict(db.query(LeituraCanal.canal_id, LeituraCanal.lida_em).filter(
        LeituraCanal.estudante_id == estudante.id, LeituraCanal.canal_id.in_([c.id for c in canais] or [0]),
    ).all())
    contagem = {}
    for c in canais:
        consulta = db.query(Mensagem).filter(Mensagem.canal_id == c.id, or_(Mensagem.estudante_id.is_(None), Mensagem.estudante_id != estudante.id))
        if leituras.get(c.id):
            consulta = consulta.filter(Mensagem.enviada_em > leituras[c.id])
        contagem[c.id] = consulta.count()
    return contagem


def _canal_do_aluno(db: Session, estudante: Estudante, canal_id: int) -> Canal:
    canal = db.query(Canal).filter(Canal.id == canal_id).first()
    if not canal or not eh_membro(db, canal, estudante):
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return canal


@router_aluno.get("/mensagens/canais")
def meus_canais(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    canais = _canais_do_aluno(db, estudante)
    db.commit()
    nao_lidas = _nao_lidas(db, estudante, canais)
    ultimas = _ultima(db, [c.id for c in canais])
    return [
        {
            "id": c.id, "tipo": c.tipo,
            "nome": "Coordenação" if c.tipo == "direto" else c.nome,
            "pode_escrever": c.tipo != "geral" or ALUNOS_ESCREVEM_NO_GERAL,
            "ultima_mensagem": _previa(ultimas.get(c.id), para_aluno=True),
            "nao_lidas": nao_lidas.get(c.id, 0),
        }
        for c in canais
    ]


@router_aluno.get("/mensagens/nao-lidas")
def total_nao_lidas(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    canais = _canais_do_aluno(db, estudante)
    db.commit()
    return {"total": sum(_nao_lidas(db, estudante, canais).values())}


@router_aluno.get("/mensagens/canais/{canal_id}")
def abrir_canal_aluno(canal_id: int, depois_de: Optional[int] = Query(None), estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """
    Mensagens do canal (as ocultas aparecem como removidas) e marca como lido.
    No grupo, os colegas aparecem só pelo nome curto -- sem lista de membros.
    """
    canal = _canal_do_aluno(db, estudante, canal_id)
    consulta = db.query(Mensagem).filter(Mensagem.canal_id == canal.id)
    if depois_de:
        consulta = consulta.filter(Mensagem.id > depois_de)
    mensagens = consulta.order_by(Mensagem.id).all()
    agora = agora_utc()
    db.execute(pg_insert(LeituraCanal).values(canal_id=canal.id, estudante_id=estudante.id, lida_em=agora)
               .on_conflict_do_update(index_elements=[LeituraCanal.canal_id, LeituraCanal.estudante_id], set_={"lida_em": agora}))
    db.commit()
    return {
        "id": canal.id, "tipo": canal.tipo, "nome": "Coordenação" if canal.tipo == "direto" else canal.nome,
        "pode_escrever": canal.tipo != "geral" or ALUNOS_ESCREVEM_NO_GERAL,
        # "✓✓ visto" só na conversa direta
        "escola_leu_em": _iso(canal.escola_leu_em) if canal.tipo == "direto" else None,
        "mensagens": [_mensagem_para_aluno(m, estudante) for m in mensagens],
    }


@router_aluno.post("/mensagens/canais/{canal_id}/mensagens", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def aluno_envia(request: Request, canal_id: int, data: TextoRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    canal = _canal_do_aluno(db, estudante, canal_id)
    if canal.tipo == "geral" and not ALUNOS_ESCREVEM_NO_GERAL:
        raise HTTPException(status_code=403, detail="No canal geral só a escola escreve. Fale com a coordenação na conversa direta.")
    texto = data.texto.strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Escreva a mensagem.")
    agora = agora_utc()
    mensagem = Mensagem(canal_id=canal.id, autor_tipo="aluno", estudante_id=estudante.id, texto=texto, enviada_em=agora)
    db.add(mensagem)
    db.execute(pg_insert(LeituraCanal).values(canal_id=canal.id, estudante_id=estudante.id, lida_em=agora)
               .on_conflict_do_update(index_elements=[LeituraCanal.canal_id, LeituraCanal.estudante_id], set_={"lida_em": agora}))
    db.commit()
    db.refresh(mensagem)
    return _mensagem_para_aluno(mensagem, estudante)
