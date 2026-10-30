import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconSparkle, IconWand, IconWarning, IconDocument, IconClipboard, IconLinkedIn, IconCheckCircle } from './icons';
import { apiFetch, urlDeArquivo } from '../api';
import { FolhaCurriculo, ESTILOS_FOLHA, Imprimir, listar } from './FolhaCurriculo';
import { dataHoraIsoParaBr } from '../utils/formatos';

const formatarCurriculoTexto = (cv, perfil) => {
  const linhas = [
    cv.nome_candidato || perfil.nome || '',
    [perfil.email, perfil.linkedin].filter(Boolean).join(' · '),
    '',
    'OBJETIVO',
    cv.objetivo_profissional || cv.objetivo_professional || '—',
    '',
    'FORMAÇÃO',
    `Ensino Médio${perfil.itinerario ? ` — Itinerário: ${perfil.itinerario}` : ''}`,
  ];
  if (listar(cv.experiencias).length) {
    linhas.push('', 'EXPERIÊNCIAS E PROJETOS', ...listar(cv.experiencias).map((e) => `• ${e}`));
  }
  linhas.push(
    '',
    `COMPETÊNCIAS TÉCNICAS: ${listar(cv.hard_skills).join(', ') || '—'}`,
    `COMPETÊNCIAS COMPORTAMENTAIS: ${listar(cv.soft_skills).join(', ') || '—'}`,
    `ÁREAS DE INTERESSE: ${listar(cv.sugestao_areas_atuacao).join(', ') || '—'}`,
  );
  return linhas.join('\n');
};

const ResumeBuilder = ({ aoGerar }) => {
  const [habilidades, setHabilidades] = useState('');
  const [curriculo, setCurriculo] = useState(null);
  const [geradoEm, setGeradoEm] = useState(null);
  const [imprimindo, setImprimindo] = useState(false);
  // Foto no currículo: escolha do aluno, desligada por padrão
  const [temFoto, setTemFoto] = useState(false);
  const [fotoNoCurriculo, setFotoNoCurriculo] = useState(false);
  const [fotoUrl, setFotoUrl] = useState(null);
  const [perfil, setPerfil] = useState({ nome: '', email: '', linkedin: '', itinerario: null });
  const [carregando, setCarregando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        const [respConta, respStatus, respAtual, respPerfil] = await Promise.all([
          apiFetch('/api/auth/me'),
          apiFetch('/api/estudante/me/status'),
          apiFetch('/api/resume/atual'),
          apiFetch('/api/estudante/me/perfil'),
        ]);
        if (respPerfil.ok) setTemFoto(Boolean((await respPerfil.json()).tem_foto));
        const conta = respConta.ok ? await respConta.json() : {};
        const status = respStatus.ok ? await respStatus.json() : {};
        // Abre com o último currículo salvo (e o texto que gerou ele), pra
        // o aluno só ajustar em vez de começar do zero
        const atual = respAtual.ok ? await respAtual.json() : {};
        setFotoNoCurriculo(Boolean(atual.foto_no_curriculo));
        if (atual.curriculo) {
          setCurriculo(atual.curriculo);
          setGeradoEm(atual.gerado_em);
          setHabilidades((texto) => texto || atual.texto_original || '');
        }
        setPerfil({ nome: conta.nome || status.nome || '', email: conta.email || '', linkedin: conta.linkedin || '', itinerario: status.itinerario || null });
      } catch (err) {
        console.error(err);
      }
    };
    carregarPerfil();
  }, []);

  useEffect(() => {
    if (!temFoto || !fotoNoCurriculo) { setFotoUrl(null); return undefined; }
    let ativo = true;
    let criada = null;
    urlDeArquivo('/api/estudante/me/foto').then((u) => { if (ativo) { criada = u; setFotoUrl(u); } });
    return () => { ativo = false; if (criada) URL.revokeObjectURL(criada); };
  }, [temFoto, fotoNoCurriculo]);

  const alternarFoto = async (incluir) => {
    setFotoNoCurriculo(incluir);
    const resposta = await apiFetch('/api/estudante/me/preferencias-curriculo', { method: 'PUT', body: JSON.stringify({ foto_no_curriculo: incluir }) });
    if (!resposta.ok) setFotoNoCurriculo(!incluir);
  };

  const mostrarAviso = (tipo, texto) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4000);
  };

  const handleGerarCurriculo = async () => {
    if (!habilidades.trim() || carregando) return;

    try {
      setCarregando(true);
      setErro(null);

      const response = await apiFetch('/api/resume/generate', {
        method: 'POST',
        body: JSON.stringify({ habilidades_texto: habilidades }),
      });

      if (!response.ok) throw new Error('Falha ao comunicar com a IA para criar o currículo.');

      const dados = await response.json();
      if (dados.sucesso) {
        setCurriculo(dados.curriculo);
        setGeradoEm(dados.gerado_em || new Date().toISOString());
        aoGerar?.();
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

  const handleBaixarPdf = () => setImprimindo(true);

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(formatarCurriculoTexto(curriculo, perfil));
      mostrarAviso('ok', 'Texto do currículo copiado.');
    } catch {
      mostrarAviso('erro', 'Não deu pra copiar automaticamente.');
    }
  };

  const handleExportarLinkedIn = async () => {
    if (!curriculo || sincronizando) return;

    try {
      setSincronizando(true);
      const response = await apiFetch('/api/resume/export-linkedin', {
        method: 'POST',
        body: JSON.stringify({ texto_curriculo: formatarCurriculoTexto(curriculo, perfil) }),
      });

      if (!response.ok) throw new Error();

      const dados = await response.json();
      const secoes = dados.secoes_atualizadas ? dados.secoes_atualizadas.join(', ') : 'Summary, Skills, TargetJobs';
      mostrarAviso('ok', `${dados.mensagem || 'Perfil sincronizado.'} Campos: ${secoes}.`);
    } catch (err) {
      console.error(err);
      mostrarAviso('erro', 'Falha ao conectar com o sandbox da API do LinkedIn.');
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <style>{`
        .resume-card {
          background: rgba(255,255,255,0.045);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgb(var(--accent-rgb) / 0.15);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 900px;
          box-shadow: 0 0 80px rgb(var(--accent-strong-rgb) / 0.06);
        }

        .resume-textarea {
          width: 100%;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgb(var(--accent-rgb) / 0.2);
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
        .resume-textarea:focus { border-color: rgb(var(--accent-rgb) / 0.45); }
        .resume-textarea:disabled { opacity: 0.4; }

        .generate-btn {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--accent-strong) 0%, var(--accent-2-strong) 100%);
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
          box-shadow: 0 12px 32px rgb(var(--accent-strong-rgb) / 0.35);
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

        .result-container { margin-top: 28px; }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 14px;
        }

        .result-action-btn {
          padding: 9px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .result-action-btn.pdf { background: var(--accent); color: #000; }
        .result-action-btn.pdf:hover { background: #fff; }

        .result-action-btn.copy {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
        }
        .result-action-btn.copy:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }

        .result-action-btn.linkedin { background: #0a66c2; color: white; }
        .result-action-btn.linkedin:hover:not(:disabled) { background: #004182; }
        .result-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .resume-aviso {
          margin-bottom: 14px;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
        }
        .resume-aviso.ok { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25); color: #6ee7b7; }
        .resume-aviso.erro { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: #f87171; }

        .empty-state {
          padding: 40px;
          border: 1px dashed rgb(var(--accent-rgb) / 0.15);
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

        @media (max-width: 600px) {
          .resume-card { padding: 24px 18px; }
        }

        ${ESTILOS_FOLHA}
      `}</style>

      <div className="resume-card">
        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>IA Generativa</div>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.5px', marginBottom: '10px' }}>
              Gerador de <span className="gradient-text-live">Currículo</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, maxWidth: '480px' }}>
              Nunca fez um currículo? Conte do seu jeito o que você sabe fazer, o que já fez na escola e do que gosta.
              A IA monta um currículo profissional, pronto pra baixar em PDF e mandar pras vagas.
            </p>
          </div>
          <IconSparkle style={{ fontSize: '24px', color: 'var(--accent)', flexShrink: 0, marginTop: '4px' }} />
        </div>

        {/* Input */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="resume-texto" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Sobre você
          </label>
          <textarea
            id="resume-texto"
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
            <><IconWand /> {curriculo ? 'Gerar de novo' : 'Gerar meu currículo'}</>
          )}
        </button>

        {erro && (
          <div className="error-msg" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconWarning /> {erro} (Garanta que seu back-end está rodando!)
          </div>
        )}

        {!curriculo && !carregando && (
          <div className="empty-state">
            Seu currículo formatado aparecerá aqui, pronto pra virar PDF.
          </div>
        )}

        <AnimatePresence>
          {curriculo && (
            <motion.div
              className="result-container"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="result-header">
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconDocument /> Currículo pronto</span>
                  {/* Cada geração vira a versão que a escola vê no painel */}
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <IconCheckCircle style={{ color: '#34d399' }} />
                    Enviado pra coordenação{geradoEm ? ` · atualizado em ${dataHoraIsoParaBr(geradoEm)}` : ''}
                  </div>
                  <label style={{ fontSize: '12px', color: temFoto ? '#cbd5e1' : '#475569', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: temFoto ? 'pointer' : 'not-allowed' }} title={temFoto ? undefined : 'Adicione uma foto em Minha conta primeiro'}>
                    <input type="checkbox" checked={fotoNoCurriculo && temFoto} disabled={!temFoto} onChange={(e) => alternarFoto(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    Incluir minha foto no currículo{!temFoto && ' (adicione uma foto em Minha conta)'}
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={handleBaixarPdf} className="result-action-btn pdf">
                    <IconDocument /> Baixar PDF
                  </button>
                  <button onClick={handleCopiar} className="result-action-btn copy">
                    <IconClipboard /> Copiar texto
                  </button>
                  <button onClick={handleExportarLinkedIn} disabled={sincronizando} className="result-action-btn linkedin">
                    {sincronizando ? 'Sincronizando...' : <><IconLinkedIn /> Atualizar LinkedIn</>}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {aviso && (
                  <motion.div
                    className={`resume-aviso ${aviso.tipo}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {aviso.texto}
                  </motion.div>
                )}
              </AnimatePresence>

              <FolhaCurriculo cv={curriculo} perfil={perfil} foto={fotoUrl} />
            </motion.div>
          )}
        </AnimatePresence>

        {curriculo && imprimindo && (
          <Imprimir nomeDoArquivo={`Curriculo - ${(curriculo.nome_candidato || perfil.nome || 'Estudante').trim()}`} aoTerminar={() => setImprimindo(false)}>
            <FolhaCurriculo cv={curriculo} perfil={perfil} foto={fotoUrl} />
          </Imprimir>
        )}
      </div>
    </div>
  );
};

export default ResumeBuilder;
