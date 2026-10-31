import React from 'react';

// Fundo fixo do app: grade técnica que some nas bordas, dois brilhos
// (magenta e ciano) respirando devagar e uma linha de varredura vertical.
const TechBackground = () => (
  <>
    <style>{`
      .tech-bg {
        position: fixed;
        inset: 0;
        overflow: hidden;
        z-index: 0;
        pointer-events: none;
        background: var(--bg);
      }

      .tech-bg-grid {
        position: absolute;
        inset: -2px;
        background-image:
          linear-gradient(rgb(var(--tinta-rgb) / 0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgb(var(--tinta-rgb) / 0.045) 1px, transparent 1px);
        background-size: 56px 56px;
        mask-image: radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 100%);
        -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 100%);
      }

      .tech-bg-glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(110px);
        will-change: transform, opacity;
      }

      .tech-bg-glow-1 {
        width: 620px; height: 620px;
        top: -260px; left: -180px;
        background: radial-gradient(circle, rgb(var(--accent-rgb) / 0.55), transparent 70%);
        animation: techGlow1 18s ease-in-out infinite;
      }

      .tech-bg-glow-2 {
        width: 540px; height: 540px;
        bottom: -260px; right: -160px;
        background: radial-gradient(circle, rgb(var(--accent-2-rgb) / 0.35), transparent 70%);
        animation: techGlow2 22s ease-in-out infinite;
      }

      .tech-bg-scan {
        position: absolute;
        left: 0; right: 0;
        height: 160px;
        background: linear-gradient(180deg, transparent, rgb(var(--accent-rgb) / 0.05) 50%, transparent);
        animation: techScan 9s linear infinite;
      }

      .tech-bg-noise {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(0deg, rgb(var(--tinta-rgb) / 0.012) 0 1px, transparent 1px 3px);
      }

      @keyframes techGlow1 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.55; }
        50% { transform: translate(80px, 60px) scale(1.12); opacity: 0.8; }
      }
      @keyframes techGlow2 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
        50% { transform: translate(-70px, -50px) scale(1.15); opacity: 0.75; }
      }
      @keyframes techScan {
        0% { top: -160px; }
        100% { top: 100%; }
      }

      @media (prefers-reduced-motion: reduce) {
        .tech-bg-glow, .tech-bg-scan { animation: none !important; }
        .tech-bg-scan { display: none; }
      }
    `}</style>
    <div className="tech-bg" aria-hidden="true">
      <div className="tech-bg-glow tech-bg-glow-1" />
      <div className="tech-bg-glow tech-bg-glow-2" />
      <div className="tech-bg-grid" />
      <div className="tech-bg-scan" />
      <div className="tech-bg-noise" />
    </div>
  </>
);

export default TechBackground;
