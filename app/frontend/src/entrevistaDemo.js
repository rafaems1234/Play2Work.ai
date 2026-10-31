// Simulador de entrevista no modo demonstração: as mesmas regras de
// entrevista.py (triagem, notas por critério e XP calculado aqui), lidas do
// mesmo data/entrevista.json. Sem IA, a avaliação é a de reserva do backend.
import REGRAS from './data/entrevista.json';

export { REGRAS };

export const PERGUNTA_INICIAL = REGRAS.pergunta_inicial;
export const PERGUNTA_RECOMECO = REGRAS.pergunta_recomeco;
const CRITERIOS = Object.keys(REGRAS.pesos);

export const CONTA = /\d+\s*[+*x×÷^]\s*\d+|quanto (e|da|que e) \d/;
export const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
export const TELEFONE = /\(?\b\d{2}\)?\s?9\d{4}-?\d{4}\b/;

export const normalizar = (texto) => (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const palavrasDe = (t) => t.match(/[a-z0-9]+/g) || [];
export const escapar = (e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const temExpressao = (t, lista) => lista.some((e) => new RegExp(`\\b${escapar(e)}\\b`).test(t));

export const triagem = (mensagem, respostasAnteriores) => {
  const texto = normalizar(mensagem);
  const palavras = palavrasDe(texto);
  if (temExpressao(texto, REGRAS.sinais_de_ajuda) || texto.includes('suicid')) return 'precisa_de_ajuda';
  if (temExpressao(texto, REGRAS.palavras_inadequadas)) return 'inadequada';
  if (CPF.test(texto) || TELEFONE.test(texto) || texto.includes('minha senha')) return 'dados_pessoais';
  if (CONTA.test(texto) || temExpressao(texto, REGRAS.pedidos_fora_do_tema)) return 'fora_do_tema';
  const letras = texto.replace(/[^a-z]/g, '');
  const vogais = [...letras].filter((c) => 'aeiou'.includes(c)).length;
  if (palavras.length < 3 || letras.length < 10 || vogais / letras.length < 0.25 || /([a-z])\1{3,}/.test(letras)) return 'sem_conteudo';
  if (respostasAnteriores.some((r) => normalizar(r) === texto)) return 'repetida';
  return null;
};

export const xpDasNotas = (notas) => {
  const limpa = (c) => Math.max(0, Math.min(10, Math.trunc(notas[c] || 0)));
  if (limpa('relevancia') < REGRAS.relevancia_minima) return 0;
  return Math.round((CRITERIOS.reduce((t, c) => t + REGRAS.pesos[c] * limpa(c), 0) / 10) * REGRAS.xp_maximo);
};

const avaliarSemIa = (mensagem) => {
  const texto = normalizar(mensagem);
  const n = palavrasDe(texto).length;
  const conta = (lista) => lista.filter((m) => new RegExp(`\\b${escapar(m)}\\b`).test(texto)).length;
  const marcas = conta(REGRAS.marcas_de_exemplo);
  const girias = conta(REGRAS.girias);
  const pontuada = /[.,;!?]/.test(mensagem);
  const curta = n < 8;
  const notas = {
    relevancia: curta ? 3 : n >= 15 ? 7 : 6,
    clareza: curta ? 3 : n < 20 ? 6 : n > 180 ? 6 : 8 + (pontuada ? 1 : 0),
    exemplos: Math.min(n >= 15 ? 10 : 6, (curta ? 1 : 2) + 3 * marcas),
    postura: Math.min(curta ? 5 : 9, Math.max(2, 9 - 3 * girias)),
  };
  if (girias >= 2) notas.clareza = Math.min(notas.clareza, 5);
  const pior = CRITERIOS.reduce((a, c) => (notas[c] < notas[a] ? c : a), CRITERIOS[0]);
  const { dicas } = REGRAS;
  const feedback = notas[pior] >= 8 ? dicas.otima : pior === 'clareza' ? (n > 180 ? dicas.clareza_longa : dicas.clareza_curta) : dicas[pior];
  return { notas, feedback };
};

// Uma rodada (espelho de entrevista.conduzir com a avaliação de reserva)
export const conduzirDemo = (mensagem, perguntaAtual, respostasAnteriores, perguntasJaFeitas) => {
  const categoria = triagem(mensagem, respostasAnteriores);
  if (categoria) {
    const fixa = REGRAS.mensagens[categoria];
    return {
      categoria, notas: null, xp_concedido: 0, analise_feedback: fixa.feedback, pergunta: perguntaAtual,
      fala: categoria === 'precisa_de_ajuda' ? fixa.fala : `${fixa.fala} ${REGRAS.fala_volta_pergunta} ${perguntaAtual}`,
    };
  }
  const { notas, feedback } = avaliarSemIa(mensagem);
  const proxima = REGRAS.perguntas[perguntasJaFeitas % REGRAS.perguntas.length];
  return { categoria: 'resposta', notas, xp_concedido: xpDasNotas(notas), analise_feedback: feedback, fala: proxima, pergunta: proxima };
};
