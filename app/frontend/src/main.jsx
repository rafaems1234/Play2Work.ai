import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { aplicarTema, temaSalvo } from './hooks/useTema'

// Tema antes do primeiro desenho da tela -- sem piscar escuro pra quem escolheu o claro
aplicarTema(temaSalvo())

// Proteção contra cópia (par do user-select: none em index.css): bloqueia
// copiar/recortar, o menu do botão direito e arrastar conteúdo, exceto em
// campos de digitação e em áreas marcadas com .permitir-copia.
const PODE_COPIAR = 'input, textarea, [contenteditable="true"], .permitir-copia';
const podeCopiar = (alvo) => alvo instanceof Element && Boolean(alvo.closest(PODE_COPIAR));
const selecaoPermitida = () => {
  const selecao = window.getSelection();
  if (!selecao || selecao.isCollapsed) return true;
  const no = selecao.anchorNode;
  return podeCopiar(no instanceof Element ? no : no?.parentElement);
};

['copy', 'cut'].forEach((evento) => {
  document.addEventListener(evento, (e) => {
    if (!podeCopiar(e.target) && !selecaoPermitida()) e.preventDefault();
  });
});
document.addEventListener('contextmenu', (e) => {
  if (!podeCopiar(e.target)) e.preventDefault();
});
document.addEventListener('dragstart', (e) => {
  if (!podeCopiar(e.target)) e.preventDefault();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
