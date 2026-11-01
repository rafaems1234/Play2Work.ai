"""
Prepara o banco antes de a API subir (roda no início do contêiner).

- Banco vazio (primeira subida): cria todas as tabelas pelos modelos e marca a
  versão mais nova do Alembic. As migrações antigas não servem pra isso: a
  primeira delas supõe que as tabelas já existiam.
- Banco que já tem as tabelas: aplica as migrações que faltam
  (alembic upgrade head).
- Em qualquer caso, garante que exista pelo menos uma escola (ESCOLA_NOME no
  .env, ou "Escola piloto") -- é nela que a senha de instalação (ADMIN_SENHA)
  cria o primeiro Administrador.

    python preparar_banco.py
"""
import os

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

import models
from database import SessionLocal, engine

PASTA = os.path.dirname(os.path.abspath(__file__))


def preparar() -> None:
    config = Config(os.path.join(PASTA, "alembic.ini"))
    config.set_main_option("script_location", os.path.join(PASTA, "alembic"))
    tabelas = set(inspect(engine).get_table_names())
    if "estudantes" not in tabelas:
        print("Banco vazio: criando as tabelas e marcando a versão mais nova das migrações...")
        models.Base.metadata.create_all(bind=engine)
        command.stamp(config, "head")
    else:
        print("Aplicando as migrações que faltam...")
        command.upgrade(config, "head")

    db = SessionLocal()
    try:
        if db.query(models.Escola).count() == 0:
            nome = os.environ.get("ESCOLA_NOME") or "Escola piloto"
            slug = os.environ.get("ESCOLA_SLUG") or "piloto"
            db.add(models.Escola(nome=nome, slug=slug, ativa=True))
            db.commit()
            print(f"Escola criada: {nome}. Entre no painel com o usuário em branco e a ADMIN_SENHA para criar o primeiro Administrador.")
    finally:
        db.close()
    print("Banco pronto.")


if __name__ == "__main__":
    preparar()
