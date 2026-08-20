import sys
import os
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock

# Garante o mapeamento correto das pastas
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from main import app
from database import get_db
from auth import get_estudante_atual, hash_senha

client = TestClient(app=app)

# ----------------------------------------------------------------------
# FIXTURES / MOCKS DE BANCO DE DADOS E AUTENTICAÇÃO
# ----------------------------------------------------------------------
# Sobrescrevemos get_db via app.dependency_overrides para não tocar no
# PostgreSQL real durante os testes. Patchar "routes.get_db" não funciona:
# o Depends(get_db) já capturou a referência da função original no momento
# em que as rotas foram declaradas, então o patch do atributo do módulo é
# ignorado em tempo de execução.
@pytest.fixture
def mock_db():
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    yield db
    app.dependency_overrides.pop(get_db, None)


def criar_mock_estudante(**overrides):
    """
    MagicMock de Estudante com todos os campos numéricos/data usados pela
    gamificação já setados com valores reais (não MagicMock auto-gerado),
    pra comparações como `estudante.vidas >= 5` não quebrarem nos testes.
    """
    padrao = dict(
        id=1,
        nome="Gabriel",
        email="gabriel@escola.com",
        xp_total=100,
        xp_semanal=50,
        nivel_gamificacao=1,
        ofensiva_dias=2,
        missoes_diarias_concluidas=1,
        ultimo_treino=None,
        semana_referencia=None,
        categoria_status="🌌 Na Jornada",
        itinerario=None,
        vidas=5,
        proxima_vida_em=None,
        moedas=0,
        congelamentos_disponiveis=0,
        quizzes_perfeitos_seguidos=0,
        precisa_trocar_senha=False,
        linkedin=None,
    )
    padrao.update(overrides)
    return MagicMock(**padrao)


@pytest.fixture
def mock_estudante_logado():
    """
    Sobrescreve get_estudante_atual pra simular um usuário já autenticado,
    sem precisar gerar um JWT de verdade em cada teste de rota protegida.
    """
    estudante = criar_mock_estudante()
    app.dependency_overrides[get_estudante_atual] = lambda: estudante
    yield estudante
    app.dependency_overrides.pop(get_estudante_atual, None)


# ----------------------------------------------------------------------
# AUTENTICAÇÃO
# ----------------------------------------------------------------------

def test_registrar_e_logar(mock_db):
    mock_db.query().filter().first.return_value = None  # e-mail ainda não existe

    resposta_registro = client.post("/api/auth/registrar", json={
        "nome": "Nova Aluna",
        "email": "nova@escola.com",
        "senha": "senha123",
    })
    assert resposta_registro.status_code == 201
    assert "token" in resposta_registro.json()


def test_registrar_email_duplicado(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante()

    resposta = client.post("/api/auth/registrar", json={
        "nome": "Duplicado",
        "email": "gabriel@escola.com",
        "senha": "senha123",
    })
    assert resposta.status_code == 409


def test_login_senha_incorreta(mock_db):
    estudante = criar_mock_estudante(senha_hash="$2b$12$hashquenaobateaproposito")
    mock_db.query().filter().all.return_value = [estudante]

    resposta = client.post("/api/auth/login", json={"nome": "Gabriel", "senha": "errada"})
    assert resposta.status_code == 401


def test_login_desempata_por_senha_quando_nome_repetido(mock_db):
    conta_1 = criar_mock_estudante(id=1, senha_hash=hash_senha("senhaDaConta1"))
    conta_2 = criar_mock_estudante(id=2, senha_hash=hash_senha("senhaDaConta2"))
    mock_db.query().filter().all.return_value = [conta_1, conta_2]

    resposta = client.post("/api/auth/login", json={"nome": "João Silva", "senha": "senhaDaConta2"})
    assert resposta.status_code == 200
    assert resposta.json()["estudante"]["id"] == 2


def test_resetar_senha_gera_temporaria(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante()

    resposta = client.post("/api/auth/resetar-senha", json={"email": "gabriel@escola.com"})
    assert resposta.status_code == 200
    assert len(resposta.json()["senha_temporaria"]) >= 8


def test_resetar_senha_email_inexistente_nao_revela(mock_db):
    mock_db.query().filter().first.return_value = None

    resposta = client.post("/api/auth/resetar-senha", json={"email": "naoexiste@escola.com"})
    assert resposta.status_code == 200
    assert "senha_temporaria" not in resposta.json()


def test_trocar_senha(mock_db, mock_estudante_logado):
    mock_estudante_logado.senha_hash = hash_senha("senhaAtual123")

    resposta = client.post("/api/auth/trocar-senha", json={"senha_atual": "senhaAtual123", "nova_senha": "novaSenha456"})
    assert resposta.status_code == 200
    assert mock_estudante_logado.precisa_trocar_senha is False


def test_trocar_senha_atual_incorreta(mock_db, mock_estudante_logado):
    mock_estudante_logado.senha_hash = hash_senha("senhaAtual123")

    resposta = client.post("/api/auth/trocar-senha", json={"senha_atual": "errada", "nova_senha": "novaSenha456"})
    assert resposta.status_code == 401


def test_rota_protegida_sem_token(mock_db):
    response = client.get("/api/estudante/me/status")
    assert response.status_code == 401


# ----------------------------------------------------------------------
# ROTAS PROTEGIDAS
# ----------------------------------------------------------------------

def test_buscar_vagas_match(mock_db, mock_estudante_logado):
    with patch("routes.AIService.calcular_match_vagas", new_callable=AsyncMock) as mock_match:
        mock_match.return_value = {
            "vagas": [{"id": 1, "titulo_vaga": "Dev Backend", "percentual_match": 100}],
            "pagina": 1,
            "tamanho_pagina": 20,
            "total": 1,
        }

        response = client.get("/api/jobs/match")
        assert response.status_code == 200
        assert "percentual_match" in response.json()["vagas"][0]


def test_aplicar_para_vaga(mock_db, mock_estudante_logado):
    mock_db.query().filter().first.side_effect = [
        MagicMock(id=1, empresa="Vivo"),  # busca da vaga
        None,  # não existe candidatura anterior
    ]

    response = client.post("/api/jobs/apply-meta", json={"vaga_id": 1})

    assert response.status_code == 201
    assert response.json()["sucesso"] is True
    assert response.json()["ja_existia"] is False


@patch("routes.AIService.processar_entrevista_ia")
def test_interagir_simulador_ia(mock_processar_ia, mock_db, mock_estudante_logado):
    mock_db.query().filter().order_by().limit().all.return_value = []
    mock_processar_ia.return_value = {
        "analise_feedback": "Boa resposta!",
        "xp_concedido": 20,
        "proxima_pergunta": "Qual seu objetivo?"
    }

    response = client.post("/api/chat/message", json={"mensagem_usuario": "Olá, quero treinar!"})

    assert response.status_code == 200
    assert "feedback_ia" in response.json()
    assert response.json()["xp_concedido"] == 20


@patch("routes.AIService.gerar_curriculo_ia")
def test_gerar_curriculo_ia(mock_gerar_ia, mock_db, mock_estudante_logado):
    mock_gerar_ia.return_value = {"nome_candidato": "Rafael", "hard_skills": ["Python"]}

    response = client.post("/api/resume/generate", json={"habilidades_texto": "Gosto de tecnologia"})

    assert response.status_code == 201
    assert response.json()["sucesso"] is True


def test_obter_ranking_semanal(mock_db):
    inicio_semana_atual = date.today() - timedelta(days=date.today().weekday())
    mock_estudante = MagicMock(
        nome="Rafael",
        xp_semanal=150,
        categoria_status="🌌 Na Jornada",
        semana_referencia=inicio_semana_atual,
    )
    mock_db.query().filter().all.return_value = [mock_estudante]

    response = client.get("/api/ranking")
    assert response.status_code == 200
    assert len(response.json()) > 0
    assert response.json()[0]["nome"] == "Rafael"


def test_listar_itinerarios():
    response = client.get("/api/quiz/itinerarios")
    assert response.status_code == 200
    nomes = [it["nome"] for it in response.json()["itinerarios"]]
    assert "Tecnologia e Ciência de Dados" in nomes


@patch("routes.AIService.gerar_quiz_ia")
def test_gerar_quiz(mock_gerar_quiz, mock_db, mock_estudante_logado):
    mock_gerar_quiz.return_value = {
        "tema": "Fundamentos de Python e lógica de programação",
        "perguntas": [
            {"pergunta": "P1?", "opcoes": ["a", "b", "c", "d"], "resposta_correta_index": 0, "explicacao": "..."},
        ],
    }

    response = client.post("/api/quiz/generate")

    assert response.status_code == 200
    assert len(response.json()["perguntas"]) == 1


def test_submeter_quiz(mock_db, mock_estudante_logado):
    payload = {"tema": "Lógica de programação para iniciantes", "acertos": 4, "total": 5}
    response = client.post("/api/quiz/submit", json=payload)

    assert response.status_code == 200
    assert response.json()["xp_concedido"] == 32  # 4 acertos * 8 XP
    assert response.json()["acertos"] == 4


def test_escolher_itinerario(mock_db, mock_estudante_logado):
    response = client.post("/api/itinerario/escolher", json={"itinerario": "Robótica e Automação"})

    assert response.status_code == 200
    assert response.json()["itinerario"] == "Robótica e Automação"


def test_escolher_itinerario_invalido(mock_db, mock_estudante_logado):
    response = client.post("/api/itinerario/escolher", json={"itinerario": "Curso Inexistente"})
    assert response.status_code == 400


def test_status_gamificacao(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 3
    mock_estudante_logado.moedas = 40
    mock_estudante_logado.congelamentos_disponiveis = 1

    response = client.get("/api/estudante/me/status")

    assert response.status_code == 200
    assert response.json()["vidas"] == 3
    assert response.json()["moedas"] == 40
    assert response.json()["congelamentos_disponiveis"] == 1


def test_quiz_bloqueado_sem_vidas(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 0
    mock_estudante_logado.proxima_vida_em = None

    response = client.post("/api/quiz/generate")
    assert response.status_code == 403


def test_comprar_vida_sucesso(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 3
    mock_estudante_logado.moedas = 100

    response = client.post("/api/vidas/comprar")

    assert response.status_code == 200
    assert response.json()["vidas"] == 4
    assert response.json()["moedas"] == 50


def test_comprar_vida_sem_moedas_suficientes(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 3
    mock_estudante_logado.moedas = 10

    response = client.post("/api/vidas/comprar")
    assert response.status_code == 400


def test_quiz_pular_nao_custa_vida(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 5

    # 10 perguntas: 6 acertos, 2 pulos, 2 erros reais -> só os 2 erros custam vida
    payload = {"tema": "teste", "acertos": 6, "total": 10, "pulos": 2}
    response = client.post("/api/quiz/submit", json=payload)

    assert response.status_code == 200
    assert response.json()["vidas"] == 3
    assert response.json()["xp_concedido"] == 48  # 6 acertos * 8 XP


def test_quiz_perfeito_5_vezes_seguidas_da_vida_bonus(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 3
    mock_estudante_logado.quizzes_perfeitos_seguidos = 4

    payload = {"tema": "teste", "acertos": 5, "total": 5}
    response = client.post("/api/quiz/submit", json=payload)

    assert response.status_code == 200
    assert response.json()["vida_bonus_ganha"] is True
    assert response.json()["vidas"] == 4
    assert response.json()["quizzes_perfeitos_seguidos"] == 0


def test_quiz_imperfeito_reseta_sequencia_de_perfeitos(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 3
    mock_estudante_logado.quizzes_perfeitos_seguidos = 4

    payload = {"tema": "teste", "acertos": 3, "total": 5}
    response = client.post("/api/quiz/submit", json=payload)

    assert response.status_code == 200
    assert response.json()["vida_bonus_ganha"] is False
    assert response.json()["quizzes_perfeitos_seguidos"] == 0


def test_ranking_ignora_xp_de_semana_anterior(mock_db):
    # Estudante com xp_semanal > 0 mas de uma semana passada não deve aparecer
    semana_passada = date.today() - timedelta(days=date.today().weekday() + 14)
    mock_estudante = MagicMock(
        nome="Estudante Antigo",
        xp_semanal=999,
        categoria_status="🌌 Na Jornada",
        semana_referencia=semana_passada,
    )
    mock_db.query().filter().all.return_value = [mock_estudante]

    response = client.get("/api/ranking")
    assert response.status_code == 200
    assert response.json() == []
