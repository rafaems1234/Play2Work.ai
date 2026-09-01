import { atenderRequisicaoFake } from './mockApi';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Modo demonstração: liga por padrão (pra dar pra apresentar o produto
// rodando só `npm run dev`, sem precisar subir o backend/banco de dados).
// Pra desenvolver contra a API real, defina VITE_DEMO_MODE=false no .env.
export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE ?? 'true') !== 'false';

export const apiFetch = async (path, options = {}) => {
  if (DEMO_MODE) {
    return atenderRequisicaoFake(path, options);
  }

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
};
