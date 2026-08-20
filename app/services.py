import os
import json
import logging
import asyncio
import httpx
from datetime import date, datetime, timedelta
from dotenv import load_dotenv
from sqlalchemy import func
from sqlalchemy.orm import Session

from google import genai
from models import Estudante, Vaga, AtividadeDiaria
from schemas import CurriculoIaSchema, AvaliacaoEntrevistaSchema, QuizSchema

# ❤️ Configuração do sistema de vidas/moedas/congelamento de ofensiva
VIDAS_MAXIMAS = 5
HORAS_PARA_REGENERAR_VIDA = 2
CUSTO_MOEDAS_POR_VIDA = 50
MOEDAS_POR_XP = 0.1              # 1 moeda a cada 10 XP ganho
DIAS_OFENSIVA_POR_CONGELAMENTO = 7  # a cada 7 dias seguidos, ganha 1 congelamento de graça
QUIZZES_PERFEITOS_PARA_VIDA_BONUS = 5  # 5 quizzes seguidos com 100% de acerto = 1 vida de bônus

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

# Itinerários formativos disponíveis — funcionam como "cursos" (no espírito
# de escolher inglês/espanhol no Duolingo): o estudante escolhe UM e tanto o
# Quiz do Dia quanto o Simulador de Entrevista passam a girar em torno dele.
# Cada um tem descrição (pra UI) e sub-temas de quiz, girando por data do
# mesmo jeito — mesmo tema pra todo mundo no mesmo dia, sem guardar estado.
ITINERARIOS_QUIZ = {
    "Tecnologia e Ciência de Dados": {
        "descricao": "Análise estatística, Big Data, Python e SQL, visualização de dados e IA aplicadas ao mercado de trabalho.",
        "temas": [
            "Fundamentos de Python e lógica de programação",
            "SQL e organização de dados em tabelas",
            "Conceitos básicos de Big Data e como empresas usam dados",
            "Visualização de dados: gráficos que contam uma história",
            "Inteligência Artificial aplicada ao mercado de trabalho",
        ],
    },
    "Robótica e Automação": {
        "descricao": "Desenvolvimento de protótipos, projetos em Arduino, automação e integração entre programação e hardware.",
        "temas": [
            "Lógica de programação aplicada a hardware (Arduino)",
            "Sensores, atuadores e como um protótipo funciona",
            "Automação industrial: conceitos básicos",
            "Segurança e boas práticas em projetos de automação",
            "Como apresentar um projeto de robótica pra uma banca",
        ],
    },
    "Ciências Jurídicas / Serviços Jurídicos": {
        "descricao": "Fundamentos do Direito, Direito Digital, LGPD, ética na era digital e rotinas administrativas/jurídicas.",
        "temas": [
            "Fundamentos básicos do Direito",
            "LGPD: o que é e por que toda empresa precisa seguir",
            "Direito Digital no dia a dia",
            "Ética e postura profissional na era digital",
            "Rotinas administrativas de um escritório jurídico",
        ],
    },
    "Ciências da Natureza e Matemática": {
        "descricao": "Aprofundamento em Biologia, Física, Química e Matemática, com foco prático e preparação para vestibulares e ENEM.",
        "temas": [
            "Matemática básica para o dia a dia e provas",
            "Fundamentos de Física aplicados ao cotidiano",
            "Química no cotidiano",
            "Biologia e meio ambiente",
            "Técnicas de estudo para vestibular e ENEM",
        ],
    },
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
    def processar_entrevista_ia(mensagem_usuario: str, historico_conversa: str = "", itinerario: str | None = None) -> dict:
        """
        Avalia dinamicamente as mensagens do aluno. Dá notas baixas e 0 XP para inputs vazios
        ou aleatórios (ex: 'gh3535', 'asdasd'), criando um fluxo viciante e gamificado de verdade.
        Quando o estudante já escolheu um itinerário formativo, a entrevista gira em torno
        de vagas e situações daquela área específica (mesmo itinerário usado no Quiz do Dia).
        """
        contexto_trilha = (
            f' A vaga simulada é da área de "{itinerario}" — direcione as perguntas e o feedback para esse contexto específico.'
            if itinerario else ''
        )
        prompt = f"""
        Você é o recrutador chefe da Vivo conduzindo uma simulação de entrevista interativa.{contexto_trilha}
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
        temas = ITINERARIOS_QUIZ[itinerario]["temas"] if itinerario in ITINERARIOS_QUIZ else TEMAS_QUIZ
        return temas[date.today().toordinal() % len(temas)]

    @staticmethod
    def gerar_quiz_ia(tema: str, itinerario: str | None = None) -> dict:
        """
        Gera um quiz de 10 perguntas de múltipla escolha sobre o tema do dia,
        no mesmo padrão de JSON estrito usado no currículo e na entrevista.
        """
        contexto_trilha = f' O estudante está seguindo o itinerário formativo "{itinerario}", então contextualize os exemplos para essa área.' if itinerario else ''
        prompt = f"""
        Atue como um instrutor de preparação para o primeiro emprego de jovens aprendizes.
        Crie um quiz de exatamente 10 perguntas de múltipla escolha (4 alternativas cada,
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
                {
                    "pergunta": "Um colega te pede ajuda numa tarefa enquanto você está no meio de outra urgente. O que fazer?",
                    "opcoes": [
                        "Ignorar o pedido sem responder",
                        "Parar tudo imediatamente pra ajudar",
                        "Explicar a situação e combinar um horário pra ajudar depois",
                        "Ajudar só parte do tempo, sem avisar nada",
                    ],
                    "resposta_correta_index": 2,
                    "explicacao": "Comunicar a situação com transparência e negociar um horário mostra organização sem deixar o colega no vácuo.",
                },
                {
                    "pergunta": "Qual desses é um exemplo de escuta ativa numa reunião?",
                    "opcoes": [
                        "Mexer no celular enquanto o outro fala",
                        "Interromper pra dar sua opinião",
                        "Fazer perguntas e resumir o que entendeu",
                        "Ficar calado sem demonstrar reação",
                    ],
                    "resposta_correta_index": 2,
                    "explicacao": "Escuta ativa envolve confirmar entendimento — perguntar e resumir mostra que você realmente está prestando atenção.",
                },
                {
                    "pergunta": "Você cometeu um erro num relatório que já foi enviado. Qual a melhor atitude?",
                    "opcoes": [
                        "Esperar alguém perceber",
                        "Avisar o responsável e propor a correção",
                        "Corrigir sem falar nada pra ninguém notar",
                        "Culpar quem revisou antes de você",
                    ],
                    "resposta_correta_index": 1,
                    "explicacao": "Assumir o erro e propor solução rapidamente é o que constrói confiança profissional — esconder só piora.",
                },
                {
                    "pergunta": "Numa entrevista de emprego, o que passa mais credibilidade?",
                    "opcoes": [
                        "Dizer que não tem nenhum ponto fraco",
                        "Dar exemplos concretos de situações reais",
                        "Falar mal do emprego anterior",
                        "Responder tudo de forma genérica",
                    ],
                    "resposta_correta_index": 1,
                    "explicacao": "Exemplos concretos e reais são muito mais convincentes do que respostas genéricas ou decoradas.",
                },
                {
                    "pergunta": "O que caracteriza um bom trabalho em equipe?",
                    "opcoes": [
                        "Cada um cuidar só da própria parte, sem se comunicar",
                        "Compartilhar informações e ajudar quando possível",
                        "Competir pra aparecer mais que os colegas",
                        "Esperar que o líder resolva tudo sozinho",
                    ],
                    "resposta_correta_index": 1,
                    "explicacao": "Comunicação e colaboração são a base de qualquer equipe que funciona bem de verdade.",
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
    def _marcar_dia(estudante: Estudante, db: Session, dia: date, status: str) -> None:
        """Upsert do registro de calendário de um dia específico do estudante."""
        registro = db.query(AtividadeDiaria).filter(
            AtividadeDiaria.estudante_id == estudante.id,
            AtividadeDiaria.data == dia,
        ).first()
        if registro:
            registro.status = status
        else:
            db.add(AtividadeDiaria(estudante_id=estudante.id, data=dia, status=status))

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
        elif estudante.ultimo_treino == hoje - timedelta(days=2) and estudante.congelamentos_disponiveis > 0:
            # Faltou só 1 dia e tem congelamento disponível: consome 1 e mantém a ofensiva viva
            estudante.congelamentos_disponiveis -= 1
            estudante.ofensiva_dias += 1
            estudante.missoes_diarias_concluidas = 1
            AIService._marcar_dia(estudante, db, hoje - timedelta(days=1), "congelado")
        else:
            # Ofensiva quebrada de verdade — marca o dia anterior como perdido (se havia treino em andamento)
            if estudante.ultimo_treino is not None and estudante.ultimo_treino < hoje - timedelta(days=1):
                AIService._marcar_dia(estudante, db, hoje - timedelta(days=1), "perdido")
            estudante.ofensiva_dias = 1
            estudante.missoes_diarias_concluidas = 1

        # A cada X dias seguidos de ofensiva, ganha 1 congelamento de graça
        if estudante.ofensiva_dias > 0 and estudante.ofensiva_dias % DIAS_OFENSIVA_POR_CONGELAMENTO == 0:
            estudante.congelamentos_disponiveis += 1

        estudante.ultimo_treino = hoje
        AIService._marcar_dia(estudante, db, hoje, "feito")

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

    @staticmethod
    def regenerar_vidas(estudante: Estudante) -> None:
        """
        Calcula, de forma lazy (sem cron nenhum), quantas vidas já regeneraram
        desde a última perda com base em proxima_vida_em.
        """
        if estudante.vidas >= VIDAS_MAXIMAS or estudante.proxima_vida_em is None:
            return

        agora = datetime.utcnow()
        if agora < estudante.proxima_vida_em:
            return

        intervalo = timedelta(hours=HORAS_PARA_REGENERAR_VIDA)
        tempo_desde_a_marca = agora - estudante.proxima_vida_em
        vidas_regeneradas = 1 + int(tempo_desde_a_marca / intervalo)

        estudante.vidas = min(VIDAS_MAXIMAS, estudante.vidas + vidas_regeneradas)
        estudante.proxima_vida_em = None if estudante.vidas >= VIDAS_MAXIMAS else agora + intervalo

    @staticmethod
    def avaliar_bonus_por_desempenho(estudante: Estudante, acertos: int, total: int) -> bool:
        """
        Acompanha quizzes com 100% de acerto em sequência. Ao completar
        QUIZZES_PERFEITOS_PARA_VIDA_BONUS seguidos, concede 1 vida de bônus
        (respeitando o teto) e zera o contador. Qualquer erro reseta a
        sequência. Retorna True se uma vida de bônus foi concedida agora.
        """
        if total > 0 and acertos == total:
            estudante.quizzes_perfeitos_seguidos += 1
        else:
            estudante.quizzes_perfeitos_seguidos = 0
            return False

        if estudante.quizzes_perfeitos_seguidos >= QUIZZES_PERFEITOS_PARA_VIDA_BONUS:
            estudante.quizzes_perfeitos_seguidos = 0
            if estudante.vidas < VIDAS_MAXIMAS:
                estudante.vidas += 1
                if estudante.vidas >= VIDAS_MAXIMAS:
                    estudante.proxima_vida_em = None
                return True
        return False

    @staticmethod
    def perder_vida(estudante: Estudante) -> None:
        if estudante.vidas <= 0:
            return
        estudante.vidas -= 1
        if estudante.proxima_vida_em is None:
            estudante.proxima_vida_em = datetime.utcnow() + timedelta(hours=HORAS_PARA_REGENERAR_VIDA)

    @staticmethod
    def conceder_moedas_por_xp(estudante: Estudante, xp_concedido: int) -> None:
        if xp_concedido > 0:
            estudante.moedas += max(1, round(xp_concedido * MOEDAS_POR_XP))

    @staticmethod
    def processar_gamificacao_pos_atividade(estudante: Estudante, db: Session, xp_concedido: int) -> None:
        """
        Ponto único que roda depois de qualquer atividade que dá XP (chat da
        entrevista ou quiz): atualiza ofensiva, congelamento, calendário,
        XP total/semanal, nível, moedas e categoria/liga.
        """
        AIService.atualizar_ofensiva_duolingo(estudante, db)
        AIService.resetar_xp_semanal_se_necessario(estudante)

        estudante.xp_total += xp_concedido
        estudante.xp_semanal += xp_concedido

        if estudante.xp_total >= 300 * estudante.nivel_gamificacao:
            estudante.nivel_gamificacao += 1

        estudante.categoria_status = AIService.calcular_categoria_status(estudante.xp_total)
        AIService.conceder_moedas_por_xp(estudante, xp_concedido)

    @staticmethod
    def comprar_vida(estudante: Estudante) -> dict:
        """Troca moedas por 1 vida. Retorna {sucesso, motivo} pra rota decidir o status HTTP."""
        AIService.regenerar_vidas(estudante)

        if estudante.vidas >= VIDAS_MAXIMAS:
            return {"sucesso": False, "motivo": "Suas vidas já estão cheias."}
        if estudante.moedas < CUSTO_MOEDAS_POR_VIDA:
            return {"sucesso": False, "motivo": f"Moedas insuficientes. Precisa de {CUSTO_MOEDAS_POR_VIDA} moedas."}

        estudante.moedas -= CUSTO_MOEDAS_POR_VIDA
        estudante.vidas += 1
        if estudante.vidas >= VIDAS_MAXIMAS:
            estudante.proxima_vida_em = None
        return {"sucesso": True, "motivo": None}

    @staticmethod
    def calendario_do_mes(estudante_id: int, ano: int, mes: int, db: Session) -> list[dict]:
        registros = db.query(AtividadeDiaria).filter(
            AtividadeDiaria.estudante_id == estudante_id,
            func.extract('year', AtividadeDiaria.data) == ano,
            func.extract('month', AtividadeDiaria.data) == mes,
        ).all()
        return [{"data": r.data.isoformat(), "status": r.status} for r in registros]