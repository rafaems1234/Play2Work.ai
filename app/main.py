import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
import models
from database import engine
from routes import router  # Garanta que o arquivo routes.py exista nesta mesma pasta
from admin_routes import router as admin_router
from aulas_routes import router_admin as aulas_admin_router, router_aluno as aulas_aluno_router
from mensagens import router_admin as mensagens_admin_router, router_aluno as mensagens_aluno_router
from acesso_routes import router_admin as acesso_admin_router, router_aluno as acesso_aluno_router
from entrevista_routes import router as entrevista_router
from certificacao_routes import router_aluno as certificacao_aluno_router, router_admin as certificacao_admin_router
from gestao_routes import router as gestao_router
from auditoria import MiddlewareAuditoria
from limiter import limiter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


app = FastAPI(title="First2Work AI API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configuração CRÍTICA do CORS
# Adicionadas variações comuns para evitar bloqueios no navegador
origins = [
    "http://localhost:5173",    # Origem padrão do Vite/React
    "http://127.0.0.1:5173",
    "http://localhost:3000",    # Caso mude de porta futuramente
    "http://127.0.0.1:3000",
]
# Endereço do front publicado (ex.: https://rafaems1234.github.io), separado por vírgula se houver mais de um
origins += [o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Para testes irrestritos, mude para: allow_origins=["*"]
    allow_credentials=True,
    allow_methods=["*"],         # Permite GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],         # Permite todos os headers customizados
)

# Acoplamento de Rotas Modulares
# REMOVIDO: A linha duplicada que reincluía o router
app.include_router(router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(aulas_admin_router, prefix="/api")
app.include_router(aulas_aluno_router, prefix="/api")
app.include_router(mensagens_admin_router, prefix="/api")
app.include_router(mensagens_aluno_router, prefix="/api")
app.include_router(acesso_admin_router, prefix="/api")
app.include_router(acesso_aluno_router, prefix="/api")
app.include_router(entrevista_router, prefix="/api")
app.include_router(certificacao_aluno_router, prefix="/api")
app.include_router(certificacao_admin_router, prefix="/api")
app.include_router(gestao_router, prefix="/api")

# Auditoria do painel: registra o que cada conta da gestão incluiu, alterou, excluiu e exportou (auditoria.py)
app.add_middleware(MiddlewareAuditoria)

# Rota de checagem inicial de status
@app.get("/api/status", tags=["Status"])
def read_root():
    return {
        "status": "Online",
        "projeto": "First2Work.AI",
        "contexto": "Inclusão produtiva de jovens com IA e gamificação"
    }

if __name__ == "__main__":
    import uvicorn
    # Mudamos de "main:app" para o próprio objeto app para evitar erros de importação pelo Uvicorn
    # host 127.0.0.1 por padrão -- para expor na rede local, defina o host explicitamente ao rodar via uvicorn CLI
    uvicorn.run(app, host="127.0.0.1", port=8000)