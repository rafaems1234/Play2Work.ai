// Máscaras e conversões de CPF/data usadas no login do aluno e no painel da escola.

export const somenteDigitos = (texto) => (texto || '').replace(/\D/g, '');

export const mascararCpf = (texto) => {
  const d = somenteDigitos(texto).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
};

export const mascararData = (texto) => {
  const d = somenteDigitos(texto).slice(0, 8);
  return d.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
};

// 'dd/mm/aaaa' -> 'aaaa-mm-dd' (null se incompleta ou impossível, ex: 31/02)
export const dataBrParaIso = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto || '');
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const data = new Date(`${ano}-${mes}-${dia}T12:00:00`);
  if (Number.isNaN(data.getTime()) || data.getDate() !== Number(dia) || data.getMonth() + 1 !== Number(mes)) return null;
  return `${ano}-${mes}-${dia}`;
};

export const dataIsoParaBr = (iso) => {
  if (!iso) return '';
  // Com horário, o texto vem em UTC: a data certa é a do fuso local (21h do
  // dia 29 em Três Lagoas já é dia 30 em UTC). Data pura ('aaaa-mm-dd') não tem fuso.
  if (iso.length > 10) return dataHoraIsoParaBr(iso).slice(0, 10);
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

export const cpfValido = (texto) => {
  const cpf = somenteDigitos(texto);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(cpf[i]) * (tamanho + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(cpf[tamanho])) return false;
  }
  return true;
};

// Busca "como o usuário digita": ignora acento, maiúscula e pontuação de CPF
export const normalizarBusca = (texto) => (texto || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

// '67998765432' -> '(67) 99876-5432'; fixo com 10 dígitos -> '(67) 3521-0000'
export const mascararTelefone = (texto) => {
  const d = somenteDigitos(texto).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const meio = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, meio)}${d.length > meio ? `-${d.slice(meio)}` : ''}`;
};

export const telefoneValido = (texto) => [10, 11].includes(somenteDigitos(texto).length);

// Link pro WhatsApp da coordenação falar com o aluno/responsável (Brasil = 55)
export const linkWhatsapp = (telefone) => (telefone ? `https://wa.me/55${somenteDigitos(telefone)}` : null);

// 'aaaa-mm-ddThh:mm:ss' -> 'dd/mm/aaaa às hh:mm'
export const dataHoraIsoParaBr = (iso) => {
  if (!iso) return '';
  // O servidor grava em UTC sem fuso no texto; sem o 'Z' o navegador leria como hora local
  const comFuso = iso.length > 10 && !/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? `${iso}Z` : iso;
  const data = new Date(iso.length > 10 ? comFuso : `${iso}T12:00:00`);
  if (Number.isNaN(data.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(data.getDate())}/${p(data.getMonth() + 1)}/${data.getFullYear()} às ${p(data.getHours())}:${p(data.getMinutes())}`;
};

export const idadeDe = (iso, hoje = new Date()) => {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return hoje.getFullYear() - ano - ((hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) ? 1 : 0);
};

// 'aaaa-mm-dd' de hoje no fuso do aparelho (o da escola). toISOString() daria
// o dia em UTC, que em Três Lagoas vira às 20h.
export const hojeLocalIso = (agora = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
};
