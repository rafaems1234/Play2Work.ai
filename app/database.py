from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de conexão com as credenciais locais do PostgreSQL
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:"

# Aqui criamos o engine diretamente
engine = create_engine(SQLALCHEMY_DATABASE_URL)

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