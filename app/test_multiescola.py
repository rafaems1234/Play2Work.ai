"""
Isolamento entre escolas contra um Postgres DE VERDADE (o filtro automático de
tenancy.py só existe numa sessão real do SQLAlchemy, não no MagicMock dos
outros testes).

Roda só com FIRST2WORK_TEST_DB apontando pra um banco de TESTE já migrado
(alembic upgrade head) e populado (python seed.py):

    FIRST2WORK_TEST_DB=postgresql://usuario:senha@localhost:5432/first2work_teste pytest test_multiescola.py

Cria uma escola temporária e apaga no fim. Nunca aponte pra produção.
"""
import os
import sys

import pytest

BANCO = os.environ.get("FIRST2WORK_TEST_DB")
pytestmark = pytest.mark.skipif(not BANCO, reason="defina FIRST2WORK_TEST_DB (Postgres de teste) para rodar")

if BANCO:
    os.environ["DATABASE_URL"] = BANCO
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="module")
def ambiente():
    from fastapi.testclient import TestClient
    from database import SessionLocal
    import models
    from main import app
    from auth import COOKIE_PAINEL
    from criar_escola import criar_escola

    db = SessionLocal()
    for slug in ("teste-isolamento",):
        velha = db.query(models.Escola).filter(models.Escola.slug == slug).first()
        if velha:
            db.delete(velha)
    db.commit()
    senha = criar_escola("Escola de teste de isolamento", "teste-isolamento", "Gestor Isolamento", "gestor.isolamento")
    cliente = TestClient(app)
    # O painel recebe o token num cookie httpOnly; aqui ele é lido do cookie e mandado como Bearer
    token = cliente.post("/api/admin/login", json={"usuario": "gestor.isolamento", "senha": senha}).cookies[COOKIE_PAINEL]
    token = cliente.post("/api/admin/gestao/minha-senha", json={"senha_atual": senha, "nova_senha": "Isolamento2026x"},
                         headers={"Authorization": f"Bearer {token}"}).cookies[COOKIE_PAINEL]
    # Verificação em duas etapas obrigatória: ativa como a pessoa faria, lendo o "QR Code"
    import pyotp
    gerado = cliente.post("/api/admin/gestao/2fa/iniciar", headers={"Authorization": f"Bearer {token}"}).json()
    token = cliente.post("/api/admin/gestao/2fa/ativar", json={"codigo": pyotp.TOTP(gerado["segredo"]).now()},
                         headers={"Authorization": f"Bearer {token}"}).cookies[COOKIE_PAINEL]
    yield cliente, {"Authorization": f"Bearer {token}"}
    escola = db.query(models.Escola).filter(models.Escola.slug == "teste-isolamento").first()
    if escola:
        db.delete(escola)
        db.commit()
    db.close()


def _um_aluno_de_outra_escola():
    from database import SessionLocal
    import models
    db = SessionLocal()
    try:
        return db.query(models.Estudante).join(models.Escola).filter(models.Escola.slug != "teste-isolamento").first()
    finally:
        db.close()


def test_escola_nova_comeca_vazia(ambiente):
    cliente, cab = ambiente
    assert cliente.get("/api/admin/estudantes", headers=cab).json() == []
    resumo = cliente.get("/api/admin/resumo", headers=cab).json()
    assert resumo["total_alunos"] == 0 and resumo["total_turmas"] == 0


def test_nao_le_nem_altera_aluno_de_outra_escola(ambiente):
    cliente, cab = ambiente
    outro = _um_aluno_de_outra_escola()
    assert outro is not None, "popule o banco de teste com python seed.py"
    assert cliente.get(f"/api/admin/estudantes/{outro.id}/historico", headers=cab).status_code == 404
    assert cliente.put(f"/api/admin/estudantes/{outro.id}", json={"telefone": "67900000000"}, headers=cab).status_code == 404
    assert cliente.post(f"/api/admin/estudantes/{outro.id}/codigo-acesso", headers=cab).status_code == 404


def test_cpf_de_outra_escola_e_recusado_sem_revelar_o_nome(ambiente):
    cliente, cab = ambiente
    outro = _um_aluno_de_outra_escola()
    r = cliente.post("/api/admin/estudantes", json={"nome": "Copia", "cpf": outro.cpf, "email": "copia@teste.com"}, headers=cab)
    assert r.status_code == 409 and outro.nome not in r.json()["detail"]


def test_nomes_repetidos_entre_escolas_sao_permitidos(ambiente):
    cliente, cab = ambiente
    outro = _um_aluno_de_outra_escola()
    turma = cliente.post("/api/admin/turmas", json={"nome": "3º A", "turno": "Manhã"}, headers=cab)
    assert turma.status_code == 201
    aluno = cliente.post("/api/admin/estudantes", json={"nome": "Aluno Isolado", "cpf": "935.411.347-80", "email": outro.email, "turma_id": turma.json()["id"]}, headers=cab)
    assert aluno.status_code == 201
    nomes = [a["nome"] for a in cliente.get("/api/admin/estudantes", headers=cab).json()]
    assert nomes == ["Aluno Isolado"]


def test_auditoria_so_da_propria_escola(ambiente):
    cliente, cab = ambiente
    itens = cliente.get("/api/admin/auditoria", headers=cab).json()["itens"]
    assert itens and all(i["usuario_nome"] == "Gestor Isolamento" for i in itens)
