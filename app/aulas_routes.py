import re
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from models import Estudante, ModuloTrilha, Aula, PerguntaFixacao, MaterialAula, ProgressoAula, LogFrequencia, RetiradaCertificado
from database import get_db
from auth import get_admin_atual, get_estudante_atual
from services import ITINERARIOS_QUIZ, AIService
from fuso import agora_utc, hoje
from aulas import (
    extrair_video, buscar_ou_iniciar_progresso, registrar_trecho, estado_do_progresso,
    sortear_fixacao, corrigir_fixacao, certificados_dos_alunos, XP_MODULO_CONCLUIDO,
)

# Trilha EAD. A escola (professores) cadastra módulos, aulas, materiais e a
# fixação; o aluno assiste, a plataforma registra a frequência e a escola
# emite o relatório de carga horária. Regras de frequência em aulas.py.
router_admin = APIRouter(prefix="/admin", tags=["Play2Work.AI - Trilha EAD (escola)"], dependencies=[Depends(get_admin_atual)])
router_aluno = APIRouter(tags=["Play2Work.AI - Trilha EAD (aluno)"])

TAMANHO_MAXIMO_MATERIAL = 10 * 1024 * 1024  # "áudio leve": ~20 min de MP3 a 64 kbps
# Tipo conferido pelos primeiros bytes, não pela extensão. Slides entram como PDF.
ASSINATURAS_MATERIAL = (
    (lambda b: b.startswith(b"%PDF"), "documento", "application/pdf"),
    (lambda b: b.startswith(b"ID3") or b[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"), "audio", "audio/mpeg"),
    (lambda b: b.startswith(b"OggS"), "audio", "audio/ogg"),
    (lambda b: b[4:8] == b"ftyp", "audio", "audio/mp4"),
    (lambda b: b.startswith(b"\x1a\x45\xdf\xa3"), "audio", "audio/webm"),
)


# ---------------------------------------------------------------- schemas
class ModuloRequest(BaseModel):
    titulo: str = Field(min_length=2, max_length=150)
    descricao: Optional[str] = Field(default=None, max_length=2000)
    itinerario: Optional[str] = None
    ordem: int = 0
    publicado: bool = False


class AtualizarModuloRequest(BaseModel):
    titulo: Optional[str] = Field(default=None, min_length=2, max_length=150)
    descricao: Optional[str] = Field(default=None, max_length=2000)
    itinerario: Optional[str] = None
    ordem: Optional[int] = None
    publicado: Optional[bool] = None


class AulaRequest(BaseModel):
    titulo: str = Field(min_length=2, max_length=150)
    descricao: Optional[str] = Field(default=None, max_length=2000)
    ordem: int = 0
    link_video: Optional[str] = Field(default=None, max_length=300)
    duracao_segundos: int = Field(ge=30, le=6 * 3600)  # do vídeo; sem vídeo, tempo de estudo estimado
    texto: Optional[str] = Field(default=None, max_length=50000)
    carga_horaria_minutos: int = Field(ge=1, le=600)
    percentual_minimo_assistido: int = Field(default=80, ge=0, le=100)
    nota_minima: int = Field(default=70, ge=0, le=100)
    publicada: bool = False


class AtualizarAulaRequest(BaseModel):
    titulo: Optional[str] = Field(default=None, min_length=2, max_length=150)
    descricao: Optional[str] = Field(default=None, max_length=2000)
    ordem: Optional[int] = None
    link_video: Optional[str] = Field(default=None, max_length=300)
    duracao_segundos: Optional[int] = Field(default=None, ge=30, le=6 * 3600)
    texto: Optional[str] = Field(default=None, max_length=50000)
    carga_horaria_minutos: Optional[int] = Field(default=None, ge=1, le=600)
    percentual_minimo_assistido: Optional[int] = Field(default=None, ge=0, le=100)
    nota_minima: Optional[int] = Field(default=None, ge=0, le=100)
    publicada: Optional[bool] = None


class PerguntaRequest(BaseModel):
    enunciado: str = Field(min_length=3, max_length=1000)
    opcoes: list[str] = Field(min_length=2, max_length=5)
    resposta_correta_index: int
    explicacao: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("opcoes")
    @classmethod
    def opcoes_preenchidas(cls, opcoes):
        limpas = [o.strip() for o in opcoes]
        if any(not o for o in limpas):
            raise ValueError("Nenhuma alternativa pode ficar em branco")
        return limpas


class PerguntasRequest(BaseModel):
    perguntas: list[PerguntaRequest] = Field(max_length=30)


class TrechoRequest(BaseModel):
    de_segundo: float = Field(ge=0)
    ate_segundo: float = Field(ge=0)


class FixacaoRequest(BaseModel):
    respostas: list[Optional[int]] = Field(max_length=30)


class RetiradaRequest(BaseModel):
    retirado_em: Optional[date] = None  # sem data = hoje
    observacao: Optional[str] = Field(default=None, max_length=200)


# ---------------------------------------------------------------- auxiliares
def _iso(valor) -> Optional[str]:
    return valor.isoformat() if valor else None


def _validar_itinerario(itinerario: Optional[str]) -> None:
    if itinerario is not None and itinerario not in ITINERARIOS_QUIZ:
        raise HTTPException(status_code=400, detail="Itinerário inválido")


def _buscar(db: Session, modelo, id_, rotulo: str):
    objeto = db.query(modelo).filter(modelo.id == id_).first()
    if not objeto:
        raise HTTPException(status_code=404, detail=f"{rotulo} não encontrad{'a' if rotulo.endswith('a') else 'o'}")
    return objeto


def _tem_frequencia(db: Session, aula_ids: list[int]) -> bool:
    return bool(aula_ids) and db.query(ProgressoAula).filter(ProgressoAula.aula_id.in_(aula_ids)).first() is not None


def _material_para_dict(m: MaterialAula) -> dict:
    return {"id": m.id, "tipo": m.tipo, "nome_arquivo": m.nome_arquivo, "tipo_mime": m.tipo_mime, "tamanho_bytes": m.tamanho_bytes}


def _aula_resumo(aula: Aula) -> dict:
    return {
        "id": aula.id, "modulo_id": aula.modulo_id, "titulo": aula.titulo, "descricao": aula.descricao, "ordem": aula.ordem,
        "video_provedor": aula.video_provedor, "video_id": aula.video_id, "duracao_segundos": aula.duracao_segundos,
        "carga_horaria_minutos": aula.carga_horaria_minutos, "percentual_minimo_assistido": aula.percentual_minimo_assistido,
        "nota_minima": aula.nota_minima, "publicada": bool(aula.publicada),
        "total_perguntas": len(aula.perguntas), "total_materiais": len(aula.materiais),
    }


def _modulo_para_dict(modulo: ModuloTrilha, aulas: list[dict]) -> dict:
    return {
        "id": modulo.id, "titulo": modulo.titulo, "descricao": modulo.descricao, "itinerario": modulo.itinerario,
        "ordem": modulo.ordem, "publicado": bool(modulo.publicado), "aulas": aulas,
        "carga_horaria_minutos": sum(a["carga_horaria_minutos"] for a in aulas),
    }


def _nome_arquivo_seguro(nome: str) -> str:
    nome = re.sub(r"[^\w.\- ]", "_", (nome or "material").strip())[:150]
    return nome or "material"


def _resposta_material(material: MaterialAula) -> Response:
    disposicao = "inline" if material.tipo == "audio" else "attachment"
    return Response(
        content=material.conteudo,
        media_type=material.tipo_mime,
        headers={
            "Content-Disposition": f'{disposicao}; filename="{_nome_arquivo_seguro(material.nome_arquivo)}"',
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ================================================================ ESCOLA
@router_admin.get("/trilha")
def admin_trilha(db: Session = Depends(get_db)):
    """Todos os módulos e aulas, publicados ou em rascunho."""
    modulos = db.query(ModuloTrilha).order_by(ModuloTrilha.ordem, ModuloTrilha.id).all()
    return [_modulo_para_dict(m, [_aula_resumo(a) for a in m.aulas]) for m in modulos]


@router_admin.post("/modulos", status_code=status.HTTP_201_CREATED)
def criar_modulo(data: ModuloRequest, db: Session = Depends(get_db)):
    _validar_itinerario(data.itinerario)
    modulo = ModuloTrilha(**data.model_dump())
    db.add(modulo)
    db.commit()
    db.refresh(modulo)
    return _modulo_para_dict(modulo, [])


@router_admin.put("/modulos/{modulo_id}")
def atualizar_modulo(modulo_id: int, data: AtualizarModuloRequest, db: Session = Depends(get_db)):
    modulo = _buscar(db, ModuloTrilha, modulo_id, "Módulo")
    campos = data.model_dump(exclude_unset=True)
    if "itinerario" in campos:
        _validar_itinerario(data.itinerario)
    for campo, valor in campos.items():
        setattr(modulo, campo, valor)
    db.commit()
    return _modulo_para_dict(modulo, [_aula_resumo(a) for a in modulo.aulas])


@router_admin.delete("/modulos/{modulo_id}")
def apagar_modulo(modulo_id: int, db: Session = Depends(get_db)):
    """Só apaga módulo sem frequência registrada -- o resto se despublica, pra não sumir com a auditoria."""
    modulo = _buscar(db, ModuloTrilha, modulo_id, "Módulo")
    if _tem_frequencia(db, [a.id for a in modulo.aulas]):
        raise HTTPException(status_code=409, detail="Alunos já assistiram aulas deste módulo. Despublique em vez de apagar, pra manter o registro de frequência.")
    db.delete(modulo)
    db.commit()
    return {"sucesso": True}


@router_admin.post("/modulos/{modulo_id}/aulas", status_code=status.HTTP_201_CREATED)
def criar_aula(modulo_id: int, data: AulaRequest, db: Session = Depends(get_db)):
    _buscar(db, ModuloTrilha, modulo_id, "Módulo")
    provedor, video_id = extrair_video(data.link_video)
    campos = data.model_dump(exclude={"link_video"})
    aula = Aula(modulo_id=modulo_id, video_provedor=provedor, video_id=video_id, **campos)
    db.add(aula)
    db.commit()
    db.refresh(aula)
    return _aula_resumo(aula)


@router_admin.get("/aulas/{aula_id}")
def admin_aula(aula_id: int, db: Session = Depends(get_db)):
    """Aula completa pra edição -- inclusive o gabarito da fixação."""
    aula = _buscar(db, Aula, aula_id, "Aula")
    return {
        **_aula_resumo(aula),
        "texto": aula.texto,
        "perguntas": [
            {"id": p.id, "enunciado": p.enunciado, "opcoes": p.opcoes, "resposta_correta_index": p.resposta_correta_index, "explicacao": p.explicacao}
            for p in aula.perguntas
        ],
        "materiais": [_material_para_dict(m) for m in aula.materiais],
    }


@router_admin.put("/aulas/{aula_id}")
def atualizar_aula(aula_id: int, data: AtualizarAulaRequest, db: Session = Depends(get_db)):
    aula = _buscar(db, Aula, aula_id, "Aula")
    campos = data.model_dump(exclude_unset=True)
    if "link_video" in campos:
        aula.video_provedor, aula.video_id = extrair_video(campos.pop("link_video"))
    for campo, valor in campos.items():
        setattr(aula, campo, valor)
    aula.atualizada_em = agora_utc()
    db.commit()
    return _aula_resumo(aula)


@router_admin.delete("/aulas/{aula_id}")
def apagar_aula(aula_id: int, db: Session = Depends(get_db)):
    aula = _buscar(db, Aula, aula_id, "Aula")
    if _tem_frequencia(db, [aula.id]):
        raise HTTPException(status_code=409, detail="Alunos já assistiram esta aula. Despublique em vez de apagar, pra manter o registro de frequência.")
    db.delete(aula)
    db.commit()
    return {"sucesso": True}


@router_admin.put("/aulas/{aula_id}/perguntas")
def salvar_perguntas(aula_id: int, data: PerguntasRequest, db: Session = Depends(get_db)):
    """
    Troca a fixação inteira de uma vez (é como a tela de edição trabalha).
    As tentativas antigas continuam no log com a nota e a nota de corte da época.
    """
    aula = _buscar(db, Aula, aula_id, "Aula")
    for i, pergunta in enumerate(data.perguntas):
        if not 0 <= pergunta.resposta_correta_index < len(pergunta.opcoes):
            raise HTTPException(status_code=400, detail=f"Pergunta {i + 1}: marque qual alternativa é a correta")
    aula.perguntas = [
        PerguntaFixacao(enunciado=p.enunciado.strip(), opcoes=p.opcoes, resposta_correta_index=p.resposta_correta_index, explicacao=p.explicacao, ordem=i)
        for i, p in enumerate(data.perguntas)
    ]
    aula.atualizada_em = agora_utc()
    db.commit()
    return {"total_perguntas": len(aula.perguntas)}


@router_admin.post("/aulas/{aula_id}/materiais", status_code=status.HTTP_201_CREATED)
async def enviar_material(aula_id: int, arquivo: UploadFile = File(...), db: Session = Depends(get_db)):
    aula = _buscar(db, Aula, aula_id, "Aula")
    conteudo = await arquivo.read(TAMANHO_MAXIMO_MATERIAL + 1)
    if len(conteudo) > TAMANHO_MAXIMO_MATERIAL:
        raise HTTPException(status_code=413, detail="Arquivo grande demais (máximo 10 MB). Pra áudio, exporte em MP3 de 64 kbps.")
    if not conteudo:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    tipo = next(((t, mime) for confere, t, mime in ASSINATURAS_MATERIAL if confere(conteudo[:16])), None)
    if not tipo:
        raise HTTPException(status_code=400, detail="Formato não suportado: envie áudio (MP3, M4A, OGG) ou PDF. Slides: exporte como PDF.")
    material = MaterialAula(
        aula_id=aula.id, tipo=tipo[0], tipo_mime=tipo[1], tamanho_bytes=len(conteudo),
        nome_arquivo=_nome_arquivo_seguro(arquivo.filename), conteudo=conteudo,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return _material_para_dict(material)


@router_admin.get("/materiais/{material_id}")
def baixar_material_admin(material_id: int, db: Session = Depends(get_db)):
    return _resposta_material(_buscar(db, MaterialAula, material_id, "Material"))


@router_admin.delete("/materiais/{material_id}")
def apagar_material(material_id: int, db: Session = Depends(get_db)):
    db.delete(_buscar(db, MaterialAula, material_id, "Material"))
    db.commit()
    return {"sucesso": True}


@router_admin.get("/relatorios/frequencia")
def relatorio_frequencia(turma_id: Optional[int] = Query(None), modulo_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    """
    Comprovação de carga horária: por aluno, cada aula publicada que se aplica
    a ele (itinerário), com percentual assistido, melhor nota, tentativas e
    data de conclusão -- e o total de carga horária concluída.
    """
    consulta_alunos = db.query(Estudante)
    if turma_id is not None:
        consulta_alunos = consulta_alunos.filter(Estudante.turma_id == turma_id)
    alunos = consulta_alunos.order_by(Estudante.nome).all()

    consulta_aulas = db.query(Aula).join(ModuloTrilha).filter(Aula.publicada.is_(True), ModuloTrilha.publicado.is_(True))
    if modulo_id is not None:
        consulta_aulas = consulta_aulas.filter(Aula.modulo_id == modulo_id)
    aulas = consulta_aulas.order_by(ModuloTrilha.ordem, ModuloTrilha.id, Aula.ordem, Aula.id).all()

    progressos = {
        (p.estudante_id, p.aula_id): p
        for p in db.query(ProgressoAula).filter(
            ProgressoAula.estudante_id.in_([a.id for a in alunos] or [0]), ProgressoAula.aula_id.in_([a.id for a in aulas] or [0]),
        ).all()
    }

    retiradas = {
        (r.estudante_id, r.modulo_id): r.retirado_em
        for r in db.query(RetiradaCertificado).filter(RetiradaCertificado.estudante_id.in_([a.id for a in alunos] or [0])).all()
    }

    linhas = []
    for aluno in alunos:
        aplicaveis = [a for a in aulas if a.modulo.itinerario in (None, aluno.itinerario)]
        detalhes = []
        for aula in aplicaveis:
            p = progressos.get((aluno.id, aula.id))
            detalhes.append({
                "aula_id": aula.id, "aula": aula.titulo, "modulo": aula.modulo.titulo,
                "carga_horaria_minutos": aula.carga_horaria_minutos,
                "percentual_assistido": p.percentual_assistido if p else 0,
                "melhor_nota": p.melhor_nota_fixacao if p else None,
                "nota_minima": aula.nota_minima,
                "tentativas": p.tentativas_fixacao if p else 0,
                "concluida_em": _iso(p.concluida_em) if p else None,
            })
        concluidas = [d for d in detalhes if d["concluida_em"]]
        # Módulos que o aluno terminou -- e se ele já retirou o certificado
        # na escola (é o "quem falta buscar o certificado" da coordenação)
        modulos_concluidos = []
        for modulo in {a.modulo for a in aplicaveis}:
            do_modulo = [d for d in detalhes if d["modulo"] == modulo.titulo]
            if do_modulo and all(d["concluida_em"] for d in do_modulo):
                modulos_concluidos.append({
                    "modulo_id": modulo.id, "modulo": modulo.titulo,
                    "retirado_em": _iso(retiradas.get((aluno.id, modulo.id))),
                })
        linhas.append({
            "estudante_id": aluno.id, "nome": aluno.nome, "cpf": aluno.cpf,
            "turma": aluno.turma.nome if aluno.turma else None, "itinerario": aluno.itinerario,
            "aulas_previstas": len(detalhes), "aulas_concluidas": len(concluidas),
            "carga_prevista_minutos": sum(d["carga_horaria_minutos"] for d in detalhes),
            "carga_concluida_minutos": sum(d["carga_horaria_minutos"] for d in concluidas),
            "modulos_concluidos": sorted(modulos_concluidos, key=lambda m: m["modulo"]),
            "aulas": detalhes,
        })
    return {"gerado_em": _iso(agora_utc()), "alunos": linhas}


def situacao_do_modulo(db: Session, estudante_id: int, modulo: Optional[ModuloTrilha]) -> dict:
    """Quantas aulas publicadas do módulo o aluno já concluiu."""
    if modulo is None:
        return {"aulas_total": 0, "aulas_concluidas": 0, "concluido": True}
    publicadas = [a.id for a in modulo.aulas if a.publicada]
    concluidas = db.query(ProgressoAula).filter(
        ProgressoAula.estudante_id == estudante_id,
        ProgressoAula.aula_id.in_(publicadas or [0]),
        ProgressoAula.concluida_em.isnot(None),
    ).count() if publicadas else 0
    return {"aulas_total": len(publicadas), "aulas_concluidas": concluidas, "concluido": bool(publicadas) and concluidas >= len(publicadas)}


# Certificado de conclusão: entregue em mãos na escola. A plataforma avisa o
# aluno quando ele conclui um módulo e a coordenação registra quem já buscou.
@router_admin.get("/certificados")
def certificados_da_escola(
    turma_id: Optional[int] = Query(None),
    situacao: Optional[str] = Query(None, pattern="^(a_retirar|retirado)$"),
    db: Session = Depends(get_db),
):
    """Todos os certificados de conclusão (um por aluno e módulo concluído), os a retirar primeiro."""
    consulta = db.query(Estudante)
    if turma_id is not None:
        consulta = consulta.filter(Estudante.turma_id == turma_id)
    alunos = consulta.order_by(Estudante.nome).all()
    por_aluno = certificados_dos_alunos(db, alunos)
    linhas = []
    for aluno in alunos:
        for c in por_aluno[aluno.id]:
            if (situacao == "a_retirar" and c["retirado_em"]) or (situacao == "retirado" and not c["retirado_em"]):
                continue
            linhas.append({
                "estudante_id": aluno.id, "nome": aluno.nome, "cpf": aluno.cpf,
                "turma": aluno.turma.nome if aluno.turma else None, "telefone": aluno.telefone,
                "responsavel_nome": aluno.responsavel_nome, "responsavel_telefone": aluno.responsavel_telefone,
                **c,
            })
    linhas.sort(key=lambda l: (l["retirado_em"] is not None, l["nome"].lower()))
    return linhas


@router_admin.get("/estudantes/{estudante_id}/certificados")
def certificados_do_aluno_admin(estudante_id: int, db: Session = Depends(get_db)):
    aluno = _buscar(db, Estudante, estudante_id, "Aluno")
    return certificados_dos_alunos(db, [aluno])[aluno.id]


@router_admin.put("/estudantes/{estudante_id}/certificados/{modulo_id}")
def registrar_retirada(estudante_id: int, modulo_id: int, data: RetiradaRequest, db: Session = Depends(get_db)):
    """A coordenação marca que o aluno (ou o responsável) buscou o certificado. Chamar de novo corrige a data/observação."""
    aluno = _buscar(db, Estudante, estudante_id, "Aluno")
    modulo = _buscar(db, ModuloTrilha, modulo_id, "Módulo")
    if not any(c["modulo_id"] == modulo.id for c in certificados_dos_alunos(db, [aluno])[aluno.id]):
        raise HTTPException(status_code=409, detail=f"{aluno.nome} ainda não concluiu todas as aulas de \"{modulo.titulo}\".")
    retirado_em = data.retirado_em or hoje()
    if retirado_em > hoje():
        raise HTTPException(status_code=400, detail="A data da retirada não pode ser no futuro.")
    observacao = (data.observacao or "").strip() or None
    retirada = db.query(RetiradaCertificado).filter(RetiradaCertificado.estudante_id == aluno.id, RetiradaCertificado.modulo_id == modulo.id).first()
    if retirada:
        retirada.retirado_em, retirada.observacao = retirado_em, observacao
    else:
        db.add(RetiradaCertificado(estudante_id=aluno.id, modulo_id=modulo.id, retirado_em=retirado_em, observacao=observacao))
    db.commit()
    return {"modulo_id": modulo.id, "retirado_em": retirado_em.isoformat(), "observacao": observacao}


@router_admin.delete("/estudantes/{estudante_id}/certificados/{modulo_id}")
def desfazer_retirada(estudante_id: int, modulo_id: int, db: Session = Depends(get_db)):
    """Pra corrigir uma marcação errada (aluno ou módulo trocado): volta a "a retirar"."""
    db.query(RetiradaCertificado).filter(RetiradaCertificado.estudante_id == estudante_id, RetiradaCertificado.modulo_id == modulo_id).delete()
    db.commit()
    return {"sucesso": True}


@router_admin.get("/estudantes/{estudante_id}/frequencia")
def log_frequencia_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    """Trilha de auditoria completa de um aluno, da mais recente pra mais antiga."""
    _buscar(db, Estudante, estudante_id, "Aluno")
    registros = (
        db.query(LogFrequencia, Aula.titulo).join(Aula, Aula.id == LogFrequencia.aula_id)
        .filter(LogFrequencia.estudante_id == estudante_id)
        .order_by(LogFrequencia.registrado_em.desc(), LogFrequencia.id.desc()).limit(500).all()
    )
    return [
        {
            "aula_id": log.aula_id, "aula": titulo, "evento": log.evento, "percentual_assistido": log.percentual_assistido,
            "nota": log.nota, "nota_de_corte": log.nota_de_corte, "registrado_em": _iso(log.registrado_em),
        }
        for log, titulo in registros
    ]


# ================================================================ ALUNO
def _aula_do_aluno(db: Session, estudante: Estudante, aula_id: int) -> Aula:
    """Aula publicada, de módulo publicado, do itinerário do aluno (ou comum a todos)."""
    aula = db.query(Aula).filter(Aula.id == aula_id).first()
    if not aula or not aula.publicada or not aula.modulo.publicado or aula.modulo.itinerario not in (None, estudante.itinerario):
        raise HTTPException(status_code=404, detail="Aula não encontrada")
    return aula


def _progresso(db: Session, estudante: Estudante, aula: Aula, bloquear: bool = False) -> Optional[ProgressoAula]:
    consulta = db.query(ProgressoAula).filter(ProgressoAula.estudante_id == estudante.id, ProgressoAula.aula_id == aula.id)
    # Duas abas abertas mandando trechos ao mesmo tempo não podem apagar os blocos uma da outra
    return (consulta.with_for_update() if bloquear else consulta).first()


@router_aluno.get("/trilha")
def minha_trilha(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    modulos = (
        db.query(ModuloTrilha).filter(ModuloTrilha.publicado.is_(True))
        .filter((ModuloTrilha.itinerario.is_(None)) | (ModuloTrilha.itinerario == estudante.itinerario))
        .order_by(ModuloTrilha.ordem, ModuloTrilha.id).all()
    )
    aula_ids = [a.id for m in modulos for a in m.aulas if a.publicada]
    progressos = {
        p.aula_id: p for p in db.query(ProgressoAula).filter(ProgressoAula.estudante_id == estudante.id, ProgressoAula.aula_id.in_(aula_ids or [0])).all()
    }
    resultado = []
    for modulo in modulos:
        aulas = []
        for aula in (a for a in modulo.aulas if a.publicada):
            p = progressos.get(aula.id)
            aulas.append({
                **{k: v for k, v in _aula_resumo(aula).items() if k not in ("publicada", "video_id", "video_provedor")},
                "tem_video": bool(aula.video_id),
                "percentual_assistido": p.percentual_assistido if p else 0,
                "concluida_em": _iso(p.concluida_em) if p else None,
            })
        resultado.append(_modulo_para_dict(modulo, aulas))
    return resultado


@router_aluno.get("/aulas/{aula_id}")
def ver_aula(aula_id: int, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    aula = _aula_do_aluno(db, estudante, aula_id)
    return {
        **{k: v for k, v in _aula_resumo(aula).items() if k != "publicada"},
        "texto": aula.texto,
        "materiais": [_material_para_dict(m) for m in aula.materiais],
        **estado_do_progresso(aula, _progresso(db, estudante, aula)),
    }


@router_aluno.post("/aulas/{aula_id}/progresso")
def registrar_progresso(aula_id: int, data: TrechoRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """Heartbeat do player: o trecho do conteúdo que acabou de ser reproduzido."""
    aula = _aula_do_aluno(db, estudante, aula_id)
    progresso = _progresso(db, estudante, aula, bloquear=True) or buscar_ou_iniciar_progresso(db, estudante, aula)
    estado = registrar_trecho(db, estudante, aula, progresso, data.de_segundo, data.ate_segundo)
    db.commit()  # assistir só registra frequência; XP e ofensiva vêm ao concluir a aula
    return estado


@router_aluno.get("/aulas/{aula_id}/fixacao")
def ver_fixacao(aula_id: int, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    aula = _aula_do_aluno(db, estudante, aula_id)
    progresso = _progresso(db, estudante, aula, bloquear=True)
    if not progresso or progresso.percentual_assistido < aula.percentual_minimo_assistido:
        raise HTTPException(status_code=403, detail=f"Assista pelo menos {aula.percentual_minimo_assistido}% da aula antes da atividade.")
    perguntas = sortear_fixacao(aula, progresso)
    db.commit()
    return {"perguntas": perguntas, "nota_minima": aula.nota_minima}


@router_aluno.post("/aulas/{aula_id}/fixacao")
def responder_fixacao(aula_id: int, data: FixacaoRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    aula = _aula_do_aluno(db, estudante, aula_id)
    progresso = _progresso(db, estudante, aula, bloquear=True)
    if not progresso:
        raise HTTPException(status_code=403, detail=f"Assista pelo menos {aula.percentual_minimo_assistido}% da aula antes da atividade.")
    resultado = corrigir_fixacao(db, estudante, aula, progresso, data.respostas)
    modulo_concluido = False
    mudanca_liga = None
    if resultado["concluiu_agora"]:
        db.flush()  # a conclusão desta aula entra na contagem do módulo
        modulo_concluido = situacao_do_modulo(db, estudante.id, aula.modulo)["concluido"]
        if modulo_concluido:
            resultado["xp_concedido"] += XP_MODULO_CONCLUIDO  # bônus por terminar o módulo inteiro
        mudanca_liga = AIService.processar_gamificacao_pos_atividade(estudante, db, resultado["xp_concedido"])
    db.commit()
    return {
        **resultado, "novos_pontos_totais": estudante.xp_total, "nivel_atual": estudante.nivel_gamificacao, "mudanca_liga": mudanca_liga,
        # Terminou a última aula do módulo: o app avisa pra buscar o certificado na escola
        "modulo_concluido_agora": modulo_concluido, "modulo": aula.modulo.titulo,
        "xp_bonus_modulo": XP_MODULO_CONCLUIDO if modulo_concluido else 0,
    }


@router_aluno.get("/aulas/{aula_id}/materiais/{material_id}")
def baixar_material(aula_id: int, material_id: int, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    aula = _aula_do_aluno(db, estudante, aula_id)
    material = next((m for m in aula.materiais if m.id == material_id), None)
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado")
    return _resposta_material(material)


@router_aluno.get("/certificados")
def meus_certificados(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """Módulos concluídos e se o certificado já foi retirado na escola (a observação é só da coordenação)."""
    return certificados_dos_alunos(db, [estudante], com_observacao=False)[estudante.id]
