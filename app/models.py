from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Date, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from database import Base

class Estudante(Base):
    """
    Modelo que representa a tabela 'estudantes'.
    Armazena os dados do aluno e o seu progresso na gamificação estilo Duolingo.
    """
    __tablename__ = 'estudantes'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    nivel_gamificacao = Column(Integer, default=1)
    
    # 🌟 CORRIGIDO: Alterado de 'pontos' para 'xp_total' para bater com as rotas e o React
    xp_total = Column(Integer, default=0) 
    
    # 🎯 Mecânicas do Duolingo da Tecnologia & Ranking
    ofensiva_dias = Column(Integer, default=0)              # Streak / Dias seguidos praticando
    ultimo_treino = Column(Date, nullable=True)             # Guarda a data do último treino para validar ofensivas
    missoes_diarias_concluidas = Column(Integer, default=0)  # Contador de quests cumpridas
    xp_semanal = Column(Integer, default=0)                 # XP acumulado na semana (reseta a cada 7 dias)
    categoria_status = Column(String(50), default="🌌 Na Jornada") # Categoria/Liga do usuário
    
    # ARRAY do PostgreSQL para guardar as habilidades
    # Nota: Se usar SQLite para testes, substitua por JSON ou Text se der erro de tipo.
    habilidades = Column(ARRAY(String), default=[])
    
    criado_em = Column(DateTime, server_default=func.now())

    # Relacionamentos
    historico_entrevistas = relationship("HistoricoEntrevista", back_populates="estudante", cascade="all, delete-orphan")
    curriculos = relationship("Curriculo", back_populates="estudante", cascade="all, delete-orphan")


class Vaga(Base):
    """
    Modelo que representa a tabela 'vagas'.
    Armazena as oportunidades de emprego extraídas do mercado de trabalho.
    """
    __tablename__ = 'vagas'

    id = Column(Integer, primary_key=True, index=True)
    titulo_vaga = Column(String(150), nullable=False)
    empresa = Column(String(100), nullable=False)
    cnpj_empresa = Column(String(14), nullable=True)       
    localizacao = Column(String(100), nullable=False)
    tipo_modalidade = Column(String(50), nullable=False)   # Presencial, Remoto, Híbrido
    habilidades_exigidas = Column(ARRAY(String), nullable=False)
    link_inscricao = Column(String(255), nullable=True)
    criada_em = Column(DateTime, server_default=func.now())


class HistoricoEntrevista(Base):
    """
    Modelo que representa a tabela 'historico_entrevistas'.
    Guarda o histórico de mensagens trocadas entre o utilizador e a IA no Simulador.
    """
    __tablename__ = 'historico_entrevistas'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False)
    remetente = Column(String(10), nullable=False) # 'user' ou 'ai'
    mensagem = Column(Text, nullable=False)
    feedback_ia = Column(Text, nullable=True) # Feedback em tempo real que a IA gerou
    enviado_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante", back_populates="historico_entrevistas")


class Curriculo(Base):
    """
    Modelo que representa a tabela 'curriculos'.
    Armazena o resultado final do texto ou estrutura do currículo formatado pela IA.
    """
    __tablename__ = 'curriculos'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False)
    texto_curriculo_formatado = Column(Text, nullable=False) # Guardará o JSON estruturado gerado pela IA
    gerado_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante", back_populates="curriculos")