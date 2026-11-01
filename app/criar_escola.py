"""
Cria uma escola nova (cliente) já com o primeiro Administrador do painel.

    python criar_escola.py "EE Professor Fulano" ee-prof-fulano "Maria da Silva" maria.silva

Mostra a senha temporária do Administrador uma única vez; no primeiro acesso
ela é obrigada a trocar. A partir daí, a própria escola cria as outras contas
(aba Equipe) e cadastra os alunos. Uma escola nunca vê dado de outra
(tenancy.py). Para desativar uma escola (fim de contrato), marque
escolas.ativa = false: ninguém dela entra mais, e os dados ficam guardados.
"""
import re
import sys

from database import SessionLocal
from auth import hash_senha
from gestao_routes import senha_temporaria
import models
from tenancy import definir_escola, todas_as_escolas


def criar_escola(nome: str, slug: str, admin_nome: str, admin_usuario: str) -> str:
    slug = slug.strip().lower()
    admin_usuario = admin_usuario.strip().lower()
    if not re.fullmatch(r"[a-z0-9-]{3,60}", slug):
        raise SystemExit("O identificador (slug) usa só letras minúsculas, números e hífen (3 a 60).")
    if not re.fullmatch(r"[a-z0-9._-]{3,40}", admin_usuario):
        raise SystemExit("O usuário do Administrador usa só letras, números, ponto, hífen e sublinhado (3 a 40).")
    db = SessionLocal()
    try:
        if db.query(models.Escola).filter(models.Escola.slug == slug).first():
            raise SystemExit(f"Já existe uma escola com o identificador '{slug}'.")
        if todas_as_escolas(db.query(models.UsuarioGestao).filter(models.UsuarioGestao.usuario == admin_usuario)).first():
            raise SystemExit(f"O usuário '{admin_usuario}' já existe (usuários de login são únicos em todas as escolas).")
        escola = models.Escola(nome=nome.strip(), slug=slug, ativa=True)
        db.add(escola)
        db.flush()
        definir_escola(db, escola.id)
        senha = senha_temporaria()
        db.add(models.UsuarioGestao(nome=admin_nome.strip(), usuario=admin_usuario, senha_hash=hash_senha(senha),
                                    papel="administrador", ativo=True, deve_trocar_senha=True))
        db.commit()
        print(f"Escola criada: {escola.nome} (id {escola.id}, '{slug}')")
        print(f"Administrador: usuário {admin_usuario} / senha temporária {senha}  (aparece só agora; troca obrigatória no 1º acesso)")
        return senha
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    criar_escola(*sys.argv[1:])
