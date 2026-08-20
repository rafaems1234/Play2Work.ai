export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const TOKEN_KEY = 'play2work_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * fetch() com o token de autenticação já anexado. Se o back-end responder
 * 401 (token ausente/expirado), limpa a sessão local e recarrega a página,
 * o que devolve o usuário pra tela de login.
 */
export const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    window.location.reload();
  }

  return response;
};
