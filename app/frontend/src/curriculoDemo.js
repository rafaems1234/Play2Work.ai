// Gerador de currículo no modo demonstração: as mesmas regras de curriculo.py
// (triagem do texto e montagem sem IA), lidas do mesmo data/curriculo.json.
// O cabeçalho (nome, idade, contato) vem do cadastro, como no backend.
import REGRAS from './data/curriculo.json';
import { REGRAS as REGRAS_ENTREVISTA, CONTA, CPF, TELEFONE, normalizar, palavrasDe, escapar, temExpressao } from './entrevistaDemo';

const { maximos: MAXIMOS } = REGRAS;

// Motivo de recusa (chave de REGRAS.recusas) ou null se o texto pode virar currículo
const triagem = (texto) => {
  const t = normalizar(texto);
  const palavras = palavrasDe(t);
  if (temExpressao(t, REGRAS_ENTREVISTA.palavras_inadequadas)) return 'inadequado';
  if (CPF.test(t) || TELEFONE.test(t) || t.includes('minha senha')) return 'dados_pessoais';
  if (CONTA.test(t) || temExpressao(t, REGRAS_ENTREVISTA.pedidos_fora_do_tema)) return 'fora_do_tema';
  const letras = t.replace(/[^a-z]/g, '');
  if (!letras) return 'sem_sentido';
  const vogais = [...letras].filter((c) => 'aeiou'.includes(c)).length;
  if (vogais / letras.length < 0.25 || /([a-z])\1{3,}/.test(letras) || (palavras.length >= 6 && new Set(palavras).size / palavras.length < 0.4)) return 'sem_sentido';
  if (palavras.length < REGRAS.palavras_minimas) return 'curto';
  return null;
};

const limparLista = (itens, maximo) => {
  const vistos = new Set();
  return itens.map((i) => i.replace(/\s+/g, ' ').replace(/^[\s\-•·]+|[\s\-•·]+$/g, '').slice(0, 160)).filter((i) => {
    const chave = normalizar(i);
    if (!i || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  }).slice(0, maximo);
};

const temRaiz = (texto, raiz) => new RegExp(`\\b${escapar(raiz)}`).test(texto);

// Espelho de curriculo.montar_sem_ia
const montarSemIa = (texto, aluno) => {
  const t = normalizar(texto);
  const frases = texto.split(/[.;\n!?]+|,\s+(?=(?:e\s+)?(?:fiz|faco|faço|participo|participei|ajudo|ajudei|organizo|trabalho|criei|desenvolvi))/);
  const experiencias = frases.map((f) => f.trim())
    .filter((f) => f.length > 8 && REGRAS.verbos_experiencia.some((v) => temRaiz(normalizar(f), v)))
    .map((f) => f.charAt(0).toUpperCase() + f.slice(1));
  const doTexto = REGRAS.habilidades_conhecidas.filter((h) => new RegExp(`\\b${escapar(normalizar(h))}\\b`).test(t));
  const soft = REGRAS.soft_por_palavra.filter(([raizes]) => raizes.some((r) => temRaiz(t, r))).map(([, nome]) => nome);
  const area = aluno.itinerario;
  return {
    objetivo_profissional: `Estudante do Ensino Médio em busca da primeira oportunidade como Jovem Aprendiz${area ? ` na área de ${area}` : ''}, com vontade de aplicar na prática o que venho aprendendo e de crescer junto com a equipe.`,
    experiencias: limparLista(experiencias, MAXIMOS.experiencias),
    hard_skills: limparLista([...doTexto, ...(aluno.habilidades || [])], MAXIMOS.hard_skills),
    soft_skills: limparLista(soft, MAXIMOS.soft_skills),
    sugestao_areas_atuacao: [area ? `Jovem Aprendiz em ${area}` : 'Jovem Aprendiz'],
  };
};

// { erro } com a mensagem de recusa, ou { curriculo }
export const gerarCurriculoDemo = (texto, aluno) => {
  const motivo = triagem(texto);
  return motivo ? { erro: REGRAS.recusas[motivo] } : { curriculo: montarSemIa(texto, aluno) };
};
