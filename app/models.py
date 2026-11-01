from sqlalchemy import Column, Integer, BigInteger, String, Text, ForeignKey, DateTime, Date, Boolean, JSON, LargeBinary, Float, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship, deferred, declared_attr
from database import Base


class Escola(Base):
    """
    Tabela 'escolas': cada escola (cliente) do First2Work. Quase todas as outras
    tabelas têm escola_id (mixin EscopoEscola) e toda consulta feita por um
    aluno ou por uma conta da gestão já sai filtrada pela escola dela
    (tenancy.py) -- uma escola nunca vê dado de outra.
    """
    __tablename__ = 'escolas'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(120), nullable=False)
    slug = Column(String(60), unique=True, nullable=False, index=True)  # identificador curto: "ee-tres-lagoas"
    ativa = Column(Boolean, nullable=False, default=True, server_default="true")
    criada_em = Column(DateTime, server_default=func.now())


class EscopoEscola:
    """Mixin: a linha pertence a uma escola. Preenchido sozinho no INSERT (tenancy.py)."""

    @declared_attr
    def escola_id(cls):
        return Column(Integer, ForeignKey('escolas.id', ondelete="CASCADE"), nullable=False, index=True)

class Turma(EscopoEscola, Base):
    """
    Modelo que representa a tabela 'turmas'.
    Agrupa os estudantes como a escola organiza (ex: "3º A - Manhã"), pra
    gestão no painel admin e pra filtrar a seleção de candidatos por turma.
    """
    __tablename__ = 'turmas'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(60), nullable=False)               # único dentro da escola (__table_args__)
    turno = Column(String(20), nullable=True)               # Manhã, Tarde, Noite, Integral
    criada_em = Column(DateTime, server_default=func.now())

    estudantes = relationship("Estudante", back_populates="turma")

    __table_args__ = (UniqueConstraint('escola_id', 'nome', name='uq_turma_escola_nome'),)


class Estudante(EscopoEscola, Base):
    """
    Modelo que representa a tabela 'estudantes'.
    Armazena os dados do aluno e o seu progresso na gamificação estilo Duolingo.
    """
    __tablename__ = 'estudantes'
    __table_args__ = (
        UniqueConstraint('escola_id', 'email', name='uq_estudante_escola_email'),
        UniqueConstraint('escola_id', 'nome_exibicao', name='uq_estudante_escola_nome_exibicao'),
    )

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, index=True)   # Nome de login -- não é único: se repetir, o login desempata pela senha
    email = Column(String(100), nullable=False, index=True)  # Único dentro da escola (__table_args__)
    nome_exibicao = Column(String(60), nullable=True)  # "Rafael S." -- único, é o que aparece no ranking (ver gerar_nome_exibicao)
    cpf = Column(String(11), unique=True, nullable=True, index=True)  # Só dígitos -- login do aluno é CPF + data de nascimento (cadastrado pela escola)
    data_nascimento = Column(Date, nullable=True)
    linkedin = Column(String(255), nullable=True)            # URL do perfil do LinkedIn (opcional, coletado no cadastro)
    telefone = Column(String(11), nullable=True)             # Celular do aluno, só dígitos com DDD (cadastrado pela escola)
    responsavel_nome = Column(String(100), nullable=True)    # Responsável legal -- a maioria dos alunos é menor de idade
    responsavel_telefone = Column(String(11), nullable=True)
    responsavel_email = Column(String(255), nullable=True)   # Pra a escola falar com o responsável direto da ficha
    # 🔑 Acesso (regras em acesso.py). O aluno entra com usuário + senha. O
    # primeiro acesso, e cada senha nova aprovada pela escola, é feito com CPF
    # + código de acesso que a coordenação gera no painel e entrega em mãos.
    usuario = Column(String(40), unique=True, nullable=True, index=True)  # "rafael.sozza" -- gerado no cadastro, minúsculo e sem acento
    senha_hash = Column(String(255), nullable=True)          # Hash bcrypt da senha (nulo = ainda não fez o primeiro acesso)
    senha_definida_em = Column(DateTime, nullable=True)
    codigo_acesso_hash = Column(String(255), nullable=True)  # Hash bcrypt do código de 6 dígitos (nulo = sem código válido)
    codigo_acesso_expira_em = Column(DateTime, nullable=True)
    codigo_acesso_tentativas = Column(Integer, nullable=False, default=0, server_default="0")  # Erros com o código atual; no limite o código é anulado
    login_falhas = Column(Integer, nullable=False, default=0, server_default="0")  # Senhas erradas seguidas (zera no login certo)
    login_bloqueado_ate = Column(DateTime, nullable=True)
    sessao_versao = Column(Integer, nullable=False, default=0, server_default="0")  # Vai no token: senha nova soma 1 e derruba as sessões abertas
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
    congelamentos_disponiveis = Column(Integer, default=0)   # "Congelamentos de ofensiva": +2 a cada 7 dias seguidos (teto 4), 1 gasto por dia sem prática
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
    foto_no_curriculo = Column(Boolean, nullable=False, default=False, server_default="false")  # "com foto" / "sem foto" no currículo: o aluno escolhe; desligado por padrão (evita discriminação por aparência)
    foto_curriculo_atualizada_em = Column(DateTime, nullable=True)  # None = sem foto do currículo. É outra foto, que o aluno envia (FotoCurriculo)
    onboarding_concluido_em = Column(DateTime, nullable=True)  # None = ainda não passou pelo primeiro acesso

    # 📋 Ficha do PAP (colunas da planilha de controle da escola -- ver data/ficha_pap.json).
    # Só a escola preenche e vê; perfil_desenvolvimento é dado sensível.
    numero_cadastro_sed = Column(String(30), nullable=True)
    sexo = Column(String(10), nullable=True)
    perfil_desenvolvimento = Column(String(10), nullable=True)
    ano_escolar_inicial = Column(String(12), nullable=True)
    ano_escolar_atual = Column(String(12), nullable=True)
    turno_escolar = Column(String(12), nullable=True)
    formacao_mundo_trabalho_em = Column(Date, nullable=True)
    status_estudante = Column(String(20), nullable=True)
    endereco = Column(String(255), nullable=True)
    documentos = Column(String(255), nullable=True)
    cadastro_atualizado_em = Column(Date, nullable=True)       # "data atualização" da planilha: muda quando a escola edita
    # Conflito de edição: cada alteração do cadastro soma 1. Quem salva com uma
    # versão velha (outra pessoa salvou no meio-tempo) recebe 409 em vez de sobrescrever.
    versao_cadastro = Column(Integer, nullable=False, default=1, server_default="1")
    cadastro_alterado_por = Column(String(100), nullable=True)
    cadastro_alterado_em = Column(DateTime, nullable=True)

    criado_em = Column(DateTime, server_default=func.now())

    # Relacionamentos
    historico_entrevistas = relationship("HistoricoEntrevista", back_populates="estudante", cascade="all, delete-orphan")
    curriculos = relationship("Curriculo", back_populates="estudante", cascade="all, delete-orphan")
    atividades_diarias = relationship("AtividadeDiaria", back_populates="estudante", cascade="all, delete-orphan")
    candidaturas = relationship("Candidatura", back_populates="estudante", cascade="all, delete-orphan")
    turma = relationship("Turma", back_populates="estudantes")
    foto = relationship("FotoEstudante", uselist=False, cascade="all, delete-orphan", passive_deletes=True)
    foto_curriculo = relationship("FotoCurriculo", uselist=False, cascade="all, delete-orphan", passive_deletes=True)
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


class FotoCurriculo(Base):
    """
    Modelo que representa a tabela 'fotos_curriculo'.
    A foto que vai no currículo, separada da foto de identificação
    (FotoEstudante, que é pra escola reconhecer o aluno no painel). Opcional:
    só o aluno envia, e só aparece se ele marcar "com foto" no currículo.
    """
    __tablename__ = 'fotos_curriculo'

    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), primary_key=True)
    conteudo = Column(LargeBinary, nullable=False)
    tipo_mime = Column(String(20), nullable=False)
    atualizada_em = Column(DateTime, server_default=func.now(), onupdate=func.now())


class UsuarioGestao(EscopoEscola, Base):
    """
    Tabela 'usuarios_gestao': uma conta por pessoa da coordenação/secretaria
    (substitui a senha única do painel). Perfis (auth.PERFIS_GESTAO):
      administrador -- o "admin do admin": tudo, cria as contas e escolhe os perfis;
      auditor       -- vê tudo e a auditoria, mas não altera;
      alterar       -- vê e altera o dia a dia, sem auditoria;
      visualizar    -- só vê.
    """
    __tablename__ = 'usuarios_gestao'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    usuario = Column(String(40), unique=True, nullable=False, index=True)  # minúsculo
    senha_hash = Column(String(255), nullable=False)
    papel = Column(String(15), nullable=False, default="visualizar", server_default="visualizar")  # administrador | auditor | alterar | visualizar
    ativo = Column(Boolean, nullable=False, default=True, server_default="true")
    deve_trocar_senha = Column(Boolean, nullable=False, default=True, server_default="true")  # Senha temporária (criação/reset)
    login_falhas = Column(Integer, nullable=False, default=0, server_default="0")
    login_bloqueado_ate = Column(DateTime, nullable=True)
    sessao_versao = Column(Integer, nullable=False, default=0, server_default="0")  # Desativar/trocar senha/papel derruba as sessões
    ultimo_acesso_em = Column(DateTime, nullable=True)
    criado_em = Column(DateTime, server_default=func.now())


class RegistroAuditoria(Base):
    """
    Tabela 'auditoria': o que cada pessoa da gestão fez no painel -- incluiu,
    alterou, excluiu, exportou, entrou. Só cresce: nenhuma rota edita ou apaga;
    registros com mais de 2 anos são removidos automaticamente (auditoria.py).
    O nome e o papel ficam copiados aqui pra o registro valer mesmo se a conta
    mudar depois.
    """
    __tablename__ = 'auditoria'

    id = Column(Integer, primary_key=True, index=True)
    # Escola opcional (login errado de usuário inexistente não tem escola). Fora
    # do filtro automático: a listagem filtra pela escola de quem consulta.
    escola_id = Column(Integer, ForeignKey('escolas.id', ondelete="CASCADE"), nullable=True, index=True)
    criado_em = Column(DateTime, server_default=func.now(), index=True)
    usuario_gestao_id = Column(Integer, ForeignKey('usuarios_gestao.id', ondelete="SET NULL"), nullable=True, index=True)
    usuario_nome = Column(String(100), nullable=False)
    papel = Column(String(15), nullable=True)
    acao = Column(String(15), nullable=False, index=True)       # incluiu | alterou | excluiu | exportou | entrou | falhou_login | negado
    entidade = Column(String(40), nullable=True, index=True)    # aluno, turma, vaga, contrato, aula...
    entidade_id = Column(String(40), nullable=True)
    descricao = Column(String(255), nullable=False)
    metodo = Column(String(7), nullable=True)
    caminho = Column(String(255), nullable=True)
    status_http = Column(Integer, nullable=True)
    dados = Column(JSON, nullable=True)                          # O que foi enviado (sem senhas, códigos nem arquivos)
    antes = Column(JSON, nullable=True)                          # Como era antes (exclusões e alterações sensíveis)
    ip = Column(String(45), nullable=True)


class PedidoNovaSenha(EscopoEscola, Base):
    """
    Tabela 'pedidos_nova_senha': o aluno que esqueceu a senha pede uma nova
    na tela de login, e a coordenação aprova ou recusa no painel. Aprovar
    gera um código de acesso que a escola entrega em mãos -- quem pediu no
    lugar de outro aluno não recebe nada. O histórico fica (auditoria).
    """
    __tablename__ = 'pedidos_nova_senha'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(12), nullable=False, default="pendente", server_default="pendente", index=True)  # pendente | aprovado | recusado | concluido
    criado_em = Column(DateTime, server_default=func.now())
    decidido_em = Column(DateTime, nullable=True)
    motivo_recusa = Column(String(200), nullable=True)
    concluido_em = Column(DateTime, nullable=True)            # Quando o aluno usou o código e criou a senha nova

    estudante = relationship("Estudante")


class ObservacaoEstudante(EscopoEscola, Base):
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
    autor = Column(String(60), nullable=False, default="Coordenação")  # Nome de quem anotou (conta da gestão)
    criada_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante", back_populates="observacoes")


class MudancaStatusContratacao(EscopoEscola, Base):
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


class Vaga(EscopoEscola, Base):
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


class HistoricoEntrevista(EscopoEscola, Base):
    """
    Modelo que representa a tabela 'historico_entrevistas'.
    Guarda o histórico de mensagens trocadas entre o utilizador e a IA no Simulador.
    """
    __tablename__ = 'historico_entrevistas'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False)
    sessao_id = Column(Integer, ForeignKey('sessoes_entrevista.id', ondelete="CASCADE"), nullable=True, index=True)  # Nulo = mensagem do formato antigo (nota por resposta)
    remetente = Column(String(10), nullable=False) # 'user' ou 'ai'
    mensagem = Column(Text, nullable=False)
    categoria = Column(String(20), nullable=True)  # Só nas do aluno: 'resposta' (contou) ou o motivo de não contar (fora_do_tema, inadequada...)
    feedback_ia = Column(Text, nullable=True)      # Formato antigo: feedback por resposta
    xp_concedido = Column(Integer, nullable=True)  # Formato antigo: nota da resposta (0-50)
    enviado_em = Column(DateTime, server_default=func.now())

    estudante = relationship("Estudante", back_populates="historico_entrevistas")


class TentativaCertificacao(EscopoEscola, Base):
    """
    Tabela 'tentativas_certificacao': cada Simulado de Certificação (20
    questões, tentativa única por ciclo -- regras em certificacao.py). A
    aprovada é a certificação do aluno; as reprovadas ficam só no histórico.
    O gabarito fica aqui e nunca vai pro navegador.
    """
    __tablename__ = 'tentativas_certificacao'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    itinerario = Column(String(60), nullable=False)     # A certificação vale pro curso em que foi feita
    status = Column(String(15), nullable=False, default="em_andamento", server_default="em_andamento", index=True)  # em_andamento | aprovada | reprovada
    iniciada_em = Column(DateTime, nullable=False)
    expira_em = Column(DateTime, nullable=False)
    concluida_em = Column(DateTime, nullable=True)
    gabarito = Column(JSON, nullable=False)              # [{pergunta, opcoes, resposta_correta_index, explicacao}]
    respostas = Column(JSON, nullable=False, default=list)  # [{indice, opcao, correta}]
    acertos = Column(Integer, nullable=True)
    total = Column(Integer, nullable=True)
    percentual = Column(Integer, nullable=True)
    saidas_de_tela = Column(Integer, nullable=False, default=0, server_default="0")  # Trocou de aba/minimizou durante a prova


class RodadaEntrevista(EscopoEscola, Base):
    """
    Tabela 'rodadas_entrevista': blocos de 5 entrevistas do simulador. Média
    >= 80 marca 'meta_atingida', mas quem confirma a "Meta de Entrevista
    Atingida" é a coordenação (confirmada_em). Abaixo disso, abre a próxima
    rodada; o número de cada uma fica pra escola ver a evolução.
    """
    __tablename__ = 'rodadas_entrevista'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    numero = Column(Integer, nullable=False)          # 1ª, 2ª, 3ª rodada...
    status = Column(String(15), nullable=False, default="em_andamento", server_default="em_andamento")  # em_andamento | meta_atingida | nao_atingida
    media = Column(Integer, nullable=True)
    iniciada_em = Column(DateTime, server_default=func.now())
    concluida_em = Column(DateTime, nullable=True)
    confirmada_em = Column(DateTime, nullable=True)   # Coordenação confirmou a meta

    __table_args__ = (UniqueConstraint('estudante_id', 'numero', name='uq_rodada_estudante_numero'),)


class SessaoEntrevista(EscopoEscola, Base):
    """
    Tabela 'sessoes_entrevista': uma entrevista contínua do simulador (5 a 7
    respostas) e o laudo final de desempenho, que fica na ficha do aluno.
    Regras em entrevista.py.
    """
    __tablename__ = 'sessoes_entrevista'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="em_andamento", server_default="em_andamento", index=True)  # em_andamento | aguardando_laudo | concluida | abandonada
    respostas = Column(Integer, nullable=False, default=0, server_default="0")  # Respostas que contaram (fora do tema não conta)
    iniciada_em = Column(DateTime, server_default=func.now())
    encerrada_em = Column(DateTime, nullable=True)   # Quando a entrevistadora se despediu
    laudo_em = Column(DateTime, nullable=True)
    nota_geral = Column(Integer, nullable=True)      # 0-100, calculada no servidor a partir das notas
    notas = Column(JSON, nullable=True)              # {relevancia, clareza, exemplos, postura} de 0 a 10
    pontos_fortes = Column(JSON, nullable=True)      # lista de frases
    pontos_melhoria = Column(JSON, nullable=True)
    parecer_recrutador = Column(Text, nullable=True)
    xp_concedido = Column(Integer, nullable=True)
    laudo_por_ia = Column(Boolean, nullable=True)    # False = laudo de reserva (sem IA ou ela falhou)
    # Oficial = conta pra rodada e pro mapa de competências. Provisório (False) = saiu pelas
    # regras de reserva num sistema com IA ligada: a régua é outra, então não entra na média.
    laudo_oficial = Column(Boolean, nullable=True)
    laudo_motor = Column(String(80), nullable=True)            # "gemini:<modelo>" ou "regras" -- quem avaliou
    laudo_motivo_provisorio = Column(String(20), nullable=True)  # cota_semanal | ia_indisponivel | teto_mensal
    resumo = Column(String(160), nullable=True)      # Síntese de uma frase pro feed compacto da escola
    rodada_id = Column(Integer, ForeignKey('rodadas_entrevista.id', ondelete="SET NULL"), nullable=True, index=True)  # Nulo = treino livre (depois da meta)

    mensagens = relationship("HistoricoEntrevista", order_by="HistoricoEntrevista.id", passive_deletes=True)


class AtividadeDiaria(EscopoEscola, Base):
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


class Candidatura(EscopoEscola, Base):
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


class QuizSessao(EscopoEscola, Base):
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


class Curriculo(EscopoEscola, Base):
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


class EvidenciaCompetencia(EscopoEscola, Base):
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


class RespostaSituacao(EscopoEscola, Base):
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

class ModuloTrilha(EscopoEscola, Base):
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


class Aula(EscopoEscola, Base):
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


class PerguntaFixacao(EscopoEscola, Base):
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


class MaterialAula(EscopoEscola, Base):
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


class ProgressoAula(EscopoEscola, Base):
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


class LogFrequencia(EscopoEscola, Base):
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


class ContratoAprendizagem(EscopoEscola, Base):
    """
    Modelo que representa a tabela 'contratos_aprendizagem'.
    Contrato de Jovem Aprendiz como a escola controla na planilha do PAP:
    empresa, local, turno, tipo de contratação, vigência, aditivo, carga
    horária, status, motivo do encerramento e efetivação. Um aluno pode ter
    vários ao longo do tempo (o histórico fica); o mais recente é o atual.
    """
    __tablename__ = 'contratos_aprendizagem'

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    empresa = Column(String(100), nullable=False)
    cnpj = Column(String(14), nullable=True)
    local_atuacao = Column(String(150), nullable=True)
    turno_trabalho = Column(String(12), nullable=True)
    tipo_contratacao = Column(String(12), nullable=True)      # Direta | Alternativa
    data_inicial = Column(Date, nullable=False)
    data_final = Column(Date, nullable=True)
    aditivo = Column(String(3), nullable=True)                # Sim | Não
    aditivo_inicio = Column(Date, nullable=True)
    aditivo_fim = Column(Date, nullable=True)
    horas_teoria = Column(Integer, nullable=True)             # carga horária semanal
    horas_pratica = Column(Integer, nullable=True)
    status = Column(String(12), nullable=False, default="Ativo")  # Ativo | Finalizado
    motivo = Column(String(60), nullable=True)
    efetivado = Column(String(15), nullable=True)             # Efetivado | Não efetivado
    observacao = Column(Text, nullable=True)
    criado_em = Column(DateTime, server_default=func.now())


class RetiradaCertificado(EscopoEscola, Base):
    """
    Modelo que representa a tabela 'retiradas_certificado'.
    O certificado de conclusão de um módulo da trilha EAD é entregue em mãos
    na escola -- a plataforma não guarda nem gera o documento. Quando o aluno
    conclui o módulo, ele é avisado pra procurar a coordenação; quando busca,
    a coordenação registra aqui. Sem linha = concluiu e ainda não retirou.
    """
    __tablename__ = 'retiradas_certificado'
    __table_args__ = (UniqueConstraint('estudante_id', 'modulo_id', name='uq_retirada_estudante_modulo'),)

    id = Column(Integer, primary_key=True, index=True)
    estudante_id = Column(Integer, ForeignKey('estudantes.id', ondelete="CASCADE"), nullable=False, index=True)
    modulo_id = Column(Integer, ForeignKey('modulos_trilha.id', ondelete="CASCADE"), nullable=False, index=True)
    retirado_em = Column(Date, nullable=False)             # dia da entrega, informado pela coordenação
    observacao = Column(String(200), nullable=True)        # ex: "retirado pela mãe"
    registrado_em = Column(DateTime, server_default=func.now())


# ------------------------------------------------------------------ Mensagens (3 tipos de canal)
# 'direto': aluno <-> coordenação (1:1). 'grupo': empresa/turno -- os
# aprendizes contratados por aquela empresa (e turno) + a coordenação.
# 'geral': a escola fala com todos. Nada se edita nem se apaga; a
# coordenação pode ocultar uma mensagem imprópria (o original fica guardado).
# Regras em mensagens.py.

class Canal(EscopoEscola, Base):
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


class Mensagem(EscopoEscola, Base):
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


class UsoIa(Base):
    """
    Tabela 'uso_ia': consumo da IA por mês e modelo, somado a cada chamada
    (tokens que a própria API informa). É da PLATAFORMA, não de uma escola
    (sem escola_id de propósito): o teto de gasto é global. Regras em uso_ia.py.
    """
    __tablename__ = 'uso_ia'
    __table_args__ = (UniqueConstraint('mes', 'modelo', name='uq_uso_ia_mes_modelo'),)

    id = Column(Integer, primary_key=True)
    mes = Column(Date, nullable=False)                 # dia 1 do mês, no fuso da escola
    modelo = Column(String(80), nullable=False)
    chamadas = Column(Integer, nullable=False, default=0, server_default="0")
    tokens_entrada = Column(BigInteger, nullable=False, default=0, server_default="0")
    tokens_saida = Column(BigInteger, nullable=False, default=0, server_default="0")   # inclui os de raciocínio, cobrados como saída
    custo_usd = Column(Float, nullable=False, default=0, server_default="0")         # estimado pelos preços do .env
    atualizado_em = Column(DateTime, nullable=True)
