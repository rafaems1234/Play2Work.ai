import React from 'react';

const AuroraBackground = () => (
  <>
    <style>{`
      .aurora-layer {
        position: fixed;
        inset: 0;
        overflow: hidden;
        z-index: 0;
        pointer-events: none;
      }

      .aurora-blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(90px);
        opacity: 0.32;
        will-change: transform;
      }

      .aurora-blob-1 {
        width: 560px; height: 560px;
        top: -160px; left: -120px;
        background: radial-gradient(circle, #7c3aed, transparent 70%);
        animation: auroraFloat1 24s ease-in-out infinite;
      }

      .aurora-blob-2 {
        width: 500px; height: 500px;
        top: 20%; right: -160px;
        background: radial-gradient(circle, #22d3ee, transparent 70%);
        animation: auroraFloat2 28s ease-in-out infinite;
      }

      .aurora-blob-3 {
        width: 460px; height: 460px;
        bottom: -180px; left: 28%;
        background: radial-gradient(circle, #ec4899, transparent 70%);
        animation: auroraFloat3 32s ease-in-out infinite;
      }

      @keyframes auroraFloat1 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(70px, 50px) scale(1.15); }
      }
      @keyframes auroraFloat2 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(-60px, 70px) scale(1.12); }
      }
      @keyframes auroraFloat3 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(50px, -60px) scale(1.18); }
      }

      @media (prefers-reduced-motion: reduce) {
        .aurora-blob { animation: none !important; }
      }
    `}</style>
    <div className="aurora-layer">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
    </div>
  </>
);

export default AuroraBackground;
