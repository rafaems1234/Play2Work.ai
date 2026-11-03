"""
Manutenção do armazenamento de arquivos (ver armazenamento.py).

  python arquivos.py migrar            move fotos e materiais que ainda estão no
                                       banco (coluna 'conteudo') pro destino
                                       configurado. Pode rodar de novo: só pega
                                       o que falta. Um registro por commit.
  python arquivos.py orfaos            lista arquivos do destino que nenhum
                                       registro do banco usa
  python arquivos.py orfaos --apagar   ...e apaga (LGPD: foto de quem saiu).
                                       Rode fora do horário de uso: um envio
                                       em andamento ainda não está no banco.

Rodar com a API no ar não tem problema. No Docker:
  docker compose exec api python arquivos.py migrar
"""
import sys

from sqlalchemy import select

import armazenamento
from database import SessionLocal
from models import Estudante, FotoCurriculo, FotoEstudante, MaterialAula


def _escola_do_aluno(db, estudante_id):
    return db.execute(select(Estudante.escola_id).where(Estudante.id == estudante_id)).scalar()


def migrar() -> int:
    movidos = 0
    db = SessionLocal()
    try:
        for modelo, categoria in ((FotoEstudante, "fotos"), (FotoCurriculo, "fotos_curriculo")):
            ids = db.execute(select(modelo.estudante_id).where(modelo.arquivo_chave.is_(None), modelo.conteudo.isnot(None))).scalars().all()
            for estudante_id in ids:
                registro = db.get(modelo, estudante_id)
                registro.arquivo_chave = armazenamento.gravar(db, categoria, _escola_do_aluno(db, estudante_id), registro.conteudo, registro.tipo_mime)
                registro.conteudo = None
                db.commit()
                movidos += 1
        ids = db.execute(select(MaterialAula.id).where(MaterialAula.arquivo_chave.is_(None), MaterialAula.conteudo.isnot(None))).scalars().all()
        for material_id in ids:
            material = db.get(MaterialAula, material_id)
            material.arquivo_chave = armazenamento.gravar(db, "materiais", material.escola_id, material.conteudo, material.tipo_mime)
            material.conteudo = None
            db.commit()
            movidos += 1
    finally:
        db.close()
    return movidos


def chaves_em_uso() -> set[str]:
    db = SessionLocal()
    try:
        usadas = set()
        for modelo in (FotoEstudante, FotoCurriculo, MaterialAula):
            usadas.update(db.execute(select(modelo.arquivo_chave).where(modelo.arquivo_chave.isnot(None))).scalars())
        return usadas
    finally:
        db.close()


def orfaos() -> list[str]:
    usadas = chaves_em_uso()
    return [chave for chave in armazenamento.destino().listar() if chave not in usadas]


if __name__ == "__main__":
    comando = sys.argv[1] if len(sys.argv) > 1 else ""
    if comando == "migrar":
        print(f"{migrar()} arquivo(s) movido(s) do banco pro armazenamento.")
    elif comando == "orfaos":
        lista = orfaos()
        for chave in lista:
            print(chave)
        if "--apagar" in sys.argv:
            for chave in lista:
                armazenamento.destino().apagar(chave)
            print(f"{len(lista)} arquivo(s) órfão(s) apagado(s).")
        else:
            print(f"{len(lista)} arquivo(s) órfão(s). Use --apagar para remover.")
    else:
        print(__doc__)
        sys.exit(1)
