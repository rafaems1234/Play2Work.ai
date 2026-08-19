import React, { useState, useEffect } from 'react';
import { IconTrophy, IconWarning } from './icons';
import { API_BASE_URL } from '../api';

const WeeklyLeaderboard = () => {
  const [ranking, setRanking] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const buscarRanking = async () => {
      try {
        setCarregando(true);
        setErro(null);
        const response = await fetch(`${API_BASE_URL}/api/ranking`);
        if (!response.ok) throw new Error('Não foi possível carregar o ranking.');
        const dados = await response.json();
        setRanking(Array.isArray(dados) ? dados : []);
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
          transition: all 0.2s ease;
        }
        .leaderboard-row:hover {
          border-color: rgba(167,139,250,0.25) !important;
          background: rgba(167,139,250,0.05) !important;
          transform: translateX(3px);
        }
      `}</style>
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '24px', padding: '32px' }}>
        <header style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', background: 'rgba(167,139,250,0.1)', padding: '5px 14px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconTrophy /> Ranking Semanal</span>
          <h2 style={{ fontSize: '28px', color: '#f1f5f9', marginTop: '12px' }}>Leaderboard Play2Work</h2>
        </header>

        {carregando && (
          <p style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>Carregando ranking...</p>
        )}

        {erro && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '20px 24px', textAlign: 'center', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <IconWarning /> {erro}
          </div>
        )}

        {!carregando && !erro && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ranking.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>Ninguém pontuou essa semana ainda.</p>
            ) : (
              ranking.map((user) => (
                <div key={user.posicao} className="leaderboard-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(167,139,250,0.08)', borderRadius: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: user.posicao === 1 ? '#fbbf24' : '#94a3b8' }}>#{user.posicao}</span>
                    <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{user.nome}</span>
                    <span style={{ fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>{user.categoria}</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', color: '#67e8f9', fontWeight: '700' }}>{user.xp_semanal} XP</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyLeaderboard;
