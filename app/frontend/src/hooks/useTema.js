import { useEffect, useState } from 'react';

// Tema do app do aluno: 'escuro' (padrão) ou 'claro'. Fica no atributo
// data-tema do <html> -- as variáveis de index.css fazem o resto -- e a
// escolha é salva no navegador (é só preferência de quem está usando).
const CHAVE_TEMA = 'play2work_tema';
const EVENTO_TEMA = 'play2work-tema';

export const temaSalvo = () => {
  try {
    return localStorage.getItem(CHAVE_TEMA) === 'claro' ? 'claro' : 'escuro';
  } catch {
    return 'escuro';
  }
};

export const aplicarTema = (tema) => {
  document.documentElement.dataset.tema = tema;
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // sem localStorage: vale só nesta sessão
  }
  window.dispatchEvent(new CustomEvent(EVENTO_TEMA, { detail: tema }));
};

export const useTema = () => {
  const [tema, setTema] = useState(() => document.documentElement.dataset.tema || 'escuro');
  useEffect(() => {
    const aoMudar = (e) => setTema(e.detail);
    window.addEventListener(EVENTO_TEMA, aoMudar);
    return () => window.removeEventListener(EVENTO_TEMA, aoMudar);
  }, []);
  return [tema, () => aplicarTema(tema === 'claro' ? 'escuro' : 'claro')];
};
