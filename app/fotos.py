import base64
import binascii
from typing import Optional
from fastapi import HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

import armazenamento
from models import Estudante, FotoEstudante, FotoCurriculo
from fuso import agora_utc

# Foto do perfil do aluno: o navegador já recorta e reduz a imagem (canvas ->
# JPEG ~400px, ~50 KB) e manda em base64 dentro do JSON -- dispensa upload
# multipart e uma lib de imagem no servidor. Aqui só se confere tamanho e o
# tipo real pelos primeiros bytes (não pela extensão nem pelo que o cliente diz).
# O arquivo vai pro armazenamento (armazenamento.py) e o banco guarda só a chave.
TAMANHO_MAXIMO_FOTO = 1_000_000  # bytes, depois de decodificar

ASSINATURAS_IMAGEM = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
)


class FotoRequest(BaseModel):
    # data URL ("data:image/jpeg;base64,...") ou base64 puro
    imagem_base64: str = Field(min_length=1, max_length=1_400_000)


def _tipo_da_imagem(conteudo: bytes) -> Optional[str]:
    for assinatura, tipo in ASSINATURAS_IMAGEM:
        if conteudo.startswith(assinatura):
            return tipo
    if conteudo[:4] == b"RIFF" and conteudo[8:12] == b"WEBP":
        return "image/webp"
    return None


def decodificar_foto(texto: str) -> tuple[bytes, str]:
    if texto.startswith("data:"):
        texto = texto.partition(",")[2]
    try:
        conteudo = base64.b64decode(texto, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Imagem inválida.")
    if len(conteudo) > TAMANHO_MAXIMO_FOTO:
        raise HTTPException(status_code=413, detail="Foto grande demais (máximo 1 MB).")
    tipo = _tipo_da_imagem(conteudo)
    if not tipo:
        raise HTTPException(status_code=400, detail="Formato não suportado: envie uma foto JPG, PNG ou WebP.")
    return conteudo, tipo


def comando_upsert_foto(estudante_id: int, arquivo_chave: str, tipo: str, enviada_por: str, agora):
    """
    INSERT ... ON CONFLICT DO UPDATE: se dois envios chegam juntos pro mesmo
    aluno ainda sem foto (clique duplo, ou aluno e escola ao mesmo tempo), o
    segundo vira troca de foto em vez de estourar a chave primária (erro 500).
    """
    valores = {"arquivo_chave": arquivo_chave, "conteudo": None, "tipo_mime": tipo, "enviada_por": enviada_por, "atualizada_em": agora}
    return (
        pg_insert(FotoEstudante)
        .values(estudante_id=estudante_id, **valores)
        .on_conflict_do_update(index_elements=[FotoEstudante.estudante_id], set_=valores)
    )


def salvar_foto(db: Session, estudante: Estudante, texto_base64: str, enviada_por: str) -> None:
    """Grava (ou troca) a foto. Quem chama faz o commit."""
    conteudo, tipo = decodificar_foto(texto_base64)
    agora = agora_utc()
    _trocar_arquivo(db, FotoEstudante, estudante)
    chave = armazenamento.gravar(db, "fotos", estudante.escola_id, conteudo, tipo)
    db.execute(comando_upsert_foto(estudante.id, chave, tipo, enviada_por, agora))
    db.expire(estudante, ["foto"])  # a relação em memória ficou velha depois do upsert
    estudante.foto_atualizada_em = agora


def _trocar_arquivo(db: Session, modelo, estudante: Estudante) -> None:
    """A foto anterior (se houver) sai do armazenamento depois do commit."""
    anterior = db.query(modelo.arquivo_chave).filter(modelo.estudante_id == estudante.id).scalar()
    armazenamento.agendar_remocao(db, anterior)


def _resposta_imagem(registro, mensagem_404: str) -> Response:
    if registro is None:
        raise HTTPException(status_code=404, detail=mensagem_404)
    try:
        conteudo = armazenamento.conteudo_de(registro)
    except armazenamento.ArquivoNaoEncontrado:
        raise HTTPException(status_code=404, detail=mensagem_404)
    return Response(
        content=conteudo,
        media_type=registro.tipo_mime,
        # Foto de aluno (menor de idade, na maioria): nada de cache compartilhado/CDN
        headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"},
    )


def remover_foto(estudante: Estudante) -> None:
    estudante.foto = None
    estudante.foto_atualizada_em = None


def resposta_da_foto(estudante: Estudante) -> Response:
    return _resposta_imagem(estudante.foto, "Aluno sem foto.")


# Foto do currículo: outra foto, opcional, que só o aluno envia (a de cima é a
# de identificação, pra escola). Mesmas validações; só aparece no currículo
# quando o aluno marca "com foto".
def salvar_foto_curriculo(db: Session, estudante: Estudante, texto_base64: str) -> None:
    """Grava (ou troca) a foto do currículo. Quem chama faz o commit."""
    conteudo, tipo = decodificar_foto(texto_base64)
    agora = agora_utc()
    _trocar_arquivo(db, FotoCurriculo, estudante)
    chave = armazenamento.gravar(db, "fotos_curriculo", estudante.escola_id, conteudo, tipo)
    valores = {"arquivo_chave": chave, "conteudo": None, "tipo_mime": tipo, "atualizada_em": agora}
    db.execute(
        pg_insert(FotoCurriculo)
        .values(estudante_id=estudante.id, **valores)
        .on_conflict_do_update(index_elements=[FotoCurriculo.estudante_id], set_=valores)
    )
    db.expire(estudante, ["foto_curriculo"])
    estudante.foto_curriculo_atualizada_em = agora


def remover_foto_curriculo(estudante: Estudante) -> None:
    estudante.foto_curriculo = None
    estudante.foto_curriculo_atualizada_em = None


def resposta_da_foto_curriculo(estudante: Estudante) -> Response:
    return _resposta_imagem(estudante.foto_curriculo, "Sem foto do currículo.")
