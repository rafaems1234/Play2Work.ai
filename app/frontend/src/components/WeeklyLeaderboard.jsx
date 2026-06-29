import React from 'react';

const WeeklyLeaderboard = () => {
  const rankingMock = [
    { posicao: 1, nome: "Rafael M.", pontos: 2450, tag: "👑 MVP" },
    { posicao: 2, nome: "Ana Silva", pontos: 2100, tag: "🔥 Streak" },
    { posicao: 3, nome: "Lucas Souza", pontos: 1850, tag: "⚡ Constante" },
  ];

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px', width: '100%' }}>
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '24px', padding: '32px' }}>
        <header style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', background: 'rgba(167,139,250,0.1)', padding: '5px 14px', borderRadius: '99px' }}>🏆 Ranking Semanal</span>
          <h2 style={{ fontSize: '28px', color: '#f1f5f9', marginTop: '12px' }}>Leaderboard Play2Work</h2>
        </header>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rankingMock.map((user) => (
            <div key={user.posicao} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(167,139,250,0.08)', borderRadius: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: user.posicao === 1 ? '#fbbf24' : '#94a3b8' }}>#{user.posicao}</span>
                <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{user.nome}</span>
                <span style={{ fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>{user.tag}</span>
              </div>
              <span style={{ fontFamily: 'monospace', color: '#67e8f9', fontWeight: '700' }}>{user.pontos} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeeklyLeaderboard;