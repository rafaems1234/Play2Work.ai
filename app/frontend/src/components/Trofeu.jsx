import React, { useId } from 'react';

// Taça de uma liga. 'bloqueada' desenha a silhueta com cadeado (liga que o
// estudante ainda não alcançou) -- escura no tema escuro, cinza-clara no claro.
// As cores do tema vão em style (var() não funciona em atributo de SVG).
const Trofeu = ({ liga, bloqueada = false, tamanho = 56 }) => {
  const gradId = useId();
  const preenchimento = bloqueada ? 'var(--trofeu-bloqueado)' : `url(#${gradId})`;
  const contorno = bloqueada ? 'rgb(var(--tinta-rgb) / 0.14)' : liga.corEscura;
  const cor = { fill: preenchimento, stroke: contorno };
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={liga.cor} />
          <stop offset="1" stopColor={liga.corEscura} />
        </linearGradient>
      </defs>
      {/* alças */}
      <path d="M14 11H8.5a1.5 1.5 0 0 0-1.5 1.5c0 5.2 3.4 9 8.2 9.8M34 11h5.5a1.5 1.5 0 0 1 1.5 1.5c0 5.2-3.4 9-8.2 9.8" fill="none" style={{ stroke: bloqueada ? 'rgb(var(--tinta-rgb) / 0.14)' : liga.cor }} strokeWidth="2.6" strokeLinecap="round" />
      {/* copa */}
      <path d="M13 7h22v9.5c0 6.6-4.9 11.5-11 11.5S13 23.1 13 16.5z" style={cor} strokeWidth="1.2" />
      {/* haste e base */}
      <path d="M21 27.5h6l1.2 7h-8.4z" style={cor} strokeWidth="1.2" />
      <rect x="14" y="34.5" width="20" height="6" rx="1.8" style={cor} strokeWidth="1.2" />
      {!bloqueada && <path d="M18 10.5v6c0 2 .8 3.8 2.2 5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" />}
      {bloqueada && (
        <g fill="none" style={{ stroke: 'rgb(var(--tinta-rgb) / 0.4)' }} strokeWidth="1.6" strokeLinecap="round">
          <rect x="20" y="15" width="8" height="6.5" rx="1.2" />
          <path d="M21.8 15v-2a2.2 2.2 0 0 1 4.4 0v2" />
        </g>
      )}
    </svg>
  );
};

export default Trofeu;
