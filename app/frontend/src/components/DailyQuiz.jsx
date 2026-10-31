import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { IconTarget, IconWarning, IconSparkle, IconHeart, IconSnowflake, IconGraduationCap, IconFire, IconTimer, IconLightbulb, IconSkip, IconCheckCircle, IconXCircle } from './icons';
import { apiFetch } from '../api';
import { SkeletonStyles, Skeleton } from './Skeleton';
import QuizResultado from './QuizResultado';
import { tocarSomAcerto, tocarSomErro, tocarSomCombo, tocarSomVida } from '../utils/sound';

const DICAS_POR_QUIZ = 2;
const PULOS_POR_QUIZ = 2;
const XP_POR_ACERTO = 8;

const FRASES_ACERTO = ['Mandou bem!', 'Isso aí!', 'Certíssimo!', 'Boa!', 'Na mosca!', 'Arrasou!'];
const FRASES_ERRO = ['Quase!', 'Não foi dessa vez', 'Ops!', 'Bora aprender essa'];
const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Cor/intensidade do combo: amarelo → laranja → vermelho → roxo "em chamas"
const estiloCombo = (combo) => {
  if (combo >= 8) return { cor: '#c084fc', rotulo: 'IMPARÁVEL', chamas: 3 };
  if (combo >= 5) return { cor: 'var(--erro)', rotulo: 'EM CHAMAS', chamas: 2 };
  if (combo >= 3) return { cor: '#fb923c', rotulo: 'Pegando fogo', chamas: 1 };
  return { cor: 'var(--aviso)', rotulo: 'Combo', chamas: 1 };
};

const formatarEspera = (isoData) => {
  if (!isoData) return null;
  const ms = new Date(isoData).getTime() - Date.now();
  if (ms <= 0) return 'já já';
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  return horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
};

const formatarTempo = (segundos) => {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const DailyQuiz = ({ aoGanharXp, aoVoltarInicio }) => {
  const [quiz, setQuiz] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [semVidas, setSemVidas] = useState(false);

  const [status, setStatus] = useState(null);

  const [indiceAtual, setIndiceAtual] = useState(0);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [opcoesEliminadas, setOpcoesEliminadas] = useState([]);
  const [resultado, setResultado] = useState(null);

  const [dicasRestantes, setDicasRestantes] = useState(DICAS_POR_QUIZ);
  const [pulosRestantes, setPulosRestantes] = useState(PULOS_POR_QUIZ);
  const [pulosUsados, setPulosUsados] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maiorCombo, setMaiorCombo] = useState(0);
  const [fraseFeedback, setFraseFeedback] = useState('');
  const [avisoVida, setAvisoVida] = useState(null); // combo que acabou de render 1 vida

  const [inicioQuiz, setInicioQuiz] = useState(null);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);

  const buscarStatus = async () => {
    try {
      const respStatus = await apiFetch('/api/estudante/me/status');
      if (respStatus.ok) {
        const dadosStatus = await respStatus.json();
        setStatus(dadosStatus);
        setSemVidas(dadosStatus.vidas <= 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    buscarStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!quiz || resultado) return undefined;
    const intervalo = setInterval(() => {
      setTempoDecorrido(Math.floor((Date.now() - inicioQuiz) / 1000));
    }, 1000);
    return () => clearInterval(intervalo);
  }, [quiz, resultado, inicioQuiz]);

  const [respondendo, setRespondendo] = useState(false);
  const [feedback, setFeedback] = useState(null); // { correta, resposta_correta_index, explicacao }

  const gerarQuiz = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const response = await apiFetch('/api/quiz/generate', { method: 'POST' });
      if (response.status === 403) {
        const dados = await response.json();
        setSemVidas(true);
        setErro(dados.detail?.mensagem || 'Você está sem vidas.');
        return;
      }
      if (!response.ok) throw new Error('Não foi possível gerar o quiz.');
      const dados = await response.json();
      setQuiz(dados);
      setStatus((prev) => ({ ...prev, vidas: dados.vidas, itinerario: dados.itinerario }));
      setIndiceAtual(0);
      setOpcaoSelecionada(null);
      setOpcoesEliminadas([]);
      setResultado(null);
      setFeedback(null);
      setDicasRestantes(dados.dicas_disponiveis ?? DICAS_POR_QUIZ);
      setPulosRestantes(dados.pulos_disponiveis ?? PULOS_POR_QUIZ);
      setPulosUsados(0);
      setCombo(0);
      setMaiorCombo(0);
      setAvisoVida(null);
      setInicioQuiz(Date.now());
      setTempoDecorrido(0);
    } catch (err) {
      console.error(err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const perguntaAtual = quiz?.perguntas?.[indiceAtual];
  const ultimaPergunta = quiz && indiceAtual === quiz.perguntas.length - 1;

  // O resultado final é sempre contado pelo servidor a partir das respostas
  // que ele mesmo registrou em /quiz/responder -- o cliente não manda mais
  // "acertos"/"total" de forma autodeclarada.
  const enviarResultado = async () => {
    try {
      const response = await apiFetch('/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ quiz_id: quiz.quiz_id }),
      });
      const dados = await response.json();
      setResultado(dados);
      if (aoGanharXp && response.ok) {
        aoGanharXp({
          xp_total: dados.novos_pontos_totais,
          nivel_gamificacao: dados.nivel_atual,
          ofensiva_dias: dados.ofensiva_dias,
          categoria_status: dados.categoria_status,
          liga: dados.liga,
          mudanca_liga: dados.mudanca_liga,
        });
      }
      if (response.ok) {
        setStatus((prev) => ({
          ...prev,
          vidas: dados.vidas,
          congelamentos_disponiveis: dados.congelamentos_disponiveis,
          quizzes_perfeitos_seguidos: dados.quizzes_perfeitos_seguidos,
        }));
        setSemVidas(dados.vidas <= 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const escolherOpcao = async (idx) => {
    if (opcaoSelecionada !== null || respondendo) return;
    setOpcaoSelecionada(idx);
    setRespondendo(true);
    try {
      const response = await apiFetch('/api/quiz/responder', {
        method: 'POST',
        body: JSON.stringify({ quiz_id: quiz.quiz_id, indice_pergunta: indiceAtual, opcao_selecionada: idx }),
      });
      const dados = await response.json();
      if (!response.ok) throw new Error();
      setFeedback(dados);
      // A vida cai (ou volta pelo combo) na hora -- os corações acompanham
      if (typeof dados.vidas === 'number') setStatus((prev) => ({ ...prev, vidas: dados.vidas, proxima_vida_em: dados.proxima_vida_em }));
      if (dados.correta) {
        const novoCombo = dados.combo ?? combo + 1;
        if (novoCombo >= 2) tocarSomCombo(novoCombo); else tocarSomAcerto();
        setCombo(novoCombo);
        setMaiorCombo((m) => Math.max(m, novoCombo));
        setFraseFeedback(sortear(FRASES_ACERTO));
        if (dados.ganhou_vida_combo) {
          setTimeout(tocarSomVida, 250);
          setAvisoVida(novoCombo);
          if (novoCombo >= 5) confetti({ particleCount: 40, spread: 50, origin: { y: 0.35 }, colors: ['#f43f5e', '#fb7185', '#fbbf24'] });
        }
      } else {
        tocarSomErro();
        setCombo(0);
        setFraseFeedback(sortear(FRASES_ERRO));
      }
    } catch (err) {
      console.error(err);
      setOpcaoSelecionada(null);
    } finally {
      setRespondendo(false);
    }
  };

  const usarDica = async () => {
    if (dicasRestantes <= 0 || opcaoSelecionada !== null || respondendo) return;
    try {
      const response = await apiFetch('/api/quiz/dica', {
        method: 'POST',
        body: JSON.stringify({ quiz_id: quiz.quiz_id, indice_pergunta: indiceAtual }),
      });
      if (!response.ok) return;
      const dados = await response.json();
      setOpcoesEliminadas((prev) => [...prev, dados.opcao_eliminada]);
      setDicasRestantes((d) => d - 1);
    } catch (err) {
      console.error(err);
    }
  };

  const proximaPergunta = () => {
    setFeedback(null);
    setAvisoVida(null);
    if (!ultimaPergunta) {
      setIndiceAtual((i) => i + 1);
      setOpcaoSelecionada(null);
      setOpcoesEliminadas([]);
      return;
    }
    enviarResultado();
  };

  const pularPergunta = async () => {
    if (opcaoSelecionada !== null || pulosRestantes <= 0 || respondendo) return;
    setRespondendo(true);
    try {
      const response = await apiFetch('/api/quiz/responder', {
        method: 'POST',
        body: JSON.stringify({ quiz_id: quiz.quiz_id, indice_pergunta: indiceAtual, opcao_selecionada: null }),
      });
      if (!response.ok) return;
      setPulosRestantes((p) => p - 1);
      setPulosUsados((p) => p + 1);
      setCombo(0);

      if (!ultimaPergunta) {
        setIndiceAtual((i) => i + 1);
        setOpcaoSelecionada(null);
        setOpcoesEliminadas([]);
        return;
      }
      enviarResultado();
    } catch (err) {
      console.error(err);
    } finally {
      setRespondendo(false);
    }
  };

  const reiniciar = () => {
    setQuiz(null);
    setResultado(null);
  };

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <style>{`
        .quiz-card {
          width: 100%;
          max-width: 820px;
          background: rgb(var(--tinta-rgb) / 0.045);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgb(var(--accent-rgb) / 0.15);
          border-radius: 24px;
          padding: 36px;
        }

        .quiz-back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--txt-4);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          padding: 0;
          margin-bottom: 18px;
          transition: color 0.2s;
        }

        .quiz-back-link:hover { color: var(--accent-soft); }

        .quiz-itinerario-btn {
          text-align: left;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid rgb(var(--accent-rgb) / 0.15);
          background: rgb(var(--tinta-rgb) / 0.03);
          color: var(--txt-1b);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .quiz-itinerario-btn:hover {
          border-color: rgb(var(--accent-rgb) / 0.4);
          background: rgb(var(--accent-rgb) / 0.08);
          transform: translateY(-1px);
        }

        .quiz-option-btn {
          width: 100%;
          text-align: left;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid rgb(var(--accent-rgb) / 0.15);
          background: rgb(var(--tinta-rgb) / 0.03);
          color: var(--txt-1b);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .quiz-option-btn:hover:not(:disabled) {
          border-color: rgb(var(--accent-rgb) / 0.4);
          background: rgb(var(--accent-rgb) / 0.08);
        }

        .quiz-option-btn.correct {
          border-color: rgba(52,211,153,0.5);
          background: rgba(52,211,153,0.12);
          color: var(--ok-suave);
          animation: quizPulseCorreta 0.35s ease;
        }

        .quiz-option-btn.wrong {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.1);
          color: var(--erro-suave);
          animation: quizShakeErrada 0.4s ease;
        }

        @keyframes quizPulseCorreta {
          0% { transform: scale(1); }
          35% { transform: scale(1.035); }
          100% { transform: scale(1); }
        }

        @keyframes quizShakeErrada {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .quiz-option-btn.correct, .quiz-option-btn.wrong { animation: none; }
        }

        .quiz-option-btn.eliminada {
          opacity: 0.3;
          text-decoration: line-through;
        }

        .quiz-option-btn:disabled { cursor: default; }

        .quiz-next-btn {
          margin-top: 20px;
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--accent-strong) 0%, var(--accent-2-strong) 100%);
          color: white;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .quiz-next-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgb(var(--accent-strong-rgb) / 0.35);
        }

        .quiz-next-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .quiz-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgb(var(--tinta-rgb) / 0.03);
          border: 1px solid rgb(var(--tinta-rgb) / 0.08);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          color: var(--txt-1b);
        }

        .quiz-tool-btn {
          background: rgb(var(--tinta-rgb) / 0.04);
          border: 1px solid rgb(var(--tinta-rgb) / 0.1);
          color: var(--txt-2);
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 10px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .quiz-tool-btn:hover:not(:disabled) {
          border-color: rgb(var(--accent-rgb) / 0.4);
          background: rgb(var(--accent-rgb) / 0.1);
          color: var(--txt-1b);
        }

        .quiz-tool-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .quiz-combo-badge {
          font-size: 12px;
          font-weight: 800;
          color: var(--aviso);
          display: inline-block;
        }

        .quiz-combo-quente {
          text-shadow: 0 0 10px currentColor;
          animation: quizComboTremor 0.6s ease-in-out infinite alternate;
        }

        @keyframes quizComboTremor {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(-1px) scale(1.06); }
        }

        .quiz-feedback {
          margin-top: 16px;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid;
        }
        .quiz-feedback.certo {
          background: rgba(52,211,153,0.1);
          border-color: rgba(52,211,153,0.4);
          color: var(--ok-suave);
        }
        .quiz-feedback.errado {
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.35);
          color: var(--erro-suave);
        }

        @media (prefers-reduced-motion: reduce) {
          .quiz-combo-quente { animation: none; }
        }
      `}</style>
      <SkeletonStyles />

      <div className="quiz-card">
        {aoVoltarInicio && (
          <button onClick={aoVoltarInicio} className="quiz-back-link">
            ← Voltar pro início
          </button>
        )}

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Quiz do Dia</div>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--txt-1)', letterSpacing: '-0.5px' }}>
              Teste o que <span className="gradient-text-live">você sabe</span>
            </h2>
            <p style={{ color: 'var(--txt-4)', fontSize: '14px', lineHeight: 1.6, marginTop: '8px', maxWidth: '440px' }}>
              10 perguntas sobre o seu curso — o mesmo usado pela IA Recrutadora no Simulador. Errou, perde uma vida; acertou, ganha XP.
              {' '}<strong style={{ color: '#fb7185' }}>{status?.acertos_seguidos_para_vida ?? 5} acertos seguidos devolvem 1 vida</strong>, e cada vida perdida volta sozinha a cada {status?.minutos_para_regenerar_vida ?? 30} min.
            </p>
          </div>
          <IconTarget style={{ fontSize: '24px', color: 'var(--accent)', flexShrink: 0, marginTop: '4px' }} />
        </div>

        {status && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '28px' }}>
            <div className="quiz-stat">
              {Array.from({ length: status.vidas_maximas }).map((_, i) => (
                <IconHeart key={i} style={{ color: i < status.vidas ? '#f43f5e' : 'rgb(var(--tinta-rgb) / 0.15)' }} />
              ))}
            </div>
            {status.congelamentos_disponiveis > 0 && (
              <div className="quiz-stat" title="Cada congelamento salva a ofensiva em 1 dia sem prática. A cada 7 dias seguidos você ganha 2 (até 4 guardados)."><IconSnowflake style={{ color: 'var(--accent-2)' }} /> {status.congelamentos_disponiveis} congelamento{status.congelamentos_disponiveis > 1 ? 's' : ''}</div>
            )}
          </div>
        )}

        {semVidas && !quiz && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '22px', textAlign: 'center', marginBottom: '24px' }}>
            <IconHeart style={{ fontSize: '28px', color: '#f43f5e', marginBottom: '10px' }} />
            <div style={{ color: 'var(--txt-1b)', fontWeight: '700', marginBottom: '6px' }}>Você está sem vidas</div>
            <div style={{ color: 'var(--txt-4)', fontSize: '13px' }}>
              {status?.proxima_vida_em ? `Próxima vida em ${formatarEspera(status.proxima_vida_em)} — depois, mais 1 a cada ${status.minutos_para_regenerar_vida ?? 30} min até encher.` : 'Suas vidas voltam sozinhas com o tempo.'}
            </div>
            <div style={{ color: 'var(--txt-4)', fontSize: '13px', marginTop: '8px' }}>
              Enquanto isso, dá pra treinar no Simulador ou nas situações de trabalho, na aba Competências.
            </div>
          </div>
        )}

        {!quiz && !carregando && !semVidas && status?.itinerario && (
          <div style={{ background: 'rgb(var(--accent-rgb) / 0.06)', border: '1px solid rgb(var(--accent-rgb) / 0.2)', borderRadius: '16px', padding: '22px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Seu curso atual</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--txt-1)', marginBottom: '16px' }}>{status.itinerario}</div>
            <button onClick={gerarQuiz} className="quiz-next-btn" style={{ margin: 0 }}>
              Começar quiz de hoje →
            </button>
          </div>
        )}

        {!quiz && !carregando && !semVidas && !status?.itinerario && (
          <div style={{ background: 'rgb(var(--accent-rgb) / 0.06)', border: '1px dashed rgb(var(--accent-rgb) / 0.25)', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
            <IconGraduationCap style={{ fontSize: '30px', color: 'var(--accent)', marginBottom: '12px' }} />
            <div style={{ color: 'var(--txt-1b)', fontWeight: '700', marginBottom: '6px' }}>Seu itinerário ainda não foi cadastrado</div>
            <div style={{ color: 'var(--txt-4)', fontSize: '13px', marginBottom: '18px' }}>
              Quem define o itinerário é a escola. Enquanto isso, você pode treinar com perguntas gerais de soft skills.
            </div>
            <button onClick={gerarQuiz} className="quiz-next-btn" style={{ maxWidth: '260px', margin: '0 auto' }}>
              Treinar soft skills →
            </button>
          </div>
        )}

        {carregando && (
          <div>
            <Skeleton style={{ height: '20px', width: '70%', marginBottom: '16px' }} />
            <Skeleton style={{ height: '52px', width: '100%', marginBottom: '10px' }} />
            <Skeleton style={{ height: '52px', width: '100%', marginBottom: '10px' }} />
            <Skeleton style={{ height: '52px', width: '100%', marginBottom: '10px' }} />
            <Skeleton style={{ height: '52px', width: '100%' }} />
          </div>
        )}

        {erro && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '18px', textAlign: 'center', color: 'var(--erro)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <IconWarning /> {erro}
          </div>
        )}

        {quiz && !resultado && perguntaAtual && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{quiz.tema}</span>
              <span style={{ fontSize: '12px', color: 'var(--txt-4)', fontWeight: '600' }}>{indiceAtual + 1} / {quiz.perguntas.length}</span>
            </div>

            {/* Barra de progresso: enche a cada pergunta e esquenta de cor com o combo */}
            <div style={{ height: '10px', borderRadius: '99px', background: 'rgb(var(--tinta-rgb) / 0.07)', overflow: 'hidden', marginBottom: '14px' }}>
              <motion.div
                animate={{
                  width: `${((indiceAtual + (feedback ? 1 : 0)) / quiz.perguntas.length) * 100}%`,
                  backgroundColor: combo >= 2 ? estiloCombo(combo).cor : 'var(--ok)',
                }}
                transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                style={{ height: '100%', borderRadius: '99px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--txt-4)', fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconTimer /> {formatarTempo(tempoDecorrido)}</span>
                <AnimatePresence>
                  {combo >= 2 && (
                    <motion.span
                      key={combo}
                      initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
                      animate={{ opacity: 1, scale: [1.35, 1], rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.35 }}
                      className={`quiz-combo-badge ${combo >= 5 ? 'quiz-combo-quente' : ''}`}
                      style={{ color: estiloCombo(combo).cor }}
                    >
                      <span style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: '4px' }}>
                        {Array.from({ length: estiloCombo(combo).chamas }).map((_, i) => <IconFire key={i} />)}
                      </span>
                      {estiloCombo(combo).rotulo} x{combo}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={usarDica} disabled={dicasRestantes <= 0 || opcaoSelecionada !== null} className="quiz-tool-btn">
                  <IconLightbulb style={{ verticalAlign: '-2px' }} /> Dica ({dicasRestantes})
                </button>
                <button onClick={pularPergunta} disabled={pulosRestantes <= 0 || opcaoSelecionada !== null} className="quiz-tool-btn">
                  <IconSkip style={{ verticalAlign: '-2px' }} /> Pular ({pulosRestantes})
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={indiceAtual}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--txt-1b)', marginBottom: '18px', lineHeight: 1.5 }}>
                  {perguntaAtual.pergunta}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {perguntaAtual.opcoes.map((opcao, idx) => {
                    let classe = '';
                    if (feedback) {
                      if (idx === feedback.resposta_correta_index) classe = 'correct';
                      else if (idx === opcaoSelecionada) classe = 'wrong';
                    } else if (opcoesEliminadas.includes(idx)) {
                      classe = 'eliminada';
                    }
                    return (
                      <button
                        key={idx}
                        onClick={() => escolherOpcao(idx)}
                        disabled={opcaoSelecionada !== null || opcoesEliminadas.includes(idx)}
                        className={`quiz-option-btn ${classe}`}
                      >
                        {opcao}
                      </button>
                    );
                  })}
                </div>

                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className={`quiz-feedback ${feedback.correta ? 'certo' : 'errado'}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {feedback.correta ? <IconCheckCircle /> : <IconXCircle />} {fraseFeedback}
                      </span>
                      {feedback.correta && (
                        <motion.span
                          initial={{ opacity: 0, y: 10, scale: 0.6 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
                          style={{ fontSize: '13px', fontWeight: '800', color: 'var(--aviso)' }}
                        >
                          +{XP_POR_ACERTO} XP
                        </motion.span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--txt-2)', lineHeight: 1.6 }}>
                      <IconSparkle style={{ flexShrink: 0, marginTop: '3px', opacity: 0.8 }} />
                      <span>{feedback.explicacao}</span>
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {avisoVida && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: [1.15, 1] }}
                      exit={{ opacity: 0 }}
                      style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '12px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)', color: '#fda4af', fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <motion.span animate={{ scale: [1, 1.35, 1] }} transition={{ repeat: 2, duration: 0.5 }} style={{ display: 'inline-flex', color: '#f43f5e' }}>
                        <IconHeart />
                      </motion.span>
                      Combo x{avisoVida}! +1 vida recuperada
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>

            {feedback && (
              <button onClick={proximaPergunta} className="quiz-next-btn">
                {ultimaPergunta ? 'Ver resultado →' : 'Próxima pergunta →'}
              </button>
            )}
          </div>
        )}

        {resultado && resultado.total !== undefined && (
          <QuizResultado
            resultado={resultado}
            tempoSegundos={tempoDecorrido}
            maiorCombo={maiorCombo}
            pulosUsados={pulosUsados}
            aoRefazer={reiniciar}
          />
        )}
      </div>
    </div>
  );
};

export default DailyQuiz;
