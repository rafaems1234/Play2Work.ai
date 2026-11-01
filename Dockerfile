# Backend do First2Work.ai (FastAPI). O front é publicado à parte (build estático do Vite).
#
#   docker build -t first2work-api .
#   docker run --env-file app/.env -p 8000:8000 first2work-api
#
# Na subida, prepara o banco (cria as tabelas num banco vazio ou aplica as
# migrações que faltam, e garante uma escola) e inicia o servidor.
FROM python:3.15-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DOCS_ABERTAS=false \
    FORWARDED_ALLOW_IPS=127.0.0.1

WORKDIR /srv/app

COPY requirements.txt /srv/requirements.txt
RUN pip install -r /srv/requirements.txt

# Código do backend, migrações e os dados em JSON que backend e front compartilham
COPY app/*.py ./
COPY app/alembic.ini ./
COPY app/alembic ./alembic
COPY app/frontend/src/data ./frontend/src/data

# Não roda como root, e o código fica só leitura pra esse usuário (é do root)
RUN useradd --create-home --uid 10001 first2work
USER first2work

EXPOSE 8000
# --proxy-headers: atrás do proxy da hospedagem, o IP real do cliente (rate limit e auditoria).
# Só vale o cabeçalho X-Forwarded-For que vier dos IPs em FORWARDED_ALLOW_IPS (o uvicorn lê
# essa variável): de qualquer outro lugar, é ignorado -- senão qualquer um inventaria o próprio
# IP e escaparia do limite de tentativas. Na hospedagem, ponha o IP/faixa do proxy dela.
# "*" só se o contêiner NÃO for acessível direto da internet (só pelo proxy). Ver docs/deploy/banco.md.
CMD ["sh", "-c", "python preparar_banco.py && uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
