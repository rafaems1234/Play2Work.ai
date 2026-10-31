// Status de carreira pelo XP total -- mesmos níveis de calcular_categoria_status
// (services.py), lidos do mesmo data/status_carreira.json.
import REGRAS from './data/status_carreira.json';

const NIVEIS = REGRAS.niveis;

export const STATUS_INICIAL = NIVEIS[0].nome;
export const STATUS_CONTRATADO = REGRAS.contratado;

export const statusPorXp = (xp) => [...NIVEIS].reverse().find((n) => (xp || 0) >= n.xp_minimo).nome;

// Próximo status e quanto falta (null no último nível)
export const proximoStatus = (xp) => {
  const proximo = NIVEIS.find((n) => n.xp_minimo > (xp || 0));
  return proximo ? { nome: proximo.nome, faltam: proximo.xp_minimo - (xp || 0) } : null;
};
