import logging
import os
from urllib.parse import urlsplit
from fastapi import FastAPI, Request
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
from config import AMBIENTE_LOCAL
from limiter import limiter
from logs import proteger_logs_de_acesso

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
# Log de acesso sem os valores da query string (buscas por nome/CPF) -- ver logs.py
proteger_logs_de_acesso()


# Documentação interativa (/docs, /redoc, /openapi.json) mostra todas as rotas pra
# quem quiser ver: só abre com DOCS_ABERTAS=true no .env (desenvolvimento).
DOCS_ABERTAS = (os.environ.get("DOCS_ABERTAS") or "").strip().lower() in ("true", "1", "sim")

app = FastAPI(
    title="First2Work AI API",
    docs_url="/docs" if DOCS_ABERTAS else None,
    redoc_url="/redoc" if DOCS_ABERTAS else None,
    openapi_url="/openapi.json" if DOCS_ABERTAS else None,
)

# Cabeçalhos de segurança em toda resposta. A API só devolve JSON e arquivos
# (o front baixa tudo por fetch), então a CSP pode fechar tudo: nada de script,
# nada de ser aberta dentro de iframe. A documentação, quando aberta, precisa
# carregar o Swagger, então fica sem essa CSP.
CABECALHOS_SEGURANCA = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "cross-origin",  # o front fica em outro endereço e precisa ler as respostas
}
CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
ROTAS_DA_DOCUMENTACAO = ("/docs", "/redoc", "/openapi.json")


@app.middleware("http")
async def cabecalhos_de_seguranca(request: Request, call_next):
    resposta = await call_next(request)
    for nome, valor in CABECALHOS_SEGURANCA.items():
        resposta.headers.setdefault(nome, valor)
    if not request.url.path.startswith(ROTAS_DA_DOCUMENTACAO):
        resposta.headers.setdefault("Content-Security-Policy", CSP_API)
    if request.url.path.startswith("/api/"):
        resposta.headers.setdefault("Cache-Control", "no-store")  # dado de aluno não fica em cache de navegador nem de proxy
    if request.url.scheme == "https":
        # Só faz efeito em HTTPS; o scheme é o real quando o proxy é confiável (FORWARDED_ALLOW_IPS)
        resposta.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return resposta

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

logger = logging.getLogger("first2work.cors")

# CORS: quais endereços de front podem chamar a API pelo navegador.
# Os de localhost (Vite em 5173, ou 3000) só valem em desenvolvimento
# (APP_ENV=local ou DEBUG=true): em produção são recusados mesmo que alguém
# os coloque no CORS_ORIGINS -- senão qualquer página servida na máquina de
# quem usa o painel poderia falar com a API em nome dele.
ORIGENS_LOCAIS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
HOSTS_LOCAIS = ("localhost", "127.0.0.1", "::1", "0.0.0.0")


def _e_local(origem: str) -> bool:
    host = (urlsplit(origem).hostname or "").lower()
    return host in HOSTS_LOCAIS or host.endswith(".localhost") or host.startswith("127.")


def origens_permitidas(ambiente_local: bool = AMBIENTE_LOCAL, configuradas: str | None = None) -> list[str]:
    """ORIGENS_LOCAIS (só em desenvolvimento) + o CORS_ORIGINS do .env, separado por vírgula."""
    texto = os.environ.get("CORS_ORIGINS", "") if configuradas is None else configuradas
    do_env = [o.strip().rstrip("/") for o in texto.split(",") if o.strip()]
    if ambiente_local:
        return ORIGENS_LOCAIS + [o for o in do_env if o not in ORIGENS_LOCAIS]
    recusadas = [o for o in do_env if _e_local(o)]
    if recusadas:
        logger.warning("CORS: origens locais ignoradas fora do desenvolvimento (APP_ENV=local liga): %s", ", ".join(recusadas))
    origens = [o for o in do_env if not _e_local(o)]
    if not origens:
        logger.warning("CORS: nenhuma origem configurada -- defina CORS_ORIGINS com o endereço do front publicado")
    return origens

app.add_middleware(
    CORSMiddleware,
    allow_origins=origens_permitidas(),
    allow_credentials=True,      # o painel manda o cookie de sessão
    allow_methods=["*"],
    allow_headers=["*"],
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

# Front no MESMO endereço da API (hospedagem sem domínio próprio): se o build do front estiver
# em FRONT_DIR, a API entrega as telas também. O cookie do painel só funciona com front e API
# no mesmo site; com domínio próprio (first2work.com.br + api.first2work.com.br) isto fica desligado.
FRONT_DIR = os.environ.get("FRONT_DIR", "")
if FRONT_DIR and os.path.isdir(FRONT_DIR):
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    app.mount("/assets", StaticFiles(directory=os.path.join(FRONT_DIR, "assets")), name="assets")

    @app.get("/{caminho:path}", include_in_schema=False)
    def front(caminho: str):
        alvo = os.path.realpath(os.path.join(FRONT_DIR, caminho))
        if caminho and alvo.startswith(os.path.realpath(FRONT_DIR)) and os.path.isfile(alvo):
            return FileResponse(alvo)
        return FileResponse(os.path.join(FRONT_DIR, "index.html"))   # rotas do React (#admin etc.)


if __name__ == "__main__":
    import uvicorn
    # Mudamos de "main:app" para o próprio objeto app para evitar erros de importação pelo Uvicorn
    # host 127.0.0.1 por padrão -- para expor na rede local, defina o host explicitamente ao rodar via uvicorn CLI
    uvicorn.run(app, host="127.0.0.1", port=8000)