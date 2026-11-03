"""
Arquivos binários (fotos dos alunos e materiais das aulas) FORA do Postgres.

O banco guarda só a chave do arquivo (coluna arquivo_chave); o conteúdo vai
pra um destino configurado no .env:

  ARMAZENAMENTO=disco   (padrão) pasta dedicada: ARMAZENAMENTO_DIR (no Docker,
                        um volume próprio). Bom pro piloto num servidor só.
  ARMAZENAMENTO=azure   Azure Blob Storage: AZURE_STORAGE_CONNECTION_STRING e
                        AZURE_STORAGE_CONTAINER (contêiner PRIVADO). Pra várias
                        instâncias da API e pra escalar.

Os arquivos nunca são servidos direto do destino: passam pela API, que confere
quem pode ver (foto de aluno menor de idade, material só da própria escola).

Consistência com o banco (sem arquivo órfão e sem perder foto):
- arquivo novo é gravado ANTES do commit; se a transação não for confirmada,
  ele é apagado no fim dela;
- arquivo antigo (foto trocada, material/aula/módulo excluído, aluno que tirou
  a foto) só é apagado DEPOIS do commit -- se o commit falhar, nada some.

Linhas antigas, de antes desta mudança, ainda têm o conteúdo na coluna
'conteudo' e continuam funcionando; `python arquivos.py migrar` move tudo
pro destino configurado.
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from pathlib import Path
from typing import Iterator, Optional

from sqlalchemy import event
from sqlalchemy.orm import Session, object_session

import config  # noqa: F401  (carrega o .env)

logger = logging.getLogger(__name__)

CATEGORIAS = ("fotos", "fotos_curriculo", "materiais")
EXTENSOES = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "application/pdf": "pdf", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg",
}
# Chave gerada só pelo servidor (nunca com nome vindo do usuário): categoria/escola/aleatório.ext
CHAVE_VALIDA = re.compile(r"^(fotos|fotos_curriculo|materiais)/(\d+|sem_escola)/[0-9a-f]{32}\.[a-z0-9]{2,4}$")


class ArquivoNaoEncontrado(Exception):
    pass


def _conferir(chave: str) -> str:
    if not isinstance(chave, str) or not CHAVE_VALIDA.match(chave):
        raise ValueError(f"Chave de arquivo inválida: {chave!r}")
    return chave


class Disco:
    """Pasta dedicada. Em produção, fora do código e com backup (volume do Docker)."""

    def __init__(self, raiz: Path):
        self.raiz = Path(raiz)

    def _caminho(self, chave: str) -> Path:
        return self.raiz / _conferir(chave)

    def salvar(self, chave: str, conteudo: bytes, tipo_mime: str) -> None:
        destino = self._caminho(chave)
        destino.parent.mkdir(parents=True, exist_ok=True)
        temporario = destino.with_name(destino.name + ".parcial")
        temporario.write_bytes(conteudo)
        os.replace(temporario, destino)  # quem lê nunca vê o arquivo pela metade

    def ler(self, chave: str) -> bytes:
        try:
            return self._caminho(chave).read_bytes()
        except FileNotFoundError:
            raise ArquivoNaoEncontrado(chave) from None

    def apagar(self, chave: str) -> None:
        self._caminho(chave).unlink(missing_ok=True)

    def listar(self) -> Iterator[str]:
        if not self.raiz.exists():
            return
        for caminho in self.raiz.rglob("*"):
            if caminho.is_file() and not caminho.name.endswith(".parcial"):
                chave = caminho.relative_to(self.raiz).as_posix()
                if CHAVE_VALIDA.match(chave):
                    yield chave


class AzureBlob:
    """Azure Blob Storage, contêiner privado (sem acesso público)."""

    def __init__(self, connection_string: str, container: str):
        from azure.storage.blob import BlobServiceClient, ContentSettings  # só quem usa Azure precisa do pacote

        self._content_settings = ContentSettings
        self._container = BlobServiceClient.from_connection_string(connection_string).get_container_client(container)

    def salvar(self, chave: str, conteudo: bytes, tipo_mime: str) -> None:
        self._container.upload_blob(
            _conferir(chave), conteudo, overwrite=True,
            content_settings=self._content_settings(content_type=tipo_mime, cache_control="private, no-store"),
        )

    def ler(self, chave: str) -> bytes:
        from azure.core.exceptions import ResourceNotFoundError

        try:
            return self._container.download_blob(_conferir(chave)).readall()
        except ResourceNotFoundError:
            raise ArquivoNaoEncontrado(chave) from None

    def apagar(self, chave: str) -> None:
        from azure.core.exceptions import ResourceNotFoundError

        try:
            self._container.delete_blob(_conferir(chave))
        except ResourceNotFoundError:
            pass

    def listar(self) -> Iterator[str]:
        for blob in self._container.list_blobs():
            if CHAVE_VALIDA.match(blob.name):
                yield blob.name


def _criar_destino():
    tipo = (os.environ.get("ARMAZENAMENTO") or "disco").strip().lower()
    if tipo == "azure":
        conexao = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
        container = os.environ.get("AZURE_STORAGE_CONTAINER")
        if not conexao or not container:
            raise RuntimeError("ARMAZENAMENTO=azure precisa de AZURE_STORAGE_CONNECTION_STRING e AZURE_STORAGE_CONTAINER.")
        return AzureBlob(conexao, container)
    if tipo != "disco":
        raise RuntimeError("ARMAZENAMENTO deve ser 'disco' ou 'azure'.")
    return Disco(Path(os.environ.get("ARMAZENAMENTO_DIR") or Path(__file__).resolve().parent / "arquivos"))


_destino = None


def destino():
    global _destino
    if _destino is None:
        _destino = _criar_destino()
    return _destino


def usar_destino(novo) -> None:
    """Troca o destino (testes, script de migração)."""
    global _destino
    _destino = novo


# ---------------------------------------------------------------- ligado à transação do banco
NOVOS = "arquivos_novos"
A_REMOVER = "arquivos_a_remover"


def nova_chave(categoria: str, escola_id: Optional[int], tipo_mime: str) -> str:
    if categoria not in CATEGORIAS:
        raise ValueError(categoria)
    extensao = EXTENSOES.get(tipo_mime, "bin")
    return _conferir(f"{categoria}/{escola_id if escola_id else 'sem_escola'}/{uuid.uuid4().hex}.{extensao}")


def gravar(db: Session, categoria: str, escola_id: Optional[int], conteudo: bytes, tipo_mime: str) -> str:
    """Grava agora e devolve a chave. Se a transação não for confirmada, o arquivo é apagado."""
    chave = nova_chave(categoria, escola_id, tipo_mime)
    destino().salvar(chave, conteudo, tipo_mime)
    db.info.setdefault(NOVOS, []).append(chave)
    return chave


def agendar_remocao(db: Session, chave: Optional[str]) -> None:
    """Apaga o arquivo quando (e só se) a transação for confirmada."""
    if chave and isinstance(chave, str):
        db.info.setdefault(A_REMOVER, []).append(chave)


def ler(chave: str) -> bytes:
    return destino().ler(chave)


def conteudo_de(registro) -> bytes:
    """Bytes de uma foto/material: do destino, ou da coluna antiga ainda não migrada."""
    if registro.arquivo_chave:
        return ler(registro.arquivo_chave)
    if registro.conteudo is None:
        raise ArquivoNaoEncontrado(f"{type(registro).__name__} sem conteúdo")
    return registro.conteudo


def _apagar_varios(chaves) -> None:
    for chave in chaves:
        try:
            destino().apagar(chave)
        except Exception:
            # Fica um órfão (o banco já não aponta pra ele): `python arquivos.py orfaos --apagar` limpa
            logger.exception("Falha ao apagar o arquivo %s", chave)


@event.listens_for(Session, "after_commit")
def _depois_do_commit(session: Session) -> None:
    session.info.pop(NOVOS, None)  # confirmados: ficam
    _apagar_varios(session.info.pop(A_REMOVER, []))


@event.listens_for(Session, "after_transaction_end")
def _fim_da_transacao(session: Session, transacao) -> None:
    if transacao.parent is not None:
        return  # savepoint: quem decide é a transação de fora
    # Chegou aqui sem commit (rollback, erro, sessão fechada): desfaz o que foi gravado
    _apagar_varios(session.info.pop(NOVOS, []))
    session.info.pop(A_REMOVER, None)


def registrar_exclusoes(*modelos) -> None:
    """Quando uma linha desses modelos é apagada (inclusive em cascata pelo ORM), o arquivo vai junto."""
    for modelo in modelos:
        @event.listens_for(modelo, "after_delete")
        def _ao_apagar(mapper, connection, alvo):
            sessao = object_session(alvo)
            if sessao is not None:
                agendar_remocao(sessao, alvo.arquivo_chave)
