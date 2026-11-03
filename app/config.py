"""
Ambiente em que a API está rodando e o que muda com ele.

Seguro por padrão: sem APP_ENV, a API se comporta como produção (CORS sem
localhost, cookie do painel só em HTTPS). Desenvolvimento liga com
APP_ENV=local (ou DEBUG=true) no .env.
"""
import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


def _ligado(nome: str) -> bool:
    return (os.environ.get(nome) or "").strip().lower() in ("true", "1", "sim")


APP_ENV = (os.environ.get("APP_ENV") or "producao").strip().lower()
DEBUG = _ligado("DEBUG")
AMBIENTE_LOCAL = DEBUG or APP_ENV in ("local", "dev", "desenvolvimento", "development")

# ---------------------------------------------------------------- cookie do painel
# O token do painel da escola fica num cookie httpOnly (o JavaScript da página
# não consegue ler, então um script injetado não rouba a sessão). Pra o
# navegador mandar o cookie, o front e a API precisam ser do MESMO site:
# first2work.com.br + api.first2work.com.br (SameSite=Lax deixa passar entre
# subdomínios do mesmo domínio). Em desenvolvimento, localhost:5173 + localhost:8000.
COOKIE_SEGURO = not AMBIENTE_LOCAL  # Secure: só trafega em HTTPS (fora do local)
COOKIE_SAMESITE = (os.environ.get("COOKIE_SAMESITE") or "lax").strip().lower()
if COOKIE_SAMESITE not in ("lax", "strict"):
    raise RuntimeError("COOKIE_SAMESITE deve ser 'lax' ou 'strict'.")
# Vazio = o cookie vale só pro endereço da API (o mais restrito). Só preencha
# (ex.: .first2work.com.br) se outra parte do sistema precisar ler o cookie.
COOKIE_DOMINIO = (os.environ.get("COOKIE_DOMINIO") or "").strip() or None
