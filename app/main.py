import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
import models
from database import engine
from routes import router  # Garanta que o arquivo routes.py exista nesta mesma pasta
from limiter import limiter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


app = FastAPI(title="Play2Work AI API")

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

# Rota de checagem inicial de status
@app.get("/api/status", tags=["Status"])
def read_root():
    return {
        "status": "Online",
        "projeto": "Play2Work.AI",
        "contexto": "Desafio dos Dados Vivo 2026"
    }

if __name__ == "__main__":
    import uvicorn
    # Mudamos de "main:app" para o próprio objeto app para evitar erros de importação pelo Uvicorn
    # host 127.0.0.1 por padrão -- para expor na rede local, defina o host explicitamente ao rodar via uvicorn CLI
    uvicorn.run(app, host="127.0.0.1", port=8000)