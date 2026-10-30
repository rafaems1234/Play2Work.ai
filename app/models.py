from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Date, Boolean, JSON, LargeBinary, Float, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship, deferred
from database import Base

class Turma(Base):
    """
    Modelo que representa a tabela 'turmas'.
    Agrupa os estudantes como a escola organiza (ex: "3º A - Manhã"), pra
    gestão no painel admin e pra filtrar a seleção de candidatos por turma.
    """
    __tablename__ = 'turmas'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(60), nullable=False, unique=True)
    turno = Column(String(20), nullable=True)               # Manhã, Tarde, Noite, Integral
    criada_em = Column(DateTime, server_default=func.now())

    estudantes = relationship("Estudante", back_populates="turma")


class Estudante(Base):
    """
    Modelo que representa a tabela 'estudantes'.
    Armazena os dados do aluno e o seu progresso na gamificação estilo Duolingo.
    """
    __tablename__ = 'estudantes'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, index=True)   # Nome de login -- não é único: se repetir, o login desempata pela senha
    email = Column(String(100), unique=True, nullable=False, index=True)  # Usado só no cadastro e na recuperação de senha
    nome_exibicao = Column(String(60), unique=True, nullable=True)  # "Rafael S." -- único, é o que aparece no ranking (ver gerar_nome_exibicao)
    cpf = Column(String(11), unique=True, nullable=True, index=True)  # Só dígitos -- login do aluno é CPF + data de nascimento (cadastrado pela escola)
    data_nascimento = Column(Date, nullable=True)
    linkedin = Column(String(255), nullable=True)            # URL do perfil do LinkedIn (opcional, coletado no cadastro)
    telefone = Column(String(11), nullable=True)             # Celular do aluno, só dígitos com DDD (cadastrado pela escola)
    responsavel_nome = Column(String(100), nullable=True)    # Responsável legal -- a maioria dos alunos é menor de idade
    responsavel_telefone = Column(String(11), nullable=True)
    senha_hash = Column(String(255), nullable=True)          # Hash bcrypt da senha (nulo = conta antiga sem login)
    precisa_trocar_senha = Column(Boolean, default=False)    # True = está numa senha temporária de reset, força troca no próximo passo
    pergunta_seguranca = Column(String(200), nullable=True)  # Pergunta definida no cadastro, exigida pra resetar a senha
    resposta_seguranca_hash = Column(String(255), nullable=True)  # Hash bcrypt da resposta -- sem isso, e-mail sozinho não é suficiente pra derrubar a senha de qualquer um
    nivel_gamificacao = Column(Integer, default=1)
    
    # 🌟 CORRIGIDO: Alterado de 'pontos' para 'xp_total' para bater com as rotas e o React
    xp_total = Column(Integer, default=0) 
    
    # 🎯 Mecânicas do Duolingo da Tecnologia & Ranking
    ofensiva_dias = Column(Integer, default=0)              # Streak / Dias seguidos praticando
    ultimo_treino = Column(Date, nullable=True)             # Guarda a data do último treino para validar ofensivas
    missoes_diarias_concluidas = Column(Integer, default=0)  # Contador de quests cumpridas
    xp_semanal = Column(Integer, default=0)                 # XP acumulado na semana corrente
    semana_referencia = Column(Date, nullable=True)         # Segunda-feira da semana em que xp_semanal foi contabilizado
    categoria_status = Column(String(50), default="🌌 Na Jornada") # Status de carreira do usuário (baseado no XP total acumulado)
    liga = Column(String(20), default="Bronze")              # Liga semanal (10 ligas, de Bronze a Diamante -- ver LIGAS em services.py), com subida/descida a cada virada de semana
    itinerario = Column(String(60), nullable=True)          # Trilha formativa escolhida (ex: "Tecnologia e Dados")
    turma_id = Column(Integer, ForeignKey('turmas.id', ondelete="SET NULL"), nullable=True, index=True)  # Turma da escola (gestão no painel admin)

    # ❤️ Vidas e congelamento de ofensiva (estilo Duolingo)
    vidas = Column(Integer, default=5)                       # Vidas atuais (máx. VIDAS_MAXIMAS)
    proxima_vida_em = Column(DateTime, nullable=True)        # Quando a próxima vida perdida regenera (None = vidas cheias)
    congelamentos_disponiveis = Column(Integer, default=0)   # "Congelamentos de ofensiva" acumulados, gastos automaticamente quando falta um dia
    quizzes_perfeitos_seguidos = Column(Integer, default=0)  # Contador de quizzes com 100% de acerto em sequência (reseta a cada erro)

    # ARRAY do PostgreSQL para guardar as habilidades
    # Nota: Se usar SQLite para testes, substitua por JSON ou Text se der erro de tipo.
    habilidades = Column(ARRAY(String), default=[])

    # 💼 Empregabilidade (painel da escola / PAP)
    status_contratacao = Column(String(20), nullable=False, default="disponivel", server_default="disponivel", index=True)  # 'disponivel' (na fila) | 'contratado' -- ver STATUS_CONTRATACAO
    empresa_contratante = Column(String(100), nullable=True)  # Onde foi contratado (preenchido junto com o status)
    contratado_em = Column(Date, nullable=True)
    ja_trabalhou = Column(Boolean, nullable=True)            # Experiência prévia informada no primeiro acesso (None = não respondeu)
    experiencia_previa = Column(Text, nullable=True)         # Onde/o que fez, em texto livre
    foto_atualizada_em = Column(DateTime, nullable=True)     # None = sem foto. A imagem fica em FotoEstudante, fora da linha do aluno
    foto_no_curriculo = Column(Boolean, nullable=False, default=False, server_default="false")  # o aluno escolhe; desligado por padrão (evita discriminação por aparência)
    onboarding_concluido_em = Column(DateTime, nullable=True)  # None = ainda não passou pelo primeiro acesso

    criado_em = Column(DateTime, server_default=func.now())

    # Relacionamentos
    historico_entrevistas = relationship("HistoricoEntrevista", back_populates="estudante", cascade="all, delete-orphan")
    curriculos = relationship("Curriculo", back_populates="estudante", cascade="all, delete-orphan")
    atividades_diarias = relationship("AtividadeDiaria", back_populates="estudante", cascade="all, delete-orphan")
    candidaturas = relationship("Candidatura", back_populates="estudante", cascade="all, delete-orphan")
    turma = relationship("Turma", back_populates="estudantes")
    foto = relationship("FotoEstudante", uselist=False, cascade="all, delete-orphan", passive_deletes=True)
    observacoes = relationship("ObservacaoEstudante", back_populates="estudante", cascade="all, delete-orphan", order_by="ObservacaoEstudante.criada_em.desc()")
    mudancas_status = relationship("MudancaStatusContratacao", back_populates="estudante", cascade="all, delete-orphan", order_by="MudancaStatusContratacao.registrada_em.desc()")


class FotoEstudante(Base):
    """
    Modelo que representa a tabela 'fotos_estudantes'.
    A foto do aluno (JPEG/PNG/WebP já reduzido no navegador, ~50 KB), numa
    tabela à parte pra não pesar em toda consulta de 'estudantes'. Ficar no
    Postgres (e não em disco) faz a foto entrar no mesmo backup, funcionar com
    várias instâncias da API e sumir junto com o aluno (LGPD).
    """
    __tablename__ = 'fotos_estudantes'

    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), primary_key=True)
    conteudo = Column(LargeBinary, nullable=False)
    tipo_mime = Column(String(20), nullable=False)
    enviada_por = Column(String(10), nullable=False)  # 'aluno' | 'escola'
    atualizada_em = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ObservacaoEstudante(Base):
    """
    Modelo que representa a tabela 'observacoes_estudantes'.
    Notas internas da coordenação/PAP sobre o aluno ("comportamento exemplar",
    "melhorar pontualidade"). Uma linha por anotação, com data -- vira um
    histórico, em vez de um campo de texto único que alguém sobrescreve.
    O aluno nunca vê.
    """
    __tablename__ = 'observacoes_estudantes'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    texto = Column(Text, nullable=False)
    autor = Column(String(60), nullable=False, default="Coordenação")  # Enquanto o painel tem uma senha só, não dá pra saber quem foi
    criada_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante", back_populates="observacoes")


class MudancaStatusContratacao(Base):
    """
    Modelo que representa a tabela 'mudancas_status_contratacao'.
    Cada vez que a escola muda o status de contratação do aluno, fica o
    registro -- é o que permite a ficha mostrar "contratado em março pela X,
    voltou pra fila em agosto" e os relatórios de prestação de contas.
    """
    __tablename__ = 'mudancas_status_contratacao'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False)
    empresa = Column(String(100), nullable=True)
    registrada_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante", back_populates="mudancas_status")


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
    area_itinerario = Column(String(60), nullable=True)     # Qual dos 4 cursos essa vaga combina mais (ITINERARIOS_QUIZ)
    descricao_completa = Column(Text, nullable=True)        # Texto longo pro modal de detalhes estilo LinkedIn
    criada_em = Column(DateTime, server_default=func.now())

    candidaturas = relationship("Candidatura", back_populates="vaga", cascade="all, delete-orphan")


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
    xp_concedido = Column(Integer, nullable=True)  # Nota da resposta (0-50), só nas mensagens do aluno -- é o histórico de pontuação do simulador
    enviado_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante", back_populates="historico_entrevistas")


class AtividadeDiaria(Base):
    """
    Modelo que representa a tabela 'atividades_diarias'.
    Um registro por (estudante, dia) usado pra desenhar o calendário de
    ofensiva: dia com prática ('feito'), dia sem prática mas coberto por um
    congelamento ('congelado'), ou dia realmente perdido ('perdido').
    """
    __tablename__ = 'atividades_diarias'
    __table_args__ = (UniqueConstraint('estudante_id', 'data', name='uq_atividade_estudante_data'),)

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False)
    data = Column(Date, nullable=False)
    status = Column(String(12), nullable=False)  # 'feito' | 'congelado' | 'perdido'

    estudante = relationship("Estudante", back_populates="atividades_diarias")


class Candidatura(Base):
    """
    Modelo que representa a tabela 'candidaturas'.
    Registro real (persistido e consultável) de que um estudante se
    candidatou a uma vaga -- substitui o antigo comportamento de
    '/jobs/apply-meta', que só devolvia um ID fake sem gravar nada.
    """
    __tablename__ = 'candidaturas'
    __table_args__ = (UniqueConstraint('estudante_id', 'vaga_id', name='uq_candidatura_estudante_vaga'),)

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False)
    vaga_id = Column(Integer, ForeignKey('vagas.id', ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="enviada")  # enviada | em_analise | recusada | aprovada
    indicada_pela_escola = Column(Boolean, nullable=False, default=False, server_default="false")  # True = a escola selecionou o aluno pelo desempenho (painel admin)
    pontuacao_indicacao = Column(Integer, nullable=True)    # Nota de desempenho (0-100) no momento da indicação
    resposta_empresa = Column(Text, nullable=True)          # Retorno da empresa parceira, registrado pela escola no painel
    criada_em = Column(DateTime, server_default=func.now())
    atualizada_em = Column(DateTime, nullable=True)         # Última mudança de status/resposta

    estudante = relationship("Estudante", back_populates="candidaturas")
    vaga = relationship("Vaga", back_populates="candidaturas")


class QuizSessao(Base):
    """
    Modelo que representa a tabela 'quiz_sessoes'.
    Guarda o gabarito (resposta certa + explicação) gerado pela IA do lado
    do servidor. É isso que permite validar o resultado no /quiz/submit sem
    confiar em 'acertos'/'total' que o cliente mandasse -- o cliente nunca
    recebe o índice correto antes de responder aquela pergunta específica
    via /quiz/responder, e o servidor conta os acertos a partir do que ele
    mesmo registrou em 'respostas', não do que o cliente afirma ter feito.
    """
    __tablename__ = 'quiz_sessoes'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False)
    tema = Column(String(120), nullable=False)
    gabarito = Column(JSON, nullable=False)   # lista de {"resposta_correta_index": int, "explicacao": str}
    respostas = Column(JSON, nullable=False, default=list)  # lista paralela de {"pulou": bool, "correta": bool}
    dicas_usadas = Column(Integer, nullable=False, default=0)
    concluido = Column(Boolean, nullable=False, default=False)
    criado_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante")


class Curriculo(Base):
    """
    Modelo que representa a tabela 'curriculos'.
    Armazena o resultado final do texto ou estrutura do currículo formatado pela IA.
    """
    __tablename__ = 'curriculos'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False)
    texto_curriculo_formatado = Column(Text, nullable=False) # Guardará o JSON estruturado gerado pela IA
    texto_original = Column(Text, nullable=True)  # O que o aluno escreveu -- pra ele editar e gerar de novo sem começar do zero
    gerado_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante", back_populates="curriculos")


class EvidenciaCompetencia(Base):
    """
    Modelo que representa a tabela 'evidencias_competencia'.
    Cada atividade concluída deixa uma linha por competência que ela
    trabalhou (eixos da BNCC -- ver competencias.py), com a nota (0-100)
    daquela vez e de onde veio. É o registro auditável por trás do mapa:
    a escola consegue mostrar *por que* o aluno tem aquela pontuação.
    """
    __tablename__ = 'evidencias_competencia'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    competencia = Column(String(40), nullable=False)    # código do eixo (COMPETENCIAS)
    pontos = Column(Integer, nullable=False)            # 0-100 nessa atividade
    origem = Column(String(20), nullable=False)         # 'quiz' | 'entrevista' | 'situacao' | 'aula'
    origem_id = Column(Integer, nullable=True)          # id da QuizSessao/RespostaSituacao/Aula
    criada_em = Column(DateTime, server_default=func.now())


class MapaCompetencia(Base):
    """
    Modelo que representa a tabela 'mapa_competencias'.
    A pontuação atual do aluno em cada eixo -- média móvel das evidências
    (as mais recentes pesam mais, pra o mapa mostrar evolução). Mantida a
    cada atividade por um upsert atômico, pra o ranking de uma vaga ler
    o mapa de todos os alunos numa consulta só.
    """
    __tablename__ = 'mapa_competencias'

    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), primary_key=True)
    competencia = Column(String(40), primary_key=True)
    pontuacao = Column(Float, nullable=False)
    total_evidencias = Column(Integer, nullable=False, default=0)
    atualizado_em = Column(DateTime, server_default=func.now())


class RespostaSituacao(Base):
    """
    Modelo que representa a tabela 'respostas_situacoes'.
    Escolha do aluno numa situação de trabalho do "O que você faria?"
    (banco em frontend/src/data/situacoes.json). A pontuação por
    competência de cada opção fica só no servidor.
    """
    __tablename__ = 'respostas_situacoes'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    situacao_id = Column(String(40), nullable=False)
    opcao_index = Column(Integer, nullable=False)
    criada_em = Column(DateTime, server_default=func.now())


# ------------------------------------------------------------------ Trilha EAD
# Conteúdo produzido e gravado pelos professores da escola; a plataforma
# guarda, controla o acesso e registra a frequência pra comprovação de
# carga horária (ver aulas.py).

class ModuloTrilha(Base):
    """
    Modelo que representa a tabela 'modulos_trilha'.
    Um módulo da trilha EAD (ex: "Módulo 1 -- Mundo do trabalho"). Itinerário
    nulo = módulo comum a todos os alunos.
    """
    __tablename__ = 'modulos_trilha'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(150), nullable=False)
    descricao = Column(Text, nullable=True)
    itinerario = Column(String(60), nullable=True, index=True)
    ordem = Column(Integer, nullable=False, default=0)
    publicado = Column(Boolean, nullable=False, default=False, server_default="false")  # rascunho até a escola publicar
    criado_em = Column(DateTime, server_default=func.now())

    aulas = relationship("Aula", back_populates="modulo", cascade="all, delete-orphan", order_by="Aula.ordem")


class Aula(Base):
    """
    Modelo que representa a tabela 'aulas'.
    Uma aula: vídeo (YouTube não listado ou Vimeo, só o ID fica guardado),
    texto de apoio, materiais pra baixar e perguntas de fixação. A aula só
    conta como concluída com percentual_minimo_assistido do conteúdo E nota
    >= nota_minima na fixação -- e aí credita carga_horaria_minutos.
    """
    __tablename__ = 'aulas'

    id = Column(Integer, primary_key=True, index=True)
    modulo_id = Column(Integer, ForeignKey('modulos_trilha.id', ondelete="CASCADE"), nullable=False, index=True)
    titulo = Column(String(150), nullable=False)
    descricao = Column(Text, nullable=True)
    ordem = Column(Integer, nullable=False, default=0)
    video_provedor = Column(String(10), nullable=True)        # 'youtube' | 'vimeo' | None (aula só de texto/áudio)
    video_id = Column(String(40), nullable=True)
    duracao_segundos = Column(Integer, nullable=False)        # do vídeo; sem vídeo, o tempo de estudo estimado pelo professor
    texto = Column(Text, nullable=True)
    carga_horaria_minutos = Column(Integer, nullable=False)   # o que a aula credita no relatório quando concluída
    percentual_minimo_assistido = Column(Integer, nullable=False, default=80)
    nota_minima = Column(Integer, nullable=False, default=70)  # nota de corte da fixação (0-100)
    publicada = Column(Boolean, nullable=False, default=False, server_default="false")
    criada_em = Column(DateTime, server_default=func.now())
    atualizada_em = Column(DateTime, nullable=True)

    modulo = relationship("ModuloTrilha", back_populates="aulas")
    perguntas = relationship("PerguntaFixacao", back_populates="aula", cascade="all, delete-orphan", order_by="PerguntaFixacao.ordem")
    materiais = relationship("MaterialAula", back_populates="aula", cascade="all, delete-orphan", order_by="MaterialAula.id")


class PerguntaFixacao(Base):
    """
    Modelo que representa a tabela 'perguntas_fixacao'.
    Pergunta de múltipla escolha da atividade de fixação de uma aula. O
    gabarito nunca sai do servidor antes do aluno ser aprovado.
    """
    __tablename__ = 'perguntas_fixacao'

    id = Column(Integer, primary_key=True, index=True)
    aula_id = Column(Integer, ForeignKey('aulas.id', ondelete="CASCADE"), nullable=False, index=True)
    enunciado = Column(Text, nullable=False)
    opcoes = Column(JSON, nullable=False)                     # lista de 2 a 5 textos
    resposta_correta_index = Column(Integer, nullable=False)
    explicacao = Column(Text, nullable=True)
    ordem = Column(Integer, nullable=False, default=0)

    aula = relationship("Aula", back_populates="perguntas")


class MaterialAula(Base):
    """
    Modelo que representa a tabela 'materiais_aula'.
    Áudio de apoio ou PDF/slides pra baixar (leve: até 10 MB). Fica no
    Postgres no piloto (mesmo backup, mesmo controle de acesso); pra
    escalar, o conteúdo vai pro Blob Storage e aqui fica só a referência.
    """
    __tablename__ = 'materiais_aula'

    id = Column(Integer, primary_key=True, index=True)
    aula_id = Column(Integer, ForeignKey('aulas.id', ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(10), nullable=False)                 # 'audio' | 'documento'
    nome_arquivo = Column(String(150), nullable=False)
    tipo_mime = Column(String(60), nullable=False)
    tamanho_bytes = Column(Integer, nullable=False)
    conteudo = deferred(Column(LargeBinary, nullable=False))  # só carrega no download
    enviado_em = Column(DateTime, server_default=func.now())

    aula = relationship("Aula", back_populates="materiais")


class ProgressoAula(Base):
    """
    Modelo que representa a tabela 'progresso_aulas'.
    Estado atual do aluno numa aula. 'blocos_assistidos' é uma string de
    '0'/'1', um caractere por bloco de 10 s do conteúdo: o percentual é a
    fração de blocos realmente assistidos, então adiantar o vídeo até o fim
    não conta como ter assistido.
    """
    __tablename__ = 'progresso_aulas'
    __table_args__ = (UniqueConstraint('estudante_id', 'aula_id', name='uq_progresso_estudante_aula'),)

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    aula_id = Column(Integer, ForeignKey('aulas.id', ondelete="CASCADE"), nullable=False, index=True)
    blocos_assistidos = Column(Text, nullable=False, default="")
    percentual_assistido = Column(Integer, nullable=False, default=0)
    ultimo_registro_em = Column(DateTime, nullable=True)       # último heartbeat aceito (limita o quanto o próximo pode avançar)
    melhor_nota_fixacao = Column(Integer, nullable=True)
    tentativas_fixacao = Column(Integer, nullable=False, default=0)
    embaralhamento_fixacao = Column(JSON, nullable=True)        # ordem sorteada da tentativa aberta: [{pergunta_id, opcoes: [índices originais]}]
    iniciada_em = Column(DateTime, server_default=func.now())
    concluida_em = Column(DateTime, nullable=True)


class LogFrequencia(Base):
    """
    Modelo que representa a tabela 'log_frequencia'.
    Trilha de auditoria da frequência EAD -- só cresce, nunca é editada nem
    apagada por rota nenhuma. É a base do relatório de comprovação de carga
    horária pro PAP/MTE: quando o aluno começou, cada marco de 10% assistido,
    cada tentativa da fixação (nota e nota de corte da época) e a conclusão.
    """
    __tablename__ = 'log_frequencia'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    aula_id = Column(Integer, ForeignKey('aulas.id', ondelete="CASCADE"), nullable=False, index=True)
    evento = Column(String(20), nullable=False)                # 'inicio' | 'progresso' | 'fixacao' | 'conclusao'
    percentual_assistido = Column(Integer, nullable=False)
    nota = Column(Integer, nullable=True)
    nota_de_corte = Column(Integer, nullable=True)
    registrado_em = Column(DateTime, server_default=func.now(), index=True)


class Certificado(Base):
    """
    Modelo que representa a tabela 'certificados'.
    Certificado emitido pelo PAP (ex: o da integração), que a escola envia
    em PDF pro aluno baixar. A plataforma não gera o certificado -- só
    guarda, controla o acesso e mostra no painel quem já tem. 'modulo_id'
    liga ao módulo da trilha EAD a que ele se refere, quando houver.
    """
    __tablename__ = 'certificados'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    modulo_id = Column(Integer, ForeignKey('modulos_trilha.id', ondelete="SET NULL"), nullable=True, index=True)
    titulo = Column(String(150), nullable=False)           # ex: "Integração -- Programa de Aprendizagem 2026"
    emitido_em = Column(Date, nullable=True)               # data que consta no certificado
    nome_arquivo = Column(String(150), nullable=False)
    tamanho_bytes = Column(Integer, nullable=False)
    conteudo = deferred(Column(LargeBinary, nullable=False))  # PDF; só carrega no download
    enviado_em = Column(DateTime, server_default=func.now())


# ------------------------------------------------------------------ Mensagens (3 tipos de canal)
# 'direto': aluno <-> coordenação (1:1). 'grupo': empresa/turno -- os
# aprendizes contratados por aquela empresa (e turno) + a coordenação.
# 'geral': a escola fala com todos. Nada se edita nem se apaga; a
# coordenação pode ocultar uma mensagem imprópria (o original fica guardado).
# Regras em mensagens.py.

class Canal(Base):
    """
    Modelo que representa a tabela 'canais'.
    Grupo de empresa não guarda lista de membros: quem está contratado pela
    empresa (no turno, se houver) é membro -- entrou na empresa, entra no
    grupo; saiu, perde o acesso (o histórico continua no banco).
    """
    __tablename__ = 'canais'

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(10), nullable=False, index=True)          # 'direto' | 'grupo' | 'geral'
    nome = Column(String(120), nullable=False)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=True, unique=True)  # só no 'direto'
    empresa = Column(String(100), nullable=True, index=True)       # só no 'grupo'
    turno = Column(String(20), nullable=True)                      # só no 'grupo'; None = todos os turnos
    arquivado = Column(Boolean, nullable=False, default=False, server_default="false")
    escola_leu_em = Column(DateTime, nullable=True)                 # pra contar o que a coordenação ainda não leu
    criado_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante")


class Mensagem(Base):
    """
    Modelo que representa a tabela 'mensagens'.
    Uma mensagem num canal. Imutável: só a coordenação pode ocultar (quem
    estiver no canal passa a ver "removida pela coordenação"; o texto
    original continua aqui, com quando e por quê).
    """
    __tablename__ = 'mensagens'

    id = Column(Integer, primary_key=True, index=True)
    canal_id = Column(Integer, ForeignKey('canais.id', ondelete="CASCADE"), nullable=False, index=True)
    autor_tipo = Column(String(10), nullable=False)                # 'escola' | 'aluno'
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=True, index=True)  # quando autor_tipo='aluno'
    texto = Column(Text, nullable=False)
    enviada_em = Column(DateTime, server_default=func.now(), index=True)
    oculta_em = Column(DateTime, nullable=True)
    oculta_motivo = Column(String(200), nullable=True)

    estudante = relationship("Estudante")


class LeituraCanal(Base):
    """Até quando cada aluno leu cada canal (pra contar as não lidas)."""
    __tablename__ = 'leituras_canais'

    canal_id = Column(Integer, ForeignKey('canais.id', ondelete="CASCADE"), primary_key=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), primary_key=True)
    lida_em = Column(DateTime, nullable=False)
