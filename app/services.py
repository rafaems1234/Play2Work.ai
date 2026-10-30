import os
import json
import logging
import asyncio
import random
import time
import httpx
from datetime import date, datetime, timedelta
from dotenv import load_dotenv
from sqlalchemy import func
from sqlalchemy.orm import Session

from google import genai
from google.genai import errors as genai_errors
from models import Estudante, Vaga, AtividadeDiaria, QuizSessao
from fuso import hoje as hoje_na_escola, agora_utc
from nomes import escolher_nome_exibicao
from schemas import CurriculoIaSchema, AvaliacaoEntrevistaSchema, QuizSchema

# ❤️ Configuração do sistema de vidas/congelamento de ofensiva.
# Sem moedas nem loja: as vidas voltam sozinhas com o tempo, pelo combo de
# acertos e pelo bônus de quizzes perfeitos -- nada se compra.
VIDAS_MAXIMAS = 5
MINUTOS_PARA_REGENERAR_VIDA = 30  # cada vida perdida volta sozinha, uma a cada 30 min, até encher
ACERTOS_SEGUIDOS_PARA_VIDA = 5   # combo de 5 acertos seguidos no quiz devolve 1 vida
DIAS_OFENSIVA_POR_CONGELAMENTO = 7  # a cada 7 dias seguidos, ganha 1 congelamento de graça
QUIZZES_PERFEITOS_PARA_VIDA_BONUS = 5  # 5 quizzes seguidos com 100% de acerto = 1 vida de bônus
DICAS_POR_QUIZ = 2               # limite de dicas (elimina 1 alternativa errada) por quiz, validado no servidor
PULOS_POR_QUIZ = 2               # limite de perguntas puláveis por quiz, validado no servidor

# 🏆 Ligas semanais estilo Duolingo: sobe/desce entre grupos de acordo com o
# XP da semana que terminou. Ordem crescente de prestígio.
# Da mais baixa pra mais alta -- mesma ordem de app/frontend/src/ligas.js.
LIGAS = ["Bronze", "Prata", "Ouro", "Safira", "Rubi", "Esmeralda", "Ametista", "Pérola", "Obsidiana", "Diamante"]
LIGA_EMOJI = {
    "Bronze": "🥉", "Prata": "🥈", "Ouro": "🥇", "Safira": "🔷", "Rubi": "🔴",
    "Esmeralda": "🟢", "Ametista": "🟣", "Pérola": "⚪", "Obsidiana": "⚫", "Diamante": "💎",
}
TAMANHO_GRUPO_LIGA = 30     # o ranking mostra até 30 colegas da mesma liga
ZONA_PROMOCAO = 10          # num grupo cheio (30), os 10 primeiros sobem...
ZONA_REBAIXAMENTO = 10      # ...e os 10 últimos descem
TAMANHO_MINIMO_PARA_REBAIXAR = 4  # só rebaixa se a liga tiver gente suficiente pra não punir quem está sozinho


def vagas_das_zonas(tamanho_grupo: int) -> tuple[int, int]:
    """
    Quantos sobem e quantos descem num grupo desse tamanho: o terço de cima
    sobe e o terço de baixo desce, com teto de 10 cada (grupo cheio de 30 =
    10 sobem, 10 ficam, 10 descem). Em grupos pequenos o 1º sempre sobe e
    ninguém desce se tiver menos de TAMANHO_MINIMO_PARA_REBAIXAR pessoas.
    """
    promocao = min(ZONA_PROMOCAO, max(1, tamanho_grupo // 3))
    rebaixamento = 0 if tamanho_grupo < TAMANHO_MINIMO_PARA_REBAIXAR else min(ZONA_REBAIXAMENTO, tamanho_grupo // 3)
    return promocao, rebaixamento

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
    "Recursos Humanos e Gestão de Pessoas": {
        "descricao": "Recrutamento e seleção, departamento pessoal, legislação trabalhista básica (CLT), comunicação e clima organizacional.",
        "temas": [
            "Recrutamento e seleção: como funciona um processo seletivo por dentro",
            "Departamento pessoal: admissão, folha de ponto e documentos",
            "Noções de CLT e direitos do Jovem Aprendiz",
            "Comunicação interna, feedback e clima organizacional",
            "Treinamento, integração (onboarding) e desenvolvimento de pessoas",
        ],
    },
}

# Banco de questões por itinerário (+ "Geral" com soft skills). Fica dentro
# do front porque o modo demonstração (mockApi.js) sorteia do mesmo arquivo --
# uma fonte só pras duas pontas, sem lista duplicada pra manter em sincronia.
CAMINHO_BANCO_QUESTOES = os.path.join(os.path.dirname(__file__), "frontend", "src", "data", "banco_questoes.json")
with open(CAMINHO_BANCO_QUESTOES, encoding="utf-8") as _arquivo_banco:
    BANCO_QUESTOES = json.load(_arquivo_banco)

PERGUNTAS_POR_QUIZ = 10
PERGUNTAS_GERAIS_POR_QUIZ = 2   # dos 10, quantos vêm de soft skills gerais (o resto é da área do itinerário)
SESSOES_RECENTES_SEM_REPETIR = 5  # perguntas vistas nos últimos N quizzes ficam por último no sorteio


def _embaralhar_opcoes(pergunta: dict, rng: random.Random) -> dict:
    """Muda a ordem das alternativas (e o índice da certa junto) -- decorar 'é a letra B' não funciona."""
    ordem = list(range(len(pergunta["opcoes"])))
    rng.shuffle(ordem)
    return {
        "pergunta": pergunta["pergunta"],
        "opcoes": [pergunta["opcoes"][i] for i in ordem],
        "resposta_correta_index": ordem.index(pergunta["resposta_correta_index"]),
        "explicacao": pergunta.get("explicacao", ""),
    }


def _sortear_do_grupo(grupo: list[dict], quantidade: int, perguntas_recentes: set[str], rng: random.Random) -> list[dict]:
    ineditas = [p for p in grupo if p["pergunta"] not in perguntas_recentes]
    repetidas = [p for p in grupo if p["pergunta"] in perguntas_recentes]
    rng.shuffle(ineditas)
    rng.shuffle(repetidas)
    return (ineditas + repetidas)[:quantidade]


def sortear_perguntas_do_banco(itinerario: str | None, perguntas_recentes: set[str], rng: random.Random | None = None) -> list[dict]:
    """
    Monta o quiz a partir do banco: a maior parte da área do itinerário e
    um pouco de soft skills gerais. Perguntas que o aluno viu nos últimos
    quizzes só entram se as inéditas acabarem, e as alternativas são
    embaralhadas a cada quiz.
    """
    rng = rng or random.Random()
    da_area = BANCO_QUESTOES.get(itinerario or "", [])
    qtd_gerais = PERGUNTAS_GERAIS_POR_QUIZ if da_area else PERGUNTAS_POR_QUIZ
    escolhidas = _sortear_do_grupo(da_area, PERGUNTAS_POR_QUIZ - qtd_gerais, perguntas_recentes, rng)
    escolhidas += _sortear_do_grupo(BANCO_QUESTOES["Geral"], PERGUNTAS_POR_QUIZ - len(escolhidas), perguntas_recentes, rng)
    rng.shuffle(escolhidas)
    return [_embaralhar_opcoes(p, rng) for p in escolhidas]


def combo_final(respostas: list[dict]) -> int:
    """Acertos seguidos no fim da lista de respostas (erro ou pulo zera)."""
    combo = 0
    for resposta in respostas:
        combo = combo + 1 if resposta.get("correta") else 0
    return combo


def vidas_ganhas_por_combo(respostas: list[dict]) -> int:
    """Cada vez que o combo chega a um múltiplo de ACERTOS_SEGUIDOS_PARA_VIDA, vale 1 vida."""
    vidas, combo = 0, 0
    for resposta in respostas:
        combo = combo + 1 if resposta.get("correta") else 0
        if combo and combo % ACERTOS_SEGUIDOS_PARA_VIDA == 0:
            vidas += 1
    return vidas


def gerar_nome_exibicao(db: Session, nome_completo: str, ignorar_id: int | None = None) -> str:
    """Busca os nomes de exibição já usados com o mesmo primeiro nome e escolhe um livre."""
    primeiro = (nome_completo.split() or ["Aluno"])[0].lower()
    consulta = db.query(Estudante.nome_exibicao).filter(func.lower(Estudante.nome_exibicao).like(f"{primeiro}%"))
    if ignorar_id is not None:
        consulta = consulta.filter(Estudante.id != ignorar_id)
    ocupados = {nome.lower() for (nome,) in consulta.all() if nome}
    return escolher_nome_exibicao(nome_completo, ocupados)


# Pesos da nota de desempenho usada pela escola (painel admin) pra
# selecionar quem indicar pra uma vaga. Somam 100, então a nota final já
# sai em 0-100 e cada parcela é explicável no painel ("por que esse aluno?").
#
# XP e ofensiva (dias seguidos) saíram da nota: medem acesso a celular e
# internet em casa tanto quanto mérito, e puniam quem só usa a plataforma na
# escola. No lugar entrou o mapa de competências (competencias.py), que mede
# o que o aluno demonstrou nas atividades -- não quanto tempo ficou no app.
PESOS_DESEMPENHO = {
    "habilidades": 30,    # % das habilidades exigidas pela vaga que o aluno tem
    "itinerario": 20,     # itinerário do aluno é a área da vaga
    "competencias": 35,   # mapa de competências (BNCC), com eixos pouco medidos puxados pra 50
    "quiz": 15,           # taxa de acerto nos quizzes concluídos (validados no servidor)
}


def calcular_desempenho_para_vaga(estudante: Estudante, vaga: Vaga, taxa_acerto_quiz: float | None, nota_competencias: float) -> dict:
    """
    Nota de 0 a 100 de quão indicado o aluno é pra essa vaga, combinando a
    aderência à vaga (habilidades e itinerário) com o que ele demonstrou na
    plataforma (competências e quiz). Função pura -- quem chama já traz a
    taxa de acerto e a nota de competências (0-1, ver nota_de_competencias),
    pra dar pra ranquear muitos alunos com poucas consultas.
    """
    hab_vaga = set(vaga.habilidades_exigidas or [])
    hab_estudante = set(estudante.habilidades or [])
    fracoes = {
        "habilidades": len(hab_vaga & hab_estudante) / len(hab_vaga) if hab_vaga else 0.0,
        "itinerario": 1.0 if estudante.itinerario and estudante.itinerario == vaga.area_itinerario else 0.0,
        "competencias": max(0.0, min(1.0, nota_competencias)),
        "quiz": taxa_acerto_quiz or 0.0,
    }
    detalhes = {chave: round(fracao * PESOS_DESEMPENHO[chave], 1) for chave, fracao in fracoes.items()}
    return {
        "pontuacao": round(sum(detalhes.values())),
        "detalhes": detalhes,
        "habilidades_em_comum": sorted(hab_vaga & hab_estudante),
    }


def taxas_de_acerto_quiz(db: Session, estudante_ids: list[int]) -> dict[int, float | None]:
    """
    Taxa de acerto de cada aluno somando todos os quizzes concluídos (pulos
    não contam nem como acerto nem como erro). None = ainda não concluiu
    nenhum quiz. As respostas são as que o servidor registrou em
    /quiz/responder, não o que o cliente declarou.
    """
    acertos = {eid: 0 for eid in estudante_ids}
    respondidas = {eid: 0 for eid in estudante_ids}
    if estudante_ids:
        sessoes = db.query(QuizSessao).filter(
            QuizSessao.estudante_id.in_(estudante_ids),
            QuizSessao.concluido.is_(True),
        ).all()
        for sessao in sessoes:
            for resposta in sessao.respostas or []:
                if resposta.get("pulou"):
                    continue
                respondidas[sessao.estudante_id] += 1
                if resposta.get("correta"):
                    acertos[sessao.estudante_id] += 1
    return {eid: (acertos[eid] / respondidas[eid] if respondidas[eid] else None) for eid in estudante_ids}

# Garante que GEMINI_API_KEY esteja carregada mesmo se este módulo for
# importado antes de database.py (que também carrega o .env)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

logger = logging.getLogger(__name__)

try:
    client = genai.Client()
except Exception:
    client = None

# Modelo do plano gratuito do Google AI Studio. O gemini-2.5-flash deixou de
# aceitar chaves novas (404) e o 3.8-flash só libera 5 pedidos/min no plano
# grátis, então o padrão é o 3.5-flash-lite; dá pra trocar sem mexer no
# código definindo GEMINI_MODEL no .env.
MODELO_GEMINI = os.environ.get("GEMINI_MODEL") or "gemini-3.5-flash-lite"
TENTATIVAS_GEMINI = 2   # 503 ("alta demanda") costuma passar em segundos


def gerar_json_gemini(prompt: str, schema) -> dict:
    """
    Chama o Gemini pedindo JSON no formato do schema. Repete uma vez se o
    modelo estiver sobrecarregado (503). Cota estourada (429) não repete --
    só gastaria mais cota -- e sobe na hora pra quem chamou cair no fallback.
    """
    for tentativa in range(1, TENTATIVAS_GEMINI + 1):
        try:
            response = client.models.generate_content(
                model=MODELO_GEMINI,
                contents=prompt,
                config={
                    'response_mime_type': 'application/json',
                    'response_schema': schema,
                },
            )
            return json.loads(response.text)
        except genai_errors.APIError as e:
            if e.code != 503 or tentativa == TENTATIVAS_GEMINI:
                raise
            time.sleep(2)

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

    # Boost aplicado ao match quando a vaga é da mesma área do itinerário/curso
    # que o estudante escolheu — assim o mural fica de acordo com o curso.
    BOOST_MATCH_ITINERARIO = 20

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

            combina_com_curso = bool(estudante.itinerario) and vaga.area_itinerario == estudante.itinerario
            if combina_com_curso:
                percentual = min(100, percentual + AIService.BOOST_MATCH_ITINERARIO)

            matches_brutos.append((vaga, percentual, combina_com_curso))

        # Vagas do curso escolhido sobem pro topo do mural, e dentro de cada grupo ordena por match
        matches_brutos.sort(key=lambda item: (item[2], item[1]), reverse=True)

        total = len(matches_brutos)
        inicio = max(pagina - 1, 0) * tamanho_pagina
        pagina_atual = matches_brutos[inicio:inicio + tamanho_pagina]

        # Consulta as razões sociais em paralelo apenas para as vagas da página atual
        async with httpx.AsyncClient() as http_client:
            razoes_sociais = await asyncio.gather(*[
                AIService._buscar_razao_social(http_client, vaga.cnpj_empresa) if vaga.cnpj_empresa else asyncio.sleep(0)
                for vaga, _, _ in pagina_atual
            ])

        resultado_matches = [
            {
                "id": vaga.id,
                "titulo_vaga": vaga.titulo_vaga,
                "empresa": vaga.empresa,
                "razao_social_real": razao_social_real or "Parceiro Verificado",
                "tipo_modalidade": vaga.tipo_modalidade,
                "localizacao": vaga.localizacao,
                "habilidades_exigidas": vaga.habilidades_exigidas,
                "area_itinerario": vaga.area_itinerario,
                "combina_com_curso": combina_com_curso,
                "percentual_match": percentual,
            }
            for (vaga, percentual, combina_com_curso), razao_social_real in zip(pagina_atual, razoes_sociais)
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
        É o primeiro currículo dele: valorize atividades da escola, cursos, grêmio, voluntariado e projetos
        pessoais como experiência, sem inventar nada que não esteja no texto.
        """

        if client:
            try:
                return gerar_json_gemini(prompt, CurriculoIaSchema)
            except Exception as e:
                logger.warning("Falha ao gerar currículo via Gemini, usando fallback: %s", e)

        # Fallback estruturado caso a API falhe
        return {
            "nome_candidato": nome_estudante,
            "objetivo_profissional": "Busco minha primeira oportunidade como Jovem Aprendiz para aplicar minha dedicação e competências digitais.",
            "hard_skills": ["Informática Básica", "Navegação Web"],
            "soft_skills": ["Trabalho em Equipe", "Adaptabilidade"],
            "experiencias": [],
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
        Você é um recrutador experiente de uma grande empresa conduzindo uma simulação de entrevista interativa para uma vaga de Jovem Aprendiz.{contexto_trilha}
        Histórico anterior: {historico_conversa}
        O candidato acabou de responder: "{mensagem_usuario}"

        Instruções de Avaliação de XP:
        - Se a resposta for evasiva, aleatória (letras sem sentido como 'gh3535'), curta demais ou sem nexo: atribua xp_concedido = 0 e dê um feedback alertando que respostas assim o eliminam do processo.
        - Se a resposta demonstrar interesse básico: dê entre 10 e 25 de XP.
        - Se a resposta trouxer exemplos reais da escola, cursos ou vivências práticas: dê entre 35 e 50 de XP (Excelente!).
        """

        if client:
            try:
                return gerar_json_gemini(prompt, AvaliacaoEntrevistaSchema)
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
            "analise_feedback": "Ótima resposta! Demonstrar clareza sobre suas competências chama a atenção de forma positiva.",
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
        return temas[hoje_na_escola().toordinal() % len(temas)]

    @staticmethod
    def gerar_quiz_ia(tema: str, itinerario: str | None = None, perguntas_recentes: set[str] | None = None) -> dict:
        """
        Gera um quiz de 10 perguntas de múltipla escolha sobre o tema do dia,
        no mesmo padrão de JSON estrito usado no currículo e na entrevista.
        Sem IA (ou se ela falhar), sorteia do banco de questões da área.
        Nos dois casos, as perguntas dos últimos quizzes do aluno são
        evitadas pra não repetir.
        """
        perguntas_recentes = perguntas_recentes or set()
        contexto_trilha = f' O estudante está seguindo o itinerário formativo "{itinerario}", então contextualize os exemplos para essa área.' if itinerario else ''
        evitar = ''
        if perguntas_recentes:
            lista = "\n".join(f"- {p}" for p in sorted(perguntas_recentes)[:30])
            evitar = f"\n        Não repita nem reformule estas perguntas, que o estudante já respondeu recentemente:\n{lista}"
        prompt = f"""
        Atue como um instrutor de preparação para o primeiro emprego de jovens aprendizes.
        Crie um quiz de exatamente 10 perguntas de múltipla escolha (4 alternativas cada,
        só uma correta) sobre o tema: "{tema}".{contexto_trilha}
        As perguntas devem ser objetivas, práticas e adequadas para jovens sem experiência
        prévia de mercado de trabalho. Evite pegadinhas — o objetivo é ensinar, não confundir.{evitar}
        """

        if client:
            try:
                return gerar_json_gemini(prompt, QuizSchema)
            except Exception as e:
                logger.warning("Falha ao gerar quiz via Gemini, usando banco de questões: %s", e)

        return {"tema": tema, "perguntas": sortear_perguntas_do_banco(itinerario, perguntas_recentes)}

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
        hoje = hoje_na_escola()
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
    def calcular_estado_ofensiva(estudante: Estudante) -> dict:
        """
        Calcula (sem persistir nada) se a ofensiva atual corre risco de
        quebrar ainda hoje -- usado só pra mostrar o aviso no front. A quebra
        de verdade continua sendo tratada de forma lazy em
        atualizar_ofensiva_duolingo, disparada apenas quando o estudante
        volta a treinar.
        """
        hoje = hoje_na_escola()
        if not estudante.ultimo_treino or estudante.ofensiva_dias <= 0:
            return {"treinou_hoje": False, "em_risco": False}

        dias_desde_treino = (hoje - estudante.ultimo_treino).days
        treinou_hoje = dias_desde_treino == 0
        coberto_por_congelamento = dias_desde_treino == 2 and estudante.congelamentos_disponiveis > 0
        em_risco = not treinou_hoje and (dias_desde_treino == 1 or coberto_por_congelamento)
        return {"treinou_hoje": treinou_hoje, "em_risco": em_risco}

    @staticmethod
    def avaliar_liga_semanal(estudante: Estudante, db: Session) -> dict | None:
        """
        Roda na virada de semana, antes de zerar o xp_semanal: compara o
        desempenho do estudante com os demais da mesma liga na semana que
        terminou e decide promoção/rebaixamento (ver vagas_das_zonas). Retorna um
        resumo pro front mostrar um aviso, ou None se a liga não mudou.
        """
        liga_atual = estudante.liga if estudante.liga in LIGAS else "Bronze"
        estudante.liga = liga_atual

        grupo = db.query(Estudante).filter(Estudante.liga == liga_atual).all()
        if estudante not in grupo:
            grupo.append(estudante)
        grupo.sort(key=lambda e: (-e.xp_semanal, e.id))
        posicao = grupo.index(estudante) + 1
        tamanho_grupo = len(grupo)

        indice_atual = LIGAS.index(liga_atual)
        nova_liga = liga_atual
        vagas_promocao, vagas_rebaixamento = vagas_das_zonas(tamanho_grupo)

        if estudante.xp_semanal > 0 and posicao <= vagas_promocao and indice_atual < len(LIGAS) - 1:
            nova_liga = LIGAS[indice_atual + 1]
        elif posicao > tamanho_grupo - vagas_rebaixamento and indice_atual > 0:
            nova_liga = LIGAS[indice_atual - 1]

        if nova_liga == liga_atual:
            return None

        estudante.liga = nova_liga
        return {
            "direcao": "subiu" if LIGAS.index(nova_liga) > indice_atual else "desceu",
            "liga_anterior": liga_atual,
            "liga_nova": nova_liga,
        }

    @staticmethod
    def resetar_xp_semanal_se_necessario(estudante: Estudante, db: Session) -> dict | None:
        """
        Zera o xp_semanal quando o estudante entra em uma nova semana (segunda-feira),
        mantendo o ranking em '/api/ranking' de fato semanal. Antes de zerar,
        avalia a mudança de liga referente à semana que está terminando.
        """
        inicio_semana_atual = hoje_na_escola() - timedelta(days=hoje_na_escola().weekday())
        if estudante.semana_referencia == inicio_semana_atual:
            return None

        # Só avalia liga se já havia uma semana anterior de fato encerrando
        # (evita promover/rebaixar um estudante novo na primeira atividade dele).
        mudanca_liga = AIService.avaliar_liga_semanal(estudante, db) if estudante.semana_referencia is not None else None
        estudante.xp_semanal = 0
        estudante.semana_referencia = inicio_semana_atual
        return mudanca_liga

    @staticmethod
    def regenerar_vidas(estudante: Estudante) -> None:
        """
        Calcula, de forma lazy (sem cron nenhum), quantas vidas já regeneraram
        desde a última perda com base em proxima_vida_em.
        """
        if estudante.vidas >= VIDAS_MAXIMAS or estudante.proxima_vida_em is None:
            return

        agora = agora_utc()
        if agora < estudante.proxima_vida_em:
            return

        intervalo = timedelta(minutes=MINUTOS_PARA_REGENERAR_VIDA)
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
            estudante.proxima_vida_em = agora_utc() + timedelta(minutes=MINUTOS_PARA_REGENERAR_VIDA)

    @staticmethod
    def ganhar_vidas(estudante: Estudante, quantidade: int) -> int:
        """Devolve até 'quantidade' vidas respeitando o teto. Retorna quantas entraram de fato."""
        ganhas = max(0, min(quantidade, VIDAS_MAXIMAS - estudante.vidas))
        estudante.vidas += ganhas
        if estudante.vidas >= VIDAS_MAXIMAS:
            estudante.proxima_vida_em = None
        return ganhas

    @staticmethod
    def processar_gamificacao_pos_atividade(estudante: Estudante, db: Session, xp_concedido: int) -> dict | None:
        """
        Ponto único que roda depois de qualquer atividade que dá XP (chat da
        entrevista ou quiz): atualiza ofensiva, congelamento, calendário,
        XP total/semanal, nível, categoria de carreira e liga
        semanal. Retorna um resumo de mudança de liga (ou None) pro front
        mostrar um aviso de promoção/rebaixamento.
        """
        AIService.atualizar_ofensiva_duolingo(estudante, db)
        mudanca_liga = AIService.resetar_xp_semanal_se_necessario(estudante, db)

        estudante.xp_total += xp_concedido
        estudante.xp_semanal += xp_concedido

        if estudante.xp_total >= 300 * estudante.nivel_gamificacao:
            estudante.nivel_gamificacao += 1

        estudante.categoria_status = AIService.calcular_categoria_status(estudante.xp_total)
        return mudanca_liga

    @staticmethod
    def calendario_do_mes(estudante_id: int, ano: int, mes: int, db: Session) -> list[dict]:
        registros = db.query(AtividadeDiaria).filter(
            AtividadeDiaria.estudante_id == estudante_id,
            func.extract('year', AtividadeDiaria.data) == ano,
            func.extract('month', AtividadeDiaria.data) == mes,
        ).all()
        return [{"data": r.data.isoformat(), "status": r.status} for r in registros]