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
