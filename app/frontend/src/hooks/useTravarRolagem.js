import { useEffect } from 'react';

// Enquanto uma janela por cima (ficha, "Minha conta", simulador...) estiver aberta,
// a página de trás para de rolar: assim só a janela tem barra de rolagem, em vez de
// duas barras lado a lado. Conta quantas janelas estão abertas (uma pode abrir outra)
// e compensa a largura da barra que some, pra a página não "pular" pro lado.
let abertas = 0;
let estiloAntes = null;

export default function useTravarRolagem(ativo = true) {
  useEffect(() => {
    if (!ativo) return undefined;
    const raiz = document.documentElement;
    if (abertas === 0) {
      const larguraBarra = window.innerWidth - raiz.clientWidth;
      estiloAntes = { overflow: raiz.style.overflow, paddingRight: raiz.style.paddingRight };
      raiz.style.overflow = 'hidden';
      if (larguraBarra > 0) raiz.style.paddingRight = `${larguraBarra}px`;
    }
    abertas += 1;
    return () => {
      abertas -= 1;
      if (abertas === 0 && estiloAntes) {
        raiz.style.overflow = estiloAntes.overflow;
        raiz.style.paddingRight = estiloAntes.paddingRight;
        estiloAntes = null;
      }
    };
  }, [ativo]);
}
