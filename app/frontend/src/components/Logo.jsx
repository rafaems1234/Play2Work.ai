import React, { useId } from 'react';

// Marca do Play2Work: "P" geométrico com botão de play no miolo (Play → Work).
// Mesmo desenho de public/favicon.svg, inline pra herdar tamanho e não
// depender do caminho base do deploy.
const Logo = ({ size = 32, comFundo = true, style }) => {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Play2Work.ai" style={{ display: 'block', flexShrink: 0, ...style }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2e7bff" />
          <stop offset="1" stopColor="#00e5ff" />
        </linearGradient>
      </defs>
      {comFundo && (
        <>
          <rect width="64" height="64" rx="14" fill="#07070b" />
          <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="13.25" fill="none" stroke={`url(#${gradId})`} strokeOpacity="0.55" strokeWidth="1.5" />
        </>
      )}
      <path d="M21 51V15h13.5a11.5 11.5 0 0 1 0 23H21" fill="none" stroke={`url(#${gradId})`} strokeWidth="8" strokeLinejoin="round" />
      <path d="M30.5 21.5v10l8-5z" fill="#fff" />
    </svg>
  );
};

export default Logo;
