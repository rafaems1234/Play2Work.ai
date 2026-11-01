// Simulador de entrevista no modo demonstração: as mesmas regras de
// entrevista.py (triagem, conversa contínua e laudo com nota e XP calculados
// aqui), lidas do mesmo data/entrevista.json. Sem IA: perguntas do banco e laudo de reserva.
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

const PADROES_FORA_DO_TEMA = REGRAS.padroes_fora_do_tema.map((p) => new RegExp(p));

export const triagem = (mensagem, respostasAnteriores) => {
  const texto = normalizar(mensagem);
  const palavras = palavrasDe(texto);
  if (temExpressao(texto, REGRAS.sinais_de_ajuda) || texto.includes('suicid')) return 'precisa_de_ajuda';
  if (temExpressao(texto, REGRAS.palavras_inadequadas)) return 'inadequada';
  if (CPF.test(texto) || TELEFONE.test(texto) || texto.includes('minha senha')) return 'dados_pessoais';
  if (CONTA.test(texto) || temExpressao(texto, REGRAS.pedidos_fora_do_tema) || PADROES_FORA_DO_TEMA.some((p) => p.test(texto))) return 'fora_do_tema';
  const letras = texto.replace(/[^a-z]/g, '');
  const vogais = [...letras].filter((c) => 'aeiou'.includes(c)).length;
  if (palavras.length < 3 || letras.length < 10 || vogais / letras.length < 0.25 || /([a-z])\1{3,}/.test(letras)) return 'sem_conteudo';
  if (respostasAnteriores.some((r) => normalizar(r) === texto)) return 'repetida';
  return null;
};

// ------------------------------------------------------------------ notas e laudo (espelho de entrevista.py)
const { sessao: SESSAO } = REGRAS;
export const RESPOSTAS_MINIMAS = SESSAO.respostas_minimas;
export const RESPOSTAS_MAXIMAS = SESSAO.respostas_maximas;
export const LAUDOS_COM_XP_POR_DIA = SESSAO.laudos_com_xp_por_dia;
export const ENTREVISTAS_POR_RODADA = SESSAO.entrevistas_por_rodada;
export const META_DA_RODADA = SESSAO.meta_da_rodada;

const limparNotas = (notas) => Object.fromEntries(CRITERIOS.map((c) => [c, Math.max(0, Math.min(10, Math.trunc((notas || {})[c] || 0)))]));

export const notaGeral = (notas) => {
  const limpas = limparNotas(notas);
  let media = CRITERIOS.reduce((t, c) => t + REGRAS.pesos[c] * limpas[c], 0) * 10;
  if (limpas.relevancia < REGRAS.relevancia_minima) media = Math.min(media, 20);
  return Math.round(media);
};

export const xpDaNota = (nota) => Math.round((Math.max(0, Math.min(100, nota)) / 100) * SESSAO.xp_maximo);

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
  return notas;
};

// Espelho de entrevista.pergunta_da_fala
export const perguntaDaFala = (fala) => {
  const marcador = REGRAS.fala_volta_pergunta;
  const texto = (fala || '').includes(marcador) ? fala.slice(fala.lastIndexOf(marcador) + marcador.length).trim() : (fala || '');
  const perguntas = texto.match(/[^.!?]*\?/g);
  return perguntas ? perguntas.at(-1).trim() : texto;
};

// Uma troca da entrevista (espelho de entrevista.rodada, sem IA: a próxima pergunta vem do banco)
export const rodadaDemo = (mensagem, ultimaFala, respostasAnteriores, perguntasJaFeitas) => {
  const perguntaAtual = perguntaDaFala(ultimaFala);
  const categoria = triagem(mensagem, respostasAnteriores);
  if (categoria) {
    const fixa = REGRAS.mensagens[categoria];
    return {
      categoria, conta: false, encerrou: false,
      fala: categoria === 'precisa_de_ajuda' ? fixa.fala : `${fixa.fala} ${REGRAS.fala_volta_pergunta} ${perguntaAtual}`,
    };
  }
  // Sem IA não dá pra saber se "já tem o suficiente": encerra no máximo de respostas
  const respostas = respostasAnteriores.length + 1;
  if (respostas >= RESPOSTAS_MAXIMAS) return { categoria: 'resposta', conta: true, encerrou: true, fala: REGRAS.despedida };
  const ponte = REGRAS.pontes[perguntasJaFeitas % REGRAS.pontes.length];
  const proxima = REGRAS.perguntas[perguntasJaFeitas % REGRAS.perguntas.length];
  return { categoria: 'resposta', conta: true, encerrou: false, fala: `${ponte} ${proxima}` };
};

// Laudo de reserva (espelho de entrevista.laudo_sem_ia + montar_laudo)
export const laudoDemo = (respostas) => {
  const avaliacoes = respostas.length ? respostas.map(avaliarSemIa) : [limparNotas({})];
  const notas = Object.fromEntries(CRITERIOS.map((c) => [c, Math.round(avaliacoes.reduce((t, a) => t + a[c], 0) / avaliacoes.length)]));
  const ordem = [...CRITERIOS].sort((a, b) => notas[b] - notas[a] || CRITERIOS.indexOf(a) - CRITERIOS.indexOf(b));
  const { fortes, parecer } = REGRAS.laudo_reserva;
  const { dicas } = REGRAS;
  // Cada critério entra numa lista só: forte (nota alta) ou a melhorar (espelho de entrevista.laudo_sem_ia)
  let criteriosFortes = ordem.filter((c) => notas[c] >= 8).slice(0, 3);
  if (!criteriosFortes.length && notas[ordem[0]] >= 6) criteriosFortes = [ordem[0]];
  const pontosFortes = criteriosFortes.map((c) => fortes[c]);
  const melhorias = [...ordem].reverse().filter((c) => !criteriosFortes.includes(c) && notas[c] < 9).slice(0, 3).map((c) => (c === 'clareza' ? dicas.clareza_curta : dicas[c]));
  const nota = notaGeral(notas);
  return {
    notas,
    nota_geral: nota,
    xp: xpDaNota(nota),
    pontos_fortes: pontosFortes.length ? pontosFortes : [REGRAS.laudo_reserva.forte_minimo],
    pontos_melhoria: melhorias.length ? melhorias : [dicas.otima],
    parecer_recrutador: parecer[nota >= 70 ? 'alto' : nota >= 45 ? 'medio' : 'baixo'],
    resumo: REGRAS.laudo_reserva.resumo[nota >= 70 ? 'alto' : nota >= 45 ? 'medio' : 'baixo'],
    por_ia: false,
  };
};
