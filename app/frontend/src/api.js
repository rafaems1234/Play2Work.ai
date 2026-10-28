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

export const obterToken = (papel) => {
  try {
    return localStorage.getItem(CHAVES_TOKEN[papel]);
  } catch {
    return null;
  }
};

export const salvarToken = (papel, token) => {
  try {
    localStorage.setItem(CHAVES_TOKEN[papel], token);
  } catch {
    // sem localStorage (modo privado) -- a sessão dura só até recarregar a página
  }
  tokensEmMemoria[papel] = token;
};

export const limparToken = (papel) => {
  try {
    localStorage.removeItem(CHAVES_TOKEN[papel]);
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
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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
