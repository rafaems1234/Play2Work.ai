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
];

const VAGAS = [
  { id: 1, titulo_vaga: 'Jovem Aprendiz - Ciência de Dados', empresa: 'Vivo Telefônica', razao_social_real: 'TELEFÔNICA BRASIL S.A.', localizacao: 'São Paulo - SP', tipo_modalidade: 'Híbrido', habilidades_exigidas: ['Python', 'SQL', 'Análise de Dados'], area_itinerario: 'Tecnologia e Ciência de Dados', descricao_completa: 'Você vai apoiar o time de dados da Vivo em análises de churn e consumo, aprendendo Python, SQL e visualização de dados na prática.', link_inscricao: 'https://vagas.vivo.com.br' },
  { id: 2, titulo_vaga: 'Desenvolvedor Front-end Junior', empresa: 'TechSoluções', razao_social_real: 'Parceiro Verificado VIVO', localizacao: 'Remoto', tipo_modalidade: 'Remoto', habilidades_exigidas: ['React', 'JavaScript', 'CSS'], area_itinerario: 'Tecnologia e Ciência de Dados', descricao_completa: 'Squad pequeno construindo produtos web com React. Você vai revisar PRs de verdade e aprender boas práticas de front-end com mentoria semanal.', link_inscricao: 'https://techsolucoes.com/carreiras' },
  { id: 3, titulo_vaga: 'Assistente de TI', empresa: 'Suzano Papel e Celulose', razao_social_real: 'SUZANO S.A.', localizacao: 'Três Lagoas - MS', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Lógica de Programação', 'SQL'], area_itinerario: 'Tecnologia e Ciência de Dados', descricao_completa: 'Suporte ao time de infraestrutura de TI da unidade fabril: manutenção de estações de trabalho e apoio em chamados.', link_inscricao: 'https://suzano.gupy.io' },
  { id: 4, titulo_vaga: 'Jovem Aprendiz - Automação e Robótica', empresa: 'Bosch Manufatura', razao_social_real: 'ROBERT BOSCH LTDA', localizacao: 'Campinas - SP', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Lógica de Programação', 'Arduino', 'Trabalho em Equipe'], area_itinerario: 'Robótica e Automação', descricao_completa: 'Você vai acompanhar a equipe de automação industrial em projetos de prototipagem com Arduino e sensores.', link_inscricao: 'https://carreiras.bosch.com.br' },
  { id: 5, titulo_vaga: 'Estagiário de Departamento Jurídico', empresa: 'Machado Advogados Associados', razao_social_real: 'Parceiro Verificado VIVO', localizacao: 'São Paulo - SP', tipo_modalidade: 'Híbrido', habilidades_exigidas: ['Comunicação', 'Organização', 'Redação'], area_itinerario: 'Ciências Jurídicas / Serviços Jurídicos', descricao_completa: 'Apoio em rotinas administrativas de um escritório de Direito Digital e LGPD.', link_inscricao: 'https://machadoadvogados.com.br/carreiras' },
  { id: 6, titulo_vaga: 'Jovem Aprendiz - Laboratório de Análises', empresa: 'Instituto Butantan', razao_social_real: 'INSTITUTO BUTANTAN', localizacao: 'São Paulo - SP', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Biologia', 'Química', 'Organização'], area_itinerario: 'Ciências da Natureza e Matemática', descricao_completa: 'Apoio em rotinas de laboratório sob supervisão de pesquisadores: preparo de amostras e registro de dados experimentais.', link_inscricao: 'https://butantan.gov.br/trabalhe-conosco' },
];

const QUIZ_FALLBACK = [
  { pergunta: 'Você chega 10 minutos atrasado para uma reunião online importante. Qual a melhor atitude?', opcoes: ['Entrar sem avisar e fingir que não houve atraso', 'Entrar, pedir desculpas rapidamente e focar no que está sendo dito', 'Não entrar mais, já que já perdeu o começo', 'Mandar mensagem culpando o trânsito ou a internet em detalhes'], resposta_correta_index: 1, explicacao: 'Reconhecer o atraso com objetividade e seguir em frente demonstra profissionalismo sem gerar mais atrito.' },
  { pergunta: 'Qual dessas é uma soft skill valorizada por recrutadores?', opcoes: ['Comunicação clara', 'Velocidade de digitação', 'Memorização de fórmulas', 'Uso avançado de planilhas'], resposta_correta_index: 0, explicacao: 'Soft skills são competências comportamentais — comunicação clara é uma das mais buscadas em qualquer área.' },
  { pergunta: 'Você recebeu um feedback negativo do seu líder. O que fazer?', opcoes: ['Ignorar, já que é só opinião', 'Discutir na hora para provar que está certo', 'Ouvir com atenção e perguntar como pode melhorar', 'Evitar aquele líder daí em diante'], resposta_correta_index: 2, explicacao: 'Feedback é uma ferramenta de crescimento — ouvir e buscar melhorar é o que diferencia profissionais em evolução.' },
  { pergunta: 'Num e-mail profissional, o que é mais adequado?', opcoes: ['Escrever tudo em letras maiúsculas para dar ênfase', 'Usar linguagem informal e gírias', 'Ser claro, objetivo e educado, com saudação e assinatura', 'Enviar sem assunto para ser mais rápido'], resposta_correta_index: 2, explicacao: 'Clareza, objetividade e educação são a base de uma comunicação profissional eficaz por e-mail.' },
  { pergunta: 'Você tem 3 tarefas para hoje e pouco tempo. Qual a melhor estratégia?', opcoes: ['Fazer todas ao mesmo tempo', 'Priorizar a mais urgente/importante primeiro', 'Fazer a mais fácil só para riscar da lista', 'Esperar até o fim do dia para decidir'], resposta_correta_index: 1, explicacao: 'Priorizar por urgência e importância é a base de uma boa gestão de tempo.' },
  { pergunta: 'Um colega te pede ajuda numa tarefa enquanto você está no meio de outra urgente. O que fazer?', opcoes: ['Ignorar o pedido sem responder', 'Parar tudo imediatamente pra ajudar', 'Explicar a situação e combinar um horário pra ajudar depois', 'Ajudar só parte do tempo, sem avisar nada'], resposta_correta_index: 2, explicacao: 'Comunicar a situação com transparência e negociar um horário mostra organização sem deixar o colega no vácuo.' },
  { pergunta: 'Qual desses é um exemplo de escuta ativa numa reunião?', opcoes: ['Mexer no celular enquanto o outro fala', 'Interromper pra dar sua opinião', 'Fazer perguntas e resumir o que entendeu', 'Ficar calado sem demonstrar reação'], resposta_correta_index: 2, explicacao: 'Escuta ativa envolve confirmar entendimento — perguntar e resumir mostra que você realmente está prestando atenção.' },
  { pergunta: 'Você cometeu um erro num relatório que já foi enviado. Qual a melhor atitude?', opcoes: ['Esperar alguém perceber', 'Avisar o responsável e propor a correção', 'Corrigir sem falar nada pra ninguém notar', 'Culpar quem revisou antes de você'], resposta_correta_index: 1, explicacao: 'Assumir o erro e propor solução rapidamente é o que constrói confiança profissional — esconder só piora.' },
  { pergunta: 'Numa entrevista de emprego, o que passa mais credibilidade?', opcoes: ['Dizer que não tem nenhum ponto fraco', 'Dar exemplos concretos de situações reais', 'Falar mal do emprego anterior', 'Responder tudo de forma genérica'], resposta_correta_index: 1, explicacao: 'Exemplos concretos e reais são muito mais convincentes do que respostas genéricas ou decoradas.' },
  { pergunta: 'O que caracteriza um bom trabalho em equipe?', opcoes: ['Cada um cuidar só da própria parte, sem se comunicar', 'Compartilhar informações e ajudar quando possível', 'Competir pra aparecer mais que os colegas', 'Esperar que o líder resolva tudo sozinho'], resposta_correta_index: 1, explicacao: 'Comunicação e colaboração são a base de qualquer equipe que funciona bem de verdade.' },
];

const PERGUNTAS_ENTREVISTA = [
  'Legal! Me conta agora sobre uma dificuldade que você teve recentemente e como lidou com ela.',
  'Ótimo. E como você organiza seu tempo entre estudos e outras responsabilidades?',
  'Show. Me dá um exemplo de quando você trabalhou em equipe pra resolver algo.',
  'Perfeito. Por que você tem interesse nessa área específica de atuação?',
  'Boa! O que você faria se discordasse de uma decisão do seu líder?',
];

const VIDAS_MAXIMAS = 5;
const CUSTO_MOEDAS_POR_VIDA = 50;
const DICAS_POR_QUIZ = 2;
const PULOS_POR_QUIZ = 2;
const LIGA_EMOJI = { Bronze: '🥉', Prata: '🥈', Ouro: '🥇', Diamante: '💎' };
const LIGAS = ['Bronze', 'Prata', 'Ouro', 'Diamante'];

const estado = {
  nome: 'Rafael Sozza',
  email: 'rafael@escola.com',
  linkedin: 'https://linkedin.com/in/rafael-sozza',
  habilidades: ['Python', 'SQL', 'React', 'Análise de Dados', 'Lógica de Programação'],
  xp_total: 270,
  xp_semanal: 180,
  nivel_gamificacao: 3,
  ofensiva_dias: 6,
  itinerario: null,
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
  respostaEntrevistaIndex: 0,
};

let quizAtivo = null;
let proximoQuizId = 1;

const clone = (valor) => JSON.parse(JSON.stringify(valor));

const atualizarCategoriaStatus = () => {
  if (estado.xp_total < 150) estado.categoria_status = '🌌 Na Jornada';
  else if (estado.xp_total < 400) estado.categoria_status = '⚔️ Sobrevivente do RH';
  else if (estado.xp_total < 800) estado.categoria_status = '👔 Pronto para a Dinâmica';
  else estado.categoria_status = '🚀 CONTRATADO!';
};

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
  treinou_hoje: false,
  em_risco: estado.ofensiva_dias > 0,
});

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
  const pares = [
    { nome: 'Bianca Ferreira', xp_semanal: 240, categoria: '👔 Pronto para a Dinâmica' },
    { nome: estado.nome, xp_semanal: estado.xp_semanal, categoria: estado.categoria_status },
    { nome: 'Lucas Andrade', xp_semanal: 160, categoria: '⚔️ Sobrevivente do RH' },
    { nome: 'Mariana Costa', xp_semanal: 95, categoria: '🌌 Na Jornada' },
    { nome: 'Pedro Henrique', xp_semanal: 40, categoria: '🌌 Na Jornada' },
  ].sort((a, b) => b.xp_semanal - a.xp_semanal);

  const tamanho = pares.length;
  const ranking = pares.map((pessoa, idx) => {
    const posicao = idx + 1;
    let zona = null;
    if (posicao <= 3 && liga !== LIGAS[LIGAS.length - 1]) zona = 'promocao';
    else if (tamanho >= 4 && posicao > tamanho - 3 && liga !== LIGAS[0]) zona = 'rebaixamento';
    return { posicao, nome: pessoa.nome, xp_semanal: pessoa.xp_semanal, categoria: pessoa.categoria, zona };
  });

  return { liga, liga_emoji: LIGA_EMOJI[liga] || '🥉', ranking };
};

const respostaFake = (dados, status = 200) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => clone(dados),
});

const erroFake = (detail, status = 400) => respostaFake({ detail }, status);

export const atenderRequisicaoFake = (path, options = {}) => {
  const metodo = (options.method || 'GET').toUpperCase();
  const [caminho, queryString] = path.split('?');
  const query = new URLSearchParams(queryString || '');
  const corpo = options.body ? JSON.parse(options.body) : {};

  // GET /auth/me
  if (metodo === 'GET' && caminho === '/api/auth/me') {
    return respostaFake({ id: 1, nome: estado.nome, email: estado.email, linkedin: estado.linkedin, deve_trocar_senha: estado.precisaTrocarSenha });
  }

  // GET /estudante/me/status
  if (metodo === 'GET' && caminho === '/api/estudante/me/status') {
    const ofensiva = calcularEstadoOfensiva();
    return respostaFake({
      vidas: estado.vidas,
      vidas_maximas: VIDAS_MAXIMAS,
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
      return { id: idx + 1, vaga_id: id, titulo_vaga: vaga?.titulo_vaga, empresa: vaga?.empresa, status: 'enviada', criada_em: new Date().toISOString() };
    }));
  }

  // GET /jobs/{id}
  const matchDetalheVaga = metodo === 'GET' && caminho.match(/^\/api\/jobs\/(\d+)$/);
  if (matchDetalheVaga) {
    const vaga = VAGAS.find((v) => v.id === Number(matchDetalheVaga[1]));
    if (!vaga) return erroFake('Vaga não encontrada', 404);
    return respostaFake({ ...vaga, ja_candidatado: estado.candidaturas.has(vaga.id) });
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

  // POST /itinerario/escolher
  if (metodo === 'POST' && caminho === '/api/itinerario/escolher') {
    if (!ITINERARIOS.some((it) => it.nome === corpo.itinerario)) return erroFake('Itinerário inválido', 400);
    estado.itinerario = corpo.itinerario;
    return respostaFake({ itinerario: estado.itinerario });
  }

  // POST /quiz/generate
  if (metodo === 'POST' && caminho === '/api/quiz/generate') {
    if (estado.vidas <= 0) {
      return respostaFake({ detail: { mensagem: 'Você está sem vidas. Espere regenerar ou compre com moedas.', proxima_vida_em: estado.proxima_vida_em } }, 403);
    }
    quizAtivo = {
      quiz_id: proximoQuizId++,
      tema: estado.itinerario ? `Fundamentos de ${estado.itinerario}` : 'Soft skills e trabalho em equipe',
      gabarito: QUIZ_FALLBACK,
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
    return respostaFake({
      correta: registro.pulou ? null : registro.correta,
      resposta_correta_index: gabaritoPergunta.resposta_correta_index,
      explicacao: gabaritoPergunta.explicacao,
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

    estado.vidas = Math.max(0, estado.vidas - errados);
    let vidaBonusGanha = false;
    if (total > 0 && acertos === total) {
      estado.quizzes_perfeitos_seguidos += 1;
      if (estado.quizzes_perfeitos_seguidos >= 5) {
        estado.quizzes_perfeitos_seguidos = 0;
        if (estado.vidas < VIDAS_MAXIMAS) { estado.vidas += 1; vidaBonusGanha = true; }
      }
    } else {
      estado.quizzes_perfeitos_seguidos = 0;
    }

    estado.xp_total += xpConcedido;
    estado.xp_semanal += xpConcedido;
    if (estado.xp_total >= 300 * estado.nivel_gamificacao) estado.nivel_gamificacao += 1;
    atualizarCategoriaStatus();
    estado.moedas += Math.max(1, Math.round(xpConcedido * 0.1));
    estado.ofensiva_dias += 1;

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
    return respostaFake({
      sucesso: true,
      curriculo: {
        nome_candidato: estado.nome,
        objetivo_profissional: `Busco minha primeira oportunidade pra aplicar o que venho aprendendo em ${estado.itinerario || 'tecnologia'} e crescer com dedicação.`,
        hard_skills: estado.habilidades,
        soft_skills: ['Trabalho em Equipe', 'Comunicação', 'Adaptabilidade'],
        sugestao_areas_atuacao: estado.itinerario ? [estado.itinerario] : ['Atendimento ao Cliente', 'Suporte Operacional'],
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
    estado.ofensiva_dias += 1;
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
