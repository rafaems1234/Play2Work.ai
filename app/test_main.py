import sys
import os
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Garante o mapeamento correto das pastas
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from main import app

client = TestClient(app=app)

# ----------------------------------------------------------------------
# FIXTURES / MOCKS DE BANCO DE DADOS
# ----------------------------------------------------------------------
# Mockamos a dependência get_db do FastAPI para não tocar no PostgreSQL real durante os testes
@patch("routes.get_db")
def test_buscar_vagas_match(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    # Simula que o estudante ID 1 existe no banco
    mock_estudante = MagicMock()
    mock_estudante.id = 1
    mock_estudante.habilidades = ["Python", "FastAPI"]
    mock_db.query().filter().first.return_value = mock_estudante

    # Mocka o retorno do serviço de IA para o match
    with patch("routes.AIService.calcular_match_vagas") as mock_match:
        mock_match.return_value = [{"id": 1, "titulo_vaga": "Dev Backend", "percentual_match": 100}]
        
        response = client.get("/api/jobs/match/1")
        assert response.status_code == 200
        assert "percentual_match" in response.json()[0]


@patch("routes.get_db")
def test_aplicar_para_vaga(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    # Simula que estudante e vaga existem
    mock_db.query().filter().first.return_value = MagicMock(id=1, empresa="Vivo")

    payload = {"estudante_id": 1, "vaga_id": 1}
    response = client.post("/api/jobs/apply-meta", json=payload)
    
    assert response.status_code == 200
    assert response.json()["sucesso"] is True


@patch("routes.get_db")
@patch("routes.AIService.processar_entrevista_ia")
def test_interagir_simulador_ia(mock_processar_ia, mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
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


@patch("routes.get_db")
@patch("routes.AIService.gerar_curriculo_ia")
def test_gerar_curriculo_ia(mock_gerar_ia, mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    mock_db.query().filter().first.return_value = MagicMock(id=1, nome="Rafael")
    mock_gerar_ia.return_value = {"nome_candidato": "Rafael", "hard_skills": ["Python"]}

    payload = {"estudante_id": 1, "habilidades_texto": "Gosto de tecnologia"}
    response = client.post("/api/resume/generate", json=payload)
    
    assert response.status_code == 201
    assert response.json()["sucesso"] is True


@patch("routes.get_db")
def test_obter_ranking_semanal(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    # Simula uma lista de estudantes retornada do banco
    mock_estudante = MagicMock(nome="Rafael", xp_semanal=150, categoria_status="🌌 Na Jornada")
    mock_db.query().order_by().limit().all.return_value = [mock_estudante]

    response = client.get("/api/ranking")
    assert response.status_code == 200
    assert len(response.json()) > 0
    assert response.json()[0]["nome"] == "Rafael"