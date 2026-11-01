import React, { useCallback, useEffect, useRef, useState } from 'react';
import useTravarRolagem from '../hooks/useTravarRolagem';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { IconRobot, IconFire, IconTarget, IconSparkle, IconTrophy, IconClose, IconCheckCircle, IconLightbulb, IconWarning } from './icons';
import { apiFetch, lerErro, DEMO_MODE } from '../api';
import { useCountUp } from '../hooks/useCountUp';
import Typewriter from './Typewriter';
import { tocarSomAcerto, tocarSomErro } from '../utils/sound';

// Simulador de entrevista contínua (regras em entrevista.py): uma conversa de
// 5 a 7 respostas, sem nota no meio. Quando a entrevistadora se despede, o
// aluno gera o LAUDO final (nota geral, pontos fortes, de melhoria e parecer),
// e só aí entra o XP. A entrevista aberta fica no servidor: recarregar a
// página retoma de onde parou.

const CRITERIOS = [['relevancia', 'Respondeu as perguntas'], ['clareza', 'Clareza'], ['exemplos', 'Exemplos reais'], ['postura', 'Postura']];
const corDaNota = (n) => (n >= 8 ? 'var(--ok)' : n >= 5 ? 'var(--aviso)' : 'var(--erro)');
const corDaNotaGeral = (n) => (n >= 75 ? 'var(--ok)' : n >= 50 ? 'var(--aviso)' : 'var(--erro)');

const dispararConfete = () => {
  const cores = ['#2e7bff', '#00e5ff', '#1652e0', '#34d399'];
  confetti({ particleCount: 130, spread: 75, origin: { y: 0.6 }, colors: cores });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: cores }), 150);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: cores }), 150);
};

const paraTela = (mensagens) => mensagens.map((m, i) => ({ id: i, remetente: m.remetente, texto: m.mensagem, categoria: m.categoria, novo: false }));

// ------------------------------------------------------------------ laudo final (modal)
const ModalLaudo = ({ laudo, aoFechar, aoNovaEntrevista }) => {
  useTravarRolagem();
  const nota = useCountUp(laudo.nota_geral || 0);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgb(var(--surface-rgb) / 0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      role="dialog" aria-modal="true" aria-labelledby="laudo-titulo"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
        style={{ width: '100%', maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto', background: 'rgb(var(--surface-rgb) / 0.98)', border: '1px solid rgb(var(--accent-rgb) / 0.25)', borderRadius: '24px', padding: '26px 24px', position: 'relative' }}
      >
        <button type="button" onClick={aoFechar} aria-label="Fechar laudo" style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgb(var(--tinta-rgb) / 0.06)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--txt-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconClose />
        </button>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '1px' }}>Laudo de desempenho</div>
        <h2 id="laudo-titulo" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--txt-1)', margin: '4px 0 18px' }}>Como foi a sua entrevista</h2>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '18px' }}>
          <div style={{ width: '104px', height: '104px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: `conic-gradient(${corDaNotaGeral(laudo.nota_geral)} ${laudo.nota_geral * 3.6}deg, rgb(var(--tinta-rgb) / 0.08) 0deg)` }}>
            <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'rgb(var(--surface-rgb))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <strong style={{ fontSize: '28px', color: corDaNotaGeral(laudo.nota_geral), lineHeight: 1 }}>{nota}</strong>
              <span style={{ fontSize: '10px', color: 'var(--txt-4)' }}>de 100</span>
            </div>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--accent-2)' }}>+{laudo.xp_concedido} XP</div>
            <div style={{ fontSize: '12px', color: 'var(--txt-4)', lineHeight: 1.5 }}>
              {laudo.limite_diario
                ? 'Você já ganhou XP com 3 entrevistas hoje. O laudo vale do mesmo jeito; o XP volta amanhã.'
                : `${laudo.respostas} respostas avaliadas na entrevista inteira.`}
              {!laudo.por_ia && (DEMO_MODE
                ? ' Na demonstração, o laudo sai pelas regras do sistema; com a IA ligada, ele cita o que você disse.'
                : ' Laudo gerado pelas regras do sistema (a IA não respondeu agora).')}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '6px', marginBottom: '18px' }}>
          {CRITERIOS.map(([id, rotulo]) => (
            <div key={id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 24px', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--txt-3)' }}>
              <span>{rotulo}</span>
              <div style={{ height: '6px', borderRadius: '3px', background: 'rgb(var(--tinta-rgb) / 0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(laudo.notas?.[id] ?? 0) * 10}%`, background: corDaNota(laudo.notas?.[id] ?? 0), borderRadius: '3px' }} />
              </div>
              <strong style={{ textAlign: 'right', color: corDaNota(laudo.notas?.[id] ?? 0) }}>{laudo.notas?.[id] ?? 0}</strong>
            </div>
          ))}
        </div>

        <div className="laudo-bloco ok">
          <div className="laudo-titulo"><IconCheckCircle /> Pontos fortes</div>
          <ul>{laudo.pontos_fortes.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="laudo-bloco melhorar">
          <div className="laudo-titulo"><IconLightbulb /> O que melhorar</div>
          <ul>{laudo.pontos_melhoria.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="laudo-bloco">
          <div className="laudo-titulo"><IconRobot /> Parecer da recrutadora</div>
          <p style={{ margin: 0 }}>{laudo.parecer_recrutador}</p>
        </div>
        {laudo.rodada && (
          <div className="laudo-bloco" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span><strong>{laudo.rodada.numero}ª rodada</strong> · entrevista {laudo.rodada.feitas} de {laudo.rodada.total}{laudo.rodada.media != null && <> · média {laudo.rodada.media}%</>} (meta {laudo.rodada.meta}%)</span>
            {laudo.rodada.status === 'meta_atingida' && <span style={{ color: 'var(--ok)', fontWeight: 700 }}>Meta atingida! A coordenação vai confirmar.</span>}
            {laudo.rodada.status === 'nao_atingida' && <span style={{ color: 'var(--aviso)', fontWeight: 700 }}>Não foi dessa vez: a próxima entrevista começa a rodada {laudo.rodada.numero + 1}.</span>}
          </div>
        )}
        <p style={{ fontSize: '11px', color: 'var(--txt-5)', margin: '12px 0 0' }}>A coordenação da escola vê este laudo na sua ficha.</p>

        <button type="button" onClick={aoNovaEntrevista} className="sim-restart-btn" style={{ width: '100%', marginTop: '16px' }}>Fazer outra entrevista</button>
      </motion.div>
    </motion.div>
  );
};

// ------------------------------------------------------------------ simulador
// XP, nível, ofensiva e missões vêm do App (estudanteStatus): um número só pro app inteiro.
const InterviewSimulator = ({ status, aoGanharXp }) => {
  const [sessao, setSessao] = useState(null); // { id, status, respostas, minimo, maximo }
  const [historico, setHistorico] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [gerandoLaudo, setGerandoLaudo] = useState(false);
  const [laudo, setLaudo] = useState(null);
  const [erro, setErro] = useState(null);
  const fimRef = useRef(null);

  const pontos = status?.xp_total ?? 0;
  const nivel = status?.nivel_gamificacao ?? 1;
  const ofensiva = status?.ofensiva_dias ?? 0;
  const missoes = status?.missoes_diarias ?? 0;
  const pontosExibidos = useCountUp(pontos);

  const aplicarSessao = (dados) => {
    setSessao({ id: dados.id, status: dados.status, respostas: dados.respostas, minimo: dados.minimo, maximo: dados.maximo });
    setHistorico(paraTela(dados.mensagens).map((m, i, lista) => ({ ...m, novo: lista.length === 1 && i === 0 })));
  };

  const novaEntrevista = useCallback(async (abertura = 'inicial') => {
    setErro(null);
    setLaudo(null);
    const r = await apiFetch('/api/entrevista/sessoes', { method: 'POST', body: JSON.stringify({ abertura }) });
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível começar a entrevista.')); return; }
    aplicarSessao(await r.json());
  }, []);

  // Retoma a entrevista aberta (ou começa uma). O ref evita duas sessões
  // quando o React monta o componente duas vezes em desenvolvimento.
  const iniciouRef = useRef(false);
  useEffect(() => {
    if (iniciouRef.current) return;
    iniciouRef.current = true;
    (async () => {
      try {
        const r = await apiFetch('/api/entrevista/sessao-atual');
        const dados = r.ok ? await r.json() : { sessao: null };
        if (dados.sessao) aplicarSessao(dados.sessao);
        else await novaEntrevista('inicial');
      } catch (err) {
        console.error(err);
        setErro('Não foi possível conectar. Tente de novo.');
      }
    })();
  }, [novaEntrevista]);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [historico, carregando]);

  const enviarMensagem = async () => {
    const texto = mensagem.trim();
    if (!texto || carregando || !sessao || sessao.status !== 'em_andamento') return;
    setMensagem('');
    setErro(null);
    setCarregando(true);
    setHistorico((prev) => [...prev, { id: Date.now(), remetente: 'user', texto, novo: false }]);
    try {
      const r = await apiFetch(`/api/entrevista/sessoes/${sessao.id}/mensagens`, { method: 'POST', body: JSON.stringify({ mensagem: texto }) });
      if (!r.ok) throw new Error(await lerErro(r, 'Tive um probleminha para processar isso. Pode tentar de novo?'));
      const dados = await r.json();
      if (!dados.contou) tocarSomErro();
      setSessao((s) => ({ ...s, status: dados.status, respostas: dados.respostas }));
      setHistorico((prev) => [
        ...prev.slice(0, -1),
        { ...prev[prev.length - 1], categoria: dados.categoria },
        { id: Date.now() + 1, remetente: 'ai', texto: dados.fala, novo: true },
      ]);
    } catch (err) {
      setErro(err.message);
      setHistorico((prev) => prev.slice(0, -1));
      setMensagem(texto);
    } finally {
      setCarregando(false);
    }
  };

  const gerarLaudo = async () => {
    if (!sessao || gerandoLaudo) return;
    setGerandoLaudo(true);
    setErro(null);
    try {
      const r = await apiFetch(`/api/entrevista/sessoes/${sessao.id}/laudo`, { method: 'POST' });
      if (!r.ok) throw new Error(await lerErro(r, 'Não foi possível gerar o laudo. Tente de novo.'));
      const dados = await r.json();
      setLaudo(dados);
      setSessao((s) => ({ ...s, status: 'concluida' }));
      if (dados.xp_concedido > 0) { tocarSomAcerto(); dispararConfete(); }
      if (aoGanharXp && !dados.ja_gerado) {
        aoGanharXp({
          xp_total: dados.novos_pontos_totais,
          nivel_gamificacao: dados.nivel_atual,
          ...(typeof dados.ofensiva_dias === 'number' ? { ofensiva_dias: dados.ofensiva_dias } : {}),
          ...(typeof dados.missoes_diarias === 'number' ? { missoes_diarias: dados.missoes_diarias } : {}),
          categoria_status: dados.categoria_status,
          liga: dados.liga,
          mudanca_liga: dados.mudanca_liga,
        });
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setGerandoLaudo(false);
    }
  };

  const respostas = sessao?.respostas ?? 0;
  const maximo = sessao?.maximo ?? 7;
  const aguardandoLaudo = sessao?.status === 'aguardando_laudo';
  const concluida = sessao?.status === 'concluida';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <style>{`
        .sim-stat-card { background: rgb(var(--tinta-rgb) / 0.03); border: 1px solid rgb(var(--accent-rgb) / 0.12); border-radius: 14px; padding: 10px 20px; display: flex; align-items: center; gap: 10px; }
        .sim-xp-bar-track { width: 120px; height: 5px; background: rgb(var(--tinta-rgb) / 0.08); border-radius: 99px; overflow: hidden; }
        .sim-xp-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--accent), var(--accent-2)); transition: width 0.6s ease; }
        .sim-msg-ai { background: rgb(var(--tinta-rgb) / 0.04); border: 1px solid rgb(var(--accent-rgb) / 0.15); color: var(--txt-2); border-radius: 16px; border-top-left-radius: 4px; padding: 14px 18px; max-width: 80%; font-size: 14px; line-height: 1.6; }
        .sim-msg-user { background: rgb(var(--accent-rgb) / 0.16); border: 1px solid rgb(var(--accent-rgb) / 0.3); color: var(--txt-1b); border-radius: 16px; border-top-right-radius: 4px; padding: 14px 18px; max-width: 80%; font-size: 14px; line-height: 1.6; }
        .sim-nao-contou { font-size: 11px; color: var(--aviso); text-align: right; margin-top: 4px; }
        .sim-input { flex: 1; background: rgb(var(--tinta-rgb) / 0.04); border: 1px solid rgb(var(--accent-rgb) / 0.2); border-radius: 12px; padding: 13px 18px; color: var(--txt-1b); font-size: 14px; outline: none; transition: border-color 0.2s; font-family: inherit; resize: none; }
        .sim-input::placeholder { color: var(--txt-5); }
        .sim-input:focus { border-color: rgb(var(--accent-rgb) / 0.5); }
        .sim-input:disabled { opacity: 0.4; cursor: not-allowed; }
        .sim-send-btn { background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong)); border: none; border-radius: 12px; color: white; font-weight: 700; font-size: 14px; padding: 13px 24px; cursor: pointer; transition: all 0.2s; white-space: nowrap; font-family: inherit; }
        .sim-send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgb(var(--accent-strong-rgb) / 0.3); }
        .sim-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sim-pulse { width: 8px; height: 8px; border-radius: 50%; animation: simPulse 1.5s infinite; }
        @keyframes simPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        .sim-typing { animation: simTyping 1.2s infinite; color: var(--txt-4); font-size: 13px; font-style: italic; }
        @keyframes simTyping { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .sim-end-btn { background: rgb(var(--tinta-rgb) / 0.06); border: 1px solid rgb(var(--tinta-rgb) / 0.12); color: var(--txt-2); font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-family: inherit; }
        .sim-end-btn:hover { background: rgb(var(--accent-rgb) / 0.18); border-color: rgb(var(--accent-rgb) / 0.35); color: var(--txt-1b); }
        .sim-complete-card { background: rgb(var(--accent-rgb) / 0.08); border: 1px solid rgb(var(--accent-rgb) / 0.3); border-radius: 16px; padding: 20px 24px; text-align: center; }
        .sim-restart-btn { background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong)); border: none; border-radius: 12px; color: white; font-weight: 800; font-size: 14px; padding: 12px 22px; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .sim-restart-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgb(var(--accent-strong-rgb) / 0.3); }
        .sim-restart-btn:disabled { opacity: 0.6; cursor: wait; }
        .sim-progresso { display: flex; gap: 4px; align-items: center; }
        .sim-progresso span { width: 18px; height: 5px; border-radius: 3px; background: rgb(var(--tinta-rgb) / 0.12); }
        .sim-progresso span.feita { background: var(--accent); }
        .laudo-bloco { border-radius: 14px; padding: 12px 14px; margin-top: 10px; background: rgb(var(--tinta-rgb) / 0.04); border: 1px solid rgb(var(--tinta-rgb) / 0.1); font-size: 13px; color: var(--txt-2); line-height: 1.6; }
        .laudo-bloco.ok { background: rgba(52,211,153,0.06); border-color: rgba(52,211,153,0.25); }
        .laudo-bloco.melhorar { background: rgba(251,191,36,0.06); border-color: rgba(251,191,36,0.28); }
        .laudo-bloco ul { margin: 0; padding-left: 18px; }
        .laudo-titulo { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: var(--txt-3); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .laudo-bloco.ok .laudo-titulo { color: var(--ok); }
        .laudo-bloco.melhorar .laudo-titulo { color: var(--aviso); }
        @media (max-width: 520px) { .sim-msg-ai, .sim-msg-user { max-width: 92%; } }
      `}</style>

      {/* Barra de status */}
      <div style={{ maxWidth: '920px', width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div className="sim-stat-card">
          <div style={{ background: 'var(--accent-strong)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: '700', color: 'white', letterSpacing: '0.5px' }}>NÍV {nivel}</div>
          <div className="sim-xp-bar-track"><div className="sim-xp-bar-fill" style={{ width: `${(pontos % 500) / 5}%` }} /></div>
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
          <div className="sim-stat-card" title="Práticas concluídas hoje">
            <span style={{ fontSize: '20px', color: 'var(--ok)', display: 'inline-flex' }}><IconTarget /></span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--ok)', lineHeight: 1 }}>{missoes}</div>
              <div style={{ fontSize: '10px', color: 'var(--txt-4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>diárias</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '920px', width: '100%', background: 'rgb(var(--surface-rgb) / 0.9)', border: '1px solid rgb(var(--accent-rgb) / 0.15)', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 0 60px rgb(var(--accent-rgb) / 0.05)' }}>
        {/* Cabeçalho */}
        <div style={{ background: 'rgb(var(--accent-strong-rgb) / 0.14)', borderBottom: '1px solid rgb(var(--accent-rgb) / 0.15)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--txt-1b)', display: 'flex', alignItems: 'center', gap: '8px' }}><IconRobot /> IA Recrutadora</div>
            <div style={{ fontSize: '12px', color: 'var(--txt-3)', marginTop: '2px' }}>Entrevista para Jovem Aprendiz · a avaliação sai no laudo, no final</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {sessao && (
              <div title={`${respostas} de até ${maximo} respostas`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="sim-progresso" aria-hidden="true">
                  {Array.from({ length: maximo }, (_, i) => <span key={i} className={i < respostas ? 'feita' : ''} />)}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--txt-4)' }}>{respostas}/{maximo}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sim-pulse" style={{ background: carregando ? '#facc15' : 'var(--ok)' }} />
              <span style={{ fontSize: '12px', color: 'var(--txt-4)' }}>{carregando ? 'ouvindo' : 'online'}</span>
            </div>
            {sessao?.status === 'em_andamento' && respostas > 0 && (
              <button type="button" onClick={() => novaEntrevista('recomeco')} className="sim-end-btn" title="Descarta esta entrevista sem laudo">Recomeçar</button>
            )}
          </div>
        </div>

        {/* Conversa */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: 'rgb(var(--campo-rgb) / 0.2)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '420px', maxHeight: '520px' }}>
          {historico.map((msg) => (
            <motion.div key={msg.id} initial={msg.novo ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              <div style={{ display: 'flex', justifyContent: msg.remetente === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.remetente === 'ai' && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'white', marginRight: '8px', flexShrink: 0, alignSelf: 'flex-end' }}><IconRobot /></div>
                )}
                <div className={msg.remetente === 'user' ? 'sim-msg-user' : 'sim-msg-ai'}>
                  {msg.remetente === 'ai' && msg.novo ? <Typewriter text={msg.texto} /> : msg.texto}
                </div>
              </div>
              {msg.remetente === 'user' && msg.categoria && msg.categoria !== 'resposta' && (
                <div className="sim-nao-contou">Não contou como resposta da entrevista</div>
              )}
            </motion.div>
          ))}
          {carregando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'white', flexShrink: 0 }}><IconRobot /></div>
              <p className="sim-typing">A entrevistadora está pensando...</p>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {erro && (
          <div role="alert" style={{ margin: '0 20px 12px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--erro-suave)', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <IconWarning /> {erro}
          </div>
        )}

        {/* Resposta / fim da entrevista */}
        <AnimatePresence mode="wait">
          {aguardandoLaudo || concluida ? (
            <motion.div key="fim" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '20px' }}>
              <div className="sim-complete-card">
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--txt-1b)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <IconTrophy /> Entrevista encerrada
                </div>
                <div style={{ fontSize: '13px', color: 'var(--txt-3)', margin: '6px 0 14px' }}>
                  {concluida ? 'O seu laudo já foi gerado.' : 'A recrutadora vai analisar a conversa inteira e montar o seu laudo de desempenho.'}
                </div>
                {concluida ? (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {laudo && <button type="button" className="sim-end-btn" onClick={() => setLaudo({ ...laudo, aberto: true })}>Ver laudo</button>}
                    <button type="button" className="sim-restart-btn" onClick={() => novaEntrevista('recomeco')}>Nova entrevista</button>
                  </div>
                ) : (
                  <button type="button" className="sim-restart-btn" onClick={gerarLaudo} disabled={gerandoLaudo}>
                    <IconSparkle /> {gerandoLaudo ? 'Gerando o laudo...' : 'Finalizar e gerar laudo'}
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '16px 20px', background: 'rgb(var(--campo-rgb) / 0.3)', borderTop: '1px solid rgb(var(--accent-rgb) / 0.1)', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea
                rows={2}
                maxLength={1500}
                placeholder={carregando ? 'Aguarde a entrevistadora...' : 'Digite sua resposta (Enter envia, Shift+Enter pula linha)'}
                className="sim-input"
                aria-label="Sua resposta"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                disabled={carregando || !sessao}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
              />
              <button type="button" onClick={enviarMensagem} disabled={carregando || !sessao || !mensagem.trim()} className="sim-send-btn">
                {carregando ? '···' : 'Enviar →'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* No body: a aba animada (transform) prenderia o position: fixed dentro dela */}
      {createPortal(
        <AnimatePresence>
          {laudo && laudo.aberto !== false && (
            <ModalLaudo laudo={laudo} aoFechar={() => setLaudo({ ...laudo, aberto: false })} aoNovaEntrevista={() => novaEntrevista('recomeco')} />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

export default InterviewSimulator;
