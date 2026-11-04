# Backend do First2Work.ai (FastAPI). O front é publicado à parte (build estático do Vite).
#
#   docker build -t first2work-api .
#   docker run --env-file app/.env -p 8000:8000 first2work-api
#
# Na subida, prepara o banco (cria as tabelas num banco vazio ou aplica as
# migrações que faltam, e garante uma escola) e inicia o servidor.
# Etapa 1 (opcional): build do front para servir no mesmo endereço da API.
#   docker build --build-arg VITE_API_URL=https://<endereço-da-api> -t first2work-api .
FROM node:20-slim AS front
ARG VITE_API_URL=""
WORKDIR /front
COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend ./
RUN if [ -n "$VITE_API_URL" ]; then VITE_DEMO_MODE=false VITE_BASE=/ npm run build; else mkdir -p dist; fi

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DOCS_ABERTAS=false \
    FORWARDED_ALLOW_IPS=127.0.0.1 \
    ARMAZENAMENTO_DIR=/srv/arquivos

WORKDIR /srv/app

COPY requirements.txt /srv/requirements.txt
RUN pip install -r /srv/requirements.txt

# Código do backend, migrações e os dados em JSON que backend e front compartilham
COPY app/*.py ./
COPY app/alembic.ini ./
COPY app/alembic ./alembic
COPY app/frontend/src/data ./frontend/src/data

# Não roda como root, e o código fica só leitura pra esse usuário (é do root)
# Fotos e materiais (ARMAZENAMENTO=disco): a única pasta em que a API escreve -- montar um volume aqui
RUN useradd --create-home --uid 10001 first2work \
    && mkdir -p /srv/arquivos && chown first2work /srv/arquivos
COPY --from=front /front/dist /srv/front
ENV FRONT_DIR=/srv/front
USER first2work

EXPOSE 8000
# --proxy-headers: atrás do proxy da hospedagem, o IP real do cliente (rate limit e auditoria).
# Só vale o cabeçalho X-Forwarded-For que vier dos IPs em FORWARDED_ALLOW_IPS (o uvicorn lê
# essa variável): de qualquer outro lugar, é ignorado -- senão qualquer um inventaria o próprio
# IP e escaparia do limite de tentativas. Na hospedagem, ponha o IP/faixa do proxy dela.
# "*" só se o contêiner NÃO for acessível direto da internet (só pelo proxy). Ver docs/deploy/banco.md.
CMD ["sh", "-c", "python preparar_banco.py && uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
