import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { IconGraduationCap, IconWarning, IconCheck } from './icons';
import { apiFetch } from '../api';
import { Skeleton, SkeletonStyles } from './Skeleton';

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// O itinerário é o curso que o aluno faz na escola: quem cadastra é a escola
// (painel admin). Aqui o aluno só vê o dele em destaque e conhece os outros.
const CourseSelector = () => {
  const [itinerarios, setItinerarios] = useState([]);
  const [atual, setAtual] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      try {
        setCarregando(true);
        const [respIt, respStatus] = await Promise.all([
          apiFetch('/api/quiz/itinerarios'),
          apiFetch('/api/estudante/me/status'),
        ]);
        if (respIt.ok) setItinerarios((await respIt.json()).itinerarios || []);
        if (respStatus.ok) setAtual((await respStatus.json()).itinerario);
      } catch (err) {
        console.error(err);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, []);

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <style>{`
        .course-card {
          text-align: left;
          padding: 24px;
          border-radius: 20px;
          border: 1px solid rgb(var(--accent-rgb) / 0.15);
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          font-family: inherit;
          position: relative;
          overflow: hidden;
          opacity: 0.55;
        }

        .course-card.ativo {
          border-color: rgba(52,211,153,0.5);
          background: rgba(52,211,153,0.06);
          opacity: 1;
          grid-column: 1 / -1;
        }

        .course-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #34d399;
          background: rgba(52,211,153,0.12);
          border: 1px solid rgba(52,211,153,0.3);
          padding: 3px 10px;
          border-radius: 99px;
          margin-bottom: 10px;
        }
      `}</style>
      <SkeletonStyles />

      <div style={{ width: '100%', maxWidth: '1060px' }}>
        <header style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid rgb(var(--accent-rgb) / 0.1)', paddingBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Seu Curso</div>
            <h1 style={{ fontSize: '30px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.5px' }}>
              Seu <span className="gradient-text-live">itinerário</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginTop: '8px', maxWidth: '520px' }}>
              É o curso que você faz na escola, cadastrado pela coordenação. Ele define o tema do Quiz do Dia, o contexto da IA Recrutadora no Simulador e as vagas pra que a escola pode te indicar. Está errado? Fale com a coordenação.
            </p>
          </div>
          <IconGraduationCap style={{ fontSize: '28px', color: 'var(--accent)', flexShrink: 0 }} />
        </header>

        {!carregando && !atual && (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '16px', padding: '16px', textAlign: 'center', color: '#fbbf24', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '14px' }}>
            <IconWarning /> Seu itinerário ainda não foi cadastrado pela escola.
          </div>
        )}

        {carregando ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgb(var(--accent-rgb) / 0.1)' }}>
                <Skeleton style={{ height: '18px', width: '70%', marginBottom: '12px' }} />
                <Skeleton style={{ height: '13px', width: '100%', marginBottom: '6px' }} />
                <Skeleton style={{ height: '13px', width: '90%' }} />
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}
            variants={gridVariants}
            initial="hidden"
            animate="visible"
          >
            {[...itinerarios].sort((a, b) => (b.nome === atual) - (a.nome === atual)).map((it) => {
              const ativo = it.nome === atual;
              return (
                <motion.div
                  key={it.nome}
                  variants={cardVariants}
                  className={`course-card ${ativo ? 'ativo' : ''}`}
                >
                  {ativo && <div className="course-badge"><IconCheck /> Seu curso · definido pela escola</div>}
                  <div style={{ fontSize: ativo ? '22px' : '17px', fontWeight: '800', color: '#f1f5f9', marginBottom: '8px' }}>{it.nome}</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>{it.descricao}</div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CourseSelector;
