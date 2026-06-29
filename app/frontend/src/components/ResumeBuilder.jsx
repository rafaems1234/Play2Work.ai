import React, { useState } from 'react';

const ResumeBuilder = ({ estudanteId = 1 }) => {
  const [habilidades, setHabilidades] = useState('');
  const [curriculoGerado, setCurriculoGerado] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState(null);

  const handleGerarCurriculo = async () => {
    if (!habilidades.trim() || carregando) return;

    try {
      setCarregando(true);
      setErro(null);

      const response = await fetch('http://127.0.0.1:8000/api/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudante_id: estudanteId, habilidades_texto: habilidades }),
      });

      if (!response.ok) throw new Error('Falha ao comunicar com a IA para criar o currículo.');

      const dados = await response.json();
      if (dados.sucesso) {
        setCurriculoGerado(dados.curriculo);
      } else {
        throw new Error(dados.erro || 'Erro desconhecido ao gerar o currículo.');
      }
    } catch (err) {
      console.error(err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleExportarLinkedIn = async () => {
    if (!curriculoGerado || sincronizando) return;

    try {
      setSincronizando(true);
      const response = await fetch('http://127.0.0.1:8000/api/resume/export-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudante_id: estudanteId, texto_curriculo: curriculoGerado }),
      });

      if (!response.ok) throw new Error();

      const dados = await response.json();
      
      const secoes = dados.secoes_atualizadas ? dados.secoes_atualizadas.join(', ') : 'Summary, Skills, TargetJobs';
      alert(`💼 Perfil Sincronizado!\n\n${dados.mensagem || 'Dados integrados com o sandbox.'}\n\nCampos atualizados: ${secoes}`);
    } catch (err) {
      alert('⚠️ Falha ao conectar com o sandbox da API do LinkedIn.');
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <style>{`
        .resume-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(167,139,250,0.15);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 680px;
          box-shadow: 0 0 80px rgba(124,58,237,0.06);
        }

        .resume-textarea {
          width: 100%;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(167,139,250,0.2);
          border-radius: 14px;
          padding: 16px 20px;
          color: #e2e8f0;
          font-size: 14px;
          line-height: 1.6;
          resize: vertical;
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
          min-height: 140px;
        }

        .resume-textarea::placeholder { color: #475569; }
        .resume-textarea:focus { border-color: rgba(167,139,250,0.45); }
        .resume-textarea:disabled { opacity: 0.4; }

        .generate-btn {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #7c3aed 0%, #0e7490 100%);
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: inherit;
          letter-spacing: -0.2px;
        }

        .generate-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(124,58,237,0.35);
        }

        .generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: btnSpin 0.7s linear infinite;
        }

        @keyframes btnSpin { to { transform: rotate(360deg); } }

        .result-container {
          margin-top: 28px;
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(167,139,250,0.15);
          border-radius: 16px;
          overflow: hidden;
        }

        .result-header {
          padding: 14px 20px;
          background: rgba(167,139,250,0.08);
          border-bottom: 1px solid rgba(167,139,250,0.12);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .result-action-btn {
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          font-family: inherit;
        }

        .result-action-btn.copy {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
        }

        .result-action-btn.copy:hover {
          background: rgba(255,255,255,0.1);
          color: #e2e8f0;
        }

        .result-action-btn.linkedin {
          background: #0a66c2;
          color: white;
        }

        .result-action-btn.linkedin:hover:not(:disabled) {
          background: #004182;
          box-shadow: 0 4px 12px rgba(10,102,194,0.3);
        }

        .result-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .result-body {
          padding: 20px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.7;
          color: #cbd5e1;
          white-space: pre-line;
          overflow-x: auto;
        }

        .empty-state {
          padding: 40px;
          border: 1px dashed rgba(167,139,250,0.15);
          border-radius: 16px;
          text-align: center;
          color: #475569;
          font-size: 14px;
          margin-top: 28px;
        }

        .error-msg {
          margin-top: 16px;
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.18);
          border-radius: 12px;
          padding: 14px 18px;
          font-size: 13px;
          color: #f87171;
        }
      `}</style>

      <div className="resume-card">
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '99px', padding: '5px 14px', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px' }}> ✨ IA Generativa</span>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.6px', marginBottom: '10px' }}>
            Gerador de{' '}
            <span style={{ background: 'linear-gradient(135deg, #a78bfa, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Currículo
            </span>
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>
            Não sabe como montar um currículo? Digite o que você gosta e sabe fazer — a IA formata tudo como um profissional.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Suas habilidades e interesses
          </label>
          <textarea
            className="resume-textarea"
            rows="5"
            placeholder="Ex: Sou bom em matemática, gosto de mexer no computador, fiz um curso de robótica na escola e ajudo a organizar os eventos do grêmio estudantil..."
            value={habilidades}
            onChange={(e) => setHabilidades(e.target.value)}
            disabled={carregando}
          />
        </div>

        <button
          onClick={handleGerarCurriculo}
          disabled={carregando || !habilidades.trim()}
          className="generate-btn"
        >
          {carregando ? (
            <>
              <div className="btn-spinner" />
              Estruturando seu currículo...
            </>
          ) : (
            '🪄 Gerar currículo perfeito'
          )}
        </button>

        {erro && (
          <div className="error-msg">
            ⚠️ {erro} (Garanta que seu back-end está rodando!)
          </div>
        )}

        {!curriculoGerado && !carregando && (
          <div className="empty-state">
            Seu currículo formatado aparecerá aqui...
          </div>
        )}

        {curriculoGerado && (
          <div className="result-container">
            <div className="result-header">
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#a78bfa' }}>📄 Currículo gerado</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => navigator.clipboard.writeText(curriculoGerado)}
                  className="result-action-btn copy"
                >
                  📋 Copiar
                </button>
                <button
                  onClick={handleExportarLinkedIn}
                  disabled={sincronizando}
                  className="result-action-btn linkedin"
                >
                  {sincronizando ? 'Sincronizando...' : '💼 Atualizar LinkedIn'}
                </button>
              </div>
            </div>
            <div className="result-body">
              {curriculoGerado}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeBuilder;