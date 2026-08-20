import os
import json
import logging
import asyncio
import httpx
from datetime import date, timedelta
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from google import genai
from models import Estudante, Vaga
from schemas import CurriculoIaSchema, AvaliacaoEntrevistaSchema, QuizSchema

# Temas genéricos do Quiz do Dia — usados quando o estudante ainda não
# escolheu um itinerário. Giram automaticamente por data (mesmo tema pra
# todo mundo no mesmo dia, sem precisar guardar estado nenhum no banco).
TEMAS_QUIZ = [
    "Soft skills e trabalho em equipe",
    "Postura e etiqueta em entrevistas de emprego",
    "Lógica de programação para iniciantes",
    "Comunicação profissional (e-mail, chat, reuniões)",
    "Organização, produtividade e gestão do tempo",
    "Ética e postura no ambiente de trabalho",
]

# Itinerários formativos disponíveis. Cada um tem seus próprios sub-temas de
# quiz, girando por data do mesmo jeito — assim quem escolhe uma trilha vê
# conteúdo relevante pra ela em vez de temas genéricos aleatórios.
ITINERARIOS_QUIZ = {
    "Tecnologia e Dados": [
        "Lógica de programação para iniciantes",
        "Fundamentos de banco de dados e planilhas",
        "Segurança digital básica no trabalho",
        "Como explicar um projeto técnico pra quem não é da área",
    ],
    "Administrativo e Escritório": [
        "Organização, produtividade e gestão do tempo",
        "Comunicação profissional (e-mail, chat, reuniões)",
        "Rotinas administrativas e arquivamento de documentos",
        "Etiqueta profissional no escritório",
    ],
    "Atendimento e Vendas": [
        "Comunicação profissional com clientes",
        "Como lidar com reclamações e clientes difíceis",
        "Técnicas básicas de venda e negociação",
        "Postura e escuta ativa no atendimento",
    ],
    "Logística e Operações": [
        "Organização, produtividade e gestão do tempo",
        "Segurança e boas práticas em ambientes operacionais",
        "Trabalho em equipe em processos operacionais",
        "Noções básicas de estoque e conferência",
    ],
    "Marketing e Comunicação": [
        "Comunicação profissional (e-mail, chat, reuniões)",
        "Noções básicas de redes sociais para marcas",
        "Como dar e receber feedback criativo",
        "Ética e postura no ambiente de trabalho",
    ],
}

# Garante que GEMINI_API_KEY esteja carregada mesmo se este módulo for
# importado antes de database.py (que também carrega o .env)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

logger = logging.getLogger(__name__)

try:
    client = genai.Client()
except Exception:
    client = None

class AIService:
    """
    Serviço inteligente que gerencia regras de negócio, integrações externas,
    IA generativa estruturada e gamificação do Play2Work.AI.
    """

    @staticmethod
    async def _buscar_razao_social(http_client: httpx.AsyncClient, cnpj: str) -> str | None:
        try:
            response = await http_client.get(f"https://brasilapi.com.br/api/cnpj/v1/{cnpj}", timeout=2)
            if response.status_code == 200:
                return response.json().get("razao_social")
        except Exception as e:
            logger.warning("Falha ao consultar BrasilAPI para o CNPJ %s: %s", cnpj, e)
        return None

    @staticmethod
    async def calcular_match_vagas(estudante_id: int, db: Session, pagina: int = 1, tamanho_pagina: int = 20) -> dict:
        estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
        if not estudante or not estudante.habilidades:
            return {"vagas": [], "pagina": pagina, "tamanho_pagina": tamanho_pagina, "total": 0}

        vagas = db.query(Vaga).all()
        hab_estudante = set(estudante.habilidades)

        matches_brutos = []
        for vaga in vagas:
            hab_vaga = set(vaga.habilidades_exigidas)
            hab_em_comum = hab_estudante.intersection(hab_vaga)
            total_exigido = len(hab_vaga)
            percentual = round((len(hab_em_comum) / max(total_exigido, 1)) * 100)
            matches_brutos.append((vaga, percentual))

        matches_brutos.sort(key=lambda item: item[1], reverse=True)

        total = len(matches_brutos)
        inicio = max(pagina - 1, 0) * tamanho_pagina
        pagina_atual = matches_brutos[inicio:inicio + tamanho_pagina]

        # Consulta as razões sociais em paralelo apenas para as vagas da página atual
        async with httpx.AsyncClient() as http_client:
            razoes_sociais = await asyncio.gather(*[
                AIService._buscar_razao_social(http_client, vaga.cnpj_empresa) if vaga.cnpj_empresa else asyncio.sleep(0)
                for vaga, _ in pagina_atual
            ])

        resultado_matches = [
            {
                "id": vaga.id,
                "titulo_vaga": vaga.titulo_vaga,
                "empresa": vaga.empresa,
                "razao_social_real": razao_social_real or "Parceiro Verificado VIVO",
                "tipo_modalidade": vaga.tipo_modalidade,
                "percentual_match": percentual,
            }
            for (vaga, percentual), razao_social_real in zip(pagina_atual, razoes_sociais)
        ]

        return {"vagas": resultado_matches, "pagina": pagina, "tamanho_pagina": tamanho_pagina, "total": total}

    @staticmethod
    def gerar_curriculo_ia(habilidades_texto: str, nome_estudante: str) -> dict:
        """
        Gera um dicionário estruturado via JSON estrito com o Gemini para mapear o currículo perfeito.
        """
        prompt = f"""
        Atue como um recrutador especialista focado em inclusão produtiva de jovens.
        O estudante se chama {nome_estudante} e digitou o seguinte sobre seu perfil: "{habilidades_texto}".
        Extraia as informações de forma profissional, inferindo objetivos viáveis e corrigindo falhas informais.
        """

        if client:
            try:
                # 🌟 CORRIGIDO: Passando a configuração de schema de forma nativa e limpa para a SDK
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config={
                        'response_mime_type': 'application/json',
                        'response_schema': CurriculoIaSchema,
                    },
                )
                return json.loads(response.text)
            except Exception as e:
                logger.warning("Falha ao gerar currículo via Gemini, usando fallback: %s", e)

        # Fallback estruturado caso a API falhe
        return {
            "nome_candidato": nome_estudante,
            "objetivo_profissional": "Busco minha primeira oportunidade como Jovem Aprendiz para aplicar minha dedicação e competências digitais.",
            "hard_skills": ["Informática Básica", "Navegação Web"],
            "soft_skills": ["Trabalho em Equipe", "Adaptabilidade"],
            "sugestao_areas_atuacao": ["Atendimento ao Cliente", "Suporte Operacional"]
        }

    @staticmethod
    def processar_entrevista_ia(mensagem_usuario: str, historico_conversa: str = "") -> dict:
        """
        Avalia dinamicamente as mensagens do aluno. Dá notas baixas e 0 XP para inputs vazios
        ou aleatórios (ex: 'gh3535', 'asdasd'), criando um fluxo viciante e gamificado de verdade.
        """
        prompt = f"""
        Você é o recrutador chefe da Vivo conduzindo uma simulação de entrevista interativa.
        Histórico anterior: {historico_conversa}
        O candidato acabou de responder: "{mensagem_usuario}"

        Instruções de Avaliação de XP:
        - Se a resposta for evasiva, aleatória (letras sem sentido como 'gh3535'), curta demais ou sem nexo: atribua xp_concedido = 0 e dê um feedback alertando que respostas assim o eliminam do processo.
        - Se a resposta demonstrar interesse básico: dê entre 10 e 25 de XP.
        - Se a resposta trouxer exemplos reais da escola, cursos ou vivências práticas: dê entre 35 e 50 de XP (Excelente!).
        """

        if client:
            try:
                # 🌟 CORRIGIDO: Passando a configuração de schema de forma nativa e limpa para a SDK
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config={
                        'response_mime_type': 'application/json',
                        'response_schema': AvaliacaoEntrevistaSchema,
                    },
                )
                return json.loads(response.text)
            except Exception as e:
                logger.warning("Falha ao avaliar resposta via Gemini, usando fallback: %s", e)

        # Fallback inteligente se estiver sem internet/chave
        if len(mensagem_usuario.strip()) < 5 or "gh" in mensagem_usuario:
            return {
                "analise_feedback": "Atenção! Respostas desconexas ou muito curtas reduzem suas chances com o recrutador. Tente elaborar mais.",
                "xp_concedido": 0,
                "proxima_pergunta": "Vamos tentar de novo. Me conte um projeto escolar ou atividade que você teve orgulho de realizar?"
            }
        
        return {
            "analise_feedback": "Ótima resposta! Você demonstrar clareza sobre suas competências chama a atenção de forma positiva.",
            "xp_concedido": 35,
            "proxima_pergunta": "Excelente progresso. Como você lida com feedbacks negativos ou críticas em trabalhos em equipe?"
        }

    @staticmethod
    def tema_quiz_do_dia(itinerario: str | None = None) -> str:
        """
        Escolhe o tema do dia de forma determinística (mesmo tema o dia
        inteiro pra todo mundo). Se o estudante tiver um itinerário
        escolhido, sorteia dentro dos sub-temas daquela trilha específica.
        """
        temas = ITINERARIOS_QUIZ.get(itinerario, TEMAS_QUIZ)
        return temas[date.today().toordinal() % len(temas)]

    @staticmethod
    def gerar_quiz_ia(tema: str, itinerario: str | None = None) -> dict:
        """
        Gera um quiz de 5 perguntas de múltipla escolha sobre o tema do dia,
        no mesmo padrão de JSON estrito usado no currículo e na entrevista.
        """
        contexto_trilha = f' O estudante está seguindo o itinerário formativo "{itinerario}", então contextualize os exemplos para essa área.' if itinerario else ''
        prompt = f"""
        Atue como um instrutor de preparação para o primeiro emprego de jovens aprendizes.
        Crie um quiz de exatamente 5 perguntas de múltipla escolha (4 alternativas cada,
        só uma correta) sobre o tema: "{tema}".{contexto_trilha}
        As perguntas devem ser objetivas, práticas e adequadas para jovens sem experiência
        prévia de mercado de trabalho. Evite pegadinhas — o objetivo é ensinar, não confundir.
        """

        if client:
            try:
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config={
                        'response_mime_type': 'application/json',
                        'response_schema': QuizSchema,
                    },
                )
                return json.loads(response.text)
            except Exception as e:
                logger.warning("Falha ao gerar quiz via Gemini, usando fallback: %s", e)

        # Fallback estático caso a API falhe ou não tenha chave configurada
        return {
            "tema": tema,
            "perguntas": [
                {
                    "pergunta": "Você chega 10 minutos atrasado para uma reunião online importante. Qual a melhor atitude?",
                    "opcoes": [
                        "Entrar sem avisar e fingir que não houve atraso",
                        "Entrar, pedir desculpas rapidamente e focar no que está sendo dito",
                        "Não entrar mais, já que já perdeu o começo",
                        "Mandar mensagem culpando o trânsito ou a internet em detalhes",
                    ],
                    "resposta_correta_index": 1,
                    "explicacao": "Reconhecer o atraso com objetividade e seguir em frente demonstra profissionalismo sem gerar mais atrito.",
                },
                {
                    "pergunta": "Qual dessas é uma soft skill valorizada por recrutadores?",
                    "opcoes": ["Comunicação clara", "Velocidade de digitação", "Memorização de fórmulas", "Uso avançado de planilhas"],
                    "resposta_correta_index": 0,
                    "explicacao": "Soft skills são competências comportamentais — comunicação clara é uma das mais buscadas em qualquer área.",
                },
                {
                    "pergunta": "Você recebeu um feedback negativo do seu líder. O que fazer?",
                    "opcoes": [
                        "Ignorar, já que é só opinião",
                        "Discutir na hora para provar que está certo",
                        "Ouvir com atenção e perguntar como pode melhorar",
                        "Evitar aquele líder daí em diante",
                    ],
                    "resposta_correta_index": 2,
                    "explicacao": "Feedback é uma ferramenta de crescimento — ouvir e buscar melhorar é o que diferencia profissionais em evolução.",
                },
                {
                    "pergunta": "Num e-mail profissional, o que é mais adequado?",
                    "opcoes": [
                        "Escrever tudo em letras maiúsculas para dar ênfase",
                        "Usar linguagem informal e gírias",
                        "Ser claro, objetivo e educado, com saudação e assinatura",
                        "Enviar sem assunto para ser mais rápido",
                    ],
                    "resposta_correta_index": 2,
                    "explicacao": "Clareza, objetividade e educação são a base de uma comunicação profissional eficaz por e-mail.",
                },
                {
                    "pergunta": "Você tem 3 tarefas para hoje e pouco tempo. Qual a melhor estratégia?",
                    "opcoes": [
                        "Fazer todas ao mesmo tempo",
                        "Priorizar a mais urgente/importante primeiro",
                        "Fazer a mais fácil só para riscar da lista",
                        "Esperar até o fim do dia para decidir",
                    ],
                    "resposta_correta_index": 1,
                    "explicacao": "Priorizar por urgência e importância é a base de uma boa gestão de tempo.",
                },
            ],
        }

    @staticmethod
    def calcular_categoria_status(xp_total: int) -> str:
        """
        Sistema de Categorias/Ligas Dinâmicas baseado no progresso de XP (Estilo Duolingo/LOL)
        """
        # 🌟 ALINHADO: Garantido o uso semântico do novo parâmetro xp_total
        if xp_total < 150:
            return "🌌 Na Jornada"
        elif xp_total < 400:
            return "⚔️ Sobrevivente do RH"
        elif xp_total < 800:
            return "👔 Pronto para a Dinâmica"
        else:
            return "🚀 CONTRATADO!"

    @staticmethod
    def atualizar_ofensiva_duolingo(estudante: Estudante, db: Session) -> None:
        hoje = date.today()
        if estudante.ultimo_treino is None:
            estudante.ofensiva_dias = 1
            estudante.missoes_diarias_concluidas = 1
        elif estudante.ultimo_treino == hoje:
            estudante.missoes_diarias_concluidas += 1
        elif estudante.ultimo_treino == hoje - timedelta(days=1):
            estudante.ofensiva_dias += 1
            estudante.missoes_diarias_concluidas += 1
        else:
            estudante.ofensiva_dias = 1
            estudante.missoes_diarias_concluidas = 1
        
        estudante.ultimo_treino = hoje

    @staticmethod
    def resetar_xp_semanal_se_necessario(estudante: Estudante) -> None:
        """
        Zera o xp_semanal quando o estudante entra em uma nova semana (segunda-feira),
        mantendo o ranking em '/api/ranking' de fato semanal.
        """
        inicio_semana_atual = date.today() - timedelta(days=date.today().weekday())
        if estudante.semana_referencia != inicio_semana_atual:
            estudante.xp_semanal = 0
            estudante.semana_referencia = inicio_semana_atual