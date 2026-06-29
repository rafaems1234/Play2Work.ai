from pydantic import BaseModel, Field
from typing import List, Optional

# Esquema para o Gemini gerar o Currículo estruturado
class CurriculoIaSchema(BaseModel):
    nome_candidato: str = Field(description="Nome limpo do candidato deduzido ou fornecido")
    objetivo_profissional: str = Field(description="Texto motivador focado em primeiro emprego/LinkedIn")
    hard_skills: List[str] = Field(description="Lista de habilidades técnicas mapeadas do texto")
    soft_skills: List[str] = Field(description="Lista de habilidades comportamentais extraídas")
    sugestao_areas_atuacao: List[str] = Field(description="Lista de áreas/cargos ideais na Vivo ou mercado")

# Esquema para o Gemini analisar a resposta da entrevista de forma humana e inteligente
class AvaliacaoEntrevistaSchema(BaseModel):
    analise_feedback: str = Field(description="Feedback construtivo e direto sobre a resposta do jovem")
    xp_concedido: int = Field(description="XP entre 0 e 50 baseado na qualidade, realismo e interesse. Se for texto aleatório ou zoado, dê 0.")
    proxima_pergunta: str = Field(description="A próxima pergunta lógica da entrevista baseada no contexto ou uma nova pergunta realista de RH")

# Corpo da requisição para geração de currículo
class CurriculoRequest(BaseModel):
    estudante_id: int
    habilidades_texto: str

# Corpo da requisição para o chat do simulador
class ChatRequest(BaseModel):
    estudante_id: int
    mensagem_usuario: str