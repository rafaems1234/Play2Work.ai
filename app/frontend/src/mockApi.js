import { LIGAS as LIGAS_INFO } from './ligas.js';
import BANCO_QUESTOES from './data/banco_questoes.json';

// Modo demonstração: simula todas as rotas da API inteiramente no navegador,
// com dados fictícios e uma "gamificação" leve simulada em memória -- pra dar
// pra apresentar o produto rodando só o front, sem precisar subir backend
// nem banco de dados. Ativado/desativado em api.js (ver DEMO_MODE).

const ITINERARIOS = [
  {
    nome: 'Tecnologia e Ciência de Dados',
    descricao: 'Análise estatística, Big Data, Python e SQL, visualização de dados e IA aplicadas ao mercado de trabalho.',
  },
  {
    nome: 'Robótica e Automação',
    descricao: 'Desenvolvimento de protótipos, projetos em Arduino, automação e integração entre programação e hardware.',
  },
  {
    nome: 'Ciências Jurídicas / Serviços Jurídicos',
    descricao: 'Fundamentos do Direito, Direito Digital, LGPD, ética na era digital e rotinas administrativas/jurídicas.',
  },
  {
    nome: 'Ciências da Natureza e Matemática',
    descricao: 'Aprofundamento em Biologia, Física, Química e Matemática, com foco prático e preparação para vestibulares e ENEM.',
  },
  {
    nome: 'Recursos Humanos e Gestão de Pessoas',
    descricao: 'Recrutamento e seleção, departamento pessoal, legislação trabalhista básica (CLT), comunicação e clima organizacional.',
  },
];

const VAGAS = [
  { id: 1, titulo_vaga: 'Jovem Aprendiz - Ciência de Dados', empresa: 'Vivo Telefônica', razao_social_real: 'TELEFÔNICA BRASIL S.A.', localizacao: 'São Paulo - SP', tipo_modalidade: 'Híbrido', habilidades_exigidas: ['Python', 'SQL', 'Análise de Dados'], area_itinerario: 'Tecnologia e Ciência de Dados', descricao_completa: 'Você vai apoiar o time de dados da Vivo em análises de churn e consumo, aprendendo Python, SQL e visualização de dados na prática.', link_inscricao: 'https://vagas.vivo.com.br' },
  { id: 2, titulo_vaga: 'Desenvolvedor Front-end Júnior', empresa: 'TechSoluções', razao_social_real: 'Parceiro Verificado', localizacao: 'Remoto', tipo_modalidade: 'Remoto', habilidades_exigidas: ['React', 'JavaScript', 'CSS'], area_itinerario: 'Tecnologia e Ciência de Dados', descricao_completa: 'Squad pequeno construindo produtos web com React. Você vai revisar PRs de verdade e aprender boas práticas de front-end com mentoria semanal.', link_inscricao: 'https://techsolucoes.com/carreiras' },
  { id: 3, titulo_vaga: 'Assistente de TI', empresa: 'Suzano Papel e Celulose', razao_social_real: 'SUZANO S.A.', localizacao: 'Três Lagoas - MS', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Lógica de Programação', 'SQL'], area_itinerario: 'Tecnologia e Ciência de Dados', descricao_completa: 'Suporte ao time de infraestrutura de TI da unidade fabril: manutenção de estações de trabalho e apoio em chamados.', link_inscricao: 'https://suzano.gupy.io' },
  { id: 4, titulo_vaga: 'Jovem Aprendiz - Automação e Robótica', empresa: 'Bosch Manufatura', razao_social_real: 'ROBERT BOSCH LTDA', localizacao: 'Campinas - SP', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Lógica de Programação', 'Arduino', 'Trabalho em Equipe'], area_itinerario: 'Robótica e Automação', descricao_completa: 'Você vai acompanhar a equipe de automação industrial em projetos de prototipagem com Arduino e sensores.', link_inscricao: 'https://carreiras.bosch.com.br' },
  { id: 5, titulo_vaga: 'Estagiário de Departamento Jurídico', empresa: 'Machado Advogados Associados', razao_social_real: 'Parceiro Verificado', localizacao: 'São Paulo - SP', tipo_modalidade: 'Híbrido', habilidades_exigidas: ['Comunicação', 'Organização', 'Redação'], area_itinerario: 'Ciências Jurídicas / Serviços Jurídicos', descricao_completa: 'Apoio em rotinas administrativas de um escritório de Direito Digital e LGPD.', link_inscricao: 'https://machadoadvogados.com.br/carreiras' },
  { id: 7, titulo_vaga: 'Jovem Aprendiz - Assistente Jurídico', empresa: 'Defensoria Parceira (Programa Jovem Cidadão)', razao_social_real: 'Parceiro Verificado', localizacao: 'Três Lagoas - MS', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Redação', 'Organização', 'Atendimento', 'LGPD'], area_itinerario: 'Ciências Jurídicas / Serviços Jurídicos', descricao_completa: 'Apoio no atendimento ao público, triagem e digitalização de documentos, controle de prazos e organização de processos, com sigilo e supervisão.', link_inscricao: null },
  { id: 8, titulo_vaga: 'Jovem Aprendiz - Recursos Humanos', empresa: 'Suzano Papel e Celulose', razao_social_real: 'SUZANO S.A.', localizacao: 'Três Lagoas - MS', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Comunicação', 'Organização', 'Pacote Office', 'Atendimento'], area_itinerario: 'Recursos Humanos e Gestão de Pessoas', descricao_completa: 'Apoio ao RH em recrutamento e seleção (triagem de currículos, agendamento de entrevistas), integração de novos colaboradores e rotinas de departamento pessoal.', link_inscricao: 'https://suzano.gupy.io' },
  { id: 9, titulo_vaga: 'Auxiliar de Departamento Pessoal (Aprendiz)', empresa: 'Contabilidade Horizonte', razao_social_real: 'Parceiro Verificado', localizacao: 'Campo Grande - MS', tipo_modalidade: 'Híbrido', habilidades_exigidas: ['Organização', 'Pacote Office', 'Comunicação'], area_itinerario: 'Recursos Humanos e Gestão de Pessoas', descricao_completa: 'Apoio em admissões, conferência de folha de ponto, organização de documentos de funcionários e atendimento a dúvidas sobre férias e benefícios.', link_inscricao: null },
  { id: 6, titulo_vaga: 'Jovem Aprendiz - Laboratório de Análises', empresa: 'Instituto Butantan', razao_social_real: 'INSTITUTO BUTANTAN', localizacao: 'São Paulo - SP', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Biologia', 'Química', 'Organização'], area_itinerario: 'Ciências da Natureza e Matemática', descricao_completa: 'Apoio em rotinas de laboratório sob supervisão de pesquisadores: preparo de amostras e registro de dados experimentais.', link_inscricao: 'https://butantan.gov.br/trabalhe-conosco' },
];

const PERGUNTAS_ENTREVISTA = [
  'Legal! Me conta agora sobre uma dificuldade que você teve recentemente e como lidou com ela.',
  'Ótimo. E como você organiza seu tempo entre estudos e outras responsabilidades?',
  'Show. Me dá um exemplo de quando você trabalhou em equipe pra resolver algo.',
  'Perfeito. Por que você tem interesse nessa área específica de atuação?',
  'Boa! O que você faria se discordasse de uma decisão do seu líder?',
];

const VIDAS_MAXIMAS = 5;
const MINUTOS_PARA_REGENERAR_VIDA = 30;
const ACERTOS_SEGUIDOS_PARA_VIDA = 5;
const PERGUNTAS_POR_QUIZ = 10;
const PERGUNTAS_GERAIS_POR_QUIZ = 2;
const SENHA_ADMIN_DEMO = 'escola123';
const TOKEN_ADMIN_DEMO = 'demo-admin';
const CUSTO_MOEDAS_POR_VIDA = 50;
const DICAS_POR_QUIZ = 2;
const PULOS_POR_QUIZ = 2;
const LIGAS = LIGAS_INFO.map((l) => l.nome);

const estado = {
  alunoId: 1,
  nome: 'Rafael Sozza',
  nome_exibicao: 'Rafael S.',
  email: 'rafael@escola.com',
  linkedin: 'https://linkedin.com/in/rafael-sozza',
  habilidades: ['Python', 'SQL', 'React', 'Análise de Dados', 'Lógica de Programação'],
  xp_total: 270,
  xp_semanal: 180,
  nivel_gamificacao: 3,
  ofensiva_dias: 6,
  itinerario: 'Tecnologia e Ciência de Dados',
  categoria_status: '🌌 Na Jornada',
  liga: 'Prata',
  vidas: 4,
  proxima_vida_em: null,
  moedas: 65,
  congelamentos_disponiveis: 1,
  quizzes_perfeitos_seguidos: 3,
  precisaTrocarSenha: false,
  candidaturas: new Set(),
  quizzesEnviados: 0,
  treinouHoje: false,
  respostaEntrevistaIndex: 0,
};

let quizAtivo = null;
let proximoQuizId = 1;
const perguntasRecentes = []; // últimos quizzes, pra não repetir (igual SESSOES_RECENTES_SEM_REPETIR no backend)

// --------------------------------------------------------------- escola (painel admin)
// Mesma regra de nomes.py: nome curto e único pro ranking ("Rafael S.", "Rafael Si."...)
const escolherNomeExibicao = (nomeCompleto, ocupados) => {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  const primeiro = partes.length ? cap(partes[0]) : 'Aluno';
  const candidatos = partes.length <= 1 ? [primeiro] : [];
  if (partes.length > 1) {
    const ultimo = cap(partes[partes.length - 1]);
    for (let n = 1; n < ultimo.length; n += 1) candidatos.push(`${primeiro} ${ultimo.slice(0, n)}.`);
    candidatos.push(`${primeiro} ${ultimo}`);
    partes.slice(1, -1).filter((m) => m.length > 2).forEach((m) => candidatos.push(`${primeiro} ${m[0].toUpperCase()}. ${ultimo}`));
  }
  const livre = candidatos.find((c) => !ocupados.has(c.toLowerCase()));
  if (livre) return livre;
  const base = candidatos[candidatos.length - 1];
  let numero = 2;
  while (ocupados.has(`${base} ${numero}`.toLowerCase())) numero += 1;
  return `${base} ${numero}`;
};

const TURMAS = [
  { id: 1, nome: '2º A', turno: 'Manhã' },
  { id: 2, nome: '3º A', turno: 'Manhã' },
  { id: 3, nome: '3º B', turno: 'Tarde' },
];

// [nome, cpf, turma, itinerário, xp, ofensiva, habilidades, % acerto no quiz]
const ALUNOS = [
  ['Rafael Sozza', '52998224725', 2, 'Tecnologia e Ciência de Dados', 270, 6, ['Python', 'SQL', 'React', 'Análise de Dados', 'Lógica de Programação'], 80],
  ['Bianca Ferreira', '22257222261', 2, 'Tecnologia e Ciência de Dados', 640, 18, ['Python', 'SQL', 'Análise de Dados', 'Comunicação'], 90],
  ['Lucas Andrade', '33368333372', 3, 'Tecnologia e Ciência de Dados', 210, 3, ['JavaScript', 'React', 'CSS'], 60],
  ['Júlia Martins', '44479444483', 2, 'Robótica e Automação', 480, 12, ['Arduino', 'Lógica de Programação', 'Trabalho em Equipe'], 80],
  ['Gabriel Souza', '55810555560', 1, 'Robótica e Automação', 150, 1, ['Arduino', 'Matemática'], 50],
  ['Ana Clara Lima', '66911666635', 2, 'Ciências Jurídicas / Serviços Jurídicos', 560, 21, ['Comunicação', 'Organização', 'Redação', 'LGPD'], 90],
  ['Matheus Rocha', '71012777723', 3, 'Ciências Jurídicas / Serviços Jurídicos', 320, 6, ['Redação', 'Atendimento'], 70],
  ['Beatriz Nunes', '81113888881', 3, 'Recursos Humanos e Gestão de Pessoas', 590, 15, ['Comunicação', 'Organização', 'Pacote Office', 'Atendimento'], 80],
  ['Isabela Duarte', '91214999930', 1, 'Recursos Humanos e Gestão de Pessoas', 260, 4, ['Comunicação', 'Trabalho em Equipe'], 70],
  ['Guilherme Pires', '51010101030', 1, 'Ciências da Natureza e Matemática', 410, 9, ['Biologia', 'Química', 'Matemática'], 80],
  ['Mariana Costa', '61111111162', 3, 'Ciências da Natureza e Matemática', 180, 2, ['Biologia', 'Organização'], 60],
  ['Rafael Silva', '12345678909', 1, 'Tecnologia e Ciência de Dados', 300, 5, ['Python', 'Excel'], 70],
].reduce((lista, [nome, cpf, turma_id, itinerario, xp_total, ofensiva_dias, habilidades, taxa], idx) => {
  const ocupados = new Set(lista.map((a) => a.nome_exibicao.toLowerCase()));
  lista.push({
    id: idx + 1, nome, nome_exibicao: escolherNomeExibicao(nome, ocupados), cpf, data_nascimento: null,
    email: `${nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.')}@escola.com`,
    turma_id, itinerario, xp_total, ofensiva_dias, habilidades, taxa_acerto_quiz: taxa, liga: 'Bronze', total_candidaturas: 0,
  });
  return lista;
}, []);

const indicacoes = new Map(); // vagaId -> Map(alunoId -> pontuação)
let proximoAlunoId = ALUNOS.length + 1;
let proximaTurmaId = TURMAS.length + 1;
let proximaVagaId = 10;

const PESOS_DESEMPENHO = { habilidades: 35, itinerario: 20, quiz: 25, engajamento: 15, constancia: 5 };
const calcularDesempenho = (aluno, vaga, xpMaximo) => {
  const habVaga = new Set(vaga.habilidades_exigidas);
  const emComum = (aluno.habilidades || []).filter((h) => habVaga.has(h));
  const fracoes = {
    habilidades: habVaga.size ? emComum.length / habVaga.size : 0,
    itinerario: aluno.itinerario && aluno.itinerario === vaga.area_itinerario ? 1 : 0,
    quiz: (aluno.taxa_acerto_quiz ?? 0) / 100,
    engajamento: xpMaximo > 0 ? Math.min(1, aluno.xp_total / xpMaximo) : 0,
    constancia: Math.min(1, aluno.ofensiva_dias / 30),
  };
  const detalhes = Object.fromEntries(Object.entries(fracoes).map(([k, f]) => [k, Math.round(f * PESOS_DESEMPENHO[k] * 10) / 10]));
  return { pontuacao: Math.round(Object.values(detalhes).reduce((a, b) => a + b, 0)), detalhes, habilidades_em_comum: emComum.sort() };
};

const nomeTurma = (id) => TURMAS.find((t) => t.id === id)?.nome ?? null;
const totalIndicacoesDoAluno = (id) => [...indicacoes.values()].filter((m) => m.has(id)).length;
const alunoParaApi = (a) => ({
  ...a,
  turma: nomeTurma(a.turma_id),
  nivel: 1 + Math.floor(a.xp_total / 300),
  total_indicacoes: totalIndicacoesDoAluno(a.id),
});

// --------------------------------------------------------------- banco de questões
const embaralhar = (lista) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

const sortearDoGrupo = (grupo, quantidade) => {
  const recentes = new Set(perguntasRecentes.flat());
  return [...embaralhar(grupo.filter((p) => !recentes.has(p.pergunta))), ...embaralhar(grupo.filter((p) => recentes.has(p.pergunta)))].slice(0, quantidade);
};

// Mesma regra de sortear_perguntas_do_banco() no backend: maioria da área,
// um pouco de soft skills, sem repetir os últimos quizzes, alternativas embaralhadas
const sortearPerguntas = (itinerario) => {
  const daArea = BANCO_QUESTOES[itinerario] || [];
  const qtdGerais = daArea.length ? PERGUNTAS_GERAIS_POR_QUIZ : PERGUNTAS_POR_QUIZ;
  let escolhidas = sortearDoGrupo(daArea, PERGUNTAS_POR_QUIZ - qtdGerais);
  escolhidas = [...escolhidas, ...sortearDoGrupo(BANCO_QUESTOES.Geral, PERGUNTAS_POR_QUIZ - escolhidas.length)];
  perguntasRecentes.push(escolhidas.map((p) => p.pergunta));
  if (perguntasRecentes.length > 5) perguntasRecentes.shift();
  return embaralhar(escolhidas).map((p) => {
    const ordem = embaralhar(p.opcoes.map((_, i) => i));
    return {
      pergunta: p.pergunta,
      opcoes: ordem.map((i) => p.opcoes[i]),
      resposta_correta_index: ordem.indexOf(p.resposta_correta_index),
      explicacao: p.explicacao,
    };
  });
};

const comboFinal = (respostas) => respostas.reduce((combo, r) => (r.correta ? combo + 1 : 0), 0);
const vidasGanhasPorCombo = (respostas) => {
  let vidas = 0;
  let combo = 0;
  respostas.forEach((r) => {
    combo = r.correta ? combo + 1 : 0;
    if (combo && combo % ACERTOS_SEGUIDOS_PARA_VIDA === 0) vidas += 1;
  });
  return vidas;
};

// Regeneração "lazy" de 1 vida a cada 30 min, igual regenerar_vidas() no backend
const regenerarVidas = () => {
  if (estado.vidas >= VIDAS_MAXIMAS || !estado.proxima_vida_em) return;
  const agora = Date.now();
  const marca = new Date(estado.proxima_vida_em).getTime();
  if (agora < marca) return;
  const intervalo = MINUTOS_PARA_REGENERAR_VIDA * 60_000;
  const regeneradas = 1 + Math.floor((agora - marca) / intervalo);
  estado.vidas = Math.min(VIDAS_MAXIMAS, estado.vidas + regeneradas);
  estado.proxima_vida_em = estado.vidas >= VIDAS_MAXIMAS ? null : new Date(agora + intervalo).toISOString();
};

const perderVida = () => {
  if (estado.vidas <= 0) return;
  estado.vidas -= 1;
  if (!estado.proxima_vida_em) estado.proxima_vida_em = new Date(Date.now() + MINUTOS_PARA_REGENERAR_VIDA * 60_000).toISOString();
};

const ganharVidas = (quantidade) => {
  const ganhas = Math.max(0, Math.min(quantidade, VIDAS_MAXIMAS - estado.vidas));
  estado.vidas += ganhas;
  if (estado.vidas >= VIDAS_MAXIMAS) estado.proxima_vida_em = null;
  return ganhas;
};

// O app do aluno roda sempre sobre "estado"; ao entrar com o CPF de outro
// aluno da lista, o estado passa a refletir os dados dele.
const entrarComo = (aluno) => {
  if (estado.alunoId === aluno.id) return;
  Object.assign(estado, {
    alunoId: aluno.id,
    nome: aluno.nome,
    nome_exibicao: aluno.nome_exibicao,
    email: aluno.email,
    habilidades: aluno.habilidades,
    itinerario: aluno.itinerario,
    xp_total: aluno.xp_total,
    xp_semanal: Math.round(aluno.xp_total * 0.6),
    nivel_gamificacao: 1 + Math.floor(aluno.xp_total / 300),
    ofensiva_dias: aluno.ofensiva_dias,
    candidaturas: new Set(),
  });
  atualizarCategoriaStatus();
};

const alunoDoToken = (token) => {
  const m = /^demo-aluno-(\d+)$/.exec(token || '');
  return m ? ALUNOS.find((a) => a.id === Number(m[1])) : null;
};

const clone = (valor) => JSON.parse(JSON.stringify(valor));

const atualizarCategoriaStatus = () => {
  if (estado.xp_total < 150) estado.categoria_status = '🌌 Na Jornada';
  else if (estado.xp_total < 400) estado.categoria_status = '⚔️ Sobrevivente do RH';
  else if (estado.xp_total < 800) estado.categoria_status = '👔 Pronto para a Dinâmica';
  else estado.categoria_status = '🚀 CONTRATADO!';
};
atualizarCategoriaStatus();

// Depois do 2º quiz/entrevista concluído na sessão, promove de liga uma vez
// -- garante que dá pra mostrar o toast de "subiu de liga" na apresentação
// sem depender de sorte ou de ter outros estudantes cadastrados.
const avaliarPromocaoDemo = () => {
  estado.quizzesEnviados += 1;
  if (estado.quizzesEnviados === 2 && estado.liga !== LIGAS[LIGAS.length - 1]) {
    const ligaAnterior = estado.liga;
    estado.liga = LIGAS[LIGAS.indexOf(ligaAnterior) + 1];
    return { direcao: 'subiu', liga_anterior: ligaAnterior, liga_nova: estado.liga };
  }
  return null;
};

const calcularEstadoOfensiva = () => ({
  treinou_hoje: estado.treinouHoje,
  em_risco: estado.ofensiva_dias > 0 && !estado.treinouHoje,
});

// A ofensiva conta dias, não ações: só o primeiro treino do dia soma +1.
const registrarTreinoDoDia = () => {
  if (!estado.treinouHoje) {
    estado.treinouHoje = true;
    estado.ofensiva_dias += 1;
  }
};

const calcularMatchVagas = () => {
  const habEstudante = new Set(estado.habilidades);
  return VAGAS.map((vaga) => {
    const habVaga = new Set(vaga.habilidades_exigidas);
    const emComum = [...habVaga].filter((h) => habEstudante.has(h));
    let percentual = Math.round((emComum.length / Math.max(habVaga.size, 1)) * 100);
    const combinaComCurso = Boolean(estado.itinerario) && vaga.area_itinerario === estado.itinerario;
    if (combinaComCurso) percentual = Math.min(100, percentual + 20);
    return { ...vaga, percentual_match: percentual, combina_com_curso: combinaComCurso };
  }).sort((a, b) => (b.combina_com_curso - a.combina_com_curso) || (b.percentual_match - a.percentual_match));
};

const construirCalendarioMes = (ano, mes) => {
  const hoje = new Date();
  if (ano !== hoje.getFullYear() || mes !== hoje.getMonth() + 1) return [];
  const dias = [];
  for (let i = 0; i < estado.ofensiva_dias; i += 1) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - i);
    if (data.getMonth() + 1 !== mes) break;
    dias.push({ data: data.toISOString().slice(0, 10), status: i === 2 ? 'congelado' : 'feito' });
  }
  return dias;
};

const construirRanking = () => {
  const liga = estado.liga;
  // Grupo cheio de 30, como no backend (TAMANHO_GRUPO_LIGA): os 10 primeiros
  // sobem, os 10 do meio ficam e os 10 últimos caem. O estudante começa
  // logo abaixo da zona de promoção, então um quiz já faz ele subir.
  const colegas = [
    'Bianca Ferreira', 'Lucas Andrade', 'Júlia Martins', 'Gabriel Souza', 'Ana Clara Lima',
    'Matheus Rocha', 'Beatriz Nunes', 'Rafael Gomes', 'Isabela Duarte', 'Guilherme Pires',
    'Mariana Costa', 'Enzo Ribeiro', 'Laura Mendes', 'Davi Carvalho', 'Sofia Teixeira',
    'Pedro Henrique', 'Lívia Barbosa', 'Arthur Moreira', 'Helena Castro', 'Miguel Araújo',
    'Valentina Dias', 'Heitor Correia', 'Manuela Pinto', 'Bernardo Freitas', 'Alice Cardoso',
    'Lorenzo Batista', 'Cecília Ramos', 'Samuel Vieira', 'Larissa Alves',
  ];
  const categoriaPorXp = (xp) => (xp >= 400 ? '👔 Pronto para a Dinâmica' : xp >= 150 ? '⚔️ Sobrevivente do RH' : '🌌 Na Jornada');
  const pares = [
    ...colegas.map((nome, i) => {
      const xp = Math.max(31 - i, 300 - i * 12 - (i > 9 ? 25 : 0));
      return { nome, xp_semanal: xp, categoria: categoriaPorXp(xp) };
    }),
    { nome: estado.nome_exibicao || estado.nome, xp_semanal: estado.xp_semanal, categoria: estado.categoria_status, voce: true },
  ].sort((a, b) => b.xp_semanal - a.xp_semanal);

  // Mesma regra de vagas_das_zonas() no backend.
  const tamanho = pares.length;
  const vagasPromocao = Math.min(10, Math.max(1, Math.floor(tamanho / 3)));
  const vagasRebaixamento = tamanho < 4 ? 0 : Math.min(10, Math.floor(tamanho / 3));
  const ranking = pares.map((pessoa, idx) => {
    const posicao = idx + 1;
    let zona = null;
    if (posicao <= vagasPromocao && liga !== LIGAS[LIGAS.length - 1]) zona = 'promocao';
    else if (posicao > tamanho - vagasRebaixamento && liga !== LIGAS[0]) zona = 'rebaixamento';
    return { posicao, nome: pessoa.nome, xp_semanal: pessoa.xp_semanal, categoria: pessoa.categoria, zona, voce: Boolean(pessoa.voce) };
  });

  return { liga, liga_emoji: '🏆', ranking };
};

// Currículo do modo demo: sem IA, então extrai do texto digitado as frases
// que descrevem algo que o estudante fez (curso, projeto, grêmio...) e
// reconhece algumas habilidades comuns -- o suficiente pra demo ser coerente.
const VERBOS_EXPERIENCIA = /(fiz|faço|participei|participo|ajudo|ajudei|organizo|organizei|trabalho|trabalhei|criei|crio|desenvolvi|monitor|voluntári|curso|projeto|grêmio|olimpíada|feira)/i;
const HABILIDADES_CONHECIDAS = ['Python', 'SQL', 'Excel', 'Power BI', 'JavaScript', 'React', 'HTML', 'CSS', 'Arduino', 'Robótica', 'Matemática', 'Inglês', 'Espanhol', 'Redação', 'Pacote Office', 'Canva', 'Atendimento'];
const SOFT_POR_PALAVRA = [
  [/equipe|grupo|grêmio|time/i, 'Trabalho em Equipe'],
  [/organiz/i, 'Organização'],
  [/apresent|comunic|falar/i, 'Comunicação'],
  [/lider|coorden/i, 'Liderança'],
  [/ajud|volunt/i, 'Colaboração'],
  [/aprend|curios|estudo|estudar/i, 'Vontade de Aprender'],
];

const montarCurriculoDemo = (texto) => {
  const frases = texto.split(/[.;,\n]|\s+e\s+(?=(?:fiz|faço|participo|participei|ajudo|ajudei|organizo|trabalho|criei|desenvolvi))/i)
    .map((f) => f.trim())
    .filter((f) => f.length > 8 && VERBOS_EXPERIENCIA.test(f))
    .map((f) => f.charAt(0).toUpperCase() + f.slice(1));
  const textoMinusculo = texto.toLowerCase();
  const hardDoTexto = HABILIDADES_CONHECIDAS.filter((h) => textoMinusculo.includes(h.toLowerCase()));
  const soft = SOFT_POR_PALAVRA.filter(([re]) => re.test(texto)).map(([, nome]) => nome);
  return {
    experiencias: frases.slice(0, 5),
    hard_skills: [...new Set([...hardDoTexto, ...estado.habilidades])].slice(0, 8),
    soft_skills: soft.length ? soft : ['Trabalho em Equipe', 'Comunicação', 'Adaptabilidade'],
  };
};

const respostaFake = (dados, status = 200) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => clone(dados),
});

const erroFake = (detail, status = 400) => respostaFake({ detail }, status);

const atenderAdmin = (metodo, caminho, query, corpo, token) => {
  if (metodo === 'POST' && caminho === '/api/admin/login') {
    if (corpo.senha !== SENHA_ADMIN_DEMO) return erroFake('Senha incorreta', 401);
    return respostaFake({ token: TOKEN_ADMIN_DEMO });
  }
  if (token !== TOKEN_ADMIN_DEMO) return erroFake('Acesso restrito à escola. Faça login no painel.', 401);

  const xpMaximo = Math.max(0, ...ALUNOS.map((a) => a.xp_total));
  const validarCpf = (cpfDigitado, ignorarId) => {
    const cpf = String(cpfDigitado || '').replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return [null, erroFake('CPF inválido — confira os números', 400)];
    for (const tamanho of [9, 10]) {
      let soma = 0;
      for (let i = 0; i < tamanho; i += 1) soma += Number(cpf[i]) * (tamanho + 1 - i);
      if (((soma * 10) % 11) % 10 !== Number(cpf[tamanho])) return [null, erroFake('CPF inválido — confira os números', 400)];
    }
    const existente = ALUNOS.find((a) => a.cpf === cpf && a.id !== ignorarId);
    if (existente) return [null, erroFake(`Esse CPF já está cadastrado (${existente.nome})`, 409)];
    return [cpf, null];
  };
  const nomesOcupados = (ignorarId) => new Set(ALUNOS.filter((a) => a.id !== ignorarId).map((a) => a.nome_exibicao.toLowerCase()));

  if (metodo === 'GET' && caminho === '/api/admin/resumo') {
    const porIt = ITINERARIOS.map((it) => ({ itinerario: it.nome, total: ALUNOS.filter((a) => a.itinerario === it.nome).length }));
    const semIt = ALUNOS.filter((a) => !a.itinerario).length;
    return respostaFake({
      total_alunos: ALUNOS.length,
      total_turmas: TURMAS.length,
      total_vagas: VAGAS.length,
      total_indicacoes: [...indicacoes.values()].reduce((t, m) => t + m.size, 0),
      alunos_por_itinerario: semIt ? [...porIt, { itinerario: null, total: semIt }] : porIt,
    });
  }
  if (metodo === 'GET' && caminho === '/api/admin/itinerarios') return respostaFake({ itinerarios: ITINERARIOS.map((it) => it.nome) });

  if (metodo === 'GET' && caminho === '/api/admin/turmas') {
    return respostaFake(TURMAS.map((t) => ({ ...t, total_alunos: ALUNOS.filter((a) => a.turma_id === t.id).length })));
  }
  if (metodo === 'POST' && caminho === '/api/admin/turmas') {
    const nome = (corpo.nome || '').trim();
    if (TURMAS.some((t) => t.nome.toLowerCase() === nome.toLowerCase())) return erroFake('Já existe uma turma com esse nome', 409);
    const turma = { id: proximaTurmaId++, nome, turno: corpo.turno || null };
    TURMAS.push(turma);
    return respostaFake({ ...turma, total_alunos: 0 }, 201);
  }

  if (metodo === 'GET' && caminho === '/api/admin/estudantes') {
    return respostaFake([...ALUNOS].sort((a, b) => b.xp_total - a.xp_total).map(alunoParaApi));
  }
  if (metodo === 'POST' && caminho === '/api/admin/estudantes') {
    const [cpf, erroCpf] = validarCpf(corpo.cpf);
    if (erroCpf) return erroCpf;
    if (ALUNOS.some((a) => a.email === corpo.email)) return erroFake('Já existe um aluno com esse e-mail', 409);
    const nome = corpo.nome.trim();
    const aluno = {
      id: proximoAlunoId++, nome, nome_exibicao: escolherNomeExibicao(nome, nomesOcupados()), cpf,
      data_nascimento: corpo.data_nascimento || null, email: corpo.email, turma_id: corpo.turma_id ?? null,
      itinerario: corpo.itinerario || null, habilidades: corpo.habilidades || [], xp_total: 0, ofensiva_dias: 0,
      taxa_acerto_quiz: null, liga: 'Bronze', total_candidaturas: 0,
    };
    ALUNOS.push(aluno);
    return respostaFake(alunoParaApi(aluno), 201);
  }
  const matchAluno = metodo === 'PUT' && caminho.match(/^\/api\/admin\/estudantes\/(\d+)$/);
  if (matchAluno) {
    const aluno = ALUNOS.find((a) => a.id === Number(matchAluno[1]));
    if (!aluno) return erroFake('Aluno não encontrado', 404);
    if (corpo.cpf) {
      const [cpf, erroCpf] = validarCpf(corpo.cpf, aluno.id);
      if (erroCpf) return erroCpf;
      aluno.cpf = cpf;
    }
    if (corpo.nome && corpo.nome.trim() !== aluno.nome) {
      aluno.nome = corpo.nome.trim();
      aluno.nome_exibicao = escolherNomeExibicao(aluno.nome, nomesOcupados(aluno.id));
    }
    ['data_nascimento', 'email', 'turma_id', 'itinerario', 'habilidades'].forEach((campo) => {
      if (campo in corpo) aluno[campo] = corpo[campo];
    });
    if (aluno.id === estado.alunoId) {
      Object.assign(estado, { nome: aluno.nome, nome_exibicao: aluno.nome_exibicao, itinerario: aluno.itinerario, habilidades: aluno.habilidades, email: aluno.email });
    }
    return respostaFake(alunoParaApi(aluno));
  }

  if (metodo === 'GET' && caminho === '/api/admin/vagas') {
    return respostaFake([...VAGAS].sort((a, b) => b.id - a.id).map((v) => ({ ...v, total_indicados: indicacoes.get(v.id)?.size ?? 0 })));
  }
  if (metodo === 'POST' && caminho === '/api/admin/vagas') {
    const vaga = { id: proximaVagaId++, razao_social_real: 'Parceiro Verificado', link_inscricao: null, ...corpo };
    VAGAS.push(vaga);
    return respostaFake({ ...vaga, total_indicados: 0 }, 201);
  }
  const matchRanking = metodo === 'GET' && caminho.match(/^\/api\/admin\/vagas\/(\d+)\/ranking$/);
  if (matchRanking) {
    const vaga = VAGAS.find((v) => v.id === Number(matchRanking[1]));
    if (!vaga) return erroFake('Vaga não encontrada', 404);
    const turmaId = query.get('turma_id');
    const soDoItinerario = query.get('somente_itinerario_da_vaga') === 'true';
    const indicadosDaVaga = indicacoes.get(vaga.id) || new Map();
    const ranking = ALUNOS
      .filter((a) => (turmaId ? String(a.turma_id) === turmaId : true))
      .filter((a) => (soDoItinerario && vaga.area_itinerario ? a.itinerario === vaga.area_itinerario : true))
      .map((a) => ({
        estudante_id: a.id, nome: a.nome, nome_exibicao: a.nome_exibicao, turma: nomeTurma(a.turma_id), itinerario: a.itinerario,
        xp_total: a.xp_total, ofensiva_dias: a.ofensiva_dias, taxa_acerto_quiz: a.taxa_acerto_quiz,
        ...calcularDesempenho(a, vaga, xpMaximo),
        candidatou_se: indicadosDaVaga.has(a.id) || (a.id === estado.alunoId && estado.candidaturas.has(vaga.id)),
        indicado: indicadosDaVaga.has(a.id),
      }))
      .sort((a, b) => b.pontuacao - a.pontuacao || b.xp_total - a.xp_total)
      .map((r, i) => ({ ...r, posicao: i + 1 }));
    return respostaFake({ vaga: { ...vaga, total_indicados: indicadosDaVaga.size }, ranking: ranking.slice(0, Number(query.get('limite') || 20)), total_avaliados: ranking.length });
  }
  const matchIndicar = metodo === 'POST' && caminho.match(/^\/api\/admin\/vagas\/(\d+)\/indicar$/);
  if (matchIndicar) {
    const vaga = VAGAS.find((v) => v.id === Number(matchIndicar[1]));
    if (!vaga) return erroFake('Vaga não encontrada', 404);
    const ids = corpo.estudante_ids || [];
    if (!ids.length || ids.some((id) => !ALUNOS.some((a) => a.id === id))) return erroFake('Algum aluno selecionado não existe', 400);
    const mapa = indicacoes.get(vaga.id) || new Map();
    let novas = 0;
    ids.forEach((id) => {
      if (!mapa.has(id)) novas += 1;
      mapa.set(id, calcularDesempenho(ALUNOS.find((a) => a.id === id), vaga, xpMaximo).pontuacao);
    });
    indicacoes.set(vaga.id, mapa);
    return respostaFake({ sucesso: true, indicados: ids.length, novas_indicacoes: novas, mensagem: `${ids.length} aluno(s) indicado(s) para ${vaga.titulo_vaga} — ${vaga.empresa}.` });
  }
  return erroFake(`Rota fake não implementada: ${metodo} ${caminho}`, 404);
};

export const atenderRequisicaoFake = (path, options = {}) => {
  const metodo = (options.method || 'GET').toUpperCase();
  const [caminho, queryString] = path.split('?');
  const query = new URLSearchParams(queryString || '');
  const corpo = options.body ? JSON.parse(options.body) : {};

  if (caminho.startsWith('/api/admin')) return atenderAdmin(metodo, caminho, query, corpo, options.token);

  // POST /auth/entrar -- a senha é o CPF
  if (metodo === 'POST' && caminho === '/api/auth/entrar') {
    const cpf = String(corpo.cpf || '').replace(/\D/g, '');
    const aluno = ALUNOS.find((a) => a.cpf === cpf);
    if (!aluno) return erroFake('Senha não encontrada. Confira o CPF digitado ou fale com a coordenação.', 401);
    entrarComo(aluno);
    return respostaFake({ token: `demo-aluno-${aluno.id}`, estudante: { id: aluno.id, nome: aluno.nome, email: aluno.email } });
  }

  // Rotas do aluno exigem o token do login (itinerários é pública)
  if (caminho !== '/api/quiz/itinerarios') {
    const aluno = alunoDoToken(options.token);
    if (!aluno) return erroFake('Sessão expirada. Entre de novo com seu CPF.', 401);
    entrarComo(aluno);
  }
  regenerarVidas();

  // GET /auth/me
  if (metodo === 'GET' && caminho === '/api/auth/me') {
    return respostaFake({ id: 1, nome: estado.nome, email: estado.email, linkedin: estado.linkedin, deve_trocar_senha: estado.precisaTrocarSenha });
  }

  // PUT /auth/conta
  if (metodo === 'PUT' && caminho === '/api/auth/conta') {
    estado.linkedin = corpo.linkedin || null;
    return respostaFake({ id: 1, nome: estado.nome, email: estado.email, linkedin: estado.linkedin });
  }

  // GET /estudante/me/status
  if (metodo === 'GET' && caminho === '/api/estudante/me/status') {
    const ofensiva = calcularEstadoOfensiva();
    return respostaFake({
      vidas: estado.vidas,
      vidas_maximas: VIDAS_MAXIMAS,
      minutos_para_regenerar_vida: MINUTOS_PARA_REGENERAR_VIDA,
      acertos_seguidos_para_vida: ACERTOS_SEGUIDOS_PARA_VIDA,
      proxima_vida_em: estado.proxima_vida_em,
      moedas: estado.moedas,
      congelamentos_disponiveis: estado.congelamentos_disponiveis,
      quizzes_perfeitos_seguidos: estado.quizzes_perfeitos_seguidos,
      quizzes_perfeitos_para_bonus: 5,
      ofensiva_dias: estado.ofensiva_dias,
      treinou_hoje: ofensiva.treinou_hoje,
      ofensiva_em_risco: ofensiva.em_risco,
      itinerario: estado.itinerario,
      nome: estado.nome,
      nome_exibicao: estado.nome_exibicao,
      xp_total: estado.xp_total,
      nivel_gamificacao: estado.nivel_gamificacao,
      categoria_status: estado.categoria_status,
      liga: estado.liga,
    });
  }

  // GET /estudante/me/calendario
  if (metodo === 'GET' && caminho === '/api/estudante/me/calendario') {
    return respostaFake({ dias: construirCalendarioMes(Number(query.get('ano')), Number(query.get('mes'))) });
  }

  // GET /jobs/match
  if (metodo === 'GET' && caminho === '/api/jobs/match') {
    const vagas = calcularMatchVagas();
    return respostaFake({ vagas, pagina: 1, tamanho_pagina: 20, total: vagas.length });
  }

  // GET /jobs/minhas-candidaturas
  if (metodo === 'GET' && caminho === '/api/jobs/minhas-candidaturas') {
    return respostaFake([...estado.candidaturas].map((id, idx) => {
      const vaga = VAGAS.find((v) => v.id === id);
      return { id: idx + 1, vaga_id: id, titulo_vaga: vaga?.titulo_vaga, empresa: vaga?.empresa, status: 'enviada', indicada_pela_escola: Boolean(indicacoes.get(id)?.has(estado.alunoId)), criada_em: new Date().toISOString() };
    }));
  }

  // GET /jobs/{id}
  const matchDetalheVaga = metodo === 'GET' && caminho.match(/^\/api\/jobs\/(\d+)$/);
  if (matchDetalheVaga) {
    const vaga = VAGAS.find((v) => v.id === Number(matchDetalheVaga[1]));
    if (!vaga) return erroFake('Vaga não encontrada', 404);
    const indicado = Boolean(indicacoes.get(vaga.id)?.has(estado.alunoId));
    return respostaFake({ ...vaga, ja_candidatado: indicado || estado.candidaturas.has(vaga.id), indicado_pela_escola: indicado });
  }

  // POST /jobs/apply-meta
  if (metodo === 'POST' && caminho === '/api/jobs/apply-meta') {
    const vaga = VAGAS.find((v) => v.id === corpo.vaga_id);
    if (!vaga) return erroFake('Vaga não encontrada', 404);
    const jaExistia = estado.candidaturas.has(vaga.id);
    estado.candidaturas.add(vaga.id);
    return respostaFake({
      sucesso: true,
      ja_existia: jaExistia,
      candidatura_id: vaga.id,
      status: 'enviada',
      mensagem: jaExistia
        ? `Você já tinha se candidatado pra ${vaga.empresa}. Status atual: enviada.`
        : `Candidatura enviada com sucesso pra ${vaga.empresa}!`,
    }, 201);
  }

  // GET /quiz/itinerarios
  if (metodo === 'GET' && caminho === '/api/quiz/itinerarios') {
    return respostaFake({ itinerarios: ITINERARIOS });
  }

  // POST /itinerario/escolher -- bloqueado: quem define é a escola
  if (metodo === 'POST' && caminho === '/api/itinerario/escolher') {
    return erroFake('O itinerário é definido pela escola. Fale com a coordenação se estiver errado.', 403);
  }

  // POST /quiz/generate
  if (metodo === 'POST' && caminho === '/api/quiz/generate') {
    if (estado.vidas <= 0) {
      return respostaFake({ detail: { mensagem: 'Você está sem vidas. Espere regenerar ou compre com moedas.', proxima_vida_em: estado.proxima_vida_em } }, 403);
    }
    quizAtivo = {
      quiz_id: proximoQuizId++,
      tema: estado.itinerario || 'Soft skills e trabalho em equipe',
      gabarito: sortearPerguntas(estado.itinerario),
      respostas: [],
      dicas_usadas: 0,
    };
    return respostaFake({
      quiz_id: quizAtivo.quiz_id,
      itinerario: estado.itinerario,
      vidas: estado.vidas,
      tema: quizAtivo.tema,
      perguntas: quizAtivo.gabarito.map((p) => ({ pergunta: p.pergunta, opcoes: p.opcoes })),
      dicas_disponiveis: DICAS_POR_QUIZ,
      pulos_disponiveis: PULOS_POR_QUIZ,
      acertos_seguidos_para_vida: ACERTOS_SEGUIDOS_PARA_VIDA,
    });
  }

  // POST /quiz/responder
  if (metodo === 'POST' && caminho === '/api/quiz/responder') {
    if (!quizAtivo || quizAtivo.quiz_id !== corpo.quiz_id) return erroFake('Quiz não encontrado.', 404);
    const gabaritoPergunta = quizAtivo.gabarito[corpo.indice_pergunta];
    const registro = corpo.opcao_selecionada === null
      ? { pulou: true, correta: false }
      : { pulou: false, correta: corpo.opcao_selecionada === gabaritoPergunta.resposta_correta_index };
    quizAtivo.respostas.push(registro);
    const combo = comboFinal(quizAtivo.respostas);
    return respostaFake({
      correta: registro.pulou ? null : registro.correta,
      resposta_correta_index: gabaritoPergunta.resposta_correta_index,
      explicacao: gabaritoPergunta.explicacao,
      combo,
      ganhou_vida_combo: combo > 0 && combo % ACERTOS_SEGUIDOS_PARA_VIDA === 0,
    });
  }

  // POST /quiz/dica
  if (metodo === 'POST' && caminho === '/api/quiz/dica') {
    if (!quizAtivo || quizAtivo.quiz_id !== corpo.quiz_id) return erroFake('Quiz não encontrado.', 404);
    if (quizAtivo.dicas_usadas >= DICAS_POR_QUIZ) return erroFake('Limite de dicas por quiz atingido.', 403);
    const corretaIdx = quizAtivo.gabarito[corpo.indice_pergunta].resposta_correta_index;
    const opcoesErradas = [0, 1, 2, 3].filter((i) => i !== corretaIdx);
    const opcaoEliminada = opcoesErradas[Math.floor(Math.random() * opcoesErradas.length)];
    quizAtivo.dicas_usadas += 1;
    return respostaFake({ opcao_eliminada: opcaoEliminada, dicas_usadas: quizAtivo.dicas_usadas });
  }

  // POST /quiz/submit
  if (metodo === 'POST' && caminho === '/api/quiz/submit') {
    if (!quizAtivo || quizAtivo.quiz_id !== corpo.quiz_id) return erroFake('Quiz não encontrado.', 404);
    const total = quizAtivo.gabarito.length;
    const acertos = quizAtivo.respostas.filter((r) => r.correta).length;
    const pulos = quizAtivo.respostas.filter((r) => r.pulou).length;
    const errados = Math.max(0, total - acertos - pulos);
    const xpConcedido = acertos * 8;

    for (let i = 0; i < errados; i += 1) perderVida();
    const vidasRecuperadasCombo = ganharVidas(vidasGanhasPorCombo(quizAtivo.respostas));
    let vidaBonusGanha = false;
    if (total > 0 && acertos === total) {
      estado.quizzes_perfeitos_seguidos += 1;
      if (estado.quizzes_perfeitos_seguidos >= 5) {
        estado.quizzes_perfeitos_seguidos = 0;
        vidaBonusGanha = ganharVidas(1) > 0;
      }
    } else {
      estado.quizzes_perfeitos_seguidos = 0;
    }

    estado.xp_total += xpConcedido;
    estado.xp_semanal += xpConcedido;
    if (estado.xp_total >= 300 * estado.nivel_gamificacao) estado.nivel_gamificacao += 1;
    atualizarCategoriaStatus();
    estado.moedas += Math.max(1, Math.round(xpConcedido * 0.1));
    registrarTreinoDoDia();

    const mudancaLiga = avaliarPromocaoDemo();
    quizAtivo = null;

    return respostaFake({
      acertos,
      total,
      xp_concedido: xpConcedido,
      novos_pontos_totais: estado.xp_total,
      nivel_atual: estado.nivel_gamificacao,
      ofensiva_dias: estado.ofensiva_dias,
      categoria_status: estado.categoria_status,
      missoes_diarias: 1,
      vidas: estado.vidas,
      moedas: estado.moedas,
      congelamentos_disponiveis: estado.congelamentos_disponiveis,
      quizzes_perfeitos_seguidos: estado.quizzes_perfeitos_seguidos,
      vida_bonus_ganha: vidaBonusGanha,
      vidas_recuperadas_combo: vidasRecuperadasCombo,
      proxima_vida_em: estado.proxima_vida_em,
      liga: estado.liga,
      mudanca_liga: mudancaLiga,
    });
  }

  // POST /vidas/comprar
  if (metodo === 'POST' && caminho === '/api/vidas/comprar') {
    if (estado.vidas >= VIDAS_MAXIMAS) return erroFake('Suas vidas já estão cheias.', 400);
    if (estado.moedas < CUSTO_MOEDAS_POR_VIDA) return erroFake(`Moedas insuficientes. Precisa de ${CUSTO_MOEDAS_POR_VIDA} moedas.`, 400);
    estado.moedas -= CUSTO_MOEDAS_POR_VIDA;
    estado.vidas += 1;
    return respostaFake({ sucesso: true, vidas: estado.vidas, moedas: estado.moedas });
  }

  // GET /ranking
  if (metodo === 'GET' && caminho === '/api/ranking') {
    return respostaFake(construirRanking());
  }

  // POST /resume/generate
  if (metodo === 'POST' && caminho === '/api/resume/generate') {
    const extraido = montarCurriculoDemo(corpo.habilidades_texto || '');
    const area = estado.itinerario || 'Tecnologia';
    return respostaFake({
      sucesso: true,
      curriculo: {
        nome_candidato: estado.nome,
        objetivo_profissional: `Estudante do Ensino Médio em busca da primeira oportunidade como Jovem Aprendiz na área de ${area}, com vontade de aplicar na prática o que venho aprendendo e de crescer junto com a equipe.`,
        ...extraido,
        sugestao_areas_atuacao: estado.itinerario
          ? [`Jovem Aprendiz em ${estado.itinerario}`, 'Suporte Operacional', 'Assistente Administrativo']
          : ['Jovem Aprendiz', 'Atendimento ao Cliente', 'Suporte Operacional'],
      },
    }, 201);
  }

  // POST /resume/export-linkedin
  if (metodo === 'POST' && caminho === '/api/resume/export-linkedin') {
    return respostaFake({
      status: 'sucesso',
      provedor: 'LinkedIn Partner API v2 (2026 Sandbox)',
      mensagem: `Sucesso! O perfil de ${estado.nome} foi sincronizado de forma automática.`,
      secoes_atualizadas: ['Summary', 'Skills', 'TargetJobs'],
    });
  }

  // POST /chat/message
  if (metodo === 'POST' && caminho === '/api/chat/message') {
    const mensagem = (corpo.mensagem_usuario || '').trim();
    const respostaFraca = mensagem.length < 5;
    const xpConcedido = respostaFraca ? 0 : 15 + Math.floor(Math.random() * 26);
    const proximaPergunta = PERGUNTAS_ENTREVISTA[estado.respostaEntrevistaIndex % PERGUNTAS_ENTREVISTA.length];
    estado.respostaEntrevistaIndex += 1;

    estado.xp_total += xpConcedido;
    estado.xp_semanal += xpConcedido;
    if (estado.xp_total >= 300 * estado.nivel_gamificacao) estado.nivel_gamificacao += 1;
    atualizarCategoriaStatus();
    if (xpConcedido > 0) estado.moedas += Math.max(1, Math.round(xpConcedido * 0.1));
    if (!respostaFraca) registrarTreinoDoDia();
    const mudancaLiga = avaliarPromocaoDemo();

    return respostaFake({
      feedback_ia: respostaFraca
        ? 'Atenção! Respostas muito curtas reduzem suas chances com o recrutador. Tente elaborar mais.'
        : 'Boa resposta! Você demonstra clareza sobre suas competências.',
      resposta_ia: proximaPergunta,
      xp_concedido: xpConcedido,
      novos_pontos_totais: estado.xp_total,
      nivel_atual: estado.nivel_gamificacao,
      ofensiva_dias: estado.ofensiva_dias,
      categoria_status: estado.categoria_status,
      missoes_diarias: 1,
      moedas: estado.moedas,
      liga: estado.liga,
      mudanca_liga: mudancaLiga,
    });
  }

  return erroFake(`Rota fake não implementada: ${metodo} ${caminho}`, 404);
};
