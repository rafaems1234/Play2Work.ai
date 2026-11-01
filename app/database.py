import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# Carrega variáveis de ambiente do arquivo .env (não versionado)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# URL de conexão com o PostgreSQL, configurada via variável de ambiente
def _com_driver(url: str) -> str:
    """
    O SQLAlchemy 2.1 passou a usar o psycopg 3 pra "postgresql://". O projeto usa o
    psycopg2 (requirements.txt), então o driver vai explícito -- assim o .env pode
    continuar com o endereço comum. Endereço que já diz o driver fica como está.
    """
    for prefixo in ("postgresql://", "postgres://"):
        if url.startswith(prefixo):
            return "postgresql+psycopg2://" + url[len(prefixo):]
    return url


SQLALCHEMY_DATABASE_URL = _com_driver(os.environ["DATABASE_URL"])
# Em produção a API entra com um usuário que só lê e grava dados (sem criar nem
# apagar tabela); as migrações rodam com o dono do banco. Ver docs/deploy/banco.md.
# Sem esta variável, as migrações usam a mesma DATABASE_URL (desenvolvimento).
MIGRACAO_DATABASE_URL = _com_driver(os.environ.get("MIGRACAO_DATABASE_URL") or SQLALCHEMY_DATABASE_URL)

# Aqui criamos o engine diretamente
# Sessão sempre em UTC: o now() das colunas com server_default grava no mesmo
# fuso que o Python (fuso.agora_utc), seja qual for o fuso do servidor Postgres.
# A conversão pro fuso da escola acontece só em fuso.py.
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"options": "-c timezone=UTC"})

# Criamos a SessionLocal vinculada ao engine
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declaramos o Base usando a sintaxe moderna do SQLAlchemy 2.0+
Base = declarative_base()

# Função injetora de dependência utilizada pelas rotas FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()