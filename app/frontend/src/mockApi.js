import { idadeDe, hojeLocalIso } from './utils/formatos';
import { LIGAS as LIGAS_INFO } from './ligas.js';
import BANCO_QUESTOES from './data/banco_questoes.json';
import SITUACOES_LISTA from './data/situacoes.json';
import { criarMockTrilha } from './mockTrilha';
import { criarMockMensagens } from './mockMensagens';
import { conduzirDemo, PERGUNTA_INICIAL, PERGUNTA_RECOMECO } from './entrevistaDemo';
import { gerarCurriculoDemo } from './curriculoDemo';
import { statusPorXp, STATUS_CONTRATADO, STATUS_INICIAL } from './statusCarreira';
import { validarFicha, conferirContrato, STATUS_APRENDIZ } from './fichaPapDemo';

// Modo demonstração: simula todas as rotas da API inteiramente no navegador,
// com dados fictícios e uma "gamificação" leve simulada em memória -- pra dar
// pra apresentar o produto rodando só o front, sem precisar subir backend
// nem banco de dados. Ativado/desativado em api.js (ver DEMO_MODE).

const ITINERARIOS = [
  { nome: 'Serviços Jurídicos', descricao: 'Fundamentos do Direito, Direito Digital, LGPD, ética e rotinas administrativas de escritórios e departamentos jurídicos.' },
  { nome: 'Ciência de Dados', descricao: 'Análise de dados, Python e SQL, planilhas e visualização de dados aplicadas ao mercado de trabalho.' },
  { nome: 'Administração', descricao: 'Rotinas administrativas, finanças básicas, estoque, atendimento ao cliente e organização de documentos.' },
  { nome: 'Recursos Humanos', descricao: 'Recrutamento e seleção, departamento pessoal, legislação trabalhista básica (CLT), comunicação e clima organizacional.' },
  { nome: 'Mecatrônica', descricao: 'Mecânica, eletrônica e programação juntas: sensores, atuadores, Arduino e automação industrial.' },
  { nome: 'Inteligência Artificial', descricao: 'Como a IA funciona, aprendizado de máquina, uso responsável de ferramentas de IA, dados e ética.' },
];

const VAGAS = [
  { id: 1, titulo_vaga: 'Jovem Aprendiz - Ciência de Dados', empresa: 'Vivo Telefônica', razao_social_real: 'TELEFÔNICA BRASIL S.A.', localizacao: 'São Paulo - SP', tipo_modalidade: 'Híbrido', habilidades_exigidas: ['Python', 'SQL', 'Análise de Dados'], area_itinerario: 'Ciência de Dados', descricao_completa: 'Você vai apoiar o time de dados da Vivo em análises de churn e consumo, aprendendo Python, SQL e visualização de dados na prática.', link_inscricao: 'https://vagas.vivo.com.br' },
  { id: 2, titulo_vaga: 'Desenvolvedor Front-end Júnior', empresa: 'TechSoluções', razao_social_real: 'Parceiro Verificado', localizacao: 'Remoto', tipo_modalidade: 'Remoto', habilidades_exigidas: ['React', 'JavaScript', 'CSS'], area_itinerario: 'Ciência de Dados', descricao_completa: 'Squad pequeno construindo produtos web com React. Você vai revisar PRs de verdade e aprender boas práticas de front-end com mentoria semanal.', link_inscricao: 'https://techsolucoes.com/carreiras' },
  { id: 3, titulo_vaga: 'Assistente de TI', empresa: 'Suzano Papel e Celulose', razao_social_real: 'SUZANO S.A.', localizacao: 'Três Lagoas - MS', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Lógica de Programação', 'SQL'], area_itinerario: 'Ciência de Dados', descricao_completa: 'Suporte ao time de infraestrutura de TI da unidade fabril: manutenção de estações de trabalho e apoio em chamados.', link_inscricao: 'https://suzano.gupy.io' },
  { id: 4, titulo_vaga: 'Jovem Aprendiz - Automação e Robótica', empresa: 'Bosch Manufatura', razao_social_real: 'ROBERT BOSCH LTDA', localizacao: 'Campinas - SP', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Lógica de Programação', 'Arduino', 'Trabalho em Equipe'], area_itinerario: 'Mecatrônica', descricao_completa: 'Você vai acompanhar a equipe de automação industrial em projetos de prototipagem com Arduino e sensores.', link_inscricao: 'https://carreiras.bosch.com.br' },
  { id: 5, titulo_vaga: 'Estagiário de Departamento Jurídico', empresa: 'Machado Advogados Associados', razao_social_real: 'Parceiro Verificado', localizacao: 'São Paulo - SP', tipo_modalidade: 'Híbrido', habilidades_exigidas: ['Comunicação', 'Organização', 'Redação'], area_itinerario: 'Serviços Jurídicos', descricao_completa: 'Apoio em rotinas administrativas de um escritório de Direito Digital e LGPD.', link_inscricao: 'https://machadoadvogados.com.br/carreiras' },
  { id: 7, titulo_vaga: 'Jovem Aprendiz - Assistente Jurídico', empresa: 'Defensoria Parceira (Programa Jovem Cidadão)', razao_social_real: 'Parceiro Verificado', localizacao: 'Três Lagoas - MS', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Redação', 'Organização', 'Atendimento', 'LGPD'], area_itinerario: 'Serviços Jurídicos', descricao_completa: 'Apoio no atendimento ao público, triagem e digitalização de documentos, controle de prazos e organização de processos, com sigilo e supervisão.', link_inscricao: null },
  { id: 8, titulo_vaga: 'Jovem Aprendiz - Recursos Humanos', empresa: 'Suzano Papel e Celulose', razao_social_real: 'SUZANO S.A.', localizacao: 'Três Lagoas - MS', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Comunicação', 'Organização', 'Pacote Office', 'Atendimento'], area_itinerario: 'Recursos Humanos', descricao_completa: 'Apoio ao RH em recrutamento e seleção (triagem de currículos, agendamento de entrevistas), integração de novos colaboradores e rotinas de departamento pessoal.', link_inscricao: 'https://suzano.gupy.io' },
  { id: 9, titulo_vaga: 'Auxiliar de Departamento Pessoal (Aprendiz)', empresa: 'Contabilidade Horizonte', razao_social_real: 'Parceiro Verificado', localizacao: 'Campo Grande - MS', tipo_modalidade: 'Híbrido', habilidades_exigidas: ['Organização', 'Pacote Office', 'Comunicação'], area_itinerario: 'Recursos Humanos', descricao_completa: 'Apoio em admissões, conferência de folha de ponto, organização de documentos de funcionários e atendimento a dúvidas sobre férias e benefícios.', link_inscricao: null },
  { id: 6, titulo_vaga: 'Jovem Aprendiz - Auxiliar Administrativo', empresa: 'Prefeitura Municipal (parceira)', razao_social_real: 'Parceiro Verificado', localizacao: 'Três Lagoas - MS', tipo_modalidade: 'Presencial', habilidades_exigidas: ['Pacote Office', 'Organização', 'Atendimento'], area_itinerario: 'Administração', descricao_completa: 'Apoio no protocolo e no arquivo de documentos, atendimento ao público, controle de planilhas e rotinas de compras e almoxarifado.', link_inscricao: null },
  { id: 10, titulo_vaga: 'Jovem Aprendiz - Inteligência Artificial', empresa: 'TechSoluções', razao_social_real: 'Parceiro Verificado', localizacao: 'Remoto', tipo_modalidade: 'Remoto', habilidades_exigidas: ['Python', 'Lógica de Programação', 'Análise de Dados'], area_itinerario: 'Inteligência Artificial', descricao_completa: 'Apoio ao time que treina modelos de IA: organização e limpeza de dados, testes de chatbots e documentação dos resultados.', link_inscricao: null },
];


const VIDAS_MAXIMAS = 5;
const MINUTOS_PARA_REGENERAR_VIDA = 30;
const ACERTOS_SEGUIDOS_PARA_VIDA = 5;
const PERGUNTAS_POR_QUIZ = 10;
const PERGUNTAS_GERAIS_POR_QUIZ = 2;
const SENHA_ADMIN_DEMO = 'escola123';
const TOKEN_ADMIN_DEMO = 'demo-admin';
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
  itinerario: 'Ciência de Dados',
  categoria_status: STATUS_INICIAL,
  liga: 'Prata',
  vidas: 4,
  proxima_vida_em: null,
  congelamentos_disponiveis: 1,
  quizzes_perfeitos_seguidos: 3,
  precisaTrocarSenha: false,
  candidaturas: new Set(),
  quizzesEnviados: 0,
  treinouHoje: false,
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
  ['Rafael Sozza', '52998224725', 2, 'Ciência de Dados', 270, 6, ['Python', 'SQL', 'React', 'Análise de Dados', 'Lógica de Programação'], 80],
  ['Bianca Ferreira', '22257222261', 2, 'Ciência de Dados', 640, 18, ['Python', 'SQL', 'Análise de Dados', 'Comunicação'], 90],
  ['Lucas Andrade', '33368333372', 3, 'Ciência de Dados', 210, 3, ['JavaScript', 'React', 'CSS'], 60],
  ['Júlia Martins', '44479444483', 2, 'Mecatrônica', 480, 12, ['Arduino', 'Lógica de Programação', 'Trabalho em Equipe'], 80],
  ['Gabriel Souza', '55810555560', 1, 'Mecatrônica', 150, 1, ['Arduino', 'Matemática'], 50],
  ['Ana Clara Lima', '66911666635', 2, 'Serviços Jurídicos', 560, 21, ['Comunicação', 'Organização', 'Redação', 'LGPD'], 90],
  ['Matheus Rocha', '71012777723', 3, 'Serviços Jurídicos', 320, 6, ['Redação', 'Atendimento'], 70],
  ['Beatriz Nunes', '81113888881', 3, 'Recursos Humanos', 590, 15, ['Comunicação', 'Organização', 'Pacote Office', 'Atendimento'], 80],
  ['Isabela Duarte', '91214999930', 1, 'Recursos Humanos', 260, 4, ['Comunicação', 'Trabalho em Equipe'], 70],
  ['Guilherme Pires', '51010101030', 1, 'Administração', 410, 9, ['Pacote Office', 'Organização', 'Matemática'], 80],
  ['Mariana Costa', '61111111162', 3, 'Inteligência Artificial', 180, 2, ['Python', 'Organização'], 60],
  ['Rafael Silva', '12345678909', 1, 'Ciência de Dados', 300, 5, ['Python', 'Excel'], 70],
].reduce((lista, [nome, cpf, turma_id, itinerario, xp_total, ofensiva_dias, habilidades, taxa], idx) => {
  const ocupados = new Set(lista.map((a) => a.nome_exibicao.toLowerCase()));
  lista.push({
    id: idx + 1, nome, nome_exibicao: escolherNomeExibicao(nome, ocupados), cpf, data_nascimento: null,
    email: `${nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.')}@escola.com`,
    turma_id, itinerario, xp_total, ofensiva_dias, habilidades, taxa_acerto_quiz: taxa, liga: 'Bronze', total_candidaturas: 0,
  });
  return lista;
}, []);

// Contato, nascimento e situação de cada aluno da demonstração (id -> campos)
const DDD = '67';
const EXTRAS_ALUNOS = {
  1: { data_nascimento: '2008-11-15', responsavel_nome: 'Cláudia Sozza' },
  2: { data_nascimento: '2008-03-02', responsavel_nome: 'Paulo Ferreira', status_contratacao: 'contratado', empresa_contratante: 'Eldorado Brasil Celulose', contratado_em: '2026-09-15', ja_trabalhou: true, experiencia_previa: 'Ajudava na lan house do tio: atendimento e manutenção básica dos computadores.' },
  3: { data_nascimento: '2009-07-21', responsavel_nome: 'Renata Andrade' },
  4: { data_nascimento: '2008-01-30', responsavel_nome: 'Sérgio Martins', ja_trabalhou: false, status_contratacao: 'contratado', empresa_contratante: 'Eldorado Brasil Celulose', contratado_em: '2026-10-01' },
  5: { data_nascimento: '2010-05-12', responsavel_nome: 'Márcia Souza' },
  6: { data_nascimento: '2007-12-08', responsavel_nome: 'Helena Lima', status_contratacao: 'contratado', empresa_contratante: 'Machado Advogados Associados', contratado_em: '2026-08-04', ja_trabalhou: true, experiencia_previa: 'Jovem Aprendiz no cartório da cidade por 1 ano.' },
  7: { data_nascimento: '2009-02-17', responsavel_nome: 'Fábio Rocha' },
  8: { data_nascimento: '2008-09-25', responsavel_nome: 'Lúcia Nunes', ja_trabalhou: false },
  9: { data_nascimento: '2010-01-03', responsavel_nome: 'Cristina Duarte' },
  10: { data_nascimento: '2008-06-14', responsavel_nome: 'Antônio Pires' },
  11: { data_nascimento: '2009-10-29', responsavel_nome: 'Juliana Costa' },
  12: { responsavel_nome: 'Roberto Silva' }, // sem nascimento: mostra o aviso do filtro de idade
};
ALUNOS.forEach((a) => Object.assign(a, {
  status_contratacao: 'disponivel', empresa_contratante: null, contratado_em: null, ja_trabalhou: null, experiencia_previa: null, foto_no_curriculo: false,
  telefone: `${DDD}9${String(91000000 + a.id * 137).slice(0, 8)}`,
  responsavel_telefone: `${DDD}9${String(88000000 + a.id * 211).slice(0, 8)}`,
}, EXTRAS_ALUNOS[a.id] || {}));

// Ficha do PAP de exemplo (dados fictícios, só pra demonstração)
const SEXO_DEMO = { 1: 'Masculino', 2: 'Feminino', 3: 'Masculino', 4: 'Feminino', 5: 'Masculino', 6: 'Feminino', 7: 'Masculino', 8: 'Feminino', 9: 'Feminino', 10: 'Masculino', 11: 'Feminino', 12: 'Masculino' };
ALUNOS.forEach((a) => Object.assign(a, {
  numero_cadastro_sed: String(4100230 + a.id * 17),
  sexo: SEXO_DEMO[a.id] || null,
  perfil_desenvolvimento: a.id === 5 ? 'Atípico' : 'Típico',
  ano_escolar_inicial: '1º Ano',
  ano_escolar_atual: a.turma_id === 1 ? '2º Ano' : '3º Ano',
  turno_escolar: a.turma_id === 3 ? 'Vespertino' : 'Matutino',
  formacao_mundo_trabalho_em: a.id % 3 === 0 ? null : '2026-02-20',
  status_estudante: a.id === 12 ? 'Não habilitado' : 'Habilitado',
  endereco: `Rua Exemplo, ${100 + a.id * 10} - Centro, Três Lagoas/MS`,
  documentos: a.id % 4 === 0 ? 'Falta comprovante de residência' : 'Completos',
  cadastro_atualizado_em: null,
}));
ALUNOS.find((a) => a.id === 9).status_contratacao = 'desistencia';
Object.assign(ALUNOS.find((a) => a.id === 11), { status_contratacao: 'expirado' });

const CONTRATOS = [];
let proximoContratoId = 1;
const novoContratoDemo = (dados) => {
  const contrato = { id: proximoContratoId++, cnpj: null, local_atuacao: null, turno_trabalho: null, tipo_contratacao: null, data_final: null, aditivo: null, aditivo_inicio: null, aditivo_fim: null, horas_teoria: null, horas_pratica: null, motivo: null, efetivado: null, observacao: null, ...dados };
  CONTRATOS.push(contrato);
  return contrato;
};
ALUNOS.filter((a) => a.status_contratacao === 'contratado').forEach((a) => novoContratoDemo({
  estudante_id: a.id, empresa: a.empresa_contratante, local_atuacao: a.empresa_contratante, turno_trabalho: 'Vespertino', tipo_contratacao: 'Direta',
  data_inicial: a.contratado_em, data_final: null, aditivo: 'Não', horas_teoria: 4, horas_pratica: 16, status: 'Ativo',
}));
novoContratoDemo({
  estudante_id: 11, empresa: 'Comércio Parceiro (fictício)', local_atuacao: 'Loja Centro', turno_trabalho: 'Matutino', tipo_contratacao: 'Alternativa',
  data_inicial: '2025-03-10', data_final: '2026-03-09', aditivo: 'Não', horas_teoria: 4, horas_pratica: 16, status: 'Finalizado', motivo: 'Fim da vigência', efetivado: 'Não efetivado',
});
const contratosDoAluno = (id) => CONTRATOS.filter((c) => c.estudante_id === id).sort((x, y) => (y.data_inicial || '').localeCompare(x.data_inicial || '') || y.id - x.id);

const agoraIso = () => new Date().toISOString().slice(0, 19);
const diasAtras = (dias, hora = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString().slice(0, 19);
};

const fotos = new Map();                  // alunoId -> { dataUrl, em } (identificação, pra escola)
const fotosCurriculo = new Map();         // alunoId -> { dataUrl, em } (outra, opcional, só no currículo)
// O aluno da demo passa pelo primeiro acesso uma vez; concluído, fica guardado
// no navegador pra não perguntar de novo a cada recarga da página
const CHAVE_ONBOARDING_DEMO = 'play2work_demo_onboarding_concluido';
const onboardingConcluido = new Set(ALUNOS.map((a) => a.id).filter((id) => id !== 1));
try {
  if (localStorage.getItem(CHAVE_ONBOARDING_DEMO) === '1') onboardingConcluido.add(1);
} catch {
  // sem localStorage (aba anônima, prévia): só nesta sessão
}
const curriculos = new Map([[2, [{
  id: 1, gerado_em: diasAtras(3), texto_original: 'Gosto de dados, fiz curso de Excel e Python na escola e ajudava na lan house do meu tio.',
  curriculo: {
    objetivo_profissional: 'Estudante do Ensino Médio em busca da primeira oportunidade como Jovem Aprendiz em Ciência de Dados.',
    experiencias: ['Atendimento e manutenção de computadores na lan house da família', 'Curso de Python e Excel oferecido pela escola'],
    hard_skills: ['Python', 'SQL', 'Excel', 'Análise de Dados'],
    soft_skills: ['Comunicação', 'Organização', 'Proatividade'],
    sugestao_areas_atuacao: ['Jovem Aprendiz em Dados', 'Suporte Técnico'],
  },
}]]]);
let proximoCurriculoId = 2;
const entrevistas = new Map([[2, [
  { remetente: 'ai', mensagem: 'Me conta um pouco sobre você e por que quer trabalhar com dados.', em: diasAtras(5) },
  { remetente: 'user', mensagem: 'Gosto de organizar informação. Na lan house eu fazia a planilha de caixa do meu tio.', feedback: 'Ótimo exemplo prático! Mostra iniciativa.', xp: 40, em: diasAtras(5) },
  { remetente: 'ai', mensagem: 'Como você lida com prazos apertados?', em: diasAtras(5) },
  { remetente: 'user', mensagem: 'Faço uma lista do que é mais urgente e peço ajuda quando preciso.', feedback: 'Boa resposta, tente dar um exemplo real.', xp: 25, em: diasAtras(5) },
]]]);
let proximaObservacaoId = 3;
const observacoes = new Map([
  [2, [{ id: 1, texto: 'Comportamento exemplar na entrevista da Eldorado. Empresa elogiou a pontualidade.', autor: 'Coordenação', criada_em: diasAtras(20) }]],
  [3, [{ id: 2, texto: 'Precisa melhorar a pontualidade nas aulas do itinerário.', autor: 'Coordenação', criada_em: diasAtras(8) }]],
]);
const mudancasStatus = new Map([
  [2, [{ status: 'contratado', empresa: 'Eldorado Brasil Celulose', registrada_em: diasAtras(44) }]],
  [6, [{ status: 'contratado', empresa: 'Machado Advogados Associados', registrada_em: diasAtras(86) }]],
]);
const infoCandidaturas = new Map(); // `${alunoId}-${vagaId}` -> { status, resposta_empresa, criada_em, atualizada_em }

const ultimoCurriculo = (id) => (curriculos.get(id) || [])[0] || null;

const indicacoes = new Map(); // vagaId -> Map(alunoId -> pontuação)
let proximoAlunoId = ALUNOS.length + 1;
let proximaTurmaId = TURMAS.length + 1;
let proximaVagaId = 10;

// --------------------------------------------------------------- mapa de competências
// Mesma regra de competencias.py: 10 eixos da BNCC, média móvel (nova evidência
// pesa 30%) e, na indicação, cada eixo puxado pra 50 como se tivesse 3 evidências medianas.
const COMPETENCIAS = [
  ['conhecimento', 'Conhecimento', 1, 'Usar os conhecimentos construídos pra entender a realidade e continuar aprendendo.'],
  ['pensamento_critico', 'Pensamento crítico e criativo', 2, 'Investigar, refletir, analisar criticamente e criar soluções.'],
  ['repertorio_cultural', 'Repertório cultural', 3, 'Valorizar e fruir as diversas manifestações artísticas e culturais.'],
  ['comunicacao', 'Comunicação', 4, 'Se expressar com clareza, nas linguagens verbal, escrita, digital e outras.'],
  ['cultura_digital', 'Cultura digital', 5, 'Usar tecnologias digitais de forma crítica, ética e responsável.'],
  ['trabalho_projeto_vida', 'Trabalho e projeto de vida', 6, 'Entender o mundo do trabalho e fazer escolhas alinhadas ao seu projeto de vida.'],
  ['argumentacao', 'Argumentação', 7, 'Argumentar com base em fatos e defender ideias com respeito.'],
  ['autoconhecimento', 'Autoconhecimento e autocuidado', 8, 'Conhecer a si mesmo, reconhecer suas emoções e lidar com elas.'],
  ['empatia_cooperacao', 'Empatia e cooperação', 9, 'Dialogar, resolver conflitos e trabalhar em equipe com respeito ao outro.'],
  ['responsabilidade', 'Responsabilidade e cidadania', 10, 'Agir com autonomia, responsabilidade, ética e compromisso.'],
].map(([codigo, nome, bncc, descricao]) => ({ codigo, nome, bncc, descricao }));
const SITUACOES = Object.fromEntries(SITUACOES_LISTA.map((sit) => [sit.id, sit]));
const SITUACOES_POR_DIA = 5;

const mapas = new Map();        // alunoId -> { codigo: { pontuacao, total } }
const evidencias = new Map();   // alunoId -> [{ competencia, pontos, origem, criada_em }]
const respostasSituacoes = new Map(); // alunoId -> [{ situacao_id, opcao_index, criada_em }]
const ORIGENS = { quiz: 'Quiz do dia', entrevista: 'Simulador de entrevista', situacao: 'O que você faria?', aula: 'Aula EAD (fixação)' };

const registrarEvidencias = (alunoId, pontosPorEixo, origem, criadaEm = agoraIso()) => {
  const mapa = mapas.get(alunoId) || {};
  Object.entries(pontosPorEixo).forEach(([codigo, bruto]) => {
    const pontos = Math.max(0, Math.min(100, Math.round(bruto)));
    const atual = mapa[codigo];
    mapa[codigo] = atual ? { pontuacao: atual.pontuacao * 0.7 + pontos * 0.3, total: atual.total + 1 } : { pontuacao: pontos, total: 1 };
    evidencias.set(alunoId, [{ competencia: codigo, pontos, origem: ORIGENS[origem], criada_em: criadaEm }, ...(evidencias.get(alunoId) || [])]);
  });
  mapas.set(alunoId, mapa);
};

const notaCompetencias = (alunoId) => {
  const mapa = mapas.get(alunoId) || {};
  const soma = COMPETENCIAS.reduce((total, { codigo }) => {
    const { pontuacao = 50, total: n = 0 } = mapa[codigo] || {};
    return total + (pontuacao * n + 50 * 3) / (n + 3);
  }, 0);
  return soma / COMPETENCIAS.length / 100;
};

const mapaParaTela = (aluno) => {
  const mapa = mapas.get(aluno.id) || {};
  const daTurma = ALUNOS.filter((a) => (aluno.turma_id ? a.turma_id === aluno.turma_id : true));
  return {
    referencia_media: aluno.turma_id ? 'turma' : 'escola',
    eixos: COMPETENCIAS.map((comp) => {
      const valores = daTurma.map((a) => mapas.get(a.id)?.[comp.codigo]?.pontuacao).filter((v) => v != null);
      const meu = mapa[comp.codigo];
      return {
        ...comp,
        pontuacao: meu ? Math.round(meu.pontuacao) : null,
        total_evidencias: meu?.total ?? 0,
        media_turma: valores.length ? Math.round(valores.reduce((x, y) => x + y, 0) / valores.length) : null,
      };
    }),
  };
};

// Histórico fictício pra demonstração: cada aluno já fez algumas atividades
// (o aluno 1, da demo, só algumas -- pra mostrar eixos ainda sem atividades)
ALUNOS.forEach((a) => {
  const semente = (n) => ((a.id * 37 + n * 53) % 41) - 20; // -20..20, fixo por aluno
  const base = (a.taxa_acerto_quiz ?? 60);
  const eixos = a.id === 1 ? ['conhecimento', 'comunicacao', 'cultura_digital', 'trabalho_projeto_vida'] : COMPETENCIAS.map((c) => c.codigo).filter((_, i) => (a.id + i) % 5 !== 0);
  eixos.forEach((codigo, i) => {
    for (let k = 0; k < 2 + ((a.id + i) % 3); k += 1) {
      registrarEvidencias(a.id, { [codigo]: base + semente(i + k) }, codigo === 'conhecimento' ? 'quiz' : i % 2 ? 'situacao' : 'entrevista', diasAtras(10 - k));
    }
  });
});

const PESOS_DESEMPENHO = { habilidades: 30, itinerario: 20, competencias: 35, quiz: 15 };
const calcularDesempenho = (aluno, vaga) => {
  const habVaga = new Set(vaga.habilidades_exigidas);
  const emComum = (aluno.habilidades || []).filter((h) => habVaga.has(h));
  const fracoes = {
    habilidades: habVaga.size ? emComum.length / habVaga.size : 0,
    itinerario: aluno.itinerario && aluno.itinerario === vaga.area_itinerario ? 1 : 0,
    competencias: notaCompetencias(aluno.id),
    quiz: (aluno.taxa_acerto_quiz ?? 0) / 100,
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
  idade: idadeDe(a.data_nascimento),
  tem_foto: fotos.has(a.id),
  foto_atualizada_em: fotos.get(a.id)?.em ?? null,
  tem_foto_curriculo: fotosCurriculo.has(a.id),
  foto_curriculo_atualizada_em: fotosCurriculo.get(a.id)?.em ?? null,
  curriculo_atualizado_em: ultimoCurriculo(a.id)?.gerado_em ?? null,
  contrato_atual: contratosDoAluno(a.id)[0] ?? null,
  ...trilha.resumoCertificados(a.id),
});

// Mesma validação de fotos.py (tipo pelos primeiros bytes, até 1 MB)
const validarFoto = (texto) => {
  const base64 = String(texto || '').split(',').pop();
  let bytes;
  try { bytes = atob(base64); } catch { return 'Imagem inválida.'; }
  if (bytes.length > 1_000_000) return 'Foto grande demais (máximo 1 MB).';
  const ehJpeg = bytes.startsWith('\xff\xd8\xff');
  const ehPng = bytes.startsWith('\x89PNG');
  const ehWebp = bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
  return ehJpeg || ehPng || ehWebp ? null : 'Formato não suportado: envie uma foto JPG, PNG ou WebP.';
};

const respostaFoto = (id, mapa = fotos) => {
  const foto = mapa.get(id);
  if (!foto) return erroFake('Aluno sem foto.', 404);
  return Promise.resolve({ ok: true, status: 200, blob: async () => (await fetch(foto.dataUrl)).blob(), json: async () => ({}) });
};

const salvarFotoDemo = (id, corpo) => {
  const erro = validarFoto(corpo.imagem_base64);
  if (erro) return erroFake(erro, 400);
  const em = agoraIso();
  fotos.set(id, { dataUrl: corpo.imagem_base64, em });
  return respostaFake({ sucesso: true, foto_atualizada_em: em });
};

// Foto do currículo: enviar já marca "com foto"; remover volta pra "sem foto" (como em routes.py)
const salvarFotoCurriculoDemo = (aluno, corpo) => {
  const erro = validarFoto(corpo.imagem_base64);
  if (erro) return erroFake(erro, 400);
  const em = agoraIso();
  fotosCurriculo.set(aluno.id, { dataUrl: corpo.imagem_base64, em });
  aluno.foto_no_curriculo = true;
  return respostaFake({ sucesso: true, foto_no_curriculo: true, foto_curriculo_atualizada_em: em });
};

// Candidaturas de um aluno = indicações da escola + as que ele mesmo fez
const candidaturasDoAluno = (aluno) => VAGAS
  .filter((v) => indicacoes.get(v.id)?.has(aluno.id) || (aluno.id === estado.alunoId && estado.candidaturas.has(v.id)))
  .map((v) => {
    const chave = `${aluno.id}-${v.id}`;
    if (!infoCandidaturas.has(chave)) infoCandidaturas.set(chave, { status: 'em_analise', resposta_empresa: null, criada_em: agoraIso(), atualizada_em: null });
    const info = infoCandidaturas.get(chave);
    const indicada = indicacoes.get(v.id)?.has(aluno.id) ?? false;
    return {
      id: aluno.id * 1000 + v.id, vaga_id: v.id, titulo_vaga: v.titulo_vaga, empresa: v.empresa, ...info,
      indicada_pela_escola: indicada, pontuacao_indicacao: indicada ? indicacoes.get(v.id).get(aluno.id) : null,
    };
  });

const entrevistasPorDia = (mensagens) => {
  const dias = new Map();
  let ultimaPergunta = null;
  mensagens.forEach((m) => {
    if (m.remetente === 'ai') { ultimaPergunta = m.mensagem; return; }
    const dia = m.em.slice(0, 10);
    if (!dias.has(dia)) dias.set(dia, []);
    dias.get(dia).push({ pergunta: ultimaPergunta, resposta: m.mensagem, feedback: m.feedback, nota: m.xp });
  });
  return [...dias.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([data, itens]) => {
    const notas = itens.map((i) => i.nota).filter((n) => n != null);
    return { data, total_respostas: itens.length, nota_media: notas.length ? Math.round(notas.reduce((x, y) => x + y, 0) / notas.length) : null, itens };
  });
};

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
  estado.proxima_vida_em = estado.vidas >= VIDAS_MAXIMAS ? null : new Date(marca + regeneradas * intervalo).toISOString();
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
  estado.categoria_status = categoriaAtualDemo();
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
    // Como no backend: a cada 7 dias seguidos, +2 congelamentos (teto de 4)
    if (estado.ofensiva_dias % 7 === 0) estado.congelamentos_disponiveis = Math.min(4, estado.congelamentos_disponiveis + 2);
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
  const pares = [
    ...colegas.map((nome, i) => {
      const xp = Math.max(31 - i, 300 - i * 12 - (i > 9 ? 25 : 0));
      return { nome, xp_semanal: xp, categoria: statusPorXp(xp) };
    }),
    { nome: estado.nome_exibicao || estado.nome, xp_semanal: estado.xp_semanal, categoria: categoriaAtualDemo(), voce: true },
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

// Cabeçalho do currículo: o cadastro da escola (dados_do_sistema em curriculo.py)
const dadosPessoaisDemo = (aluno) => ({
  nome: aluno.nome,
  idade: idadeDe(aluno.data_nascimento),
  data_nascimento: aluno.data_nascimento || null,
  email: aluno.email,
  telefone: aluno.telefone || null,
  linkedin: aluno.id === estado.alunoId ? estado.linkedin || null : null,
  turma: nomeTurma(aluno.turma_id),
  itinerario: aluno.itinerario,
});

// Status de carreira do aluno logado (calcular_categoria_status no backend):
// "Contratado" só quando a escola marcou no painel; senão, o nível do XP.
// Declaração 'function' (içada): atualizarCategoriaStatus roda na carga do módulo, antes desta linha.
function categoriaAtualDemo() {
  return ALUNOS.find((a) => a.id === estado.alunoId)?.status_contratacao === 'contratado'
    ? STATUS_CONTRATADO
    : statusPorXp(estado.xp_total);
}

const respostaFake = (dados, status = 200) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => clone(dados),
});

const erroFake = (detail, status = 400) => respostaFake({ detail }, status);

// Trilha EAD (aulas, frequência, fixação e certificados) -- em mockTrilha.js
const concederXpDemo = (xp) => {
  estado.xp_total += xp;
  estado.xp_semanal += xp;
  if (estado.xp_total >= 300 * estado.nivel_gamificacao) estado.nivel_gamificacao += 1;
  atualizarCategoriaStatus();
  registrarTreinoDoDia();
};
const mensagensDemo = criarMockMensagens({ ALUNOS, TURMAS, estado, respostaFake, erroFake, agoraIso, diasAtras });
const trilha = criarMockTrilha({ ALUNOS, estado, respostaFake, erroFake, registrarEvidencias, concederXp: concederXpDemo, nomeTurma, agoraIso, diasAtras });

const atenderAdmin = async (metodo, caminho, query, corpo, token) => {
  if (metodo === 'POST' && caminho === '/api/admin/login') {
    if (corpo.senha !== SENHA_ADMIN_DEMO) return erroFake('Senha incorreta', 401);
    return respostaFake({ token: TOKEN_ADMIN_DEMO });
  }
  if (token !== TOKEN_ADMIN_DEMO) return erroFake('Acesso restrito à escola. Faça login no painel.', 401);
  const daTrilha = await trilha.admin(metodo, caminho, query, corpo);
  if (daTrilha) return daTrilha;
  const dasMensagens = mensagensDemo.admin(metodo, caminho, query, corpo);
  if (dasMensagens) return dasMensagens;

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
      total_contratados: ALUNOS.filter((a) => a.status_contratacao === 'contratado').length,
      mensagens_nao_lidas: mensagensDemo.naoLidasDaEscola(),
      total_sem_foto: ALUNOS.filter((a) => !fotos.has(a.id)).length,
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
      telefone: corpo.telefone || null, responsavel_nome: corpo.responsavel_nome || null, responsavel_telefone: corpo.responsavel_telefone || null,
      status_contratacao: 'disponivel', empresa_contratante: null, contratado_em: null, ja_trabalhou: null, experiencia_previa: null,
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
    ['data_nascimento', 'email', 'turma_id', 'itinerario', 'habilidades', 'telefone', 'responsavel_nome', 'responsavel_telefone', 'ja_trabalhou', 'experiencia_previa'].forEach((campo) => {
      if (campo in corpo) aluno[campo] = corpo[campo];
    });
    if (corpo.ficha) {
      const [limpos, erro] = validarFicha('aluno', corpo.ficha, true);
      if (erro) return erroFake(erro, 400);
      Object.assign(aluno, limpos);
    }
    aluno.cadastro_atualizado_em = hojeLocalIso();
    if (aluno.id === estado.alunoId) {
      Object.assign(estado, { nome: aluno.nome, nome_exibicao: aluno.nome_exibicao, itinerario: aluno.itinerario, habilidades: aluno.habilidades, email: aluno.email });
    }
    return respostaFake(alunoParaApi(aluno));
  }

  // Contratos de aprendizagem (como em admin_routes.py)
  const matchContratos = caminho.match(/^\/api\/admin\/estudantes\/(\d+)\/contratos$/);
  const matchContrato = caminho.match(/^\/api\/admin\/contratos\/(\d+)$/);
  if (matchContratos || matchContrato) {
    const existente = matchContrato && CONTRATOS.find((c) => c.id === Number(matchContrato[1]));
    if (matchContrato && !existente) return erroFake('Contrato não encontrado', 404);
    const aluno = ALUNOS.find((a) => a.id === (existente ? existente.estudante_id : Number(matchContratos[1])));
    if (!aluno) return erroFake('Aluno não encontrado', 404);
    if (metodo === 'GET' && matchContratos) return respostaFake(contratosDoAluno(aluno.id));
    if (metodo === 'DELETE' && existente) { CONTRATOS.splice(CONTRATOS.indexOf(existente), 1); return respostaFake({ sucesso: true }); }
    if (metodo === 'POST' || metodo === 'PUT') {
      const [limpos, erro] = validarFicha('contrato', corpo);
      if (erro) return erroFake(erro, 400);
      const problema = conferirContrato(limpos);
      if (problema) return erroFake(problema, 400);
      const contrato = existente ? Object.assign(existente, limpos) : novoContratoDemo({ estudante_id: aluno.id, ...limpos });
      if (contrato.status === 'Ativo') {
        Object.assign(aluno, { status_contratacao: 'contratado', empresa_contratante: contrato.empresa, contratado_em: contrato.data_inicial });
        mudancasStatus.set(aluno.id, [{ status: 'contratado', empresa: contrato.empresa, registrada_em: agoraIso() }, ...(mudancasStatus.get(aluno.id) || [])]);
      }
      aluno.cadastro_atualizado_em = hojeLocalIso();
      return respostaFake(contrato, existente ? 200 : 201);
    }
  }

  const matchFicha = caminho.match(/^\/api\/admin\/estudantes\/(\d+)\/(status|foto|foto-curriculo|curriculo|historico|observacoes|competencias)$/);
  if (matchFicha) {
    const aluno = ALUNOS.find((a) => a.id === Number(matchFicha[1]));
    if (!aluno) return erroFake('Aluno não encontrado', 404);
    const recurso = matchFicha[2];

    if (recurso === 'status' && metodo === 'PUT') {
      if (!(corpo.status in STATUS_APRENDIZ)) return erroFake('Status inválido', 400);
      const empresa = (corpo.empresa || '').trim() || null;
      if (corpo.status === 'contratado' && !empresa) return erroFake('Informe a empresa que contratou o aluno', 400);
      Object.assign(aluno, corpo.status === 'contratado'
        ? { status_contratacao: 'contratado', empresa_contratante: empresa, contratado_em: corpo.contratado_em || hojeLocalIso() }
        : { status_contratacao: corpo.status, empresa_contratante: null, contratado_em: null });
      mudancasStatus.set(aluno.id, [{ status: corpo.status, empresa, registrada_em: agoraIso() }, ...(mudancasStatus.get(aluno.id) || [])]);
      return respostaFake({ status_contratacao: aluno.status_contratacao, empresa_contratante: aluno.empresa_contratante, contratado_em: aluno.contratado_em });
    }
    if (recurso === 'foto-curriculo' && metodo === 'GET') return respostaFoto(aluno.id, fotosCurriculo);
    if (recurso === 'foto') {
      if (metodo === 'GET') return respostaFoto(aluno.id);
      if (metodo === 'PUT') return salvarFotoDemo(aluno.id, corpo);
      if (metodo === 'DELETE') { fotos.delete(aluno.id); return respostaFake({ sucesso: true }); }
    }
    if (recurso === 'curriculo' && metodo === 'GET') {
      const versoes = curriculos.get(aluno.id) || [];
      if (!versoes.length) return respostaFake({ atual: null, versoes: [] });
      const versaoId = Number(query.get('versao_id')) || null;
      const atual = versaoId ? versoes.find((v) => v.id === versaoId) : versoes[0];
      if (!atual) return erroFake('Versão do currículo não encontrada', 404);
      return respostaFake({ atual, versoes: versoes.map((v, i) => ({ id: v.id, gerado_em: v.gerado_em, mais_recente: i === 0 })) });
    }
    if (recurso === 'historico' && metodo === 'GET') {
      return respostaFake({
        experiencia: { ja_trabalhou: aluno.ja_trabalhou, experiencia_previa: aluno.experiencia_previa },
        entrevistas: entrevistasPorDia(entrevistas.get(aluno.id) || []),
        candidaturas: candidaturasDoAluno(aluno),
        mudancas_status: mudancasStatus.get(aluno.id) || [],
        observacoes: observacoes.get(aluno.id) || [],
      });
    }
    if (recurso === 'competencias' && metodo === 'GET') {
      return respostaFake({
        ...mapaParaTela(aluno),
        evidencias: (evidencias.get(aluno.id) || []).slice(0, 30),
        situacoes: (respostasSituacoes.get(aluno.id) || []).slice(0, 20).map((r) => ({
          titulo: SITUACOES[r.situacao_id].titulo, escolha: SITUACOES[r.situacao_id].opcoes[r.opcao_index].texto, criada_em: r.criada_em,
        })),
      });
    }
    if (recurso === 'observacoes' && metodo === 'POST') {
      const texto = (corpo.texto || '').trim();
      if (!texto) return erroFake('Escreva a observação', 400);
      const nova = { id: proximaObservacaoId++, texto, autor: 'Coordenação', criada_em: agoraIso() };
      observacoes.set(aluno.id, [nova, ...(observacoes.get(aluno.id) || [])]);
      return respostaFake(nova, 201);
    }
  }
  const matchObservacao = metodo === 'DELETE' && caminho.match(/^\/api\/admin\/observacoes\/(\d+)$/);
  if (matchObservacao) {
    const id = Number(matchObservacao[1]);
    const dono = [...observacoes.entries()].find(([, lista]) => lista.some((o) => o.id === id));
    if (!dono) return erroFake('Observação não encontrada', 404);
    observacoes.set(dono[0], dono[1].filter((o) => o.id !== id));
    return respostaFake({ sucesso: true });
  }
  const matchCandidatura = metodo === 'PUT' && caminho.match(/^\/api\/admin\/candidaturas\/(\d+)$/);
  if (matchCandidatura) {
    const id = Number(matchCandidatura[1]);
    const chave = `${Math.floor(id / 1000)}-${id % 1000}`;
    const info = infoCandidaturas.get(chave);
    if (!info) return erroFake('Candidatura não encontrada', 404);
    if ('status' in corpo) {
      if (!['enviada', 'em_analise', 'aprovada', 'recusada'].includes(corpo.status)) return erroFake('Status inválido', 400);
      info.status = corpo.status;
    }
    if ('resposta_empresa' in corpo) info.resposta_empresa = (corpo.resposta_empresa || '').trim() || null;
    info.atualizada_em = agoraIso();
    return respostaFake({ id, ...info });
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
        ...calcularDesempenho(a, vaga),
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
      mapa.set(id, calcularDesempenho(ALUNOS.find((a) => a.id === id), vaga).pontuacao);
    });
    indicacoes.set(vaga.id, mapa);
    return respostaFake({ sucesso: true, indicados: ids.length, novas_indicacoes: novas, mensagem: `${ids.length} aluno(s) indicado(s) para ${vaga.titulo_vaga} — ${vaga.empresa}.` });
  }
  return erroFake(`Rota fake não implementada: ${metodo} ${caminho}`, 404);
};

export const atenderRequisicaoFake = async (path, options = {}) => {
  const metodo = (options.method || 'GET').toUpperCase();
  const [caminho, queryString] = path.split('?');
  const query = new URLSearchParams(queryString || '');
  const corpo = options.body instanceof FormData ? options.body : options.body ? JSON.parse(options.body) : {};

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
      categoria_status: categoriaAtualDemo(),
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
    return respostaFake(candidaturasDoAluno(ALUNOS.find((a) => a.id === estado.alunoId)).map(({ id, vaga_id, titulo_vaga, empresa, status, indicada_pela_escola, criada_em }) => ({ id, vaga_id, titulo_vaga, empresa, status, indicada_pela_escola, criada_em })));
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
    return erroFake('As indicações para as vagas são feitas pela coordenação da escola, de acordo com as cotas das empresas parceiras.', 403);
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
      return respostaFake({ detail: { mensagem: 'Você está sem vidas. Elas voltam sozinhas: 1 a cada 30 minutos.', proxima_vida_em: estado.proxima_vida_em } }, 403);
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
    // Como no backend: a vida cai na hora do erro e o combo devolve na hora
    regenerarVidas();
    let ganhouVidaCombo = false;
    if (!registro.pulou && !registro.correta) perderVida();
    else if (combo > 0 && combo % ACERTOS_SEGUIDOS_PARA_VIDA === 0) ganhouVidaCombo = ganharVidas(1) > 0;
    return respostaFake({
      correta: registro.pulou ? null : registro.correta,
      resposta_correta_index: gabaritoPergunta.resposta_correta_index,
      explicacao: gabaritoPergunta.explicacao,
      combo,
      ganhou_vida_combo: ganhouVidaCombo,
      vidas: estado.vidas,
      proxima_vida_em: estado.proxima_vida_em,
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
    // Como no backend: quiz pela metade não vale XP nem ofensiva
    if (quizAtivo.respostas.length !== total) return erroFake('Ainda faltam perguntas para responder.', 400);
    const acertos = quizAtivo.respostas.filter((r) => r.correta).length;
    const pulos = quizAtivo.respostas.filter((r) => r.pulou).length;
    const xpConcedido = acertos * 8;

    // Vidas já mudaram em /quiz/responder; aqui só XP e ofensiva (quiz concluído)
    if (total - pulos > 0) registrarEvidencias(estado.alunoId, { conhecimento: (acertos / (total - pulos)) * 100 }, 'quiz');
    const vidasRecuperadasCombo = vidasGanhasPorCombo(quizAtivo.respostas);
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
      categoria_status: categoriaAtualDemo(),
      missoes_diarias: 1,
      vidas: estado.vidas,
      congelamentos_disponiveis: estado.congelamentos_disponiveis,
      quizzes_perfeitos_seguidos: estado.quizzes_perfeitos_seguidos,
      vida_bonus_ganha: vidaBonusGanha,
      vidas_recuperadas_combo: vidasRecuperadasCombo,
      proxima_vida_em: estado.proxima_vida_em,
      liga: estado.liga,
      mudanca_liga: mudancaLiga,
    });
  }

  // GET /ranking
  if (metodo === 'GET' && caminho === '/api/ranking') {
    return respostaFake(construirRanking());
  }

  const alunoAtual = ALUNOS.find((a) => a.id === estado.alunoId);
  const daTrilha = await trilha.aluno(metodo, caminho, query, corpo);
  if (daTrilha) return daTrilha;
  const dasMensagens = mensagensDemo.aluno(metodo, caminho, query, corpo);
  if (dasMensagens) return dasMensagens;

  if (metodo === 'GET' && caminho === '/api/estudante/me/competencias') return respostaFake(mapaParaTela(alunoAtual));

  const situacoesHoje = () => (respostasSituacoes.get(estado.alunoId) || []).filter((r) => r.dia === hojeLocalIso()).length;
  if (metodo === 'GET' && caminho === '/api/situacoes/proxima') {
    const restantes = Math.max(0, SITUACOES_POR_DIA - situacoesHoje());
    if (!restantes) return respostaFake({ situacao: null, restantes_hoje: 0, limite_diario: SITUACOES_POR_DIA });
    const feitas = new Set((respostasSituacoes.get(estado.alunoId) || []).map((r) => r.situacao_id));
    const candidatas = SITUACOES_LISTA.filter((sit) => !feitas.has(sit.id));
    const escolhida = (candidatas.length ? candidatas : SITUACOES_LISTA)[Math.floor(Math.random() * (candidatas.length || SITUACOES_LISTA.length))];
    return respostaFake({
      situacao: { id: escolhida.id, titulo: escolhida.titulo, cenario: escolhida.cenario, opcoes: escolhida.opcoes.map((o) => o.texto) },
      restantes_hoje: restantes,
      limite_diario: SITUACOES_POR_DIA,
    });
  }
  if (metodo === 'POST' && caminho === '/api/situacoes/responder') {
    const situacao = SITUACOES[corpo.situacao_id];
    if (!situacao) return erroFake('Situação não encontrada', 404);
    const opcao = situacao.opcoes[corpo.opcao_index];
    if (!opcao) return erroFake('Opção inválida', 400);
    if (situacoesHoje() >= SITUACOES_POR_DIA) return erroFake(`Você já fez as ${SITUACOES_POR_DIA} situações de hoje. Volte amanhã!`, 429);
    respostasSituacoes.set(estado.alunoId, [{ situacao_id: situacao.id, opcao_index: corpo.opcao_index, criada_em: agoraIso(), dia: hojeLocalIso() }, ...(respostasSituacoes.get(estado.alunoId) || [])]);
    registrarEvidencias(estado.alunoId, opcao.competencias, 'situacao');
    const media = (o) => Object.values(o.competencias).reduce((x, y) => x + y, 0) / Object.values(o.competencias).length;
    const indiceMelhor = situacao.opcoes.reduce((melhor, o, i) => (media(o) > media(situacao.opcoes[melhor]) ? i : melhor), 0);
    const nota = media(opcao);
    const xp = Math.max(2, Math.round(nota / 5));
    estado.xp_total += xp;
    estado.xp_semanal += xp;
    if (estado.xp_total >= 300 * estado.nivel_gamificacao) estado.nivel_gamificacao += 1;
    atualizarCategoriaStatus();
    registrarTreinoDoDia();
    return respostaFake({
      nota: Math.round(nota),
      xp_concedido: xp,
      consequencia: opcao.consequencia,
      competencias: Object.entries(opcao.competencias).map(([codigo, pontos]) => ({ codigo, pontos })),
      escolheu_a_melhor: indiceMelhor === corpo.opcao_index,
      melhor_opcao: indiceMelhor === corpo.opcao_index ? null : { indice: indiceMelhor, texto: situacao.opcoes[indiceMelhor].texto, consequencia: situacao.opcoes[indiceMelhor].consequencia },
      novos_pontos_totais: estado.xp_total,
      nivel_atual: estado.nivel_gamificacao,
      ofensiva_dias: estado.ofensiva_dias,
      categoria_status: categoriaAtualDemo(),
      liga: estado.liga,
      mudanca_liga: avaliarPromocaoDemo(),
    });
  }

  if (metodo === 'GET' && caminho === '/api/estudante/me/perfil') {
    const curriculo = ultimoCurriculo(estado.alunoId);
    return respostaFake({
      tem_foto: fotos.has(estado.alunoId),
      foto_atualizada_em: fotos.get(estado.alunoId)?.em ?? null,
      tem_curriculo: Boolean(curriculo),
      curriculo_atualizado_em: curriculo?.gerado_em ?? null,
      ja_trabalhou: alunoAtual?.ja_trabalhou ?? null,
      experiencia_previa: alunoAtual?.experiencia_previa ?? null,
      onboarding_concluido: onboardingConcluido.has(estado.alunoId),
    });
  }
  if (caminho === '/api/estudante/me/foto-curriculo') {
    if (metodo === 'GET') return respostaFoto(estado.alunoId, fotosCurriculo);
    if (metodo === 'PUT') return salvarFotoCurriculoDemo(alunoAtual, corpo);
    if (metodo === 'DELETE') {
      fotosCurriculo.delete(estado.alunoId);
      alunoAtual.foto_no_curriculo = false;
      return respostaFake({ sucesso: true, foto_no_curriculo: false });
    }
  }
  if (caminho === '/api/estudante/me/foto') {
    if (metodo === 'GET') return respostaFoto(estado.alunoId);
    if (metodo === 'PUT') return salvarFotoDemo(estado.alunoId, corpo);
    if (metodo === 'DELETE') { fotos.delete(estado.alunoId); return respostaFake({ sucesso: true }); }
  }
  if (metodo === 'PUT' && caminho === '/api/estudante/me/experiencia') {
    const texto = (corpo.experiencia_previa || '').trim();
    Object.assign(alunoAtual, { ja_trabalhou: corpo.ja_trabalhou, experiencia_previa: corpo.ja_trabalhou && texto ? texto : null });
    return respostaFake({ ja_trabalhou: alunoAtual.ja_trabalhou, experiencia_previa: alunoAtual.experiencia_previa });
  }
  if (metodo === 'POST' && caminho === '/api/estudante/me/onboarding/concluir') {
    onboardingConcluido.add(estado.alunoId);
    try {
      if (estado.alunoId === 1) localStorage.setItem(CHAVE_ONBOARDING_DEMO, '1');
    } catch {
      // sem localStorage: só nesta sessão
    }
    return respostaFake({ onboarding_concluido: true });
  }
  if (metodo === 'GET' && caminho === '/api/resume/atual') {
    const curriculo = ultimoCurriculo(estado.alunoId);
    return respostaFake({
      foto_no_curriculo: Boolean(alunoAtual?.foto_no_curriculo),
      tem_foto_curriculo: fotosCurriculo.has(estado.alunoId),
      foto_curriculo_atualizada_em: fotosCurriculo.get(estado.alunoId)?.em ?? null,
      dados_pessoais: dadosPessoaisDemo(alunoAtual),
      ...(curriculo ? { curriculo: curriculo.curriculo, texto_original: curriculo.texto_original, gerado_em: curriculo.gerado_em } : { curriculo: null }),
    });
  }
  if (metodo === 'PUT' && caminho === '/api/estudante/me/preferencias-curriculo') {
    alunoAtual.foto_no_curriculo = Boolean(corpo.foto_no_curriculo);
    return respostaFake({ foto_no_curriculo: alunoAtual.foto_no_curriculo });
  }

  // POST /resume/generate -- cada geração vira uma versão nova, que o painel da escola lê
  if (metodo === 'POST' && caminho === '/api/resume/generate') {
    // Mesmas regras de curriculo.py: texto que não fala do aluno não gera currículo
    const texto = corpo.habilidades_texto || '';
    const gerado = gerarCurriculoDemo(texto, alunoAtual);
    if (gerado.erro) return erroFake(gerado.erro, 422);
    const versao = { id: proximoCurriculoId++, gerado_em: agoraIso(), texto_original: texto, curriculo: gerado.curriculo };
    // Como no backend: conta pra ofensiva; XP (10) só no primeiro currículo do dia
    const jaGerouHoje = (curriculos.get(estado.alunoId) || []).some((v) => v.gerado_em.slice(0, 10) === agoraIso().slice(0, 10));
    const xpCurriculo = jaGerouHoje ? 0 : 10;
    concederXpDemo(xpCurriculo);
    curriculos.set(estado.alunoId, [versao, ...(curriculos.get(estado.alunoId) || [])]);
    return respostaFake({
      sucesso: true, curriculo: versao.curriculo, dados_pessoais: dadosPessoaisDemo(alunoAtual), gerado_em: versao.gerado_em,
      xp_concedido: xpCurriculo, novos_pontos_totais: estado.xp_total, nivel_atual: estado.nivel_gamificacao,
      ofensiva_dias: estado.ofensiva_dias, categoria_status: categoriaAtualDemo(), liga: estado.liga, mudanca_liga: null,
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
    if (!mensagem || mensagem.length > 1500) return erroFake('A resposta precisa ter entre 1 e 1500 caracteres.', 422);
    if (corpo.abertura && !['inicial', 'recomeco'].includes(corpo.abertura)) return erroFake('Abertura inválida.', 422);
    // Mesma lógica de routes.chat_interview: a pergunta vem do histórico, não do aluno
    const historico = entrevistas.get(estado.alunoId) || [];
    const inicio = Boolean(corpo.abertura) || !historico.some((m) => m.remetente === 'ai');
    const perguntaAtual = inicio
      ? (corpo.abertura === 'recomeco' ? PERGUNTA_RECOMECO : PERGUNTA_INICIAL)
      : historico.filter((m) => m.remetente === 'ai').at(-1).mensagem;
    const rodada = conduzirDemo(
      mensagem, perguntaAtual,
      historico.filter((m) => m.remetente === 'user').slice(-10).map((m) => m.mensagem),
      historico.filter((m) => m.remetente === 'ai').length,
    );
    const xpConcedido = rodada.xp_concedido;
    entrevistas.set(estado.alunoId, [
      ...historico,
      ...(inicio ? [{ remetente: 'ai', mensagem: perguntaAtual, em: agoraIso() }] : []),
      { remetente: 'user', mensagem, feedback: rodada.analise_feedback, xp: xpConcedido, em: agoraIso() },
      { remetente: 'ai', mensagem: rodada.fala, em: agoraIso() },
    ]);

    let mudancaLiga = null;
    if (rodada.categoria === 'resposta') {
      estado.xp_total += xpConcedido;
      estado.xp_semanal += xpConcedido;
      if (estado.xp_total >= 300 * estado.nivel_gamificacao) estado.nivel_gamificacao += 1;
      atualizarCategoriaStatus();
      registrarTreinoDoDia();
      registrarEvidencias(estado.alunoId, { comunicacao: xpConcedido * 2, trabalho_projeto_vida: xpConcedido * 2, autoconhecimento: xpConcedido * 2 }, 'entrevista');
      mudancaLiga = avaliarPromocaoDemo();
    }

    return respostaFake({
      feedback_ia: rodada.analise_feedback,
      resposta_ia: rodada.fala,
      xp_concedido: xpConcedido,
      categoria: rodada.categoria,
      notas: rodada.notas,
      novos_pontos_totais: estado.xp_total,
      nivel_atual: estado.nivel_gamificacao,
      ofensiva_dias: estado.ofensiva_dias,
      categoria_status: categoriaAtualDemo(),
      missoes_diarias: 1,
      liga: estado.liga,
      mudanca_liga: mudancaLiga,
    });
  }

  return erroFake(`Rota fake não implementada: ${metodo} ${caminho}`, 404);
};
