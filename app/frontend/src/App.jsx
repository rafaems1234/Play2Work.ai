import React, { useState } from 'react';
import InterviewSimulator from './components/InterviewSimulator';
import JobMatchBoard from './components/JobMatchBoard';
import ResumeBuilder from './components/ResumeBuilder';
import WeeklyLeaderboard from './components/WeeklyLeaderboard';

function App() {
  const [abaAtiva, setAbaAtiva] = useState('vagas');
  const [estudanteStatus, setEstudanteStatus] = useState({
    nome: 'Gabriel',
    xp_total: 120,
    nivel_gamificacao: 1,
    ofensiva_dias: 4,
    categoria_status: '🌌 Na Jornada'
  });

  const ESTUDANTE_ID = 1;

  const atualizarDadosUsuario = (novosDados) => {
    setEstudanteStatus(prev => ({ ...prev, ...novosDados }));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080812', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Barra Superior (Header) */}
      <header style={{ background: 'rgba(8, 8, 18, 0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(167, 139, 250, 0.12)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifycontent: 'space-between' }}>
          
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🎮</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#a78bfa' }}>Play2Work.ai</span>
          </div>

          {/* Estado de Gamificação */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px' }}>
              <span>Liga:</span>
              <span style={{ color: '#a78bfa', fontWeight: '700' }}>{estudanteStatus.categoria_status}</span>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px' }}>
              <span>🔥</span>
              <span style={{ color: '#a78bfa', fontWeight: '700' }}>{estudanteStatus.ofensiva_dias} dias</span>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px' }}>
              <span>Nível {estudanteStatus.nivel_gamificacao}</span>
              <span style={{ color: '#67e8f9', fontWeight: '600' }}>{estudanteStatus.xp_total} XP</span>
            </div>
          </div>

          {/* Menu de Navegação */}
          <nav style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button 
              onClick={() => setAbaAtiva('vagas')} 
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: abaAtiva === 'vagas' ? 'rgba(167, 139, 250, 0.2)' : 'transparent', color: abaAtiva === 'vagas' ? '#c4b5fd' : '#94a3b8', border: '1px solid transparent' }}
            >
              💼 Mural
            </button>
            <button 
              onClick={() => setAbaAtiva('simulador')} 
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: abaAtiva === 'simulador' ? 'rgba(167, 139, 250, 0.2)' : 'transparent', color: abaAtiva === 'simulador' ? '#c4b5fd' : '#94a3b8', border: '1px solid transparent' }}
            >
              🤖 Simulador IA
            </button>
            <button 
              onClick={() => setAbaAtiva('curriculo')} 
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: abaAtiva === 'curriculo' ? 'rgba(167, 139, 250, 0.2)' : 'transparent', color: abaAtiva === 'curriculo' ? '#c4b5fd' : '#94a3b8', border: '1px solid transparent' }}
            >
              ✨ Currículo
            </button>
            <button 
              onClick={() => setAbaAtiva('ranking')} 
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: abaAtiva === 'ranking' ? 'rgba(167, 139, 250, 0.2)' : 'transparent', color: abaAtiva === 'ranking' ? '#c4b5fd' : '#94a3b8', border: '1px solid transparent' }}
            >
              🏆 Ranking
            </button>
          </nav>

        </div>
      </header>

      {/* Conteúdo Dinâmico das Abas */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
        {abaAtiva === 'vagas' && (
          <>
            <JobMatchBoard estudanteId={ESTUDANTE_ID} />
          </>
        )}
        {abaAtiva === 'simulador' && (
          <>
            <InterviewSimulator 
              estudanteId={ESTUDANTE_ID} 
              aoGanharXp={atualizarDadosUsuario} 
            />
          </>
        )}
        {abaAtiva === 'curriculo' && (
          <>
            <ResumeBuilder estudanteId={ESTUDANTE_ID} />
          </>
        )}
        {abaAtiva === 'ranking' && (
          <>
            <WeeklyLeaderboard />
          </>
        )}
      </main>

    </div>
  );
}

export default App;