import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IconTrophy, IconWarning } from './icons';
import { apiFetch } from '../api';
import { SkeletonStyles, RowSkeleton } from './Skeleton';

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

const ZONA_ESTILO = {
  promocao: { borda: 'rgba(52,211,153,0.4)', fundo: 'rgba(52,211,153,0.06)', rotulo: '↑ Zona de promoção', cor: '#6ee7b7' },
  rebaixamento: { borda: 'rgba(239,68,68,0.4)', fundo: 'rgba(239,68,68,0.05)', rotulo: '↓ Zona de rebaixamento', cor: '#fca5a5' },
};

const WeeklyLeaderboard = () => {
  const [ranking, setRanking] = useState([]);
  const [liga, setLiga] = useState(null);
  const [ligaEmoji, setLigaEmoji] = useState('🥉');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const buscarRanking = async () => {
      try {
        setCarregando(true);
        setErro(null);
        const response = await apiFetch('/api/ranking');
        if (!response.ok) throw new Error('Não foi possível carregar o ranking.');
        const dados = await response.json();
        setRanking(Array.isArray(dados?.ranking) ? dados.ranking : []);
        setLiga(dados?.liga || null);
        setLigaEmoji(dados?.liga_emoji || '🥉');
      } catch (err) {
        console.error(err);
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    };
    buscarRanking();
  }, []);

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px', width: '100%' }}>
      <style>{`
        .leaderboard-row {
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .leaderboard-row:hover {
          border-color: rgba(167,139,250,0.25) !important;
          background: rgba(167,139,250,0.05) !important;
        }
        .rank-glow {
          box-shadow: 0 0 12px rgba(251,191,36,0.2);
        }
      `}</style>
      <SkeletonStyles />
      <div style={{ background: 'rgba(255,255,255,0.045)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '24px', padding: '32px' }}>
        <header style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Ranking Semanal</div>
            <h2 style={{ fontSize: '26px', color: '#f1f5f9', fontWeight: '800', letterSpacing: '-0.4px' }}>Leaderboard <span className="gradient-text-live">Play2Work</span></h2>
          </div>
          <IconTrophy style={{ fontSize: '28px', color: '#fbbf24', flexShrink: 0 }} />
        </header>

        {liga && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '13px', color: '#94a3b8' }}>
            <span style={{ fontSize: '18px' }}>{ligaEmoji}</span>
            Você está na <strong style={{ color: '#e2e8f0' }}>Liga {liga}</strong> — top 3 sobe, últimos 3 descem na virada da semana (grupos com 4+ pessoas).
          </div>
        )}

        {carregando && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        )}

        {erro && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '20px 24px', textAlign: 'center', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <IconWarning /> {erro}
          </div>
        )}

        {!carregando && !erro && (
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} variants={listVariants} initial="hidden" animate="visible">
            {ranking.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>Ninguém pontuou essa semana ainda.</p>
            ) : (
              ranking.map((user) => {
                const zona = ZONA_ESTILO[user.zona];
                return (
                  <motion.div
                    key={user.posicao}
                    className={`leaderboard-row ${user.posicao === 1 ? 'rank-glow' : ''}`}
                    variants={rowVariants}
                    whileHover={{ x: 6, scale: 1.01 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                      padding: '16px 20px', background: zona ? zona.fundo : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${zona ? zona.borda : 'rgba(167,139,250,0.08)'}`, borderRadius: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: user.posicao === 1 ? '#fbbf24' : '#94a3b8' }}>#{user.posicao}</span>
                      <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{user.nome}</span>
                      <span style={{ fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>{user.categoria}</span>
                      {zona && (
                        <span style={{ fontSize: '10px', color: zona.cor, fontWeight: '800', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{zona.rotulo}</span>
                      )}
                    </div>
                    <span style={{ fontFamily: 'monospace', color: '#67e8f9', fontWeight: '700', whiteSpace: 'nowrap' }}>{user.xp_semanal} XP</span>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default WeeklyLeaderboard;
