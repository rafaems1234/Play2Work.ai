# Backend do First2Work.ai (FastAPI). O front é publicado à parte (build estático do Vite).
#
#   docker build -t play2work-api .
#   docker run --env-file app/.env -p 8000:8000 play2work-api
#
# Na subida, prepara o banco (cria as tabelas num banco vazio ou aplica as
# migrações que faltam, e garante uma escola) e inicia o servidor.
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv/app

COPY requirements.txt /srv/requirements.txt
RUN pip install -r /srv/requirements.txt

# Código do backend, migrações e os dados em JSON que backend e front compartilham
COPY app/*.py ./
COPY app/alembic.ini ./
COPY app/alembic ./alembic
COPY app/frontend/src/data ./frontend/src/data

# Não roda como root
RUN useradd --create-home --uid 10001 play2work && chown -R play2work /srv
USER play2work

EXPOSE 8000
# --proxy-headers: atrás do proxy da hospedagem, o IP real do cliente (rate limit e auditoria)
CMD ["sh", "-c", "python preparar_banco.py && uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
