import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import InterviewSimulator from './components/InterviewSimulator';
import JobMatchBoard from './components/JobMatchBoard';
import ResumeBuilder from './components/ResumeBuilder';
import WeeklyLeaderboard from './components/WeeklyLeaderboard';
import DailyQuiz from './components/DailyQuiz';
import CourseSelector from './components/CourseSelector';
import StreakCalendar from './components/StreakCalendar';
import Auth from './components/Auth';
import AccountSettings from './components/AccountSettings';
import AuroraBackground from './components/AuroraBackground';
import { IconBriefcase, IconRobot, IconSparkle, IconFire, IconTrophy, IconQuiz, IconCalendar, IconGraduationCap } from './components/icons';
import { useCountUp } from './hooks/useCountUp';
import { apiFetch, getToken, clearToken } from './api';

const TABS = [
  { id: 'vagas', label: 'Mural', Icon: IconBriefcase },
  { id: 'simulador', label: 'Simulador IA', Icon: IconRobot },
  { id: 'quiz', label: 'Quiz', Icon: IconQuiz },
  { id: 'curso', label: 'Curso', Icon: IconGraduationCap },
  { id: 'curriculo', label: 'Currículo', Icon: IconSparkle },
  { id: 'ranking', label: 'Ranking', Icon: IconTrophy },
];

function App() {
  const [sessaoCarregando, setSessaoCarregando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [contaInfo, setContaInfo] = useState({ nome: '', email: '', linkedin: '' });
  const [deveTrocarSenha, setDeveTrocarSenha] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);

  const [abaAtiva, setAbaAtiva] = useState('vagas');
  const [estudanteStatus, setEstudanteStatus] = useState({
    nome: '',
    xp_total: 0,
    nivel_gamificacao: 1,
    ofensiva_dias: 0,
    categoria_status: '🌌 Na Jornada'
  });

  const xpExibido = useCountUp(estudanteStatus.xp_total);

  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [calendarioDias, setCalendarioDias] = useState([]);
  const hoje = new Date();

  const atualizarDadosUsuario = (novosDados) => {
    setEstudanteStatus(prev => ({ ...prev, ...novosDados }));
  };

  const buscarStatusInicial = async () => {
    try {
      const response = await apiFetch('/api/estudante/me/status');
      if (!response.ok) return;
      const dados = await response.json();
      atualizarDadosUsuario({
        nome: dados.nome,
        xp_total: dados.xp_total,
        nivel_gamificacao: dados.nivel_gamificacao,
        categoria_status: dados.categoria_status,
        ofensiva_dias: dados.ofensiva_dias,
        itinerario: dados.itinerario,
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const restaurarSessao = async () => {
      if (!getToken()) {
        setSessaoCarregando(false);
        return;
      }
      try {
        const response = await apiFetch('/api/auth/me');
        if (response.ok) {
          const dados = await response.json();
          setContaInfo({ nome: dados.nome, email: dados.email, linkedin: dados.linkedin });
          setDeveTrocarSenha(Boolean(dados.deve_trocar_senha));
          setAutenticado(true);
          await buscarStatusInicial();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSessaoCarregando(false);
      }
    };
    restaurarSessao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aoAutenticar = async (usuario, precisaTrocarSenha) => {
    setContaInfo({ nome: usuario.nome, email: usuario.email, linkedin: usuario.linkedin });
    setDeveTrocarSenha(Boolean(precisaTrocarSenha));
    setAutenticado(true);
    atualizarDadosUsuario({ nome: usuario.nome });
    await buscarStatusInicial();
  };

  const sair = () => {
    clearToken();
    setAutenticado(false);
    setAbaAtiva('vagas');
  };

  const alternarCalendario = async () => {
    const abrindo = !calendarioAberto;
    setCalendarioAberto(abrindo);
    if (abrindo) {
      try {
        const response = await apiFetch(`/api/estudante/me/calendario?ano=${hoje.getFullYear()}&mes=${hoje.getMonth() + 1}`);
        if (response.ok) {
          const dados = await response.json();
          setCalendarioDias(dados.dias || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (sessaoCarregando) {
    return (
      <div style={{ minHeight: '100vh', background: '#080812', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/logo-icon.png" alt="Play2Work.AI" style={{ width: '48px', height: '48px', borderRadius: '14px', opacity: 0.6 }} />
      </div>
    );
  }

  if (!autenticado) {
    return <Auth aoAutenticar={aoAutenticar} />;
  }

  if (deveTrocarSenha) {
    return (
      <AccountSettings
        estudante={contaInfo}
        forcado
        aoFechar={() => setDeveTrocarSenha(false)}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div style={{ minHeight: '100vh', background: '#080812', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        .app-nav-btn {
          transition: color 0.2s ease;
        }
        .app-nav-btn:hover {
          color: #c4b5fd !important;
        }
        .app-pill {
          transition: all 0.2s ease;
        }
        .app-pill:hover {
          border-color: rgba(167, 139, 250, 0.3) !important;
          background: rgba(255, 255, 255, 0.05) !important;
        }

        .app-desktop-only {
          display: flex;
          flex-wrap: wrap;
        }
        .app-mobile-only {
          display: none;
        }

        .app-bottom-nav-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 8px 4px 10px;
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .app-bottom-nav-btn svg { font-size: 20px; }
        .app-bottom-nav-btn.active { color: #c4b5fd; }

        @media (max-width: 860px) {
          .app-desktop-only { display: none !important; }
          .app-mobile-only { display: flex !important; }

          .app-bottom-nav {
            display: flex !important;
          }

          .app-main-content {
            padding-bottom: 88px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .gradient-text-live { animation: none !important; background-position: 0% 50% !important; }
        }
      `}</style>

      <AuroraBackground />

      {/* Barra Superior (Header) */}
      <header style={{ background: 'rgba(8, 8, 18, 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(167, 139, 250, 0.12)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 24px', minHeight: '64px', display: 'flex', flexWrap: 'wrap', rowGap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo-icon.png" alt="Play2Work.AI" style={{ width: '32px', height: '32px', borderRadius: '9px', display: 'block' }} />
            <span style={{ fontSize: '20px', fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontWeight: '800', color: '#f1f5f9' }}>Play2Work<span className="gradient-text-live">.ai</span></span>
          </div>

          {/* Estado de Gamificação (desktop) */}
          <div className="app-desktop-only" style={{ gap: '10px', alignItems: 'center', position: 'relative' }}>
            {estudanteStatus.itinerario && (
              <button
                onClick={() => setAbaAtiva('quiz')}
                className="app-pill"
                style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px', cursor: 'pointer', color: '#c4b5fd', fontWeight: '700', fontFamily: 'inherit', maxWidth: '180px' }}
                title={estudanteStatus.itinerario}
              >
                <span style={{ flexShrink: 0 }}>🎯</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{estudanteStatus.itinerario}</span>
              </button>
            )}
            <div className="app-pill" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px', whiteSpace: 'nowrap' }}>
              <span>Liga:</span>
              <span style={{ color: '#a78bfa', fontWeight: '700' }}>{estudanteStatus.categoria_status}</span>
            </div>
            <div className="app-pill" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', fontSize: '12px', display: 'flex', alignItems: 'center', padding: '4px 4px 4px 12px', gap: '6px', whiteSpace: 'nowrap' }}>
              <IconFire style={{ color: '#f97316' }} />
              <span style={{ color: '#a78bfa', fontWeight: '700' }}>{estudanteStatus.ofensiva_dias} dias</span>
              <button
                onClick={alternarCalendario}
                title="Ver calendário de ofensiva"
                aria-label="Ver calendário de ofensiva"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: calendarioAberto ? 'rgba(167,139,250,0.35)' : 'rgba(167,139,250,0.14)',
                  border: 'none', cursor: 'pointer', color: '#c4b5fd', fontSize: '13px',
                }}
              >
                <IconCalendar />
              </button>
            </div>
            <div className="app-pill" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px', whiteSpace: 'nowrap' }}>
              <span>Nível {estudanteStatus.nivel_gamificacao}</span>
              <span style={{ color: '#67e8f9', fontWeight: '600' }}>{xpExibido} XP</span>
            </div>

            <button
              onClick={() => setContaAberta(true)}
              title="Sobre a conta"
              style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #7c3aed, #0e7490)', border: 'none',
                color: 'white', fontWeight: '800', fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {(estudanteStatus.nome || '?').charAt(0).toUpperCase()}
            </button>

            <button
              onClick={sair}
              title="Sair"
              className="app-pill"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', whiteSpace: 'nowrap' }}
            >
              Sair
            </button>

            <AnimatePresence>
              {calendarioAberto && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    left: 0,
                    width: '320px',
                    background: 'rgba(10, 10, 20, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(167,139,250,0.2)',
                    borderRadius: '18px',
                    padding: '20px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    zIndex: 60,
                  }}
                >
                  <StreakCalendar ano={hoje.getFullYear()} mes={hoje.getMonth() + 1} dias={calendarioDias} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Menu de Navegação (desktop) */}
          <nav className="app-desktop-only" style={{ gap: '4px', alignItems: 'center' }}>
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setAbaAtiva(id)}
                className="app-nav-btn"
                style={{
                  position: 'relative',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: abaAtiva === id ? '#c4b5fd' : '#94a3b8',
                  border: '1px solid transparent',
                }}
              >
                {abaAtiva === id && (
                  <motion.div
                    layoutId="nav-active-pill"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    style={{ position: 'absolute', inset: 0, background: 'rgba(167, 139, 250, 0.2)', borderRadius: '10px', zIndex: 0 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon /> {label}
                </span>
              </button>
            ))}
          </nav>

          {/* Estado de Gamificação compacto (mobile) — sempre visível, sem precisar abrir menu */}
          <div className="app-mobile-only" style={{ alignItems: 'center', gap: '8px', position: 'relative' }}>
            <button
              onClick={alternarCalendario}
              className="app-pill"
              style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '6px 10px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}
            >
              <IconFire style={{ color: '#f97316' }} />
              <span style={{ color: '#e2e8f0', fontWeight: '700' }}>{estudanteStatus.ofensiva_dias}</span>
              <span style={{ opacity: 0.3 }}>·</span>
              <span style={{ color: '#67e8f9', fontWeight: '700' }}>{xpExibido} XP</span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(167,139,250,0.18)', color: '#c4b5fd', marginLeft: '2px' }}>
                <IconCalendar />
              </span>
            </button>

            <AnimatePresence>
              {calendarioAberto && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    width: '280px',
                    maxWidth: '85vw',
                    background: 'rgba(10, 10, 20, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(167,139,250,0.2)',
                    borderRadius: '18px',
                    padding: '18px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    zIndex: 60,
                  }}
                >
                  <StreakCalendar ano={hoje.getFullYear()} mes={hoje.getMonth() + 1} dias={calendarioDias} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </header>

      {/* Navegação inferior fixa (mobile) — todas as abas sempre à mão, sem menu escondido */}
      <nav
        className="app-bottom-nav"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'rgba(8, 8, 18, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(167, 139, 250, 0.15)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id)}
            className={`app-bottom-nav-btn ${abaAtiva === id ? 'active' : ''}`}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      {/* Conteúdo Dinâmico das Abas */}
      <main className="app-main-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={abaAtiva}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {abaAtiva === 'vagas' && <JobMatchBoard />}
            {abaAtiva === 'simulador' && <InterviewSimulator aoGanharXp={atualizarDadosUsuario} />}
            {abaAtiva === 'quiz' && (
              <DailyQuiz
                aoGanharXp={atualizarDadosUsuario}
                aoAbrirCursos={() => setAbaAtiva('curso')}
                aoVoltarMural={() => setAbaAtiva('vagas')}
              />
            )}
            {abaAtiva === 'curso' && (
              <CourseSelector aoEscolher={(itinerario) => atualizarDadosUsuario({ itinerario })} />
            )}
            {abaAtiva === 'curriculo' && <ResumeBuilder />}
            {abaAtiva === 'ranking' && <WeeklyLeaderboard />}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {contaAberta && (
          <AccountSettings
            estudante={contaInfo}
            aoFechar={() => setContaAberta(false)}
            aoAtualizarLinkedin={(linkedin) => setContaInfo((prev) => ({ ...prev, linkedin }))}
          />
        )}
      </AnimatePresence>

    </div>
    </MotionConfig>
  );
}

export default App;
