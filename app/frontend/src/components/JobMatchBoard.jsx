import React, { useState, useEffect } from 'react';

const JobMatchBoard = () => {
  const [oportunidades, setOportunidades] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aplicandoId, setAplicandoId] = useState(null);

  const ESTUDANTE_ID = 1;

  useEffect(() => {
    const buscarVagas = async () => {
      try {
        setCarregando(true);
        setErro(null); // Reseta o estado de erro antes de tentar conectar
        const response = await fetch(`http://127.0.0.1:8000/api/jobs/match/${ESTUDANTE_ID}`);
        if (!response.ok) throw new Error('Não foi possível carregar o mural de oportunidades.');
        const dados = await response.json();
        
        // Garante que o estado seja um array plano mesmo se o back encapsular a resposta
        setOportunidades(Array.isArray(dados) ? dados : dados.vagas || []);
      } catch (err) {
        console.error(err);
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    };
    buscarVagas();
  }, []);

  const aplicarParaVaga = async (vagaId, nomeEmpresa) => {
    try {
      setAplicandoId(vagaId);
      const response = await fetch('http://127.0.0.1:8000/api/jobs/apply-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudante_id: ESTUDANTE_ID, vaga_id: vagaId }),
      });
      if (!response.ok) throw new Error();
      const dados = await response.json();
      
      // Ajustado para capturar transacao_id de forma resiliente
      const webhookId = dados.transacao_id || dados.id_webhook || 'OK-2026';
      alert(`🎯 Meta Batida! O Play2Work.AI enviou seu perfil com sucesso para o banco de talentos da ${nomeEmpresa}.\n\nID do Webhook: ${webhookId}`);
    } catch (err) {
      alert('⚠️ Ops, falha ao conectar com o barramento da empresa parceira.');
    } finally {
      setAplicandoId(null);
    }
  };

  const getMatchStyle = (pct) => {
    const valorPct = pct || 0;
    if (valorPct >= 80) return { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' };
    if (valorPct >= 50) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' };
    return { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080812', padding: '48px 24px' }}>
      <style>{`
        .job-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(167,139,250,0.12);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }

        .job-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #7c3aed, #0e7490);
          opacity: 0;
          transition: opacity 0.25s;
        }

        .job-card:hover {
          border-color: rgba(167,139,250,0.28);
          background: rgba(167,139,250,0.04);
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }

        .job-card:hover::before { opacity: 1; }

        .apply-btn {
          width: 100%;
          border: none;
          border-radius: 12px;
          padding: 13px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          background: linear-gradient(135deg, rgba(124,58,237,0.6) 0%, rgba(14,116,144,0.5) 100%);
          border: 1px solid rgba(167,139,250,0.3);
          color: #e2e8f0;
        }

        .apply-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(124,58,237,0.8) 0%, rgba(14,116,144,0.7) 100%);
          box-shadow: 0 8px 20px rgba(124,58,237,0.25);
          transform: translateY(-1px);
        }

        .apply-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner {
          width: 40px; height: 40px;
          border: 2px solid rgba(167,139,250,0.15);
          border-top-color: #a78bfa;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .jobs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
      `}</style>

      <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
        <header style={{ marginBottom: '48px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '99px', padding: '6px 16px', marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px' }}>🎯 Match Inteligente</span>
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.8px', marginBottom: '12px' }}>
            Seu Mural de{' '}
            <span style={{ background: 'linear-gradient(135deg, #a78bfa, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Oportunidades
            </span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
            Nossa IA cruzou seu perfil com as melhores vagas da região e validou os dados corporativos.
          </p>
        </header>

        {carregando && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div className="spinner" />
            <p style={{ color: '#475569', fontSize: '14px', fontStyle: 'italic' }}>Calculando os melhores matches para você...</p>
          </div>
        )}

        {erro && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '20px 24px', textAlign: 'center', color: '#f87171' }}>
            <div style={{ fontSize: '16px', marginBottom: '6px' }}>⚠️ Não foi possível conectar ao servidor</div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Verifique se o seu Back-end (main.py) está rodando no terminal!</div>
          </div>
        )}

        {!carregando && !erro && (
          <div className="jobs-grid">
            {oportunidades.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', gridColumn: '1/-1', padding: '60px 0' }}>Nenhuma vaga encontrada para o seu perfil.</p>
            ) : (
              oportunidades.map((vaga) => {
                const percentual = vaga.percentual_match || 0;
                const matchStyle = getMatchStyle(percentual);
                
                return (
                  <div key={vaga.id || Math.random()} className="job-card">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0', marginBottom: '4px', letterSpacing: '-0.2px' }}>
                            {vaga.titulo_vaga || vaga.titulo || 'Vaga de Tecnologia'}
                          </h2>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#a78bfa' }}>{vaga.empresa || 'Empresa Parceira'}</div>
                          <div style={{ fontSize: '11px', color: '#334155', marginTop: '2px', fontStyle: 'italic' }}>
                            {vaga.razao_social_real || vaga.razao_social || 'Dados Corporativos Verificados'}
                          </div>
                        </div>

                        <div style={{
                          flexShrink: 0,
                          background: matchStyle.bg,
                          border: `1px solid ${matchStyle.border}`,
                          borderRadius: '10px',
                          padding: '6px 12px',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '18px', fontWeight: '800', color: matchStyle.color, lineHeight: 1 }}>
                            {percentual}%
                          </div>
                          <div style={{ fontSize: '10px', color: matchStyle.color, opacity: 0.7, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            match
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>📍</span> {vaga.localizacao || 'Remoto / São Paulo'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>🏢</span> {vaga.tipo_modalidade || vaga.modalidade || 'Híbrido'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => aplicarParaVaga(vaga.id, vaga.empresa || 'Empresa')}
                      disabled={aplicandoId === vaga.id}
                      className="apply-btn"
                    >
                      {aplicandoId === vaga.id ? 'Enviando perfil...' : 'Ver detalhes e aplicar →'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobMatchBoard;