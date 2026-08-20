import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { IconTarget, IconTrophy, IconWarning, IconSparkle, IconHeart, IconCoins, IconSnowflake, IconGraduationCap } from './icons';
import { apiFetch } from '../api';
import { SkeletonStyles, Skeleton } from './Skeleton';

const DICAS_POR_QUIZ = 2;
const PULOS_POR_QUIZ = 2;
const CUSTO_VIDA_MOEDAS = 50;

const dispararConfete = () => {
  const cores = ['#a78bfa', '#67e8f9', '#7c3aed', '#34d399'];
  confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 }, colors: cores });
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

const DailyQuiz = ({ aoGanharXp, aoAbrirCursos, aoVoltarMural }) => {
  const [quiz, setQuiz] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [semVidas, setSemVidas] = useState(false);

  const [status, setStatus] = useState(null);
  const [comprando, setComprando] = useState(false);

  const [indiceAtual, setIndiceAtual] = useState(0);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [opcoesEliminadas, setOpcoesEliminadas] = useState([]);
  const [acertos, setAcertos] = useState(0);
  const [resultado, setResultado] = useState(null);

  const [dicasRestantes, setDicasRestantes] = useState(DICAS_POR_QUIZ);
  const [pulosRestantes, setPulosRestantes] = useState(PULOS_POR_QUIZ);
  const [pulosUsados, setPulosUsados] = useState(0);
  const [combo, setCombo] = useState(0);

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

  const comprarVida = async () => {
    try {
      setComprando(true);
      const response = await apiFetch('/api/vidas/comprar', { method: 'POST' });
      const dados = await response.json();
      if (response.ok) {
        setStatus((prev) => ({ ...prev, vidas: dados.vidas, moedas: dados.moedas }));
        setSemVidas(dados.vidas <= 0);
      } else {
        setErro(dados.detail || 'Não foi possível comprar a vida.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setComprando(false);
    }
  };

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
      setAcertos(0);
      setResultado(null);
      setFeedback(null);
      setDicasRestantes(dados.dicas_disponiveis ?? DICAS_POR_QUIZ);
      setPulosRestantes(dados.pulos_disponiveis ?? PULOS_POR_QUIZ);
      setPulosUsados(0);
      setCombo(0);
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
        });
      }
      if (response.ok) {
        setStatus((prev) => ({
          ...prev,
          vidas: dados.vidas,
          moedas: dados.moedas,
          congelamentos_disponiveis: dados.congelamentos_disponiveis,
          quizzes_perfeitos_seguidos: dados.quizzes_perfeitos_seguidos,
        }));
        setSemVidas(dados.vidas <= 0);
        if (dados.acertos === dados.total || dados.vida_bonus_ganha) dispararConfete();
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
      if (dados.correta) {
        setAcertos((a) => a + 1);
        setCombo((c) => c + 1);
      } else {
        setCombo(0);
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
          max-width: 680px;
          background: rgba(255,255,255,0.045);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(167,139,250,0.15);
          border-radius: 24px;
          padding: 36px;
        }

        .quiz-back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          padding: 0;
          margin-bottom: 18px;
          transition: color 0.2s;
        }

        .quiz-back-link:hover { color: #c4b5fd; }

        .quiz-itinerario-btn {
          text-align: left;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid rgba(167,139,250,0.15);
          background: rgba(255,255,255,0.03);
          color: #e2e8f0;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .quiz-itinerario-btn:hover {
          border-color: rgba(167,139,250,0.4);
          background: rgba(167,139,250,0.08);
          transform: translateY(-1px);
        }

        .quiz-option-btn {
          width: 100%;
          text-align: left;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid rgba(167,139,250,0.15);
          background: rgba(255,255,255,0.03);
          color: #e2e8f0;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .quiz-option-btn:hover:not(:disabled) {
          border-color: rgba(167,139,250,0.4);
          background: rgba(167,139,250,0.08);
        }

        .quiz-option-btn.correct {
          border-color: rgba(52,211,153,0.5);
          background: rgba(52,211,153,0.12);
          color: #6ee7b7;
        }

        .quiz-option-btn.wrong {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.1);
          color: #fca5a5;
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
          background: linear-gradient(135deg, #7c3aed 0%, #0e7490 100%);
          color: white;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .quiz-next-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(124,58,237,0.35);
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
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          color: #e2e8f0;
        }

        .quiz-tool-btn {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 10px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .quiz-tool-btn:hover:not(:disabled) {
          border-color: rgba(167,139,250,0.4);
          background: rgba(167,139,250,0.1);
          color: #e2e8f0;
        }

        .quiz-tool-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .quiz-combo-badge {
          font-size: 12px;
          font-weight: 800;
          color: #fbbf24;
        }
      `}</style>
      <SkeletonStyles />

      <div className="quiz-card">
        {aoVoltarMural && (
          <button onClick={aoVoltarMural} className="quiz-back-link">
            ← Voltar pro Mural
          </button>
        )}

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Quiz do Dia</div>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.5px' }}>
              Teste o que <span className="gradient-text-live">você sabe</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginTop: '8px', maxWidth: '440px' }}>
              10 perguntas sobre o seu curso — o mesmo usado pela IA Recrutadora no Simulador. Errou, perde uma vida; acertou, ganha XP e moedas.
            </p>
          </div>
          <IconTarget style={{ fontSize: '24px', color: '#a78bfa', flexShrink: 0, marginTop: '4px' }} />
        </div>

        {status && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '28px' }}>
            <div className="quiz-stat">
              {Array.from({ length: status.vidas_maximas }).map((_, i) => (
                <IconHeart key={i} style={{ color: i < status.vidas ? '#f43f5e' : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
            <div className="quiz-stat"><IconCoins style={{ color: '#fbbf24' }} /> {status.moedas}</div>
            {status.congelamentos_disponiveis > 0 && (
              <div className="quiz-stat"><IconSnowflake style={{ color: '#67e8f9' }} /> {status.congelamentos_disponiveis} congelamento{status.congelamentos_disponiveis > 1 ? 's' : ''}</div>
            )}
          </div>
        )}

        {semVidas && !quiz && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '22px', textAlign: 'center', marginBottom: '24px' }}>
            <IconHeart style={{ fontSize: '28px', color: '#f43f5e', marginBottom: '10px' }} />
            <div style={{ color: '#e2e8f0', fontWeight: '700', marginBottom: '6px' }}>Você está sem vidas</div>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
              {status?.proxima_vida_em ? `Próxima vida em ${formatarEspera(status.proxima_vida_em)}` : 'Aguarde a regeneração ou compre com moedas.'}
            </div>
            <button
              onClick={comprarVida}
              disabled={comprando || (status?.moedas ?? 0) < CUSTO_VIDA_MOEDAS}
              className="quiz-next-btn"
              style={{ maxWidth: '280px', margin: '0 auto' }}
            >
              {comprando ? 'Comprando...' : `Comprar 1 vida (${CUSTO_VIDA_MOEDAS} moedas)`}
            </button>
          </div>
        )}

        {!quiz && !carregando && !semVidas && status?.itinerario && (
          <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '16px', padding: '22px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Seu curso atual</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#f1f5f9', marginBottom: '16px' }}>{status.itinerario}</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={gerarQuiz} className="quiz-next-btn" style={{ margin: 0, flex: '1 1 200px' }}>
                Começar quiz de hoje →
              </button>
              {aoAbrirCursos && (
                <button onClick={aoAbrirCursos} className="quiz-itinerario-btn" style={{ flex: '0 0 auto' }}>
                  Trocar curso
                </button>
              )}
            </div>
          </div>
        )}

        {!quiz && !carregando && !semVidas && !status?.itinerario && (
          <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px dashed rgba(167,139,250,0.25)', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
            <IconGraduationCap style={{ fontSize: '30px', color: '#a78bfa', marginBottom: '12px' }} />
            <div style={{ color: '#e2e8f0', fontWeight: '700', marginBottom: '6px' }}>Você ainda não escolheu um curso</div>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '18px' }}>
              O curso define o tema do Quiz do Dia e das perguntas do Simulador de Entrevista.
            </div>
            {aoAbrirCursos && (
              <button onClick={aoAbrirCursos} className="quiz-next-btn" style={{ maxWidth: '260px', margin: '0 auto' }}>
                Escolher meu curso
              </button>
            )}
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
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '18px', textAlign: 'center', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <IconWarning /> {erro}
          </div>
        )}

        {quiz && !resultado && perguntaAtual && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{quiz.tema}</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{indiceAtual + 1} / {quiz.perguntas.length}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>⏱ {formatarTempo(tempoDecorrido)}</span>
                <AnimatePresence>
                  {combo >= 2 && (
                    <motion.span
                      key={combo}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      className="quiz-combo-badge"
                    >
                      🔥 Combo x{combo}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={usarDica} disabled={dicasRestantes <= 0 || opcaoSelecionada !== null} className="quiz-tool-btn">
                  💡 Dica ({dicasRestantes})
                </button>
                <button onClick={pularPergunta} disabled={pulosRestantes <= 0 || opcaoSelecionada !== null} className="quiz-tool-btn">
                  ⏭ Pular ({pulosRestantes})
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
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#e2e8f0', marginBottom: '18px', lineHeight: 1.5 }}>
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: '16px', padding: '14px 18px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '14px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, display: 'flex', gap: '8px' }}
                  >
                    <IconSparkle style={{ color: '#a78bfa', flexShrink: 0, marginTop: '2px' }} />
                    <span>{feedback.explicacao}</span>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {feedback && (
              <button onClick={proximaPergunta} className="quiz-next-btn">
                {ultimaPergunta ? 'Ver resultado →' : 'Próxima pergunta →'}
              </button>
            )}
          </div>
        )}

        {resultado && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '20px 0' }}
          >
            <IconTrophy style={{ fontSize: '40px', color: '#fbbf24', marginBottom: '14px' }} />
            <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9', marginBottom: '8px' }}>
              Você acertou {resultado.acertos} de {resultado.total}!
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '8px' }}>
              Tempo: {formatarTempo(tempoDecorrido)} · Pulos usados: {pulosUsados}
            </p>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>
              +{resultado.xp_concedido} XP · Nível {resultado.nivel_atual} · {resultado.categoria_status}
            </p>
            {resultado.vida_bonus_ganha ? (
              <p style={{ color: '#f43f5e', fontSize: '13px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <IconHeart /> 5 quizzes perfeitos seguidos! Ganhou 1 vida de bônus
              </p>
            ) : (
              acertos === resultado.total && (
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '20px' }}>
                  {resultado.quizzes_perfeitos_seguidos}/5 quizzes perfeitos seguidos pra ganhar vida de bônus
                </p>
              )
            )}
            <button onClick={reiniciar} className="quiz-next-btn" style={{ maxWidth: '260px', margin: '0 auto' }}>
              Fazer outro quiz
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DailyQuiz;
