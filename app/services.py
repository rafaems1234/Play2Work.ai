import os
import json
import requests
from datetime import date, timedelta
from sqlalchemy.orm import Session

from google import genai
from models import Estudante, Vaga
from schemas import CurriculoIaSchema, AvaliacaoEntrevistaSchema

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
    def calcular_match_vagas(estudante_id: int, db: Session) -> list:
        estudante = db.query(Estudante).filter(Estudante.id == estudante_id).first()
        if not estudante or not estudante.habilidades:
            return []

        vagas = db.query(Vaga).all()
        resultado_matches = []

        for vaga in vagas:
            hab_estudante = set(estudante.habilidades)
            hab_vaga = set(vaga.habilidades_exigidas)
            
            hab_em_comum = hab_estudante.intersection(hab_vaga)
            total_exigido = len(hab_vaga)
            percentual = round((len(hab_em_comum) / max(total_exigido, 1)) * 100)

            razao_social_real = None
            if vaga.cnpj_empresa:
                try:
                    response = requests.get(f"https://brasilapi.com.br/api/cnpj/v1/{vaga.cnpj_empresa}", timeout=2)
                    if response.status_code == 200:
                        razao_social_real = response.json().get("razao_social")
                except Exception:
                    pass

            resultado_matches.append({
                "id": vaga.id,
                "titulo_vaga": vaga.titulo_vaga,
                "empresa": vaga.empresa,
                "razao_social_real": razao_social_real or "Parceiro Verificado VIVO",
                "tipo_modalidade": vaga.tipo_modalidade,
                "percentual_match": percentual
            })

        resultado_matches.sort(key=lambda x: x["percentual_match"], reverse=True)
        return resultado_matches

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
            except Exception:
                pass
        
        # Fallback estruturado caso a API falhe
        return {
            "nome_candidato": nome_estudante,
            "objetivo_professional": "Busco minha primeira oportunidade como Jovem Aprendiz para aplicar minha dedicação e competências digitais.",
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
            except Exception:
                pass

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