import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { IconFire, IconHeart, IconTrophy, IconStar, IconBarbell, IconBook, IconRetry, IconCheckCircle, IconTimer, IconSkip } from './icons';
import { useCountUp } from '../hooks/useCountUp';
import { tocarSomFimQuiz } from '../utils/sound';

// Tela final do Quiz do Dia, no espírito do Duolingo: cartões que entram um
// por um com números contando, e a cor de tudo muda com o desempenho --
// vermelho (bora revisar) → amarelo → azul → verde (perfeito). A ofensiva
// "pega fogo" maior quanto mais dias seguidos.

const FAIXAS = [
  { min: 100, cor: '#34d399', rgb: '52 211 153', titulo: 'Perfeito!', frase: 'Gabaritou. Isso é nível de contratado.', Icone: IconTrophy },
  { min: 80, cor: '#34d399', rgb: '52 211 153', titulo: 'Mandou muito bem!', frase: 'Quase tudo certo — continua assim.', Icone: IconStar },
  { min: 60, cor: '#60a5fa', rgb: '96 165 250', titulo: 'Bom treino!', frase: 'Tá no caminho. Revise as que errou.', Icone: IconBarbell },
  { min: 40, cor: '#fbbf24', rgb: '251 191 36', titulo: 'Dá pra melhorar', frase: 'Leia as explicações e tente de novo amanhã.', Icone: IconBook },
  { min: 0, cor: '#f87171', rgb: '248 113 113', titulo: 'Bora revisar!', frase: 'Todo mundo começa assim. Amanhã tem mais.', Icone: IconRetry },
];

const faixaDaPrecisao = (precisao) => FAIXAS.find((f) => precisao >= f.min);

// Ofensiva "esquenta" com os dias: brasa → fogo → incêndio
const nivelFogo = (dias) => {
  if (dias >= 30) return { cor: '#a855f7', rotulo: 'Lendário', escala: 1.5 };
  if (dias >= 14) return { cor: '#ef4444', rotulo: 'Em chamas', escala: 1.35 };
  if (dias >= 7) return { cor: '#f97316', rotulo: 'Pegando fogo', escala: 1.2 };
  if (dias >= 3) return { cor: '#fb923c', rotulo: 'Esquentando', escala: 1.05 };
  return { cor: '#fdba74', rotulo: 'Acendendo', escala: 0.95 };
};

const formatarTempo = (segundos) => {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const Cartao = ({ indice, cor, rgb, rotulo, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 24, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay: 0.35 + indice * 0.18, type: 'spring', stiffness: 260, damping: 20 }}
    className="quiz-res-cartao"
    style={{ borderColor: `rgb(${rgb} / 0.45)`, background: `rgb(${rgb} / 0.08)` }}
  >
    <div className="quiz-res-cartao-topo" style={{ background: cor }}>{rotulo}</div>
    <div className="quiz-res-cartao-valor" style={{ color: cor }}>{children}</div>
  </motion.div>
);

// Número que só começa a contar quando o cartão entra
const Contador = ({ valor, atraso, sufixo = '' }) => {
  const [alvo, setAlvo] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAlvo(valor), atraso);
    return () => clearTimeout(id);
  }, [valor, atraso]);
  return <>{useCountUp(alvo, { duration: 1 })}{sufixo}</>;
};

const QuizResultado = ({ resultado, tempoSegundos, maiorCombo, pulosUsados, aoRefazer }) => {
  const precisao = resultado.total ? Math.round((resultado.acertos / resultado.total) * 100) : 0;
  const faixa = faixaDaPrecisao(precisao);
  const fogo = nivelFogo(resultado.ofensiva_dias || 0);
  const mediaPorPergunta = resultado.total ? Math.round(tempoSegundos / resultado.total) : 0;

  useEffect(() => {
    tocarSomFimQuiz(precisao);
    if (precisao >= 80) {
      const cores = precisao === 100 ? ['#34d399', '#fbbf24', '#60a5fa', '#f472b6'] : ['#34d399', '#6ee7b7', '#00e5ff'];
      confetti({ particleCount: precisao === 100 ? 180 : 110, spread: 85, origin: { y: 0.55 }, colors: cores });
    }
  }, [precisao]);

  return (
    <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
      <style>{`
        .quiz-res-grade {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 26px 0 18px;
        }
        @media (max-width: 640px) {
          .quiz-res-grade { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        .quiz-res-cartao {
          border: 2px solid;
          border-radius: 16px;
          overflow: hidden;
        }
        .quiz-res-cartao-topo {
          color: #0b1020;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 5px 6px;
        }
        .quiz-res-cartao-valor {
          font-size: 24px;
          font-weight: 800;
          padding: 14px 6px 16px;
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .quiz-res-chama {
          display: inline-flex;
          animation: quizResChama 0.9s ease-in-out infinite alternate;
          transform-origin: 50% 90%;
        }
        @keyframes quizResChama {
          0% { transform: scale(1) rotate(-4deg); filter: brightness(1); }
          100% { transform: scale(1.12) rotate(4deg); filter: brightness(1.25); }
        }
        .quiz-res-info { display: inline-flex; align-items: center; gap: 5px; }
        .quiz-res-barra {
          height: 12px;
          border-radius: 99px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          margin: 0 auto;
          max-width: 420px;
        }
        @media (prefers-reduced-motion: reduce) {
          .quiz-res-chama { animation: none; }
        }
      `}</style>

      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 12 }}
        style={{ fontSize: '56px', lineHeight: 1, marginBottom: '10px', color: faixa.cor, display: 'flex', justifyContent: 'center', filter: `drop-shadow(0 0 18px rgb(${faixa.rgb} / 0.45))` }}
        aria-hidden="true"
      >
        <faixa.Icone />
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ fontSize: '28px', fontWeight: '800', color: faixa.cor, marginBottom: '6px', letterSpacing: '-0.5px' }}
      >
        {faixa.titulo}
      </motion.h3>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '18px' }}>{faixa.frase}</p>

      <div className="quiz-res-barra" role="img" aria-label={`${precisao}% de acerto`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${precisao}%` }}
          transition={{ delay: 0.3, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', background: faixa.cor, borderRadius: '99px' }}
        />
      </div>

      <div className="quiz-res-grade">
        <Cartao indice={0} cor={faixa.cor} rgb={faixa.rgb} rotulo="Acertos">
          <Contador valor={precisao} atraso={450} sufixo="%" />
        </Cartao>
        <Cartao indice={1} cor="#fbbf24" rgb="251 191 36" rotulo="XP ganho">
          +<Contador valor={resultado.xp_concedido} atraso={630} />
        </Cartao>
        <Cartao indice={2} cor="#60a5fa" rgb="96 165 250" rotulo="Tempo">
          {formatarTempo(tempoSegundos)}
        </Cartao>
        <Cartao indice={3} cor={fogo.cor} rgb="249 115 22" rotulo={fogo.rotulo}>
          <span className="quiz-res-chama" style={{ fontSize: `${fogo.escala}em` }}><IconFire /></span>
          <Contador valor={resultado.ofensiva_dias || 0} atraso={990} />
        </Cartao>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 18px', color: '#94a3b8', fontSize: '13px', marginBottom: '14px' }}
      >
        <span className="quiz-res-info"><IconCheckCircle style={{ color: '#34d399' }} /> {resultado.acertos} de {resultado.total} certas</span>
        <span className="quiz-res-info"><IconFire style={{ color: '#f97316' }} /> Maior combo: x{maiorCombo}</span>
        <span className="quiz-res-info"><IconTimer style={{ color: '#60a5fa' }} /> ~{mediaPorPergunta}s por pergunta</span>
        {pulosUsados > 0 && <span className="quiz-res-info"><IconSkip /> {pulosUsados} pulo{pulosUsados > 1 ? 's' : ''}</span>}
      </motion.div>

      {resultado.vidas_recuperadas_combo > 0 && (
        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.35 }}
          style={{ color: '#f43f5e', fontSize: '13px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <IconHeart /> Seus combos recuperaram {resultado.vidas_recuperadas_combo} vida{resultado.vidas_recuperadas_combo > 1 ? 's' : ''}
        </motion.p>
      )}
      {resultado.vida_bonus_ganha ? (
        <p style={{ color: '#f43f5e', fontSize: '13px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <IconHeart /> 5 quizzes perfeitos seguidos! Ganhou 1 vida de bônus
        </p>
      ) : (
        precisao === 100 && (
          <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
            {resultado.quizzes_perfeitos_seguidos}/5 quizzes perfeitos seguidos pra ganhar vida de bônus
          </p>
        )
      )}
      <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '20px' }}>
        Nível {resultado.nivel_atual} · {resultado.categoria_status}
      </p>

      <button onClick={aoRefazer} className="quiz-next-btn" style={{ maxWidth: '260px', margin: '0 auto', background: faixa.cor, color: '#0b1020' }}>
        Fazer outro quiz
      </button>
    </div>
  );
};

export default QuizResultado;
