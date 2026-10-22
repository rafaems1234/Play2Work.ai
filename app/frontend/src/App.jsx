import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import confetti from 'canvas-confetti';
import InterviewSimulator from './components/InterviewSimulator';
import JobMatchBoard from './components/JobMatchBoard';
import ResumeBuilder from './components/ResumeBuilder';
import WeeklyLeaderboard from './components/WeeklyLeaderboard';
import DailyQuiz from './components/DailyQuiz';
import CourseSelector from './components/CourseSelector';
import StreakCalendar from './components/StreakCalendar';
import AccountSettings from './components/AccountSettings';
import TechBackground from './components/TechBackground';
import IntroScreen from './components/IntroScreen';
import Logo from './components/Logo';
import Trofeu from './components/Trofeu';
import { buscarLiga } from './ligas';
import { IconBriefcase, IconRobot, IconSparkle, IconFire, IconTrophy, IconQuiz, IconCalendar, IconGraduationCap, IconSpeakerHigh, IconSpeakerX } from './components/icons';
import { useCountUp } from './hooks/useCountUp';
import { apiFetch, DEMO_MODE } from './api';
import { somEstaAtivado, definirSomAtivado, tocarSomLevelUp, tocarSomLiga } from './utils/sound';

const TABS = [
  { id: 'vagas', label: 'Mural', Icon: IconBriefcase },
  { id: 'simulador', label: 'Simulador IA', Icon: IconRobot },
  { id: 'quiz', label: 'Quiz', Icon: IconQuiz },
  { id: 'curso', label: 'Curso', Icon: IconGraduationCap },
  { id: 'curriculo', label: 'Currículo', Icon: IconSparkle },
  { id: 'ranking', label: 'Ranking', Icon: IconTrophy },
];


const CHAVE_BANNER_OFENSIVA = 'play2work_banner_ofensiva_dispensado_em';
const hojeISO = () => new Date().toISOString().slice(0, 10);

const dispararConfeteLevelUp = () => {
  const cores = ['#2e7bff', '#00e5ff', '#fbbf24', '#34d399'];
  confetti({ particleCount: 140, spread: 80, origin: { y: 0.4 }, colors: cores });
};

function App() {
  const [contaInfo, setContaInfo] = useState({ nome: '', email: '', linkedin: '' });
  const [contaAberta, setContaAberta] = useState(false);

  const [mostrandoIntro, setMostrandoIntro] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState('vagas');
  const [estudanteStatus, setEstudanteStatus] = useState({
    nome: '',
    xp_total: 0,
    nivel_gamificacao: 1,
    ofensiva_dias: 0,
    ofensiva_em_risco: false,
    categoria_status: '🌌 Na Jornada',
    liga: 'Bronze',
  });

  const xpExibido = useCountUp(estudanteStatus.xp_total);

  // Cada aba abre do topo (senão herda a rolagem da aba anterior).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [abaAtiva]);

  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [calendarioDias, setCalendarioDias] = useState([]);
  const hoje = new Date();

  const [somAtivado, setSomAtivado] = useState(somEstaAtivado);
  const alternarSom = () => {
    setSomAtivado((prev) => {
      const novoValor = !prev;
      definirSomAtivado(novoValor);
      return novoValor;
    });
  };

  const [toasts, setToasts] = useState([]);
  const adicionarToast = (emoji, texto) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, emoji, texto }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };

  const [bannerOfensivaDispensado, setBannerOfensivaDispensado] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_BANNER_OFENSIVA) === hojeISO();
    } catch {
      return false;
    }
  });
  const dispensarBannerOfensiva = () => {
    try {
      localStorage.setItem(CHAVE_BANNER_OFENSIVA, hojeISO());
    } catch {
      // sem localStorage disponível -- o banner só reaparece nessa mesma sessão
    }
    setBannerOfensivaDispensado(true);
  };

  const atualizarDadosUsuario = (novosDados) => {
    if (
      typeof novosDados.nivel_gamificacao === 'number' &&
      novosDados.nivel_gamificacao > estudanteStatus.nivel_gamificacao
    ) {
      dispararConfeteLevelUp();
      tocarSomLevelUp();
      adicionarToast('🎉', `Nível ${novosDados.nivel_gamificacao} alcançado!`);
    }

    if (novosDados.mudanca_liga) {
      const { direcao, liga_nova } = novosDados.mudanca_liga;
      const subiu = direcao === 'subiu';
      tocarSomLiga(subiu);
      const emoji = subiu ? '🏆' : '📉';
      adicionarToast(
        emoji,
        subiu ? `Você subiu para a Liga ${liga_nova}!` : `Você caiu para a Liga ${liga_nova}. Bora recuperar!`,
      );
    }

    // Quiz e entrevista só repassam ofensiva_dias depois de um treino concluído:
    // a sequência de hoje está garantida, então o aviso de "ofensiva em risco" some.
    const treinou = typeof novosDados.ofensiva_dias === 'number';
    setEstudanteStatus(prev => ({ ...prev, ...novosDados, ...(treinou ? { ofensiva_em_risco: false } : {}) }));
  };

  // Só popula o estado (sem disparar comemoração de level-up/liga) -- usado
  // na carga inicial, onde o "nível atual" não é uma conquista nova.
  const buscarStatusInicial = async () => {
    try {
      const response = await apiFetch('/api/estudante/me/status');
      if (!response.ok) return;
      const dados = await response.json();
      setEstudanteStatus(prev => ({
        ...prev,
        nome: dados.nome,
        xp_total: dados.xp_total,
        nivel_gamificacao: dados.nivel_gamificacao,
        categoria_status: dados.categoria_status,
        ofensiva_dias: dados.ofensiva_dias,
        ofensiva_em_risco: dados.ofensiva_em_risco,
        itinerario: dados.itinerario,
        liga: dados.liga,
      }));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const carregarConta = async () => {
      try {
        const response = await apiFetch('/api/auth/me');
        if (response.ok) {
          const dados = await response.json();
          setContaInfo({ nome: dados.nome, email: dados.email, linkedin: dados.linkedin });
        }
      } catch (err) {
        console.error(err);
      }
      await buscarStatusInicial();
    };
    carregarConta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (mostrandoIntro) {
    return (
      <MotionConfig reducedMotion="user">
        <IntroScreen aoEntrar={() => { setMostrandoIntro(false); window.scrollTo(0, 0); }} />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-escala" style={{ minHeight: '100vh', background: 'var(--bg)', color: '#94a3b8', fontFamily: 'var(--sans)' }}>
      <style>{`
        /* Telas grandes (notebook, monitor, projetor): o app inteiro cresce
           ~15% -- letras, botões, cards e espaçamentos juntos. */
        @media (min-width: 1100px) {
          .app-escala { zoom: 1.15; }
        }
        @media (min-width: 1700px) {
          .app-escala { zoom: 1.3; }
        }

        .app-nav-btn {
          transition: color 0.2s ease;
        }
        .app-nav-btn:hover {
          color: var(--accent-soft) !important;
        }
        .app-pill {
          transition: all 0.2s ease;
        }
        .app-pill:hover {
          border-color: rgb(var(--accent-rgb) / 0.3) !important;
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
        .app-bottom-nav-btn.active { color: var(--accent-soft); }

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

      <TechBackground />

      {/* Barra Superior (Header) */}
      <header style={{ background: 'rgb(var(--surface-rgb) / 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgb(var(--accent-rgb) / 0.12)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '10px 24px', minHeight: '64px', display: 'flex', flexWrap: 'wrap', rowGap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <div
            onClick={() => setMostrandoIntro(true)}
            title="Voltar pra tela de abertura"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <Logo size={32} />
            <span style={{ fontSize: '20px', fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontWeight: '800', color: '#f1f5f9' }}>Play2Work<span className="gradient-text-live">.ai</span></span>
            {DEMO_MODE && (
              <span
                title="Todos os dados nesta tela são fictícios, gerados no navegador -- não há backend/banco de dados rodando."
                style={{ fontSize: '10px', fontWeight: '800', color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', padding: '3px 9px', borderRadius: '99px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
                🎭 Demonstração
              </span>
            )}
          </div>

          {/* Estado de Gamificação (desktop) */}
          <div className="app-desktop-only" style={{ gap: '10px', alignItems: 'center', position: 'relative' }}>
            {estudanteStatus.itinerario && (
              <button
                onClick={() => setAbaAtiva('quiz')}
                className="app-pill"
                style={{ background: 'rgb(var(--accent-rgb) / 0.08)', border: '1px solid rgb(var(--accent-rgb) / 0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px', cursor: 'pointer', color: 'var(--accent-soft)', fontWeight: '700', fontFamily: 'inherit', maxWidth: '180px' }}
                title={estudanteStatus.itinerario}
              >
                <span style={{ flexShrink: 0 }}>🎯</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{estudanteStatus.itinerario}</span>
              </button>
            )}
            <div className="app-pill" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px', whiteSpace: 'nowrap' }}>
              <span>Status:</span>
              <span style={{ color: 'var(--accent)', fontWeight: '700' }}>{estudanteStatus.categoria_status}</span>
            </div>
            <button
              onClick={() => setAbaAtiva('ranking')}
              className="app-pill"
              title={`Liga ${estudanteStatus.liga} — veja o ranking semanal`}
              style={{ background: 'rgba(255, 255, 255, 0.03)', border: `1px solid ${buscarLiga(estudanteStatus.liga).cor}55`, padding: '6px 12px', alignItems: 'center', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}
            >
              <Trofeu liga={buscarLiga(estudanteStatus.liga)} tamanho={18} />
              <span style={{ color: buscarLiga(estudanteStatus.liga).cor, fontWeight: '700' }}>Liga {estudanteStatus.liga}</span>
            </button>
            <div className="app-pill" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', fontSize: '12px', display: 'flex', alignItems: 'center', padding: '4px 4px 4px 12px', gap: '6px', whiteSpace: 'nowrap' }}>
              <IconFire style={{ color: '#f97316' }} />
              <span style={{ color: 'var(--accent)', fontWeight: '700' }}>{estudanteStatus.ofensiva_dias} dias</span>
              <button
                onClick={alternarCalendario}
                title="Ver calendário de ofensiva"
                aria-label="Ver calendário de ofensiva"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: calendarioAberto ? 'rgb(var(--accent-rgb) / 0.35)' : 'rgb(var(--accent-rgb) / 0.14)',
                  border: 'none', cursor: 'pointer', color: 'var(--accent-soft)', fontSize: '13px',
                }}
              >
                <IconCalendar />
              </button>
            </div>
            <div className="app-pill" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', gap: '6px', whiteSpace: 'nowrap' }}>
              <span>Nível {estudanteStatus.nivel_gamificacao}</span>
              <span style={{ color: 'var(--accent-2)', fontWeight: '600' }}>{xpExibido} XP</span>
            </div>

            <button
              onClick={alternarSom}
              title={somAtivado ? 'Desativar sons' : 'Ativar sons'}
              aria-label={somAtivado ? 'Desativar sons' : 'Ativar sons'}
              className="app-pill"
              style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                color: somAtivado ? 'var(--accent-soft)' : '#64748b', cursor: 'pointer', fontSize: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {somAtivado ? <IconSpeakerHigh /> : <IconSpeakerX />}
            </button>

            <button
              onClick={() => setContaAberta(true)}
              title="Sobre a conta"
              style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong))', border: 'none',
                color: 'white', fontWeight: '800', fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {(estudanteStatus.nome || '?').charAt(0).toUpperCase()}
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
                    background: 'rgb(var(--surface-rgb) / 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgb(var(--accent-rgb) / 0.2)',
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
                  color: abaAtiva === id ? 'var(--accent-soft)' : '#94a3b8',
                  border: '1px solid transparent',
                }}
              >
                {abaAtiva === id && (
                  <motion.div
                    layoutId="nav-active-pill"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    style={{ position: 'absolute', inset: 0, background: 'rgb(var(--accent-rgb) / 0.2)', borderRadius: '10px', zIndex: 0 }}
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
              <span style={{ color: 'var(--accent-2)', fontWeight: '700' }}>{xpExibido} XP</span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'rgb(var(--accent-rgb) / 0.18)', color: 'var(--accent-soft)', marginLeft: '2px' }}>
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
                    background: 'rgb(var(--surface-rgb) / 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgb(var(--accent-rgb) / 0.2)',
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

      <AnimatePresence>
        {estudanteStatus.ofensiva_em_risco && !bannerOfensivaDispensado && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              maxWidth: '1320px', margin: '0 auto', padding: '14px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap',
              background: 'rgba(249,115,22,0.08)', borderBottom: '1px solid rgba(249,115,22,0.25)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fdba74', fontSize: '13px', fontWeight: '600' }}>
                <IconFire style={{ color: '#f97316', fontSize: '16px' }} />
                Sua sequência de {estudanteStatus.ofensiva_dias} dias está em risco! Faça o quiz de hoje pra não perder.
              </span>
              <button
                onClick={() => setAbaAtiva('quiz')}
                style={{ background: '#f97316', border: 'none', color: '#1c0a02', fontWeight: '700', fontSize: '12px', padding: '6px 14px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Fazer quiz agora
              </button>
              <button
                onClick={dispensarBannerOfensiva}
                aria-label="Dispensar aviso"
                style={{ background: 'none', border: 'none', color: '#fdba74', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none' }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: 'rgb(var(--surface-rgb) / 0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgb(var(--accent-rgb) / 0.3)', borderRadius: '14px', padding: '12px 18px',
                display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                color: '#e2e8f0', fontSize: '13px', fontWeight: '700', maxWidth: '300px',
              }}
            >
              <span style={{ fontSize: '18px' }}>{toast.emoji}</span>
              {toast.texto}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
          background: 'rgb(var(--surface-rgb) / 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgb(var(--accent-rgb) / 0.15)',
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
      <main className="app-main-content" style={{ maxWidth: '1320px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
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
