import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { IconGraduationCap, IconWarning } from './icons';
import { API_BASE_URL } from '../api';
import { Skeleton, SkeletonStyles } from './Skeleton';

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const CourseSelector = ({ estudanteId = 1, aoEscolher }) => {
  const [itinerarios, setItinerarios] = useState([]);
  const [atual, setAtual] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [escolhendo, setEscolhendo] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const carregar = async () => {
      try {
        setCarregando(true);
        const [respIt, respStatus] = await Promise.all([
          fetch(`${API_BASE_URL}/api/quiz/itinerarios`),
          fetch(`${API_BASE_URL}/api/estudante/${estudanteId}/status`),
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
  }, [estudanteId]);

  const escolher = async (nome) => {
    try {
      setEscolhendo(nome);
      setErro(null);
      const response = await fetch(`${API_BASE_URL}/api/itinerario/escolher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudante_id: estudanteId, itinerario: nome }),
      });
      if (!response.ok) throw new Error('Não foi possível selecionar o curso.');
      const dados = await response.json();
      setAtual(dados.itinerario);
      if (aoEscolher) aoEscolher(dados.itinerario);
    } catch (err) {
      console.error(err);
      setErro(err.message);
    } finally {
      setEscolhendo(null);
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <style>{`
        .course-card {
          text-align: left;
          padding: 24px;
          border-radius: 20px;
          border: 1px solid rgba(167,139,250,0.15);
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }

        .course-card:hover {
          border-color: rgba(167,139,250,0.4);
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.3);
        }

        .course-card.ativo {
          border-color: rgba(52,211,153,0.5);
          background: rgba(52,211,153,0.06);
        }

        .course-card:disabled {
          cursor: default;
          opacity: 0.6;
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

      <div style={{ width: '100%', maxWidth: '900px' }}>
        <header style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid rgba(167,139,250,0.1)', paddingBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Seu Curso</div>
            <h1 style={{ fontSize: '30px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.5px' }}>
              Escolha seu <span className="gradient-text-live">itinerário</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginTop: '8px', maxWidth: '480px' }}>
              É como escolher um idioma pra estudar: o curso que você seguir aqui define o tema do Quiz do Dia e o contexto das perguntas da IA Recrutadora no Simulador.
            </p>
          </div>
          <IconGraduationCap style={{ fontSize: '28px', color: '#a78bfa', flexShrink: 0 }} />
        </header>

        {erro && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '16px', textAlign: 'center', color: '#f87171', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <IconWarning /> {erro}
          </div>
        )}

        {carregando ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(167,139,250,0.1)' }}>
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
            {itinerarios.map((it) => {
              const ativo = it.nome === atual;
              return (
                <motion.button
                  key={it.nome}
                  variants={cardVariants}
                  onClick={() => escolher(it.nome)}
                  disabled={escolhendo === it.nome}
                  className={`course-card ${ativo ? 'ativo' : ''}`}
                  whileHover={{ scale: ativo ? 1 : 1.01 }}
                >
                  {ativo && <div className="course-badge">✓ Curso atual</div>}
                  <div style={{ fontSize: '17px', fontWeight: '800', color: '#f1f5f9', marginBottom: '8px' }}>{it.nome}</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>{it.descricao}</div>
                  {escolhendo === it.nome && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#a78bfa' }}>Selecionando...</div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CourseSelector;
