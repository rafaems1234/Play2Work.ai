import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconPin, IconBuilding, IconWarning, IconClose, IconSparkle } from './icons';
import { apiFetch } from '../api';
import { SkeletonStyles, JobCardSkeleton } from './Skeleton';

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const handleCardMouseMove = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
};

const JobMatchBoard = () => {
  const [oportunidades, setOportunidades] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [vagaSelecionadaId, setVagaSelecionadaId] = useState(null);
  const [detalheVaga, setDetalheVaga] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [mensagemAplicacao, setMensagemAplicacao] = useState(null);

  useEffect(() => {
    const buscarVagas = async () => {
      try {
        setCarregando(true);
        setErro(null);
        const response = await apiFetch('/api/jobs/match');
        if (!response.ok) throw new Error('Não foi possível carregar o mural de oportunidades.');
        const dados = await response.json();
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

  const abrirDetalhes = async (vagaId) => {
    setVagaSelecionadaId(vagaId);
    setDetalheVaga(null);
    setMensagemAplicacao(null);
    setCarregandoDetalhe(true);
    try {
      const response = await apiFetch(`/api/jobs/${vagaId}`);
      if (!response.ok) throw new Error();
      setDetalheVaga(await response.json());
    } catch (err) {
      console.error(err);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const fecharDetalhes = () => {
    setVagaSelecionadaId(null);
    setDetalheVaga(null);
  };

  const aplicarParaVaga = async () => {
    if (!detalheVaga) return;
    try {
      setAplicando(true);
      const response = await apiFetch('/api/jobs/apply-meta', {
        method: 'POST',
        body: JSON.stringify({ vaga_id: detalheVaga.id }),
      });
      const dados = await response.json();
      if (!response.ok) throw new Error();
      setMensagemAplicacao(dados.mensagem);
      setDetalheVaga((prev) => ({ ...prev, ja_candidatado: true }));
    } catch (err) {
      console.error(err);
      setMensagemAplicacao('⚠️ Falha ao registrar a candidatura. Tente de novo.');
    } finally {
      setAplicando(false);
    }
  };

  const getMatchStyle = (pct) => {
    const valorPct = pct || 0;
    if (valorPct >= 80) return { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' };
    if (valorPct >= 50) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' };
    return { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' };
  };

  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px' }}>
      <style>{`
        .job-card {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(167,139,250,0.14);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: border-color 0.25s ease, background 0.25s ease;
          position: relative;
          overflow: hidden;
          cursor: pointer;
          text-align: left;
        }

        .job-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: #a78bfa;
          opacity: 0;
          transition: opacity 0.25s;
          z-index: 2;
        }

        .job-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(480px circle at var(--mx, 50%) var(--my, 50%), rgba(167,139,250,0.16), transparent 60%);
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }

        .job-card:hover {
          border-color: rgba(167,139,250,0.32);
        }

        .job-card:hover::before { opacity: 1; }
        .job-card:hover::after { opacity: 1; }

        .match-glow {
          box-shadow: 0 0 14px rgba(52,211,153,0.25);
        }

        .curso-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #a78bfa;
          background: rgba(167,139,250,0.12);
          border: 1px solid rgba(167,139,250,0.3);
          padding: 3px 9px;
          border-radius: 99px;
          margin-bottom: 10px;
        }

        .apply-btn {
          position: relative;
          z-index: 1;
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

        .jobs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .job-modal-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #94a3b8;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 5px 12px;
          border-radius: 99px;
        }
      `}</style>
      <SkeletonStyles />

      <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
        <header style={{
          marginBottom: '40px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          borderBottom: '1px solid rgba(167,139,250,0.1)',
          paddingBottom: '28px',
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>
              Match Inteligente
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.6px' }}>
              Mural de <span className="gradient-text-live">Oportunidades</span>
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '320px', lineHeight: 1.6, textAlign: 'right' }}>
            Nossa IA cruzou seu perfil e o seu curso com as vagas disponíveis — as mais alinhadas aparecem primeiro.
          </p>
        </header>

        {carregando && (
          <div className="jobs-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <JobCardSkeleton key={i} />
            ))}
          </div>
        )}

        {erro && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '20px 24px', textAlign: 'center', color: '#f87171' }}>
            <div style={{ fontSize: '16px', marginBottom: '6px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><IconWarning /> Não foi possível conectar ao servidor</div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Verifique se o seu Back-end (main.py) está rodando no terminal!</div>
          </div>
        )}

        {!carregando && !erro && (
          <motion.div className="jobs-grid" variants={gridVariants} initial="hidden" animate="visible">
            {oportunidades.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', gridColumn: '1/-1', padding: '60px 0' }}>Nenhuma vaga encontrada para o seu perfil.</p>
            ) : (
              oportunidades.map((vaga) => {
                const percentual = vaga.percentual_match || 0;
                const matchStyle = getMatchStyle(percentual);

                return (
                  <motion.button
                    key={vaga.id || Math.random()}
                    className="job-card"
                    variants={cardVariants}
                    whileHover={{ y: -8, scale: 1.02, boxShadow: '0 20px 45px rgba(0,0,0,0.35)' }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    onMouseMove={handleCardMouseMove}
                    onClick={() => abrirDetalhes(vaga.id)}
                  >
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      {vaga.combina_com_curso && <div className="curso-badge">🎯 Combina com seu curso</div>}
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

                        <div className={percentual >= 80 ? 'match-glow' : ''} style={{
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
                          <IconPin /> {vaga.localizacao || 'Remoto / São Paulo'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <IconBuilding /> {vaga.tipo_modalidade || vaga.modalidade || 'Híbrido'}
                        </div>
                      </div>
                    </div>

                    <div className="apply-btn" style={{ textAlign: 'center' }}>
                      Ver detalhes e aplicar →
                    </div>
                  </motion.button>
                );
              })
            )}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {vagaSelecionadaId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={fecharDetalhes}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,5,12,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto',
                background: 'rgba(12,12,22,0.98)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(167,139,250,0.2)', borderRadius: '24px', padding: '32px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={fecharDetalhes} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconClose />
                </button>
              </div>

              {carregandoDetalhe && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>Carregando...</div>
              )}

              {detalheVaga && !carregandoDetalhe && (
                <div>
                  <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #7c3aed, #0e7490)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', color: 'white', marginBottom: '18px' }}>
                    {detalheVaga.empresa?.charAt(0) || 'E'}
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9', marginBottom: '6px' }}>{detalheVaga.titulo_vaga}</h2>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#a78bfa', marginBottom: '16px' }}>{detalheVaga.empresa}</div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                    <span className="job-modal-tag"><IconPin /> {detalheVaga.localizacao}</span>
                    <span className="job-modal-tag"><IconBuilding /> {detalheVaga.tipo_modalidade}</span>
                    {detalheVaga.area_itinerario && <span className="job-modal-tag">🎯 {detalheVaga.area_itinerario}</span>}
                  </div>

                  {detalheVaga.descricao_completa && (
                    <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.7, marginBottom: '20px' }}>
                      {detalheVaga.descricao_completa}
                    </p>
                  )}

                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                    Habilidades desejadas
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '28px' }}>
                    {(detalheVaga.habilidades_exigidas || []).map((h) => (
                      <span key={h} style={{ fontSize: '12px', background: 'rgba(167,139,250,0.1)', color: '#c4b5fd', padding: '4px 10px', borderRadius: '8px' }}>{h}</span>
                    ))}
                  </div>

                  {mensagemAplicacao && (
                    <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '12px', color: '#6ee7b7', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IconSparkle /> {mensagemAplicacao}
                    </div>
                  )}

                  <button
                    onClick={aplicarParaVaga}
                    disabled={aplicando || detalheVaga.ja_candidatado}
                    className="apply-btn"
                  >
                    {detalheVaga.ja_candidatado ? '✓ Você já se candidatou' : aplicando ? 'Enviando...' : 'Aplicar pra essa vaga'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default JobMatchBoard;
