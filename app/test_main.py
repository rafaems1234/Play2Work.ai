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

client = TestClient(app=app)

# ----------------------------------------------------------------------
# FIXTURES / MOCKS DE BANCO DE DADOS
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


def test_buscar_vagas_match(mock_db):
    # Simula que o estudante ID 1 existe no banco
    mock_estudante = MagicMock()
    mock_estudante.id = 1
    mock_estudante.habilidades = ["Python", "FastAPI"]
    mock_db.query().filter().first.return_value = mock_estudante

    # Mocka o retorno assíncrono do serviço de IA para o match (paginado)
    with patch("routes.AIService.calcular_match_vagas", new_callable=AsyncMock) as mock_match:
        mock_match.return_value = {
            "vagas": [{"id": 1, "titulo_vaga": "Dev Backend", "percentual_match": 100}],
            "pagina": 1,
            "tamanho_pagina": 20,
            "total": 1,
        }

        response = client.get("/api/jobs/match/1")
        assert response.status_code == 200
        assert "percentual_match" in response.json()["vagas"][0]


def test_aplicar_para_vaga(mock_db):
    # Simula que estudante e vaga existem
    mock_db.query().filter().first.return_value = MagicMock(id=1, empresa="Vivo")

    payload = {"estudante_id": 1, "vaga_id": 1}
    response = client.post("/api/jobs/apply-meta", json=payload)

    assert response.status_code == 200
    assert response.json()["sucesso"] is True


@patch("routes.AIService.processar_entrevista_ia")
def test_interagir_simulador_ia(mock_processar_ia, mock_db):
    # Simula estudante existente com os novos atributos corrigidos (.xp_total)
    mock_estudante = MagicMock(id=1, xp_total=100, xp_semanal=50, nivel_gamificacao=1, ofensiva_dias=2)
    mock_db.query().filter().first.return_value = mock_estudante

    # Configura o retorno simulado do Gemini
    mock_processar_ia.return_value = {
        "analise_feedback": "Boa resposta!",
        "xp_concedido": 20,
        "proxima_pergunta": "Qual seu objetivo?"
    }

    payload = {"estudante_id": 1, "mensagem_usuario": "Olá, quero treinar!"}
    response = client.post("/api/chat/message", json=payload)

    assert response.status_code == 200
    assert "feedback_ia" in response.json()
    assert response.json()["xp_concedido"] == 20


@patch("routes.AIService.gerar_curriculo_ia")
def test_gerar_curriculo_ia(mock_gerar_ia, mock_db):
    mock_db.query().filter().first.return_value = MagicMock(id=1, nome="Rafael")
    mock_gerar_ia.return_value = {"nome_candidato": "Rafael", "hard_skills": ["Python"]}

    payload = {"estudante_id": 1, "habilidades_texto": "Gosto de tecnologia"}
    response = client.post("/api/resume/generate", json=payload)

    assert response.status_code == 201
    assert response.json()["sucesso"] is True


def test_obter_ranking_semanal(mock_db):
    # Simula um estudante com XP contabilizado na semana corrente
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
    assert "Tecnologia e Dados" in response.json()["itinerarios"]


@patch("routes.AIService.gerar_quiz_ia")
def test_gerar_quiz(mock_gerar_quiz, mock_db):
    mock_estudante = MagicMock(id=1, itinerario=None)
    mock_db.query().filter().first.return_value = mock_estudante

    mock_gerar_quiz.return_value = {
        "tema": "Lógica de programação para iniciantes",
        "perguntas": [
            {"pergunta": "P1?", "opcoes": ["a", "b", "c", "d"], "resposta_correta_index": 0, "explicacao": "..."},
        ],
    }

    payload = {"estudante_id": 1, "itinerario": "Tecnologia e Dados"}
    response = client.post("/api/quiz/generate", json=payload)

    assert response.status_code == 200
    assert response.json()["itinerario"] == "Tecnologia e Dados"
    assert len(response.json()["perguntas"]) == 1


def test_gerar_quiz_itinerario_invalido(mock_db):
    mock_estudante = MagicMock(id=1, itinerario=None)
    mock_db.query().filter().first.return_value = mock_estudante

    payload = {"estudante_id": 1, "itinerario": "Trilha Que Não Existe"}
    response = client.post("/api/quiz/generate", json=payload)

    assert response.status_code == 400


def test_submeter_quiz(mock_db):
    mock_estudante = MagicMock(id=1, xp_total=100, xp_semanal=50, nivel_gamificacao=1, ofensiva_dias=2)
    mock_db.query().filter().first.return_value = mock_estudante

    payload = {"estudante_id": 1, "tema": "Lógica de programação para iniciantes", "acertos": 4, "total": 5}
    response = client.post("/api/quiz/submit", json=payload)

    assert response.status_code == 200
    assert response.json()["xp_concedido"] == 32  # 4 acertos * 8 XP
    assert response.json()["acertos"] == 4


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
