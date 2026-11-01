import React, { useId } from 'react';

// Marca do First2Work: monograma "F2W" (o "2" em branco, F e W no degradê).
// Mesmo desenho de public/favicon.svg, inline pra herdar tamanho e não
// depender do caminho base do deploy.
const Logo = ({ size = 32, comFundo = true, style }) => {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="First2Work.ai" style={{ display: 'block', flexShrink: 0, ...style }}>
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
      <text
        x="32" y="41.5" textAnchor="middle"
        fontFamily="'Space Grotesk', 'Inter', 'Segoe UI', Arial, sans-serif"
        fontSize="23" fontWeight="800" letterSpacing="-1" fill={`url(#${gradId})`}
      >
        F<tspan fill="#fff">2</tspan>W
      </text>
    </svg>
  );
};

export default Logo;
