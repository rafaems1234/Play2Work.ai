import { atenderRequisicaoFake } from './mockApi';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Modo demonstração: liga por padrão (pra dar pra apresentar o produto
// rodando só `npm run dev`, sem precisar subir o backend/banco de dados).
// Pra desenvolver contra a API real, defina VITE_DEMO_MODE=false no .env.
export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE ?? 'true') !== 'false';

// Dois logins independentes: o do aluno (CPF + data de nascimento) e o do
// painel da escola. Cada rota usa o token do seu "papel".
const CHAVES_TOKEN = { aluno: 'play2work_token_aluno', admin: 'play2work_token_admin' };
const ROTAS_DE_LOGIN = ['/api/auth/entrar', '/api/admin/login'];

const papelDaRota = (path) => (path.startsWith('/api/admin') ? 'admin' : 'aluno');

// O login do aluno fica só na aba (sessionStorage): no laboratório da escola o
// computador passa de aluno pra aluno, e fechar o navegador tem que encerrar a
// sessão. O do painel continua no localStorage (computador da coordenação).
const armazenamento = (papel) => (papel === 'aluno' ? sessionStorage : localStorage);

try {
  // Versões antigas guardavam o token do aluno no localStorage por 7 dias
  localStorage.removeItem(CHAVES_TOKEN.aluno);
} catch {
  // sem acesso ao storage -- nada a limpar
}

export const obterToken = (papel) => {
  try {
    return armazenamento(papel).getItem(CHAVES_TOKEN[papel]);
  } catch {
    return null;
  }
};

export const salvarToken = (papel, token) => {
  try {
    armazenamento(papel).setItem(CHAVES_TOKEN[papel], token);
  } catch {
    // sem storage (modo privado) -- a sessão dura só até recarregar a página
  }
  tokensEmMemoria[papel] = token;
};

export const limparToken = (papel) => {
  try {
    armazenamento(papel).removeItem(CHAVES_TOKEN[papel]);
  } catch {
    // nada a limpar
  }
  tokensEmMemoria[papel] = null;
};

const tokensEmMemoria = { aluno: obterToken('aluno'), admin: obterToken('admin') };

// Quem quiser reagir a sessão expirada (voltar pra tela de login) se registra aqui
const ouvintesSessaoExpirada = new Set();
export const aoExpirarSessao = (callback) => {
  ouvintesSessaoExpirada.add(callback);
  return () => ouvintesSessaoExpirada.delete(callback);
};

export const apiFetch = async (path, options = {}) => {
  const papel = papelDaRota(path);
  const token = tokensEmMemoria[papel];

  const resposta = DEMO_MODE
    ? await atenderRequisicaoFake(path, { ...options, token })
    : await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        // FormData (upload de arquivo): o navegador monta o Content-Type com o boundary
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

  if (resposta.status === 401 && !ROTAS_DE_LOGIN.includes(path.split('?')[0])) {
    limparToken(papel);
    ouvintesSessaoExpirada.forEach((callback) => callback(papel));
  }
  return resposta;
};

// Mensagem de erro do FastAPI ('detail') pra mostrar na tela
export const lerErro = async (resposta, padrao) => {
  try {
    const dados = await resposta.json();
    if (typeof dados.detail === 'string') return dados.detail;
    if (Array.isArray(dados.detail)) return 'Confira os campos preenchidos.';
  } catch {
    // resposta sem JSON
  }
  return padrao;
};

// Arquivos protegidos (certificado, material da aula) só saem com o token,
// então não dá pra usar um <a href> direto: baixa com apiFetch e entrega pro navegador.
export const baixarArquivo = async (path, nomeArquivo) => {
  const resposta = await apiFetch(path);
  if (!resposta.ok) return lerErro(resposta, 'Não foi possível baixar o arquivo.');
  const url = URL.createObjectURL(await resposta.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
};

// Mesmo esquema, pra tocar um áudio da aula num <audio>
export const urlDeArquivo = async (path) => {
  const resposta = await apiFetch(path);
  return resposta.ok ? URL.createObjectURL(await resposta.blob()) : null;
};
