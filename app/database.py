import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# Carrega variáveis de ambiente do arquivo .env (não versionado)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# URL de conexão com o PostgreSQL, configurada via variável de ambiente
SQLALCHEMY_DATABASE_URL = os.environ["DATABASE_URL"]

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