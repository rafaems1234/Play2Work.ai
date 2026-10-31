import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconSparkle, IconWand, IconWarning, IconDocument, IconClipboard, IconLinkedIn, IconCheckCircle, IconCamera, IconTrash } from './icons';
import { apiFetch, urlDeArquivo, lerErro } from '../api';
import { FolhaCurriculo, ESTILOS_FOLHA, Imprimir, listar, linhasDoCabecalho } from './FolhaCurriculo';
import { dataHoraIsoParaBr } from '../utils/formatos';
import { SeletorFoto } from './FotoPerfil';

const formatarCurriculoTexto = (cv, perfil) => {
  const { pessoais, contato, formacao } = linhasDoCabecalho(perfil);
  const linhas = [
    perfil.nome || '',
    ...[pessoais, contato].filter((l) => l.length).map((l) => l.join(' · ')),
    '',
    'OBJETIVO',
    cv.objetivo_profissional || cv.objetivo_professional || '—',
    '',
    'FORMAÇÃO',
    `${formacao}${perfil.itinerario ? ` — Itinerário: ${perfil.itinerario}` : ''}`,
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

const ResumeBuilder = ({ aoGerar, aoGanharXp }) => {
  const [habilidades, setHabilidades] = useState('');
  const [curriculo, setCurriculo] = useState(null);
  const [geradoEm, setGeradoEm] = useState(null);
  const [imprimindo, setImprimindo] = useState(false);
  // Currículo "com foto" ou "sem foto": escolha do aluno, sem foto por padrão.
  // A foto do currículo é outra, que ele envia aqui -- a de identificação
  // (Minha conta / painel da escola) não entra no currículo.
  const [fotoNoCurriculo, setFotoNoCurriculo] = useState(false);
  const [fotoCurriculoVersao, setFotoCurriculoVersao] = useState(null);
  const [fotoUrl, setFotoUrl] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState(null);
  // Cabeçalho do currículo: o cadastro que a escola fez (nome completo, idade, contato, turma, itinerário)
  const [perfil, setPerfil] = useState({ nome: '', email: '', linkedin: '', itinerario: null });
  const [carregando, setCarregando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        const respAtual = await apiFetch('/api/resume/atual');
        // Abre com o último currículo salvo (e o texto que gerou ele), pra
        // o aluno só ajustar em vez de começar do zero
        const atual = respAtual.ok ? await respAtual.json() : {};
        setFotoNoCurriculo(Boolean(atual.foto_no_curriculo));
        setFotoCurriculoVersao(atual.tem_foto_curriculo ? atual.foto_curriculo_atualizada_em || 'sim' : null);
        if (atual.curriculo) {
          setCurriculo(atual.curriculo);
          setGeradoEm(atual.gerado_em);
          setHabilidades((texto) => texto || atual.texto_original || '');
        }
        if (atual.dados_pessoais) setPerfil(atual.dados_pessoais);
      } catch (err) {
        console.error(err);
      }
    };
    carregarPerfil();
  }, []);

  useEffect(() => {
    if (!fotoCurriculoVersao) { setFotoUrl(null); return undefined; }
    let ativo = true;
    let criada = null;
    urlDeArquivo('/api/estudante/me/foto-curriculo').then((u) => { if (ativo) { criada = u; setFotoUrl(u); } });
    return () => { ativo = false; if (criada) URL.revokeObjectURL(criada); };
  }, [fotoCurriculoVersao]);

  const alternarFoto = async (incluir) => {
    setFotoNoCurriculo(incluir);
    setErroFoto(null);
    const resposta = await apiFetch('/api/estudante/me/preferencias-curriculo', { method: 'PUT', body: JSON.stringify({ foto_no_curriculo: incluir }) });
    if (!resposta.ok) setFotoNoCurriculo(!incluir);
  };

  const enviarFotoCurriculo = async (dataUrl) => {
    setEnviandoFoto(true);
    setErroFoto(null);
    const resposta = await apiFetch('/api/estudante/me/foto-curriculo', { method: 'PUT', body: JSON.stringify({ imagem_base64: dataUrl }) });
    setEnviandoFoto(false);
    if (!resposta.ok) { setErroFoto(await lerErro(resposta, 'Não foi possível enviar a foto.')); return; }
    const corpo = await resposta.json();
    setFotoNoCurriculo(true);
    setFotoCurriculoVersao(corpo.foto_curriculo_atualizada_em);
  };

  const removerFotoCurriculo = async () => {
    const resposta = await apiFetch('/api/estudante/me/foto-curriculo', { method: 'DELETE' });
    if (!resposta.ok) { setErroFoto(await lerErro(resposta, 'Não foi possível remover a foto.')); return; }
    setFotoNoCurriculo(false);
    setFotoCurriculoVersao(null);
  };

  // A foto só vai pra folha com "com foto" marcado e uma foto do currículo enviada
  const fotoNaFolha = fotoNoCurriculo ? fotoUrl : null;

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

      // 422 = o texto não serve pra currículo; a mensagem diz o que escrever
      if (!response.ok) throw new Error(await lerErro(response, 'Não foi possível gerar o currículo. Tente de novo em instantes.'));

      const dados = await response.json();
      if (dados.sucesso) {
        setCurriculo(dados.curriculo);
        if (dados.dados_pessoais) setPerfil(dados.dados_pessoais);
        // Currículo gerado conta como prática do dia (ofensiva) e pode dar XP
        aoGanharXp?.({
          xp_total: dados.novos_pontos_totais, nivel_gamificacao: dados.nivel_atual, ofensiva_dias: dados.ofensiva_dias,
          categoria_status: dados.categoria_status, liga: dados.liga, mudanca_liga: dados.mudanca_liga,
        });
        if (dados.xp_concedido) mostrarAviso('ok', `+${dados.xp_concedido} XP pelo currículo de hoje.`);
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
          background: rgb(var(--tinta-rgb) / 0.045);
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
          background: rgb(var(--campo-rgb) / 0.3);
          border: 1px solid rgb(var(--accent-rgb) / 0.2);
          border-radius: 14px;
          padding: 16px 20px;
          color: var(--txt-1b);
          font-size: 14px;
          line-height: 1.6;
          resize: vertical;
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
          min-height: 140px;
        }

        .resume-textarea::placeholder { color: var(--txt-5); }
        .resume-foto { margin-bottom: 20px; }
        .resume-foto-rotulo { font-size: 13px; font-weight: 600; color: var(--txt-4); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .resume-segmentado { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: rgb(var(--campo-rgb) / 0.3); border: 1px solid rgb(var(--accent-rgb) / 0.2); }
        .resume-segmentado button { border: none; background: none; padding: 8px 16px; border-radius: 9px; font-family: inherit; font-size: 13px; font-weight: 700; color: var(--txt-3); cursor: pointer; }
        .resume-segmentado button.ativo { background: rgb(var(--accent-rgb) / 0.18); color: var(--txt-1); }
        .resume-foto-linha { display: flex; gap: 14px; align-items: flex-start; margin-top: 12px; }
        .resume-foto-mini { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; border: 2px solid rgb(var(--accent-rgb) / 0.35); }
        .resume-foto-mini.vazia { display: inline-flex; align-items: center; justify-content: center; background: rgb(var(--tinta-rgb) / 0.04); color: var(--txt-4); font-size: 24px; border-style: dashed; }
        .resume-foto-btn { padding: 8px 14px; border-radius: 10px; border: none; background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong)); color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
        .resume-foto-btn.secundario { background: rgb(var(--tinta-rgb) / 0.06); color: var(--txt-2); }
        .resume-foto-btn:disabled { opacity: 0.5; cursor: wait; }
        .resume-foto-dica { font-size: 12px; color: var(--txt-4); margin: 8px 0 0; line-height: 1.5; }
        .resume-foto-erro { margin-top: 6px; font-size: 12px; color: var(--erro); display: flex; gap: 6px; align-items: center; }
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
          border: 2px solid rgb(var(--tinta-rgb) / 0.3);
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
          background: rgb(var(--tinta-rgb) / 0.06);
          border: 1px solid rgb(var(--tinta-rgb) / 0.1);
          color: var(--txt-3);
        }
        .result-action-btn.copy:hover { background: rgb(var(--tinta-rgb) / 0.1); color: var(--txt-1b); }

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
        .resume-aviso.ok { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25); color: var(--ok-suave); }
        .resume-aviso.erro { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18); color: var(--erro); }

        .empty-state {
          padding: 40px;
          border: 1px dashed rgb(var(--accent-rgb) / 0.15);
          border-radius: 16px;
          text-align: center;
          color: var(--txt-5);
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
          color: var(--erro);
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
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--txt-1)', letterSpacing: '-0.5px', marginBottom: '10px' }}>
              Gerador de <span className="gradient-text-live">Currículo</span>
            </h2>
            <p style={{ color: 'var(--txt-4)', fontSize: '14px', lineHeight: 1.6, maxWidth: '480px' }}>
              Nunca fez um currículo? Conte do seu jeito o que você sabe fazer, o que já fez na escola e do que gosta.
              A IA organiza só o que você escrever, sem inventar nada, num currículo pronto pra baixar em PDF.
            </p>
          </div>
          <IconSparkle style={{ fontSize: '24px', color: 'var(--accent)', flexShrink: 0, marginTop: '4px' }} />
        </div>

        {/* Input */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="resume-texto" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--txt-4)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
          <p style={{ fontSize: '12px', color: 'var(--txt-4)', margin: '8px 2px 0', lineHeight: 1.5 }}>
            Nome completo, idade, e-mail, celular, turma e itinerário entram sozinhos, do cadastro da escola. Algo errado? Fale com a coordenação.
          </p>
        </div>

        <div className="resume-foto">
          <div className="resume-foto-rotulo">Foto no currículo</div>
          <div className="resume-segmentado" role="group" aria-label="Foto no currículo">
            <button type="button" aria-pressed={!fotoNoCurriculo} className={!fotoNoCurriculo ? 'ativo' : ''} onClick={() => alternarFoto(false)}>Sem foto</button>
            <button type="button" aria-pressed={fotoNoCurriculo} className={fotoNoCurriculo ? 'ativo' : ''} onClick={() => alternarFoto(true)}>Com foto</button>
          </div>
          {fotoNoCurriculo && (
            <div className="resume-foto-linha">
              {fotoUrl ? <img className="resume-foto-mini" src={fotoUrl} alt="Sua foto do currículo" /> : <span className="resume-foto-mini vazia"><IconCamera /></span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <SeletorFoto className="resume-foto-btn" rotulo={enviandoFoto ? 'Enviando...' : fotoCurriculoVersao ? 'Trocar foto' : 'Enviar foto'} disabled={enviandoFoto} aoEscolher={enviarFotoCurriculo} aoErro={setErroFoto} />
                  {fotoCurriculoVersao && <button type="button" className="resume-foto-btn secundario" onClick={removerFotoCurriculo}><IconTrash style={{ verticalAlign: '-2px' }} /> Remover</button>}
                </div>
                <p className="resume-foto-dica">
                  {fotoCurriculoVersao
                    ? 'Essa foto vai só no currículo. A foto que a escola usa pra te identificar não muda.'
                    : 'Envie uma foto de rosto, com fundo neutro e boa luz. Enquanto não enviar, o currículo sai sem foto.'}
                </p>
                {erroFoto && <div className="resume-foto-erro"><IconWarning /> {erroFoto}</div>}
              </div>
            </div>
          )}
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
            <IconWarning /> {erro}
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
                  <div style={{ fontSize: '12px', color: 'var(--txt-4)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <IconCheckCircle style={{ color: 'var(--ok)' }} />
                    Enviado pra coordenação{geradoEm ? ` · atualizado em ${dataHoraIsoParaBr(geradoEm)}` : ''}
                  </div>
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

              <FolhaCurriculo cv={curriculo} perfil={perfil} foto={fotoNaFolha} />
            </motion.div>
          )}
        </AnimatePresence>

        {curriculo && imprimindo && (
          <Imprimir nomeDoArquivo={`Curriculo - ${(perfil.nome || 'Estudante').trim()}`} aoTerminar={() => setImprimindo(false)}>
            <FolhaCurriculo cv={curriculo} perfil={perfil} foto={fotoNaFolha} />
          </Imprimir>
        )}
      </div>
    </div>
  );
};

export default ResumeBuilder;
