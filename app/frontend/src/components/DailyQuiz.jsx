import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { IconTarget, IconTrophy, IconWarning, IconSparkle } from './icons';
import { API_BASE_URL } from '../api';
import { SkeletonStyles, Skeleton } from './Skeleton';

const dispararConfete = () => {
  const cores = ['#a78bfa', '#67e8f9', '#7c3aed', '#34d399'];
  confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 }, colors: cores });
};

const DailyQuiz = ({ estudanteId = 1, aoGanharXp }) => {
  const [itinerarios, setItinerarios] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const [indiceAtual, setIndiceAtual] = useState(0);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [acertos, setAcertos] = useState(0);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    const buscarItinerarios = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/quiz/itinerarios`);
        if (!response.ok) throw new Error();
        const dados = await response.json();
        setItinerarios(dados.itinerarios || []);
      } catch {
        setItinerarios(['Tecnologia e Dados', 'Administrativo e Escritório', 'Atendimento e Vendas', 'Logística e Operações', 'Marketing e Comunicação']);
      }
    };
    buscarItinerarios();
  }, []);

  const gerarQuiz = async (itinerario) => {
    try {
      setCarregando(true);
      setErro(null);
      const response = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudante_id: estudanteId, itinerario }),
      });
      if (!response.ok) throw new Error('Não foi possível gerar o quiz.');
      const dados = await response.json();
      setQuiz(dados);
      setIndiceAtual(0);
      setOpcaoSelecionada(null);
      setAcertos(0);
      setResultado(null);
    } catch (err) {
      console.error(err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const perguntaAtual = quiz?.perguntas?.[indiceAtual];
  const ultimaPergunta = quiz && indiceAtual === quiz.perguntas.length - 1;

  const escolherOpcao = (idx) => {
    if (opcaoSelecionada !== null) return;
    setOpcaoSelecionada(idx);
    if (idx === perguntaAtual.resposta_correta_index) {
      setAcertos((a) => a + 1);
    }
  };

  const proximaPergunta = async () => {
    if (!ultimaPergunta) {
      setIndiceAtual((i) => i + 1);
      setOpcaoSelecionada(null);
      return;
    }

    // Última pergunta respondida: envia o resultado
    try {
      const response = await fetch(`${API_BASE_URL}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estudante_id: estudanteId,
          tema: quiz.tema,
          acertos,
          total: quiz.perguntas.length,
        }),
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
      if (acertos === quiz.perguntas.length) dispararConfete();
    } catch (err) {
      console.error(err);
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
      `}</style>
      <SkeletonStyles />

      <div className="quiz-card">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Quiz do Dia</div>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.5px' }}>
              Teste o que <span className="gradient-text-live">você sabe</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginTop: '8px', maxWidth: '440px' }}>
              5 perguntas rápidas sobre um itinerário à sua escolha. Acertou, ganhou XP — e ainda conta pra sua ofensiva do dia.
            </p>
          </div>
          <IconTarget style={{ fontSize: '24px', color: '#a78bfa', flexShrink: 0, marginTop: '4px' }} />
        </div>

        {!quiz && !carregando && (
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Escolha seu itinerário
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {itinerarios.map((it) => (
                <button key={it} onClick={() => gerarQuiz(it)} className="quiz-itinerario-btn">
                  {it}
                </button>
              ))}
            </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{quiz.tema}</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{indiceAtual + 1} / {quiz.perguntas.length}</span>
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
                    if (opcaoSelecionada !== null) {
                      if (idx === perguntaAtual.resposta_correta_index) classe = 'correct';
                      else if (idx === opcaoSelecionada) classe = 'wrong';
                    }
                    return (
                      <button
                        key={idx}
                        onClick={() => escolherOpcao(idx)}
                        disabled={opcaoSelecionada !== null}
                        className={`quiz-option-btn ${classe}`}
                      >
                        {opcao}
                      </button>
                    );
                  })}
                </div>

                {opcaoSelecionada !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: '16px', padding: '14px 18px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '14px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, display: 'flex', gap: '8px' }}
                  >
                    <IconSparkle style={{ color: '#a78bfa', flexShrink: 0, marginTop: '2px' }} />
                    <span>{perguntaAtual.explicacao}</span>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {opcaoSelecionada !== null && (
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
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
              +{resultado.xp_concedido} XP · Nível {resultado.nivel_atual} · {resultado.categoria_status}
            </p>
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
