import React, { useState } from 'react';

const InterviewSimulator = ({ estudanteId = 1, aoGanharXp }) => {
  const [mensagem, setMensagem] = useState('');
  const [historico, setHistorico] = useState([
    {
      id: 1,
      remetente: 'ai',
      texto: 'Olá! Que bom ter você aqui. Para começarmos nossa simulação de entrevista, me conte um pouco sobre você e por que tem interesse na área de tecnologia?',
      feedback: null,
      xp_ganho: null
    }
  ]);
  const [carregando, setCarregando] = useState(false);

  // Estados locais sincronizados com o back-end
  const [pontos, setPontos] = useState(120);
  const [nivel, setNivel] = useState(1);
  const [ofensiva, setOfensiva] = useState(4);
  const [missoes, setMissoes] = useState(2);

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
      const response = await fetch('http://127.0.0.1:8000/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudante_id: estudanteId, mensagem_usuario: mensagemUsuario }),
      });

      if (!response.ok) throw new Error('Erro ao conversar com o servidor');

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

      // ⚡ Opcional: Atualiza o Header global do App.js se a propriedade foi passada
      if (aoGanharXp) {
        aoGanharXp({
          xp_total: novosPontos,
          nivel_gamificacao: novoNivel,
          ofensiva_dias: novaOfensiva,
          categoria_status: dados.categoria_status
        });
      }

      setHistorico((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          remetente: 'ai',
          texto: dados.resposta_ia,
          feedback: dados.feedback_ia,
          xp_ganho: dados.xp_concedido // Guarda o XP ganho nessa rodada específica
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
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(167, 139, 250, 0.12);
          border-radius: 14px;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sim-xp-bar-track {
          width: 120px;
          height: 5px;
          background: rgba(255,255,255,0.08);
          border-radius: 99px;
          overflow: hidden;
        }

        .sim-xp-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #a78bfa, #67e8f9);
          transition: width 0.6s ease;
        }

        .sim-msg-ai {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(167,139,250,0.15);
          color: #cbd5e1;
          border-radius: 16px;
          border-top-left-radius: 4px;
          padding: 14px 18px;
          max-width: 80%;
          font-size: 14px;
          line-height: 1.6;
        }

        .sim-msg-user {
          background: linear-gradient(135deg, rgba(167,139,250,0.25) 0%, rgba(103,232,249,0.15) 100%);
          border: 1px solid rgba(167,139,250,0.3);
          color: #e2e8f0;
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
          color: #94a3b8;
          border-radius: 16px;
          border-top-left-radius: 4px;
          padding: 14px 18px;
          max-width: 80%;
          font-size: 13px;
          line-height: 1.6;
        }

        .sim-input {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(167,139,250,0.2);
          border-radius: 12px;
          padding: 13px 18px;
          color: #e2e8f0;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
        }

        .sim-input::placeholder { color: #475569; }
        .sim-input:focus { border-color: rgba(167,139,250,0.5); }
        .sim-input:disabled { opacity: 0.4; cursor: not-allowed; }

        .sim-send-btn {
          background: linear-gradient(135deg, #7c3aed, #0e7490);
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
          box-shadow: 0 8px 20px rgba(124,58,237,0.3);
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
          color: #64748b;
          font-size: 13px;
          font-style: italic;
        }

        @keyframes simTyping {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Stats bar */}
      <div style={{ maxWidth: '760px', width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div className="sim-stat-card">
          <div style={{ background: 'linear-gradient(135deg, #7c3aed, #0e7490)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: '700', color: 'white', letterSpacing: '0.5px' }}>
            NÍV {nivel}
          </div>
          <div className="sim-xp-bar-track">
            <div className="sim-xp-bar-fill" style={{ width: `${xpProgress}%` }} />
          </div>
          <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: '700' }}>{pontos} XP</span>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="sim-stat-card" title="Dias seguidos praticando!">
            <span style={{ fontSize: '20px' }}>🔥</span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#f97316', lineHeight: 1 }}>{ofensiva}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>dias</div>
            </div>
          </div>

          <div className="sim-stat-card" title="Quests cumpridas hoje">
            <span style={{ fontSize: '20px' }}>🎯</span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#34d399', lineHeight: 1 }}>{missoes}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>diárias</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat window */}
      <div style={{
        maxWidth: '760px',
        width: '100%',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(167,139,250,0.15)',
        borderRadius: '24px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 60px rgba(167,139,250,0.05)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(14,116,144,0.2) 100%)',
          borderBottom: '1px solid rgba(167,139,250,0.15)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.3px' }}>
              <span>🤖</span> IA Recrutadora
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Simulador de Entrevista · Vaga Jovem Aprendiz</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="sim-pulse" style={{ background: carregando ? '#facc15' : '#34d399' }} />
            <span style={{ fontSize: '12px', color: '#64748b' }}>{carregando ? 'analisando' : 'online'}</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: '420px',
          maxHeight: '520px',
        }}>
          {historico.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: msg.remetente === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.remetente === 'ai' && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#0e7490)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', marginRight: '8px', flexShrink: 0, alignSelf: 'flex-end' }}>
                    🤖
                  </div>
                )}
                <div className={msg.remetente === 'user' ? 'sim-msg-user' : 'sim-msg-ai'}>
                  {msg.texto}
                </div>
              </div>

              {msg.remetente === 'ai' && msg.feedback && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: '36px' }}>
                  <div className="sim-feedback-card">
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#34d399', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ✨ Feedback em tempo real {msg.xp_ganho !== null ? `· +${msg.xp_ganho} XP` : ''}
                    </div>
                    {msg.feedback}
                  </div>
                </div>
              )}
            </div>
          ))}

          {carregando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#0e7490)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>🤖</div>
              <p className="sim-typing">A IA está analisando sua resposta...</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(167,139,250,0.1)', display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder={carregando ? 'Aguarde a IA...' : 'Digite sua resposta aqui...'}
            className="sim-input"
            value={mensagem}
            onChange={(e) => setMessage(e.target.value)}
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
        </div>
      </div>
    </div>
  );
};

export default InterviewSimulator;