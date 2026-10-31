import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { IconRobot, IconFire, IconTarget, IconSparkle, IconTrophy } from './icons';
import { apiFetch } from '../api';
import { useCountUp } from '../hooks/useCountUp';
import Typewriter from './Typewriter';
import { tocarSomAcerto, tocarSomErro } from '../utils/sound';
import { PERGUNTA_INICIAL, PERGUNTA_RECOMECO } from '../entrevistaDemo';

// Notas por critério (0-10) que a entrevistadora deu; o XP sai delas, no servidor
const CRITERIOS = [['relevancia', 'Respondeu a pergunta'], ['clareza', 'Clareza'], ['exemplos', 'Exemplos reais'], ['postura', 'Postura']];
const corDaNota = (n) => (n >= 8 ? 'var(--ok)' : n >= 5 ? 'var(--aviso)' : 'var(--erro)');

const dispararConfete = () => {
  const cores = ['#2e7bff', '#00e5ff', '#1652e0', '#34d399'];
  confetti({ particleCount: 130, spread: 75, origin: { y: 0.6 }, colors: cores });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: cores }), 150);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: cores }), 150);
};

const InterviewSimulator = ({ aoGanharXp }) => {
  const [mensagem, setMensagem] = useState('');
  const [historico, setHistorico] = useState([
    {
      id: 1,
      remetente: 'ai',
      texto: PERGUNTA_INICIAL,
      feedback: null,
      xp_ganho: null
    }
  ]);
  // Primeira resposta de uma rodada avisa o servidor qual abertura foi mostrada
  const [abertura, setAbertura] = useState('inicial');
  const [carregando, setCarregando] = useState(false);
  const [sessaoConcluida, setSessaoConcluida] = useState(false);

  // Estados locais sincronizados com o back-end
  const [pontos, setPontos] = useState(120);
  const [nivel, setNivel] = useState(1);
  const [ofensiva, setOfensiva] = useState(4);
  const [missoes, setMissoes] = useState(2);

  const pontosExibidos = useCountUp(pontos);
  const xpGanhoSessao = historico.reduce((acc, m) => acc + (m.xp_ganho || 0), 0);

  const encerrarSimulacao = () => {
    setSessaoConcluida(true);
    dispararConfete();
  };

  const novaSimulacao = () => {
    setSessaoConcluida(false);
    setHistorico([
      {
        id: Date.now(),
        remetente: 'ai',
        texto: PERGUNTA_RECOMECO,
        feedback: null,
        xp_ganho: null,
      },
    ]);
    setAbertura('recomeco');
  };

  const enviarMensagem = async () => {
    if (!mensagem.trim() || carregando) return;

    const mensagemUsuario = mensagem;
    setMensagem('');
    setCarregando(true);

    const novoIdUser = Date.now();
    setHistorico((prev) => [
      ...prev,
      { id: novoIdUser, remetente: 'user', texto: mensagemUsuario, feedback: null }
    ]);

    try {
      const response = await apiFetch('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify({ mensagem_usuario: mensagemUsuario, ...(abertura ? { abertura } : {}) }),
      });

      if (!response.ok) throw new Error('Erro ao conversar com o servidor');
      setAbertura(null);

      const dados = await response.json();
      
      // 🔴 CORREÇÃO: Mapeando as chaves exatas que o back-end retorna
      const novosPontos = dados.novos_pontos_totais;
      const novoNivel = dados.nivel_atual;
      const novaOfensiva = dados.ofensiva_dias;
      const novasMissoes = dados.missoes_diarias_concluidas;

      // Atualiza os estados locais do painel interno
      setPontos(novosPontos);
      setNivel(novoNivel);
      setOfensiva(novaOfensiva);
      setMissoes(novasMissoes);

      if (dados.xp_concedido > 0) {
        tocarSomAcerto();
      } else {
        tocarSomErro();
      }

      // ⚡ Opcional: Atualiza o Header global do App.js se a propriedade foi passada
      if (aoGanharXp) {
        aoGanharXp({
          xp_total: novosPontos,
          nivel_gamificacao: novoNivel,
          ofensiva_dias: novaOfensiva,
          categoria_status: dados.categoria_status,
          liga: dados.liga,
          mudanca_liga: dados.mudanca_liga,
        });
      }

      setHistorico((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          remetente: 'ai',
          texto: dados.resposta_ia,
          feedback: dados.feedback_ia,
          xp_ganho: dados.xp_concedido, // Guarda o XP ganho nessa rodada específica
          categoria: dados.categoria,
          notas: dados.notas,
        }
      ]);
    } catch (error) {
      console.error(error);
      setHistorico((prev) => [
        ...prev,
        { id: Date.now() + 2, remetente: 'ai', texto: 'Ops, tive um probleminha para processar isso. Pode tentar de novo?', feedback: null }
      ]);
    } finally {
      setCarregando(false);
    }
  };

  const xpProgress = (pontos % 500) / 5;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <style>{`
        .sim-stat-card {
          background: rgb(var(--tinta-rgb) / 0.03);
          border: 1px solid rgb(var(--accent-rgb) / 0.12);
          border-radius: 14px;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sim-xp-bar-track {
          width: 120px;
          height: 5px;
          background: rgb(var(--tinta-rgb) / 0.08);
          border-radius: 99px;
          overflow: hidden;
        }

        .sim-xp-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
          transition: width 0.6s ease;
        }

        .sim-msg-ai {
          background: rgb(var(--tinta-rgb) / 0.04);
          border: 1px solid rgb(var(--accent-rgb) / 0.15);
          color: var(--txt-2);
          border-radius: 16px;
          border-top-left-radius: 4px;
          padding: 14px 18px;
          max-width: 80%;
          font-size: 14px;
          line-height: 1.6;
        }

        .sim-msg-user {
          background: rgb(var(--accent-rgb) / 0.16);
          border: 1px solid rgb(var(--accent-rgb) / 0.3);
          color: var(--txt-1b);
          border-radius: 16px;
          border-top-right-radius: 4px;
          padding: 14px 18px;
          max-width: 80%;
          font-size: 14px;
          line-height: 1.6;
        }

        .sim-feedback-card {
          background: rgba(52,211,153,0.06);
          border: 1px solid rgba(52,211,153,0.2);
          color: var(--txt-3);
          border-radius: 16px;
          border-top-left-radius: 4px;
          padding: 14px 18px;
          max-width: 80%;
          font-size: 13px;
          line-height: 1.6;
        }
        .sim-feedback-card.alerta { background: rgba(251,191,36,0.07); border-color: rgba(251,191,36,0.3); }
        .sim-feedback-titulo { font-size: 11px; font-weight: 700; color: var(--ok); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
        .sim-feedback-card.alerta .sim-feedback-titulo { color: var(--aviso); }
        .sim-notas { display: grid; gap: 5px; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgb(var(--tinta-rgb) / 0.06); }
        .sim-nota { display: grid; grid-template-columns: 140px 1fr 22px; align-items: center; gap: 8px; font-size: 12px; }
        .sim-nota-barra { height: 5px; border-radius: 3px; background: rgb(var(--tinta-rgb) / 0.08); overflow: hidden; }
        .sim-nota-barra > div { height: 100%; border-radius: 3px; }
        .sim-nota strong { text-align: right; }
        @media (max-width: 480px) { .sim-nota { grid-template-columns: 110px 1fr 20px; } }

        .sim-input {
          flex: 1;
          background: rgb(var(--tinta-rgb) / 0.04);
          border: 1px solid rgb(var(--accent-rgb) / 0.2);
          border-radius: 12px;
          padding: 13px 18px;
          color: var(--txt-1b);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
        }

        .sim-input::placeholder { color: var(--txt-5); }
        .sim-input:focus { border-color: rgb(var(--accent-rgb) / 0.5); }
        .sim-input:disabled { opacity: 0.4; cursor: not-allowed; }

        .sim-send-btn {
          background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong));
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 700;
          font-size: 14px;
          padding: 13px 24px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          font-family: inherit;
        }

        .sim-send-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgb(var(--accent-strong-rgb) / 0.3);
        }

        .sim-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .sim-pulse {
          width: 8px; height: 8px; border-radius: 50%;
          animation: simPulse 1.5s infinite;
        }

        @keyframes simPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .sim-typing {
          animation: simTyping 1.2s infinite;
          color: var(--txt-4);
          font-size: 13px;
          font-style: italic;
        }

        @keyframes simTyping {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .sim-end-btn {
          background: rgb(var(--tinta-rgb) / 0.06);
          border: 1px solid rgb(var(--tinta-rgb) / 0.12);
          color: var(--txt-2);
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .sim-end-btn:hover {
          background: rgb(var(--accent-rgb) / 0.18);
          border-color: rgb(var(--accent-rgb) / 0.35);
          color: var(--txt-1b);
        }

        .sim-complete-card {
          background: rgb(var(--accent-rgb) / 0.08);
          border: 1px solid rgb(var(--accent-rgb) / 0.3);
          border-radius: 16px;
          padding: 20px 24px;
          text-align: center;
        }

        .sim-restart-btn {
          margin-top: 14px;
          background: var(--accent-strong);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 700;
          font-size: 13px;
          padding: 10px 20px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .sim-restart-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgb(var(--accent-strong-rgb) / 0.3);
        }
      `}</style>

      {/* Stats bar */}
      <div style={{ maxWidth: '920px', width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div className="sim-stat-card">
          <div style={{ background: 'var(--accent-strong)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: '700', color: 'white', letterSpacing: '0.5px' }}>
            NÍV {nivel}
          </div>
          <div className="sim-xp-bar-track">
            <div className="sim-xp-bar-fill" style={{ width: `${xpProgress}%` }} />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '700' }}>{pontosExibidos} XP</span>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="sim-stat-card" title="Dias seguidos praticando!">
            <span style={{ fontSize: '20px', color: '#f97316', display: 'inline-flex' }}><IconFire /></span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#f97316', lineHeight: 1 }}>{ofensiva}</div>
              <div style={{ fontSize: '10px', color: 'var(--txt-4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>dias</div>
            </div>
          </div>

          <div className="sim-stat-card" title="Quests cumpridas hoje">
            <span style={{ fontSize: '20px', color: 'var(--ok)', display: 'inline-flex' }}><IconTarget /></span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--ok)', lineHeight: 1 }}>{missoes}</div>
              <div style={{ fontSize: '10px', color: 'var(--txt-4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>diárias</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat window */}
      <div style={{
        maxWidth: '920px',
        width: '100%',
        background: 'rgb(var(--tinta-rgb) / 0.04)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgb(var(--accent-rgb) / 0.15)',
        borderRadius: '24px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 60px rgb(var(--accent-rgb) / 0.05)',
      }}>
        {/* Header */}
        <div style={{
          background: 'rgb(var(--accent-strong-rgb) / 0.14)',
          borderBottom: '1px solid rgb(var(--accent-rgb) / 0.15)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--txt-1b)', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.3px' }}>
              <IconRobot /> IA Recrutadora
            </div>
            <div style={{ fontSize: '12px', color: 'var(--txt-3)', marginTop: '2px' }}>Simulador de Entrevista · Vaga Jovem Aprendiz</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sim-pulse" style={{ background: carregando ? '#facc15' : 'var(--ok)' }} />
              <span style={{ fontSize: '12px', color: 'var(--txt-4)' }}>{carregando ? 'analisando' : 'online'}</span>
            </div>
            {!sessaoConcluida && historico.some((m) => m.remetente === 'user') && (
              <button onClick={encerrarSimulacao} className="sim-end-btn">
                Encerrar simulação
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          background: 'rgb(var(--campo-rgb) / 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: '420px',
          maxHeight: '520px',
        }}>
          {historico.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <div style={{ display: 'flex', justifyContent: msg.remetente === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.remetente === 'ai' && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'white', marginRight: '8px', flexShrink: 0, alignSelf: 'flex-end' }}>
                    <IconRobot />
                  </div>
                )}
                <div className={msg.remetente === 'user' ? 'sim-msg-user' : 'sim-msg-ai'}>
                  {msg.remetente === 'ai' ? <Typewriter text={msg.texto} /> : msg.texto}
                </div>
              </div>

              {msg.remetente === 'ai' && msg.feedback && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: '36px' }}>
                  <div className={`sim-feedback-card ${msg.categoria && msg.categoria !== 'resposta' ? 'alerta' : ''}`}>
                    <div className="sim-feedback-titulo">
                      <IconSparkle /> {msg.categoria && msg.categoria !== 'resposta' ? 'Não valeu XP' : 'Feedback em tempo real'} {msg.xp_ganho !== null && msg.xp_ganho !== undefined ? `· +${msg.xp_ganho} XP` : ''}
                    </div>
                    {msg.feedback}
                    {msg.notas && (
                      <div className="sim-notas">
                        {CRITERIOS.map(([id, rotulo]) => (
                          <div key={id} className="sim-nota">
                            <span>{rotulo}</span>
                            <div className="sim-nota-barra"><div style={{ width: `${msg.notas[id] * 10}%`, background: corDaNota(msg.notas[id]) }} /></div>
                            <strong style={{ color: corDaNota(msg.notas[id]) }}>{msg.notas[id]}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {carregando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'white', flexShrink: 0 }}><IconRobot /></div>
              <p className="sim-typing">A entrevistadora está avaliando sua resposta...</p>
            </div>
          )}
        </div>

        {/* Input / Conclusão */}
        <AnimatePresence mode="wait">
          {sessaoConcluida ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ padding: '20px' }}
            >
              <div className="sim-complete-card">
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--txt-1b)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <IconTrophy /> Simulação concluída!
                </div>
                <div style={{ fontSize: '13px', color: 'var(--txt-3)', marginTop: '6px' }}>
                  Você ganhou <strong style={{ color: 'var(--accent-2)' }}>{xpGanhoSessao} XP</strong> nessa sessão de prática.
                </div>
                <button onClick={novaSimulacao} className="sim-restart-btn">
                  Nova simulação
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ padding: '16px 20px', background: 'rgb(var(--campo-rgb) / 0.3)', borderTop: '1px solid rgb(var(--accent-rgb) / 0.1)', display: 'flex', gap: '10px' }}
            >
              <input
                type="text"
                placeholder={carregando ? 'Aguarde a IA...' : 'Digite sua resposta aqui...'}
                className="sim-input"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                disabled={carregando}
                onKeyDown={(e) => e.key === 'Enter' && enviarMensagem()}
              />
              <button
                onClick={enviarMensagem}
                disabled={carregando}
                className="sim-send-btn"
              >
                {carregando ? '···' : 'Enviar →'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InterviewSimulator;