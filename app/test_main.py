import sys
import os
import random
from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock

# Garante o mapeamento correto das pastas
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from main import app
from database import get_db
from auth import get_estudante_atual, hash_senha, criar_token, criar_token_admin, cpf_valido, normalizar_cpf
from limiter import limiter
from fuso import hoje as hoje_na_escola
from sqlalchemy.dialects import postgresql
from services import (
    AIService,
    BANCO_QUESTOES,
    ITINERARIOS_QUIZ,
    PERGUNTAS_POR_QUIZ,
    PERGUNTAS_GERAIS_POR_QUIZ,
    PESOS_DESEMPENHO,
    calcular_desempenho_para_vaga,
    escolher_nome_exibicao,
    sortear_perguntas_do_banco,
    vidas_ganhas_por_combo,
)

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


@pytest.fixture(autouse=True)
def _resetar_rate_limiter():
    # O limiter guarda contadores em memória pro processo inteiro -- sem
    # resetar entre testes, chamadas repetidas em rotas como /auth/login
    # (usadas em vários testes) acabariam disparando 429 por causa dos
    # testes anteriores, não da lógica do teste atual.
    limiter.reset()
    yield


def criar_mock_estudante(**overrides):
    """
    MagicMock de Estudante com todos os campos numéricos/data usados pela
    gamificação já setados com valores reais (não MagicMock auto-gerado),
    pra comparações como `estudante.vidas >= 5` não quebrarem nos testes.
    """
    padrao = dict(
        id=1,
        nome="Gabriel",
        nome_exibicao=None,
        email="gabriel@escola.com",
        xp_total=100,
        xp_semanal=50,
        nivel_gamificacao=1,
        ofensiva_dias=2,
        missoes_diarias_concluidas=1,
        ultimo_treino=None,
        semana_referencia=None,
        categoria_status="🌌 Na Jornada",
        liga="Bronze",
        itinerario=None,
        vidas=5,
        proxima_vida_em=None,
        congelamentos_disponiveis=0,
        quizzes_perfeitos_seguidos=0,
        precisa_trocar_senha=False,
        linkedin=None,
        pergunta_seguranca=None,
        resposta_seguranca_hash=None,
    )
    padrao.update(overrides)
    return MagicMock(**padrao)


def criar_mock_quiz_sessao(total=5, acertos=0, pulos=0, ja_respondidas=None, concluido=False, estudante_id=1, dicas_usadas=0, id=99):
    """
    MagicMock de QuizSessao com um gabarito e uma lista de respostas já
    computados -- usado pra testar /quiz/responder, /quiz/dica e
    /quiz/submit sem precisar de um banco de verdade.

    Por padrão (ja_respondidas=None) gera uma lista de respostas do
    tamanho de 'total', simulando um quiz já completo (pro /quiz/submit).
    Pra simular uma sessão parcialmente respondida (pro /quiz/responder e
    /quiz/dica), passe ja_respondidas com a quantidade desejada.
    """
    quantidade = total if ja_respondidas is None else ja_respondidas
    respostas = []
    acertos_restantes, pulos_restantes = acertos, pulos
    for _ in range(quantidade):
        if pulos_restantes > 0:
            respostas.append({"pulou": True, "correta": False})
            pulos_restantes -= 1
        elif acertos_restantes > 0:
            respostas.append({"pulou": False, "correta": True})
            acertos_restantes -= 1
        else:
            respostas.append({"pulou": False, "correta": False})
    gabarito = [{"resposta_correta_index": 0, "explicacao": "Porque sim."} for _ in range(total)]
    return MagicMock(
        id=id,
        estudante_id=estudante_id,
        tema="teste",
        gabarito=gabarito,
        respostas=respostas,
        dicas_usadas=dicas_usadas,
        concluido=concluido,
    )


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
        "pergunta_seguranca": "Qual o nome do seu primeiro professor?",
        "resposta_seguranca": "Maria",
    })
    assert resposta_registro.status_code == 201
    assert "token" in resposta_registro.json()


def test_registrar_sem_pergunta_seguranca_falha_validacao(mock_db):
    mock_db.query().filter().first.return_value = None

    resposta = client.post("/api/auth/registrar", json={
        "nome": "Nova Aluna",
        "email": "nova@escola.com",
        "senha": "senha123",
    })
    assert resposta.status_code == 422


def test_registrar_email_duplicado(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante()

    resposta = client.post("/api/auth/registrar", json={
        "nome": "Duplicado",
        "email": "gabriel@escola.com",
        "senha": "senha123",
        "pergunta_seguranca": "Qual o nome do seu primeiro professor?",
        "resposta_seguranca": "Maria",
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


def test_pergunta_seguranca_encontrada(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante(pergunta_seguranca="Qual seu sobrenome?")

    resposta = client.post("/api/auth/pergunta-seguranca", json={"email": "gabriel@escola.com"})
    assert resposta.status_code == 200
    assert resposta.json()["pergunta"] == "Qual seu sobrenome?"


def test_pergunta_seguranca_email_inexistente(mock_db):
    mock_db.query().filter().first.return_value = None

    resposta = client.post("/api/auth/pergunta-seguranca", json={"email": "naoexiste@escola.com"})
    assert resposta.status_code == 404


def test_resetar_senha_gera_temporaria(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante(
        resposta_seguranca_hash=hash_senha("sozza"),
    )

    resposta = client.post("/api/auth/resetar-senha", json={"email": "gabriel@escola.com", "resposta_seguranca": "SOZZA"})
    assert resposta.status_code == 200
    assert len(resposta.json()["senha_temporaria"]) >= 8


def test_resetar_senha_resposta_incorreta(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante(
        resposta_seguranca_hash=hash_senha("sozza"),
    )

    resposta = client.post("/api/auth/resetar-senha", json={"email": "gabriel@escola.com", "resposta_seguranca": "errada"})
    assert resposta.status_code == 401


def test_resetar_senha_email_inexistente_nao_revela(mock_db):
    mock_db.query().filter().first.return_value = None

    resposta = client.post("/api/auth/resetar-senha", json={"email": "naoexiste@escola.com", "resposta_seguranca": "qualquer"})
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


def test_rota_do_aluno_exige_token(mock_db):
    assert client.get("/api/estudante/me/status").status_code == 401


def test_token_de_admin_nao_abre_rotas_do_aluno(mock_db):
    response = client.get("/api/estudante/me/status", headers={"Authorization": f"Bearer {criar_token_admin()}"})
    assert response.status_code == 401


def test_token_de_aluno_identifica_o_aluno(mock_db):
    estudante = criar_mock_estudante(id=7, nome="Ana")
    mock_db.query().filter().first.return_value = estudante
    response = client.get("/api/estudante/me/status", headers={"Authorization": f"Bearer {criar_token(7)}"})
    assert response.status_code == 200
    assert response.json()["nome"] == "Ana"


def test_entrar_com_cpf_como_senha(mock_db):
    estudante = criar_mock_estudante(cpf="52998224725")
    mock_db.query().filter().first.return_value = estudante

    # aceita CPF com pontuação
    response = client.post("/api/auth/entrar", json={"cpf": "529.982.247-25"})
    assert response.status_code == 200
    assert response.json()["token"]


def test_entrar_com_cpf_inexistente_falha(mock_db):
    mock_db.query().filter().first.return_value = None
    response = client.post("/api/auth/entrar", json={"cpf": "52998224725"})
    assert response.status_code == 401


def test_entrar_tem_rate_limit(mock_db):
    mock_db.query().filter().first.return_value = None
    respostas = [client.post("/api/auth/entrar", json={"cpf": "52998224725"}) for _ in range(11)]
    assert respostas[-1].status_code == 429


def test_nome_exibicao_nunca_repete():
    ocupados = set()
    nomes = []
    for nome in ["Rafael Sozza", "Rafael Silva", "Rafael Souza", "Rafael Vieira Sozza", "Rafael Sozza"]:
        escolhido = escolher_nome_exibicao(nome, ocupados)
        ocupados.add(escolhido.lower())
        nomes.append(escolhido)
    assert nomes == ["Rafael S.", "Rafael Si.", "Rafael So.", "Rafael Soz.", "Rafael Sozz."]
    assert len(set(nomes)) == len(nomes)


def test_nome_exibicao_usa_nome_do_meio_e_depois_numera():
    ocupados = {"ana l.", "ana li.", "ana lim.", "ana lima"}
    assert escolher_nome_exibicao("Ana Clara Lima", ocupados) == "Ana C. Lima"
    assert escolher_nome_exibicao("Ana Lima", ocupados) == "Ana Lima 2"
    assert escolher_nome_exibicao("Bia", set()) == "Bia"


def test_ranking_mostra_nome_de_exibicao(mock_db, mock_estudante_logado):
    hoje = hoje_na_escola()
    inicio_semana = hoje - timedelta(days=hoje.weekday())
    mock_estudante_logado.liga = "Bronze"
    colega = criar_mock_estudante(id=2, nome="Rafael Silva", nome_exibicao="Rafael Si.", xp_semanal=80, semana_referencia=inicio_semana)
    mock_db.query().filter().all.return_value = [colega]
    response = client.get("/api/ranking")
    assert response.json()["ranking"][0]["nome"] == "Rafael Si."


def test_cpf_valido():
    assert cpf_valido("52998224725")
    assert not cpf_valido("52998224726")   # dígito verificador errado
    assert not cpf_valido("11111111111")   # sequência repetida
    assert normalizar_cpf("529.982.247-25") == "52998224725"


def test_login_tem_rate_limit(mock_db):
    # Limite configurado em routes.py é 15/minute -- a 16ª tentativa na
    # mesma janela precisa ser bloqueada, senão o endpoint fica aberto
    # pra força-bruta de senha.
    estudante = criar_mock_estudante(senha_hash="$2b$12$hashquenaobateaproposito")
    mock_db.query().filter().all.return_value = [estudante]

    respostas = [client.post("/api/auth/login", json={"nome": "Gabriel", "senha": "errada"}) for _ in range(16)]

    assert all(r.status_code == 401 for r in respostas[:15])
    assert respostas[15].status_code == 429


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


def test_aluno_nao_se_candidata_sozinho(mock_db, mock_estudante_logado):
    # Vagas por cota e alunos menores: só a escola indica (/admin/vagas/{id}/indicar)
    response = client.post("/api/jobs/apply-meta", json={"vaga_id": 1})

    assert response.status_code == 403
    assert "escola" in response.json()["detail"]
    mock_db.add.assert_not_called()


@patch("routes.CANDIDATURA_PELO_ALUNO_LIBERADA", True)
def test_aplicar_para_vaga_se_a_escola_liberar(mock_db, mock_estudante_logado):
    mock_db.query().filter().first.side_effect = [
        MagicMock(id=1, empresa="Vivo"),  # busca da vaga
        None,  # não existe candidatura anterior
    ]

    response = client.post("/api/jobs/apply-meta", json={"vaga_id": 1})

    assert response.status_code == 201
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


@patch("services.client", None)
def test_curriculo_fallback_tem_todos_os_campos_da_folha():
    # Sem Gemini configurado, o fallback precisa trazer todos os campos que a
    # folha do currículo (ResumeBuilder) espera -- inclusive experiencias.
    from services import AIService

    curriculo = AIService.gerar_curriculo_ia("Gosto de tecnologia", "Rafael")

    campos_esperados = {"nome_candidato", "objetivo_profissional", "hard_skills", "soft_skills", "experiencias", "sugestao_areas_atuacao"}
    assert campos_esperados <= set(curriculo)
    assert curriculo["nome_candidato"] == "Rafael"
    assert isinstance(curriculo["experiencias"], list)


def test_obter_ranking_semanal(mock_db, mock_estudante_logado):
    inicio_semana_atual = hoje_na_escola() - timedelta(days=hoje_na_escola().weekday())
    mock_estudante = MagicMock(
        nome="Rafael",
        nome_exibicao=None,  # aluno antigo sem nome de exibição: cai no nome
        xp_semanal=150,
        categoria_status="🌌 Na Jornada",
        semana_referencia=inicio_semana_atual,
    )
    mock_db.query().filter().all.return_value = [mock_estudante]

    response = client.get("/api/ranking")
    assert response.status_code == 200
    dados = response.json()
    assert dados["liga"] == "Bronze"
    assert len(dados["ranking"]) > 0
    assert dados["ranking"][0]["nome"] == "Rafael"


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
    dados = response.json()
    assert len(dados["perguntas"]) == 1
    # O gabarito não pode vazar pro cliente antes de ele responder --
    # é isso que impede o cliente de simplesmente ler a resposta certa.
    assert "resposta_correta_index" not in dados["perguntas"][0]
    assert "explicacao" not in dados["perguntas"][0]


def test_quiz_responder_registra_acerto(mock_db, mock_estudante_logado):
    sessao = criar_mock_quiz_sessao(total=3, ja_respondidas=0)
    mock_db.query().filter().first.return_value = sessao

    resposta = client.post("/api/quiz/responder", json={"quiz_id": 99, "indice_pergunta": 0, "opcao_selecionada": 0})

    assert resposta.status_code == 200
    assert resposta.json()["correta"] is True
    assert sessao.respostas[-1] == {"pulou": False, "correta": True}


def test_quiz_responder_registra_erro(mock_db, mock_estudante_logado):
    sessao = criar_mock_quiz_sessao(total=3, ja_respondidas=0)
    mock_db.query().filter().first.return_value = sessao

    resposta = client.post("/api/quiz/responder", json={"quiz_id": 99, "indice_pergunta": 0, "opcao_selecionada": 2})

    assert resposta.status_code == 200
    assert resposta.json()["correta"] is False


def test_quiz_responder_pergunta_fora_de_ordem(mock_db, mock_estudante_logado):
    sessao = criar_mock_quiz_sessao(total=3, ja_respondidas=0)  # nenhuma resposta registrada ainda
    mock_db.query().filter().first.return_value = sessao

    resposta = client.post("/api/quiz/responder", json={"quiz_id": 99, "indice_pergunta": 1, "opcao_selecionada": 0})
    assert resposta.status_code == 400


def test_quiz_responder_respeita_limite_de_pulos(mock_db, mock_estudante_logado):
    sessao = criar_mock_quiz_sessao(total=5, pulos=2, ja_respondidas=2)  # já usou os 2 pulos permitidos
    mock_db.query().filter().first.return_value = sessao

    resposta = client.post("/api/quiz/responder", json={"quiz_id": 99, "indice_pergunta": 2, "opcao_selecionada": None})
    assert resposta.status_code == 403


def test_quiz_dica_elimina_opcao_errada(mock_db, mock_estudante_logado):
    sessao = criar_mock_quiz_sessao(total=3)
    mock_db.query().filter().first.return_value = sessao

    resposta = client.post("/api/quiz/dica", json={"quiz_id": 99, "indice_pergunta": 0})

    assert resposta.status_code == 200
    assert resposta.json()["opcao_eliminada"] != 0  # nunca elimina a correta (index 0 no mock)
    assert sessao.dicas_usadas == 1


def test_quiz_dica_respeita_limite(mock_db, mock_estudante_logado):
    sessao = criar_mock_quiz_sessao(total=3, dicas_usadas=2)  # já no limite (DICAS_POR_QUIZ=2)
    mock_db.query().filter().first.return_value = sessao

    resposta = client.post("/api/quiz/dica", json={"quiz_id": 99, "indice_pergunta": 0})
    assert resposta.status_code == 403


def test_quiz_submit_falha_se_ainda_faltam_respostas(mock_db, mock_estudante_logado):
    sessao = criar_mock_quiz_sessao(total=5, acertos=2, ja_respondidas=2)  # só 2 das 5 respondidas
    mock_db.query().filter().first.return_value = sessao

    resposta = client.post("/api/quiz/submit", json={"quiz_id": 99})
    assert resposta.status_code == 400


def test_submeter_quiz(mock_db, mock_estudante_logado):
    sessao = criar_mock_quiz_sessao(total=5, acertos=4)
    mock_db.query().filter().first.return_value = sessao

    response = client.post("/api/quiz/submit", json={"quiz_id": 99})

    assert response.status_code == 200
    assert response.json()["xp_concedido"] == 32  # 4 acertos * 8 XP
    assert response.json()["acertos"] == 4


def test_aluno_nao_pode_trocar_itinerario(mock_db, mock_estudante_logado):
    # Itinerário é cadastrado pela escola no painel admin -- o aluno só vê
    mock_estudante_logado.itinerario = "Tecnologia e Ciência de Dados"
    response = client.post("/api/itinerario/escolher", json={"itinerario": "Robótica e Automação"})

    assert response.status_code == 403
    assert mock_estudante_logado.itinerario == "Tecnologia e Ciência de Dados"


def test_status_gamificacao(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 3
    mock_estudante_logado.congelamentos_disponiveis = 1

    response = client.get("/api/estudante/me/status")

    assert response.status_code == 200
    assert response.json()["vidas"] == 3
    assert "moedas" not in response.json()
    assert response.json()["congelamentos_disponiveis"] == 1


def test_quiz_bloqueado_sem_vidas(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 0
    mock_estudante_logado.proxima_vida_em = None

    response = client.post("/api/quiz/generate")
    assert response.status_code == 403


def test_vida_nao_se_compra_mais(mock_db, mock_estudante_logado):
    # Sem moedas nem loja: as vidas só voltam com o tempo, combo e bônus
    assert client.post("/api/vidas/comprar").status_code in (404, 405)


def test_quiz_pular_nao_custa_vida(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 5

    # 8 perguntas: 4 acertos, 2 pulos, 2 erros reais -> só os 2 erros custam vida
    # (4 acertos seguidos não chegam a fechar um combo de vida)
    sessao = criar_mock_quiz_sessao(total=8, acertos=4, pulos=2)
    mock_db.query().filter().first.return_value = sessao

    response = client.post("/api/quiz/submit", json={"quiz_id": 99})

    assert response.status_code == 200
    assert response.json()["vidas"] == 3
    assert response.json()["xp_concedido"] == 32  # 4 acertos * 8 XP


def test_quiz_perfeito_5_vezes_seguidas_da_vida_bonus(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 2  # +1 do combo de 5 acertos, +1 do bônus de 5 quizzes perfeitos
    mock_estudante_logado.quizzes_perfeitos_seguidos = 4

    sessao = criar_mock_quiz_sessao(total=5, acertos=5)
    mock_db.query().filter().first.return_value = sessao

    response = client.post("/api/quiz/submit", json={"quiz_id": 99})

    assert response.status_code == 200
    assert response.json()["vida_bonus_ganha"] is True
    assert response.json()["vidas"] == 4
    assert response.json()["quizzes_perfeitos_seguidos"] == 0


def test_quiz_imperfeito_reseta_sequencia_de_perfeitos(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 3
    mock_estudante_logado.quizzes_perfeitos_seguidos = 4

    sessao = criar_mock_quiz_sessao(total=5, acertos=3)
    mock_db.query().filter().first.return_value = sessao

    response = client.post("/api/quiz/submit", json={"quiz_id": 99})

    assert response.status_code == 200
    assert response.json()["vida_bonus_ganha"] is False
    assert response.json()["quizzes_perfeitos_seguidos"] == 0


def test_combo_de_5_acertos_devolve_vida_perdida_no_mesmo_quiz(mock_db, mock_estudante_logado):
    mock_estudante_logado.vidas = 5
    # 7 perguntas: 5 acertos seguidos e 2 erros -> perde 2, recupera 1 pelo combo
    sessao = criar_mock_quiz_sessao(total=7, acertos=5)
    mock_db.query().filter().first.return_value = sessao

    response = client.post("/api/quiz/submit", json={"quiz_id": 99})

    assert response.status_code == 200
    assert response.json()["vidas_recuperadas_combo"] == 1
    assert response.json()["vidas"] == 4


def test_quiz_responder_avisa_quando_combo_fecha_vida(mock_db, mock_estudante_logado):
    sessao = criar_mock_quiz_sessao(total=6, acertos=4, ja_respondidas=4)
    mock_db.query().filter().first.return_value = sessao

    resposta = client.post("/api/quiz/responder", json={"quiz_id": 99, "indice_pergunta": 4, "opcao_selecionada": 0})

    assert resposta.json()["combo"] == 5
    assert resposta.json()["ganhou_vida_combo"] is True


def test_vidas_ganhas_por_combo_erro_ou_pulo_zera_sequencia():
    acerto, erro, pulo = {"correta": True, "pulou": False}, {"correta": False, "pulou": False}, {"correta": False, "pulou": True}
    assert vidas_ganhas_por_combo([acerto] * 4 + [erro] + [acerto] * 4) == 0
    assert vidas_ganhas_por_combo([acerto] * 4 + [pulo] + [acerto] * 5) == 1
    assert vidas_ganhas_por_combo([acerto] * 10) == 2


def test_regenera_uma_vida_a_cada_30_minutos():
    agora = datetime.utcnow()
    estudante = criar_mock_estudante(vidas=0, proxima_vida_em=agora - timedelta(minutes=61))
    AIService.regenerar_vidas(estudante)
    # a marca venceu há 61 min: a 1ª vida + mais 2 intervalos completos de 30 min
    assert estudante.vidas == 3
    assert estudante.proxima_vida_em is not None


def test_banco_de_questoes_sorteia_da_area_e_evita_repetidas():
    itinerario = "Recursos Humanos e Gestão de Pessoas"
    rng = random.Random(42)
    primeiro = sortear_perguntas_do_banco(itinerario, set(), rng)
    assert len(primeiro) == PERGUNTAS_POR_QUIZ
    perguntas_da_area = {p["pergunta"] for p in BANCO_QUESTOES[itinerario]}
    assert sum(p["pergunta"] in perguntas_da_area for p in primeiro) == PERGUNTAS_POR_QUIZ - PERGUNTAS_GERAIS_POR_QUIZ

    vistas = {p["pergunta"] for p in primeiro}
    segundo = sortear_perguntas_do_banco(itinerario, vistas, rng)
    assert not vistas & {p["pergunta"] for p in segundo}


def test_banco_de_questoes_embaralha_opcoes_sem_perder_a_resposta_certa():
    originais = {p["pergunta"]: p for grupo in BANCO_QUESTOES.values() for p in grupo}
    for p in sortear_perguntas_do_banco("Tecnologia e Ciência de Dados", set(), random.Random(7)):
        original = originais[p["pergunta"]]
        assert p["opcoes"][p["resposta_correta_index"]] == original["opcoes"][original["resposta_correta_index"]]


def test_banco_de_questoes_bem_formado():
    for itinerario, perguntas in BANCO_QUESTOES.items():
        assert itinerario == "Geral" or itinerario in ITINERARIOS_QUIZ
        for p in perguntas:
            assert len(p["opcoes"]) == 4 and 0 <= p["resposta_correta_index"] < 4, p["pergunta"]
    for itinerario in ITINERARIOS_QUIZ:
        assert len(BANCO_QUESTOES[itinerario]) >= 2 * PERGUNTAS_POR_QUIZ, itinerario


# ----------------------------------------------------------------------
# PAINEL DA ESCOLA (ADMIN)
# ----------------------------------------------------------------------

def test_admin_rotas_exigem_token(mock_db):
    assert client.get("/api/admin/estudantes").status_code == 401
    assert client.get("/api/admin/estudantes", headers={"Authorization": "Bearer lixo"}).status_code == 401


def test_token_de_aluno_nao_abre_painel_admin(mock_db):
    response = client.get("/api/admin/turmas", headers={"Authorization": f"Bearer {criar_token(1)}"})
    assert response.status_code == 401


def test_admin_login(mock_db):
    with patch("admin_routes.ADMIN_SENHA", "segredo-escola"):
        assert client.post("/api/admin/login", json={"senha": "errada"}).status_code == 401
        response = client.post("/api/admin/login", json={"senha": "segredo-escola"})
    assert response.status_code == 200
    token = response.json()["token"]

    mock_db.query().order_by().all.return_value = []
    mock_db.query().group_by().all.return_value = []
    assert client.get("/api/admin/turmas", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_admin_login_desativado_sem_senha_configurada(mock_db):
    with patch("admin_routes.ADMIN_SENHA", None):
        assert client.post("/api/admin/login", json={"senha": "qualquer"}).status_code == 503


ADMIN_HEADERS = lambda: {"Authorization": f"Bearer {criar_token_admin()}"}  # noqa: E731
NOVO_ALUNO = {"nome": "Fulano", "cpf": "529.982.247-25", "email": "f@escola.com"}


def test_admin_cadastrar_aluno_rejeita_itinerario_invalido(mock_db):
    response = client.post("/api/admin/estudantes", headers=ADMIN_HEADERS(), json={**NOVO_ALUNO, "itinerario": "Curso Inexistente"})
    assert response.status_code == 400


def test_admin_cadastrar_aluno_rejeita_cpf_invalido(mock_db):
    mock_db.query().filter().first.return_value = None
    response = client.post("/api/admin/estudantes", headers=ADMIN_HEADERS(), json={**NOVO_ALUNO, "cpf": "123.456.789-00"})
    assert response.status_code == 400


def test_admin_cadastrar_aluno_rejeita_cpf_repetido(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante(id=3, nome="Outro aluno")
    response = client.post("/api/admin/estudantes", headers=ADMIN_HEADERS(), json=NOVO_ALUNO)
    assert response.status_code == 409


def test_desempenho_para_vaga_soma_as_parcelas():
    vaga = MagicMock(habilidades_exigidas=["Comunicação", "Organização"], area_itinerario="Recursos Humanos e Gestão de Pessoas")
    perfeito = criar_mock_estudante(habilidades=["Comunicação", "Organização"], itinerario="Recursos Humanos e Gestão de Pessoas")
    resultado = calcular_desempenho_para_vaga(perfeito, vaga, taxa_acerto_quiz=1.0, nota_competencias=1.0)
    assert resultado["pontuacao"] == 100

    iniciante = criar_mock_estudante(habilidades=["Comunicação"], itinerario="Robótica e Automação")
    resultado = calcular_desempenho_para_vaga(iniciante, vaga, taxa_acerto_quiz=None, nota_competencias=0.0)
    assert resultado["detalhes"]["itinerario"] == 0
    assert resultado["pontuacao"] == round(PESOS_DESEMPENHO["habilidades"] / 2)
    assert resultado["habilidades_em_comum"] == ["Comunicação"]


def test_xp_e_ofensiva_nao_entram_mais_na_nota_de_indicacao():
    assert sum(PESOS_DESEMPENHO.values()) == 100
    assert "engajamento" not in PESOS_DESEMPENHO and "constancia" not in PESOS_DESEMPENHO
    vaga = MagicMock(habilidades_exigidas=["Python"], area_itinerario=None)
    viciado = criar_mock_estudante(habilidades=["Python"], xp_total=99999, ofensiva_dias=365)
    sem_internet = criar_mock_estudante(habilidades=["Python"], xp_total=0, ofensiva_dias=0)
    assert calcular_desempenho_para_vaga(viciado, vaga, 0.8, 0.6) == calcular_desempenho_para_vaga(sem_internet, vaga, 0.8, 0.6)


def test_ranking_ignora_xp_de_semana_anterior(mock_db, mock_estudante_logado):
    # Estudante com xp_semanal > 0 mas de uma semana passada não deve aparecer
    semana_passada = hoje_na_escola() - timedelta(days=hoje_na_escola().weekday() + 14)
    mock_estudante = MagicMock(
        nome="Estudante Antigo",
        xp_semanal=999,
        categoria_status="🌌 Na Jornada",
        semana_referencia=semana_passada,
    )
    mock_db.query().filter().all.return_value = [mock_estudante]

    response = client.get("/api/ranking")
    assert response.status_code == 200
    assert response.json()["ranking"] == []


def test_calcular_estado_ofensiva_em_risco_sem_treino_hoje():
    estudante = criar_mock_estudante(ofensiva_dias=3, ultimo_treino=hoje_na_escola() - timedelta(days=1))
    assert AIService.calcular_estado_ofensiva(estudante) == {"treinou_hoje": False, "em_risco": True}


def test_calcular_estado_ofensiva_treinou_hoje_nao_esta_em_risco():
    estudante = criar_mock_estudante(ofensiva_dias=3, ultimo_treino=hoje_na_escola())
    assert AIService.calcular_estado_ofensiva(estudante) == {"treinou_hoje": True, "em_risco": False}


def test_calcular_estado_ofensiva_sem_ofensiva_ativa():
    estudante = criar_mock_estudante(ofensiva_dias=0, ultimo_treino=hoje_na_escola() - timedelta(days=1))
    assert AIService.calcular_estado_ofensiva(estudante) == {"treinou_hoje": False, "em_risco": False}


def test_avaliar_liga_semanal_promove_top_da_liga():
    db = MagicMock()
    lider = criar_mock_estudante(id=1, liga="Bronze", xp_semanal=200)
    outro = criar_mock_estudante(id=2, liga="Bronze", xp_semanal=10)
    db.query().filter().all.return_value = [lider, outro]

    resultado = AIService.avaliar_liga_semanal(lider, db)

    assert resultado == {"direcao": "subiu", "liga_anterior": "Bronze", "liga_nova": "Prata"}
    assert lider.liga == "Prata"


def test_avaliar_liga_semanal_rebaixa_ultimos_do_grupo_grande():
    db = MagicMock()
    grupo = [criar_mock_estudante(id=i, liga="Prata", xp_semanal=100 - i * 10) for i in range(1, 6)]
    ultimo = grupo[-1]
    db.query().filter().all.return_value = grupo

    resultado = AIService.avaliar_liga_semanal(ultimo, db)

    assert resultado == {"direcao": "desceu", "liga_anterior": "Prata", "liga_nova": "Bronze"}


def test_avaliar_liga_semanal_grupo_cheio_10_sobem_10_descem():
    # Grupo cheio de 30: posições 1-10 sobem, 11-20 ficam, 21-30 descem.
    db = MagicMock()
    grupo = [criar_mock_estudante(id=i, liga="Rubi", xp_semanal=400 - i * 10) for i in range(1, 31)]
    db.query().filter().all.return_value = grupo

    assert AIService.avaliar_liga_semanal(grupo[9], db)["liga_nova"] == "Esmeralda"   # 10º sobe
    assert AIService.avaliar_liga_semanal(grupo[10], db) is None                      # 11º fica
    assert AIService.avaliar_liga_semanal(grupo[19], db) is None                      # 20º fica
    assert AIService.avaliar_liga_semanal(grupo[20], db)["liga_nova"] == "Safira"     # 21º desce


def test_avaliar_liga_semanal_sem_mudanca_no_meio_do_grupo():
    # Grupo de 8: zona de promoção são as posições 1-3, zona de rebaixamento
    # as posições 6-8 -- a posição 5 (bem no meio) não deve se mexer.
    db = MagicMock()
    grupo = [criar_mock_estudante(id=i, liga="Prata", xp_semanal=100 - i * 10) for i in range(1, 9)]
    meio = grupo[4]
    db.query().filter().all.return_value = grupo

    resultado = AIService.avaliar_liga_semanal(meio, db)

    assert resultado is None
    assert meio.liga == "Prata"


# ----------------------------------------------------------------------
# FOTO, PRIMEIRO ACESSO, STATUS DE CONTRATAÇÃO E HISTÓRICO
# ----------------------------------------------------------------------
import base64 as _base64
from fastapi import HTTPException
from fotos import decodificar_foto, TAMANHO_MAXIMO_FOTO
from admin_routes import _entrevistas_por_dia, _idade
from models import MudancaStatusContratacao, ObservacaoEstudante, HistoricoEntrevista

JPEG_MINIMO = b"\xff\xd8\xff\xe0" + b"\x00" * 60
FOTO_DATA_URL = "data:image/jpeg;base64," + _base64.b64encode(JPEG_MINIMO).decode()


def test_decodificar_foto_aceita_data_url_e_detecta_o_tipo_pelos_bytes():
    conteudo, tipo = decodificar_foto(FOTO_DATA_URL)
    assert conteudo == JPEG_MINIMO
    assert tipo == "image/jpeg"
    # O "image/jpeg" do data URL não vale nada: o que conta são os bytes
    _, tipo = decodificar_foto("data:image/jpeg;base64," + _base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 20).decode())
    assert tipo == "image/png"


def test_decodificar_foto_recusa_o_que_nao_e_imagem_e_arquivo_grande():
    with pytest.raises(HTTPException) as erro:
        decodificar_foto(_base64.b64encode(b"<script>alert(1)</script>").decode())
    assert erro.value.status_code == 400
    with pytest.raises(HTTPException) as erro:
        decodificar_foto("isso nao e base64!!")
    assert erro.value.status_code == 400
    with pytest.raises(HTTPException) as erro:
        decodificar_foto(_base64.b64encode(JPEG_MINIMO + b"\x00" * TAMANHO_MAXIMO_FOTO).decode())
    assert erro.value.status_code == 413


def test_aluno_envia_foto(mock_db, mock_estudante_logado):
    mock_estudante_logado.foto = None
    mock_estudante_logado.foto_atualizada_em = None

    response = client.put("/api/estudante/me/foto", json={"imagem_base64": FOTO_DATA_URL})

    assert response.status_code == 200
    comando = mock_db.execute.call_args.args[0]
    params = comando.compile(dialect=postgresql.dialect()).params
    assert params["conteudo"] == JPEG_MINIMO
    assert params["enviada_por"] == "aluno"
    assert mock_estudante_logado.foto_atualizada_em is not None
    mock_db.commit.assert_called()


def test_foto_e_gravada_com_upsert_pra_envio_duplicado_nao_dar_500():
    from fotos import comando_upsert_foto
    sql = str(comando_upsert_foto(7, JPEG_MINIMO, "image/jpeg", "aluno", datetime(2026, 10, 29)).compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT (estudante_id) DO UPDATE" in sql


def test_aluno_sem_foto_recebe_404(mock_db, mock_estudante_logado):
    mock_estudante_logado.foto = None
    assert client.get("/api/estudante/me/foto").status_code == 404


def test_perfil_do_primeiro_acesso(mock_db, mock_estudante_logado):
    mock_estudante_logado.foto_atualizada_em = None
    mock_estudante_logado.onboarding_concluido_em = None
    mock_estudante_logado.ja_trabalhou = None
    mock_estudante_logado.experiencia_previa = None
    mock_db.query().filter().order_by().first.return_value = None

    corpo = client.get("/api/estudante/me/perfil").json()

    assert corpo["tem_foto"] is False
    assert corpo["tem_curriculo"] is False
    assert corpo["onboarding_concluido"] is False


def test_experiencia_previa_some_quando_aluno_diz_que_nunca_trabalhou(mock_db, mock_estudante_logado):
    response = client.put("/api/estudante/me/experiencia", json={"ja_trabalhou": False, "experiencia_previa": "texto que não vale"})
    assert response.status_code == 200
    assert mock_estudante_logado.ja_trabalhou is False
    assert mock_estudante_logado.experiencia_previa is None

    client.put("/api/estudante/me/experiencia", json={"ja_trabalhou": True, "experiencia_previa": "  Ajudante na padaria do bairro  "})
    assert mock_estudante_logado.experiencia_previa == "Ajudante na padaria do bairro"


def test_simulador_guarda_a_nota_na_mensagem_do_aluno(mock_db, mock_estudante_logado):
    mock_db.query().filter().order_by().limit().all.return_value = []
    with patch("routes.AIService.processar_entrevista_ia", return_value={"analise_feedback": "Boa!", "xp_concedido": 35, "proxima_pergunta": "E agora?"}):
        client.post("/api/chat/message", json={"mensagem_usuario": "Organizei a feira de ciências"})

    mensagens = [c.args[0] for c in mock_db.add.call_args_list if isinstance(c.args[0], HistoricoEntrevista)]
    do_aluno = next(m for m in mensagens if m.remetente == "user")
    assert do_aluno.xp_concedido == 35


def test_admin_marcar_contratado_exige_empresa_e_registra_mudanca(mock_db):
    aluno = criar_mock_estudante(id=7, status_contratacao="disponivel", empresa_contratante=None, contratado_em=None)
    mock_db.query().filter().first.return_value = aluno

    assert client.put("/api/admin/estudantes/7/status", headers=ADMIN_HEADERS(), json={"status": "contratado"}).status_code == 400
    assert client.put("/api/admin/estudantes/7/status", headers=ADMIN_HEADERS(), json={"status": "efetivado"}).status_code == 400

    response = client.put("/api/admin/estudantes/7/status", headers=ADMIN_HEADERS(), json={"status": "contratado", "empresa": "Metalúrgica Três Lagoas", "contratado_em": "2026-10-20"})

    assert response.status_code == 200
    assert aluno.status_contratacao == "contratado"
    assert aluno.empresa_contratante == "Metalúrgica Três Lagoas"
    assert aluno.contratado_em == date(2026, 10, 20)
    mudanca = mock_db.add.call_args.args[0]
    assert isinstance(mudanca, MudancaStatusContratacao)
    assert mudanca.status == "contratado" and mudanca.empresa == "Metalúrgica Três Lagoas"


def test_admin_devolver_para_fila_limpa_a_empresa(mock_db):
    aluno = criar_mock_estudante(id=7, status_contratacao="contratado", empresa_contratante="X", contratado_em=date(2026, 1, 5))
    mock_db.query().filter().first.return_value = aluno

    client.put("/api/admin/estudantes/7/status", headers=ADMIN_HEADERS(), json={"status": "disponivel"})

    assert aluno.status_contratacao == "disponivel"
    assert aluno.empresa_contratante is None
    assert aluno.contratado_em is None


def test_admin_observacao_em_branco_e_recusada(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante(id=7)
    assert client.post("/api/admin/estudantes/7/observacoes", headers=ADMIN_HEADERS(), json={"texto": "   "}).status_code == 400

    client.post("/api/admin/estudantes/7/observacoes", headers=ADMIN_HEADERS(), json={"texto": " Precisa melhorar a pontualidade "})
    observacao = mock_db.add.call_args.args[0]
    assert isinstance(observacao, ObservacaoEstudante)
    assert observacao.texto == "Precisa melhorar a pontualidade"


def test_admin_registra_resposta_da_empresa(mock_db):
    candidatura = MagicMock(id=3, status="em_analise", resposta_empresa=None, atualizada_em=None)
    mock_db.query().filter().first.return_value = candidatura

    assert client.put("/api/admin/candidaturas/3", headers=ADMIN_HEADERS(), json={"status": "contratada"}).status_code == 400

    response = client.put("/api/admin/candidaturas/3", headers=ADMIN_HEADERS(), json={"status": "aprovada", "resposta_empresa": "Entrevista dia 05/11"})
    assert response.status_code == 200
    assert candidatura.status == "aprovada"
    assert candidatura.resposta_empresa == "Entrevista dia 05/11"
    assert candidatura.atualizada_em is not None


def test_admin_curriculo_de_aluno_que_ainda_nao_gerou(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante(id=7)
    mock_db.query().filter().order_by().all.return_value = []
    corpo = client.get("/api/admin/estudantes/7/curriculo", headers=ADMIN_HEADERS()).json()
    assert corpo == {"atual": None, "versoes": []}


def test_entrevistas_agrupadas_por_dia_com_a_pergunta_respondida():
    def msg(remetente, texto, dia, nota=None):
        return MagicMock(remetente=remetente, mensagem=texto, feedback_ia="ok" if remetente == "user" else None, xp_concedido=nota, enviado_em=datetime(2026, 10, dia, 10))

    mensagens = [
        msg("ai", "Fale de você", 27),
        msg("user", "Sou organizado", 27, 20),
        msg("ai", "Um desafio?", 27),
        msg("user", "Feira de ciências", 27, 40),
        msg("ai", "Por que essa vaga?", 28),
        msg("user", "Gosto de dados", 28, 30),
    ]

    dias = _entrevistas_por_dia(mensagens)

    assert [d["data"] for d in dias] == ["2026-10-28", "2026-10-27"]
    assert dias[1]["nota_media"] == 30
    assert dias[1]["itens"][1] == {"pergunta": "Um desafio?", "resposta": "Feira de ciências", "feedback": "ok", "nota": 40}


def test_idade_considera_se_ja_fez_aniversario():
    assert _idade(date(2009, 11, 15), hoje=date(2026, 10, 29)) == 16
    assert _idade(date(2009, 10, 29), hoje=date(2026, 10, 29)) == 17
    assert _idade(None) is None


def test_telefone_normalizado_com_ddd():
    from admin_routes import _normalizar_telefone
    assert _normalizar_telefone("(67) 99876-5432") == "67998765432"
    assert _normalizar_telefone("+55 67 3521-0000") == "6735210000"
    assert _normalizar_telefone("  ") is None
    with pytest.raises(HTTPException):
        _normalizar_telefone("99876-5432")  # sem DDD


def test_hoje_e_o_dia_de_tres_lagoas_e_nao_o_do_servidor():
    import fuso
    # 29/10 às 22h em Três Lagoas = 30/10 às 02h em UTC: o dia do aluno ainda é 29
    class Relogio(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 10, 30, 2, 0, tzinfo=timezone.utc).astimezone(tz)
    with patch("fuso.datetime", Relogio):
        assert fuso.hoje() == date(2026, 10, 29)
    assert fuso.data_local(datetime(2026, 10, 30, 2, 0)) == date(2026, 10, 29)
    assert fuso.data_local(datetime(2026, 10, 30, 5, 0)) == date(2026, 10, 30)


def test_entrevista_tarde_da_noite_conta_no_dia_local():
    msg = MagicMock(remetente="user", mensagem="oi", feedback_ia=None, xp_concedido=10, enviado_em=datetime(2026, 10, 30, 1, 30))
    assert _entrevistas_por_dia([msg])[0]["data"] == "2026-10-29"


def test_sessao_do_aluno_e_curta():
    import auth
    assert auth.JWT_EXPIRA_HORAS <= 8


# ----------------------------------------------------------------------
# MAPA DE COMPETÊNCIAS E "O QUE VOCÊ FARIA?"
# ----------------------------------------------------------------------
from competencias import nota_de_competencias, registrar_evidencias, CODIGOS_COMPETENCIAS, COMPETENCIAS
from atividades import SITUACOES, SITUACOES_POR_DIA, situacao_publica
from models import EvidenciaCompetencia, RespostaSituacao


def test_competencias_sao_as_10_gerais_da_bncc():
    assert [c["bncc"] for c in COMPETENCIAS] == list(range(1, 11))
    assert len(set(CODIGOS_COMPETENCIAS)) == 10


def test_eixo_com_poucas_evidencias_e_puxado_pra_50():
    sem_nada = nota_de_competencias({})
    uma_resposta_perfeita = nota_de_competencias({"comunicacao": (100, 1)})
    mes_de_treino = nota_de_competencias({c: (90, 20) for c in CODIGOS_COMPETENCIAS})
    assert sem_nada == 0.5
    # Uma resposta boa mexe pouco; um mês consistente mexe muito
    assert 0.5 < uma_resposta_perfeita < 0.52
    assert mes_de_treino > 0.84


def test_registrar_evidencia_faz_media_movel_no_proprio_banco():
    db = MagicMock()
    registrar_evidencias(db, 7, {"comunicacao": 140, "empatia_cooperacao": -5}, origem="situacao", origem_id=3)

    evidencias = [c.args[0] for c in db.add.call_args_list]
    assert [(e.competencia, e.pontos) for e in evidencias] == [("comunicacao", 100), ("empatia_cooperacao", 0)]
    sql = str(db.execute.call_args_list[0].args[0].compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT (estudante_id, competencia) DO UPDATE" in sql
    assert "mapa_competencias.pontuacao *" in sql


def test_registrar_evidencia_recusa_eixo_inexistente():
    with pytest.raises(ValueError):
        registrar_evidencias(MagicMock(), 7, {"lideranca_suprema": 80}, origem="quiz")


def test_situacao_publica_nao_entrega_pontuacao_nem_consequencia():
    publica = situacao_publica(next(iter(SITUACOES.values())))
    assert set(publica) == {"id", "titulo", "cenario", "opcoes"}
    assert all(isinstance(o, str) for o in publica["opcoes"])


def test_toda_situacao_tem_uma_opcao_claramente_melhor():
    for situacao in SITUACOES.values():
        medias = sorted((sum(o["competencias"].values()) / len(o["competencias"]) for o in situacao["opcoes"]), reverse=True)
        assert medias[0] - medias[1] >= 15, situacao["id"]


def test_responder_situacao_gera_evidencias_e_mostra_a_melhor_opcao(mock_db, mock_estudante_logado):
    mock_db.query().filter().count.return_value = 0
    situacao = SITUACOES["cliente-irritado"]

    response = client.post("/api/situacoes/responder", json={"situacao_id": "cliente-irritado", "opcao_index": 0})

    assert response.status_code == 200
    corpo = response.json()
    assert corpo["escolheu_a_melhor"] is False
    assert corpo["melhor_opcao"]["indice"] == 1
    assert corpo["consequencia"] == situacao["opcoes"][0]["consequencia"]
    gravadas = [c.args[0] for c in mock_db.add.call_args_list]
    assert any(isinstance(g, RespostaSituacao) for g in gravadas)
    assert {g.competencia for g in gravadas if isinstance(g, EvidenciaCompetencia)} == set(situacao["opcoes"][0]["competencias"])


def test_situacao_tem_limite_por_dia(mock_db, mock_estudante_logado):
    mock_db.query().filter().count.return_value = SITUACOES_POR_DIA
    response = client.post("/api/situacoes/responder", json={"situacao_id": "cliente-irritado", "opcao_index": 1})
    assert response.status_code == 429
    assert client.get("/api/situacoes/proxima").json()["situacao"] is None


def test_situacao_inexistente_ou_opcao_invalida(mock_db, mock_estudante_logado):
    mock_db.query().filter().count.return_value = 0
    assert client.post("/api/situacoes/responder", json={"situacao_id": "nao-existe", "opcao_index": 0}).status_code == 404
    assert client.post("/api/situacoes/responder", json={"situacao_id": "cliente-irritado", "opcao_index": 9}).status_code == 400


# ----------------------------------------------------------------------
# TRILHA EAD: FREQUÊNCIA, FIXAÇÃO E CONCLUSÃO
# ----------------------------------------------------------------------
from aulas import extrair_video, registrar_trecho, corrigir_fixacao, buscar_ou_iniciar_progresso
from models import Aula, ModuloTrilha, PerguntaFixacao, ProgressoAula, LogFrequencia, MaterialAula


def criar_aula_teste(duracao=600, minimo=80, nota_minima=70, perguntas=2, itinerario=None, publicada=True):
    modulo = ModuloTrilha(id=1, titulo="Mundo do trabalho", itinerario=itinerario, publicado=True, ordem=0)
    aula = Aula(id=10, modulo_id=1, titulo="Direitos do aprendiz", duracao_segundos=duracao, carga_horaria_minutos=30,
                percentual_minimo_assistido=minimo, nota_minima=nota_minima, publicada=publicada, ordem=0)
    aula.modulo = modulo
    aula.perguntas = [PerguntaFixacao(id=i + 1, enunciado=f"P{i}", opcoes=["a", "b", "c"], resposta_correta_index=1, explicacao="porque sim", ordem=i) for i in range(perguntas)]
    aula.materiais = []
    return aula


def criar_progresso(aula, percentual=0, segundos_atras=3600):
    blocos = -(-aula.duracao_segundos // 10)
    preenchidos = round(blocos * percentual / 100)
    # Sorteio "identidade" (mesma ordem do cadastro) pra os testes poderem responder pelo índice original
    return ProgressoAula(estudante_id=1, aula_id=aula.id, blocos_assistidos="1" * preenchidos + "0" * (blocos - preenchidos),
                         percentual_assistido=percentual, tentativas_fixacao=0,
                         embaralhamento_fixacao=[{"pergunta_id": p.id, "opcoes": list(range(len(p.opcoes)))} for p in aula.perguntas],
                         ultimo_registro_em=datetime(2026, 10, 29, 10, 0) - timedelta(seconds=segundos_atras))


def test_extrair_video_aceita_youtube_e_vimeo():
    assert extrair_video("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s") == ("youtube", "dQw4w9WgXcQ")
    assert extrair_video("https://youtu.be/dQw4w9WgXcQ") == ("youtube", "dQw4w9WgXcQ")
    assert extrair_video("youtube.com/shorts/dQw4w9WgXcQ") == ("youtube", "dQw4w9WgXcQ")
    assert extrair_video("https://vimeo.com/76979871") == ("vimeo", "76979871")
    assert extrair_video("") == (None, None)
    for invalido in ["https://site-qualquer.com/video.mp4", "https://youtube.com/watch?v=curto", "javascript:alert(1)"]:
        with pytest.raises(HTTPException):
            extrair_video(invalido)


def test_adiantar_o_video_ate_o_fim_nao_conta_como_assistido():
    aula, estudante, db = criar_aula_teste(duracao=600), criar_mock_estudante(), MagicMock()
    progresso = criar_progresso(aula)
    # Assistiu 30 s no começo e pulou pro final: só os blocos reproduzidos contam
    registrar_trecho(db, estudante, aula, progresso, 0, 30, agora=datetime(2026, 10, 29, 10, 0))
    estado = registrar_trecho(db, estudante, aula, progresso, 590, 600, agora=datetime(2026, 10, 29, 10, 0, 15))
    assert estado["percentual_assistido"] == 7  # 4 de 60 blocos
    assert estado["pode_fazer_fixacao"] is False


def test_trecho_maior_que_o_tempo_real_e_cortado():
    aula, estudante, db = criar_aula_teste(duracao=3600), criar_mock_estudante(), MagicMock()
    progresso = criar_progresso(aula, segundos_atras=0)
    agora = progresso.ultimo_registro_em + timedelta(seconds=20)
    # Cliente adulterado dizendo que assistiu 1 hora em 20 s: conta no máximo 20 s x 2 + folga
    estado = registrar_trecho(db, estudante, aula, progresso, 0, 3600, agora=agora)
    assert estado["percentual_assistido"] <= 2


def test_assistir_a_aula_inteira_libera_a_fixacao_e_grava_marcos_no_log():
    aula, estudante, db = criar_aula_teste(duracao=100), criar_mock_estudante(), MagicMock()
    progresso = criar_progresso(aula, segundos_atras=0)
    momento = progresso.ultimo_registro_em
    for inicio in range(0, 100, 20):
        momento += timedelta(seconds=20)
        estado = registrar_trecho(db, estudante, aula, progresso, inicio, inicio + 20, agora=momento)
    assert estado["percentual_assistido"] == 100
    assert estado["pode_fazer_fixacao"] is True
    marcos = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], LogFrequencia)]
    assert [m.percentual_assistido for m in marcos] == [20, 40, 60, 80, 100]


def test_primeiro_acesso_grava_inicio_no_log():
    db = MagicMock()
    db.query().filter().first.return_value = None
    progresso = buscar_ou_iniciar_progresso(db, criar_mock_estudante(), criar_aula_teste())
    logs = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], LogFrequencia)]
    assert progresso.percentual_assistido == 0 and len(progresso.blocos_assistidos) == 60
    assert [log.evento for log in logs] == ["inicio"]


def test_fixacao_bloqueada_antes_da_frequencia_minima():
    aula = criar_aula_teste(minimo=80)
    with pytest.raises(HTTPException) as erro:
        corrigir_fixacao(MagicMock(), criar_mock_estudante(), aula, criar_progresso(aula, percentual=50), [1, 1])
    assert erro.value.status_code == 403


def test_reprovado_na_fixacao_nao_ve_o_gabarito_e_nao_conclui():
    aula, db = criar_aula_teste(nota_minima=70), MagicMock()
    progresso = criar_progresso(aula, percentual=90)
    resultado = corrigir_fixacao(db, criar_mock_estudante(), aula, progresso, [1, 0])  # 50%
    assert resultado["aprovado"] is False and resultado["xp_concedido"] == 0
    assert progresso.concluida_em is None
    assert all("resposta_correta_index" not in c for c in resultado["correcao"])
    assert [c["acertou"] for c in resultado["correcao"]] == [True, False]
    eventos = [(c.args[0].evento, c.args[0].nota, c.args[0].nota_de_corte) for c in db.add.call_args_list if isinstance(c.args[0], LogFrequencia)]
    assert eventos == [("fixacao", 50, 70)]


def test_aprovado_conclui_uma_vez_so_e_alimenta_o_mapa():
    aula, db = criar_aula_teste(), MagicMock()
    progresso = criar_progresso(aula, percentual=100)
    primeira = corrigir_fixacao(db, criar_mock_estudante(), aula, progresso, [1, 1])
    assert primeira["aprovado"] and primeira["concluiu_agora"] and primeira["xp_concedido"] > 0
    assert primeira["correcao"][0]["resposta_correta_index"] == 1
    assert progresso.concluida_em is not None
    eventos = [c.args[0].evento for c in db.add.call_args_list if isinstance(c.args[0], LogFrequencia)]
    assert eventos == ["fixacao", "conclusao"]
    assert any(isinstance(c.args[0], EvidenciaCompetencia) and c.args[0].origem == "aula" for c in db.add.call_args_list)

    progresso.embaralhamento_fixacao = [{"pergunta_id": p.id, "opcoes": [0, 1, 2]} for p in aula.perguntas]
    segunda = corrigir_fixacao(db, criar_mock_estudante(), aula, progresso, [1, 1])
    assert segunda["concluiu_agora"] is False and segunda["xp_concedido"] == 0
    assert progresso.tentativas_fixacao == 2


@patch("aulas_routes._progresso", return_value=None)
def test_aluno_nao_ve_aula_de_outro_itinerario_nem_rascunho(_sem_progresso, mock_db, mock_estudante_logado):
    mock_estudante_logado.itinerario = "Tecnologia e Ciência de Dados"
    mock_db.query().filter().first.return_value = criar_aula_teste(itinerario="Robótica e Automação")
    assert client.get("/api/aulas/10").status_code == 404
    mock_db.query().filter().first.return_value = criar_aula_teste(publicada=False)
    assert client.get("/api/aulas/10").status_code == 404
    mock_db.query().filter().first.return_value = criar_aula_teste(itinerario=None)
    assert client.get("/api/aulas/10").status_code == 200


def test_escola_nao_apaga_aula_com_frequencia_registrada(mock_db):
    mock_db.query().filter().first.return_value = criar_aula_teste()
    response = client.delete("/api/admin/aulas/10", headers=ADMIN_HEADERS())
    assert response.status_code == 409
    mock_db.delete.assert_not_called()


def test_escola_precisa_marcar_a_alternativa_correta(mock_db):
    mock_db.query().filter().first.return_value = criar_aula_teste()
    corpo = {"perguntas": [{"enunciado": "Quanto dura o contrato?", "opcoes": ["1 ano", "2 anos"], "resposta_correta_index": 5}]}
    assert client.put("/api/admin/aulas/10/perguntas", headers=ADMIN_HEADERS(), json=corpo).status_code == 400
    corpo["perguntas"][0]["opcoes"] = ["1 ano", "  "]
    assert client.put("/api/admin/aulas/10/perguntas", headers=ADMIN_HEADERS(), json=corpo).status_code == 422


def test_material_e_conferido_pelos_bytes(mock_db):
    mock_db.query().filter().first.return_value = criar_aula_teste()
    falso_pdf = client.post("/api/admin/aulas/10/materiais", headers=ADMIN_HEADERS(), files={"arquivo": ("slides.pdf", b"MZ\x90\x00 executavel", "application/pdf")})
    assert falso_pdf.status_code == 400
    pdf = client.post("/api/admin/aulas/10/materiais", headers=ADMIN_HEADERS(), files={"arquivo": ("Aula 1 (slides).pdf", b"%PDF-1.7 conteudo", "application/pdf")})
    assert pdf.status_code == 201
    material = mock_db.add.call_args.args[0]
    assert isinstance(material, MaterialAula) and material.tipo == "documento" and material.nome_arquivo == "Aula 1 _slides_.pdf"


# ----------------------------------------------------------------------
# CERTIFICADO DO PAP (enviado pela escola, liberado após a conclusão)
# ----------------------------------------------------------------------
from models import Certificado
from aulas_routes import situacao_do_modulo


def criar_certificado_teste(modulo_id=1):
    return Certificado(id=5, estudante_id=1, modulo_id=modulo_id, titulo="Integração PAP 2026", nome_arquivo="certificado.pdf",
                       tamanho_bytes=20, conteudo=b"%PDF-1.7 certificado", enviado_em=datetime(2026, 10, 29, 12, 0))


def test_situacao_do_modulo_conta_so_aulas_publicadas():
    modulo = criar_aula_teste().modulo
    modulo.aulas = [criar_aula_teste(), Aula(id=11, publicada=False), Aula(id=12, publicada=True)]
    db = MagicMock()
    db.query().filter().count.return_value = 1
    assert situacao_do_modulo(db, 1, modulo) == {"aulas_total": 2, "aulas_concluidas": 1, "concluido": False}
    db.query().filter().count.return_value = 2
    assert situacao_do_modulo(db, 1, modulo)["concluido"] is True
    assert situacao_do_modulo(db, 1, None)["concluido"] is True  # sem módulo: libera na hora


def test_escola_so_envia_certificado_em_pdf(mock_db):
    mock_db.query().filter().first.return_value = criar_mock_estudante()
    invalido = client.post("/api/admin/estudantes/1/certificados", headers=ADMIN_HEADERS(),
                           data={"titulo": "Integração"}, files={"arquivo": ("cert.png", b"\x89PNG\r\n\x1a\n...", "image/png")})
    assert invalido.status_code == 400
    mock_db.add.assert_not_called()


@patch("aulas_routes.situacao_do_modulo", return_value={"aulas_total": 5, "aulas_concluidas": 3, "concluido": False})
def test_certificado_fica_bloqueado_ate_concluir_o_modulo(_situacao, mock_db, mock_estudante_logado):
    modulo = ModuloTrilha(id=1, titulo="Integração", publicado=True)
    mock_db.query().filter().first.side_effect = [criar_certificado_teste(), modulo]
    response = client.get("/api/certificados/5")
    assert response.status_code == 403
    assert "3 de 5" in response.json()["detail"]


@patch("aulas_routes.situacao_do_modulo", return_value={"aulas_total": 5, "aulas_concluidas": 5, "concluido": True})
def test_certificado_libera_depois_da_conclusao(_situacao, mock_db, mock_estudante_logado):
    modulo = ModuloTrilha(id=1, titulo="Integração", publicado=True)
    mock_db.query().filter().first.side_effect = [criar_certificado_teste(), modulo]
    response = client.get("/api/certificados/5")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_certificado_sem_modulo_libera_na_hora(mock_db, mock_estudante_logado):
    mock_db.query().filter().first.return_value = criar_certificado_teste(modulo_id=None)
    assert client.get("/api/certificados/5").status_code == 200


def test_player_so_avanca_ate_onde_o_aluno_ja_assistiu_sem_pular():
    from aulas import ponto_mais_longe_sem_pular, VELOCIDADE_MAXIMA
    aula = criar_aula_teste(duracao=95)
    assert VELOCIDADE_MAXIMA == 1.0
    assert ponto_mais_longe_sem_pular(aula, None) == 0
    progresso = criar_progresso(aula)
    progresso.blocos_assistidos = "1110011000"  # pulou do bloco 3 pro 5
    assert ponto_mais_longe_sem_pular(aula, progresso) == 30
    progresso.blocos_assistidos = "1" * 10
    assert ponto_mais_longe_sem_pular(aula, progresso) == 95  # não passa do fim do vídeo


def test_assistir_acelerado_nao_conta():
    aula, db = criar_aula_teste(duracao=600), MagicMock()
    progresso = criar_progresso(aula, segundos_atras=0)
    # 60 s de relógio, mas o cliente diz que viu 120 s de vídeo (2x): conta só 60 + folga
    estado = registrar_trecho(db, criar_mock_estudante(), aula, progresso, 0, 120, agora=progresso.ultimo_registro_em + timedelta(seconds=60))
    assert estado["percentual_assistido"] < 15


def test_fixacao_embaralha_perguntas_e_alternativas_e_corrige_pela_original():
    from aulas import sortear_fixacao
    aula = criar_aula_teste(perguntas=2)
    aula.perguntas[0].opcoes, aula.perguntas[1].opcoes = ["A0", "A1", "A2"], ["B0", "B1", "B2"]
    progresso = criar_progresso(aula, percentual=100)
    progresso.embaralhamento_fixacao = None
    with patch("aulas.random.shuffle", side_effect=lambda lista: lista.reverse()), patch("aulas.random.sample", return_value=[2, 1, 0]):
        publicas = sortear_fixacao(aula, progresso)
    # Perguntas invertidas e alternativas invertidas; a correta (índice 1 original) continua no meio
    assert [p["id"] for p in publicas] == [2, 1]
    assert publicas[0]["opcoes"] == ["B2", "B1", "B0"]
    assert sortear_fixacao(aula, progresso) == publicas  # reabrir não sorteia de novo

    resultado = corrigir_fixacao(MagicMock(), criar_mock_estudante(), aula, progresso, [1, 1])
    assert resultado["nota"] == 100
    assert progresso.embaralhamento_fixacao is None  # próxima tentativa sorteia outra ordem


def test_fixacao_sem_sorteio_aberto_pede_pra_abrir_de_novo():
    aula = criar_aula_teste()
    progresso = criar_progresso(aula, percentual=100)
    progresso.embaralhamento_fixacao = None
    with pytest.raises(HTTPException) as erro:
        corrigir_fixacao(MagicMock(), criar_mock_estudante(), aula, progresso, [1, 1])
    assert erro.value.status_code == 409


def test_aluno_escolhe_se_a_foto_vai_no_curriculo(mock_db, mock_estudante_logado):
    mock_estudante_logado.foto_no_curriculo = False
    response = client.put("/api/estudante/me/preferencias-curriculo", json={"foto_no_curriculo": True})
    assert response.status_code == 200
    assert mock_estudante_logado.foto_no_curriculo is True
    mock_db.commit.assert_called()


# ----------------------------------------------------------------------
# MENSAGENS: CONVERSA DIRETA, GRUPO DA EMPRESA/TURNO E CANAL GERAL
# ----------------------------------------------------------------------
from mensagens import eh_membro, _mensagem_para_aluno, _mensagem_para_escola, TEXTO_OCULTA
from models import Canal, Mensagem, Turma


def aprendiz(id=1, empresa="Eldorado", turno="Manhã", status="contratado", **extra):
    return criar_mock_estudante(id=id, status_contratacao=status, empresa_contratante=empresa, turma=MagicMock(turno=turno), **extra)


def test_quem_participa_de_cada_canal():
    db = MagicMock()
    grupo = Canal(id=1, tipo="grupo", empresa="Eldorado", turno="Manhã", arquivado=False)
    assert eh_membro(db, grupo, aprendiz()) is True
    assert eh_membro(db, grupo, aprendiz(turno="Tarde")) is False            # outro turno
    assert eh_membro(db, grupo, aprendiz(empresa="Outra")) is False          # outra empresa
    assert eh_membro(db, grupo, aprendiz(status="disponivel")) is False      # saiu da empresa: perde o acesso
    grupo.arquivado = True
    assert eh_membro(db, grupo, aprendiz()) is False
    sem_turno = Canal(id=2, tipo="grupo", empresa="Eldorado", turno=None, arquivado=False)
    assert eh_membro(db, sem_turno, aprendiz(turno="Tarde")) is True
    assert eh_membro(db, Canal(id=3, tipo="direto", estudante_id=1), aprendiz(id=1)) is True
    assert eh_membro(db, Canal(id=3, tipo="direto", estudante_id=1), aprendiz(id=2)) is False  # sem conversa privada entre alunos
    assert eh_membro(db, Canal(id=4, tipo="geral"), aprendiz(status="disponivel")) is True


def test_no_grupo_o_colega_aparece_so_pelo_nome_curto():
    eu = criar_mock_estudante(id=1)
    colega = criar_mock_estudante(id=2, nome="Bianca Ferreira da Silva", nome_exibicao="Bianca F.")
    m = Mensagem(id=9, autor_tipo="aluno", estudante_id=2, texto="Bom dia!", enviada_em=datetime(2026, 10, 30, 8, 0))
    m.estudante = colega
    assert _mensagem_para_aluno(m, eu)["autor"] == "Bianca F."
    m.estudante_id, m.estudante = 1, eu
    assert _mensagem_para_aluno(m, eu)["autor"] == "Você" and _mensagem_para_aluno(m, eu)["minha"] is True


def test_mensagem_oculta_some_pro_aluno_e_fica_guardada_pra_escola():
    m = Mensagem(id=9, autor_tipo="aluno", estudante_id=2, texto="texto impróprio", enviada_em=datetime(2026, 10, 30, 8, 0),
                 oculta_em=datetime(2026, 10, 30, 9, 0), oculta_motivo="Linguagem ofensiva")
    m.estudante = criar_mock_estudante(id=2, nome_exibicao="Lucas A.")
    assert _mensagem_para_aluno(m, criar_mock_estudante(id=1))["texto"] == TEXTO_OCULTA
    escola = _mensagem_para_escola(m)
    assert escola["texto"] == "texto impróprio" and escola["oculta_motivo"] == "Linguagem ofensiva"


def test_aluno_nao_escreve_no_canal_geral(mock_db, mock_estudante_logado):
    mock_db.query().filter().first.return_value = Canal(id=4, tipo="geral", nome="Geral da escola")
    response = client.post("/api/mensagens/canais/4/mensagens", json={"texto": "oi gente"})
    assert response.status_code == 403
    mock_db.add.assert_not_called()


def test_aluno_fora_do_grupo_nao_entra(mock_db, mock_estudante_logado):
    mock_estudante_logado.status_contratacao = "disponivel"
    mock_db.query().filter().first.return_value = Canal(id=1, tipo="grupo", empresa="Eldorado", turno=None, arquivado=False)
    assert client.get("/api/mensagens/canais/1").status_code == 404
    assert client.post("/api/mensagens/canais/1/mensagens", json={"texto": "oi"}).status_code == 404


def test_aluno_escreve_pra_coordenacao(mock_db, mock_estudante_logado):
    mock_db.query().filter().first.return_value = Canal(id=3, tipo="direto", estudante_id=mock_estudante_logado.id)
    response = client.post("/api/mensagens/canais/3/mensagens", json={"texto": "  Posso faltar amanhã? Tenho consulta.  "})
    assert response.status_code == 201
    mensagem = mock_db.add.call_args.args[0]
    assert isinstance(mensagem, Mensagem) and mensagem.autor_tipo == "aluno" and mensagem.texto == "Posso faltar amanhã? Tenho consulta."


def test_nao_cria_dois_grupos_da_mesma_empresa_e_turno(mock_db):
    mock_db.query().filter().first.return_value = Canal(id=1, tipo="grupo", empresa="Eldorado", turno="Manhã")
    response = client.post("/api/admin/mensagens/grupos", headers=ADMIN_HEADERS(), json={"empresa": "Eldorado", "turno": "Manhã"})
    assert response.status_code == 409


def test_escola_oculta_mensagem_com_motivo(mock_db):
    m = Mensagem(id=9, autor_tipo="aluno", estudante_id=2, texto="xingamento", enviada_em=datetime(2026, 10, 30, 8, 0))
    m.estudante = criar_mock_estudante(id=2)
    mock_db.query().filter().first.return_value = m
    response = client.post("/api/admin/mensagens/9/ocultar", headers=ADMIN_HEADERS(), json={"motivo": "Linguagem ofensiva"})
    assert response.status_code == 200
    assert m.oculta_em is not None and m.oculta_motivo == "Linguagem ofensiva"
    assert response.json()["texto"] == "xingamento"  # a escola continua vendo o original


def test_nao_existe_rota_pra_editar_ou_apagar_mensagem(mock_db):
    assert client.put("/api/admin/mensagens/9", headers=ADMIN_HEADERS(), json={"texto": "x"}).status_code in (404, 405)
    assert client.delete("/api/admin/mensagens/9", headers=ADMIN_HEADERS()).status_code in (404, 405)
