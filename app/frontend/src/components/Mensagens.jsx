import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconChat, IconGrupo, IconMegafone, IconGraduationCap, IconSino } from './icons';
import { apiFetch, lerErro } from '../api';
import Conversa, { ESTILOS_CONVERSA } from './Conversa';
import { tocarSomMensagem } from '../utils/sound';

// Mensagens do aluno ("o WhatsApp da escola"):
//   - Sininho no topo: notificações -- o que chegou de novo; clicar leva
//     direto pra conversa.
//   - Aba Chat: todas as conversas (coordenação, grupo da empresa/turno se
//     ele estiver contratado, e o canal geral, só leitura).
// Com o app aberto: contador, som, aviso na tela e "(n)" no título da aba.

const INTERVALO_CONTADOR_MS = 30000;
const INTERVALO_CONVERSA_MS = 5000;

const ICONE_CANAL = { direto: IconGraduationCap, grupo: IconGrupo, geral: IconMegafone };

const p2 = (n) => String(n).padStart(2, '0');
const horaCurta = (iso) => {
  if (!iso) return '';
  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
  return d.toDateString() === new Date().toDateString() ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
};

// ---------------------------------------------------------------- contador
export const useNaoLidas = (ativo, aoChegarNova) => {
  const [total, setTotal] = useState(0);
  const anteriorRef = useRef(null);

  const atualizar = useCallback(async () => {
    try {
      const r = await apiFetch('/api/mensagens/nao-lidas');
      if (!r.ok) return;
      const { total: novo } = await r.json();
      if (anteriorRef.current != null && novo > anteriorRef.current) aoChegarNova?.(novo - anteriorRef.current);
      anteriorRef.current = novo;
      setTotal(novo);
    } catch {
      // sem conexão: tenta de novo no próximo ciclo
    }
  }, [aoChegarNova]);

  useEffect(() => {
    if (!ativo) return undefined;
    atualizar();
    const id = setInterval(atualizar, INTERVALO_CONTADOR_MS);
    return () => clearInterval(id);
  }, [ativo, atualizar]);

  // "(2) Play2Work.ai" na aba do navegador, como o WhatsApp Web
  useEffect(() => {
    // Inativo (painel da escola, login): não mexe no título -- quem estiver na tela cuida dele
    if (!ativo) return undefined;
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = total ? `(${total}) ${base}` : base;
    // Ao sair do app do aluno (painel da escola, login), o "(n)" não pode ficar na aba
    return () => { document.title = document.title.replace(/^\(\d+\)\s*/, ''); };
  }, [total, ativo]);

  return { total, atualizar };
};

export const avisarMensagemNova = (somAtivado) => {
  if (somAtivado) tocarSomMensagem();
};

export const ContadorBolinha = ({ total, style }) => (total > 0 ? (
  <span style={{ minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '99px', background: '#22c55e', color: '#03210f', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>
    {total > 99 ? '99+' : total}
  </span>
) : null);

// ---------------------------------------------------------------- sininho
export const SinoNotificacoes = ({ total, aoAbrirCanal }) => {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState(null);
  const caixaRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    apiFetch('/api/mensagens/canais').then(async (r) => { if (r.ok) setItens((await r.json()).filter((c) => c.nao_lidas > 0)); });
    const fechar = (e) => { if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [aberto, total]);

  const ir = (canalId) => { setAberto(false); aoAbrirCanal(canalId); };

  return (
    <div ref={caixaRef} style={{ position: 'relative' }}>
      <style>{ESTILOS_MENSAGENS}</style>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="app-pill"
        title="Notificações"
        aria-label={total ? `Notificações: ${total} nova${total > 1 ? 's' : ''}` : 'Notificações'}
        aria-expanded={aberto}
        style={{
          position: 'relative', width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          color: total ? 'var(--accent-soft)' : '#94a3b8', cursor: 'pointer', fontSize: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <IconSino />
        <ContadorBolinha total={total} style={{ position: 'absolute', top: '-5px', right: '-6px' }} />
      </button>
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            role="dialog"
            aria-label="Notificações"
            style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '320px', maxWidth: '88vw', zIndex: 70,
              background: 'rgb(var(--surface-rgb) / 0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgb(var(--accent-rgb) / 0.2)',
              borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 14px', fontWeight: 800, color: '#f1f5f9', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Notificações</div>
            {itens === null && <div style={{ padding: '14px', color: '#64748b', fontSize: '13px' }}>Carregando…</div>}
            {itens?.length === 0 && <div style={{ padding: '18px 14px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>Nada novo por aqui.</div>}
            {itens?.map((c) => {
              const Icone = ICONE_CANAL[c.tipo];
              return (
                <button key={c.id} type="button" onClick={() => ir(c.id)} className="notif-item">
                  <span className={`msg-icone ${c.tipo}`} style={{ width: '34px', height: '34px', fontSize: '16px' }}><Icone /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                      <strong style={{ color: '#f1f5f9', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</strong>
                      <span style={{ fontSize: '11px', color: '#22c55e', flex: '0 0 auto' }}>{horaCurta(c.ultima_mensagem?.enviada_em)}</span>
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.nao_lidas > 1 ? `${c.nao_lidas} mensagens novas · ` : ''}{c.ultima_mensagem?.texto}
                    </span>
                  </span>
                </button>
              );
            })}
            <button type="button" onClick={() => ir(null)} style={{ width: '100%', padding: '11px', background: 'rgba(255,255,255,0.03)', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'var(--accent-soft)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Ver todas as conversas
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------- uma conversa
const ConversaAberta = ({ canal, aoVoltar, aoMudou }) => {
  const [dados, setDados] = useState(null);
  const ultimoIdRef = useRef(0);

  const carregar = useCallback(async (incremental) => {
    const query = incremental && ultimoIdRef.current ? `?depois_de=${ultimoIdRef.current}` : '';
    const r = await apiFetch(`/api/mensagens/canais/${canal.id}${query}`);
    if (!r.ok) return;
    const corpo = await r.json();
    setDados((atual) => ({ ...corpo, mensagens: incremental && atual ? [...atual.mensagens, ...corpo.mensagens] : corpo.mensagens }));
    if (corpo.mensagens.length) ultimoIdRef.current = corpo.mensagens[corpo.mensagens.length - 1].id;
    if (corpo.mensagens.length || !incremental) aoMudou();
  }, [canal.id, aoMudou]);

  useEffect(() => {
    ultimoIdRef.current = 0;
    setDados(null);
    carregar(false);
    const id = setInterval(() => carregar(true), INTERVALO_CONVERSA_MS);
    return () => clearInterval(id);
  }, [carregar]);

  const enviar = async (texto) => {
    const r = await apiFetch(`/api/mensagens/canais/${canal.id}/mensagens`, { method: 'POST', body: JSON.stringify({ texto }) });
    if (!r.ok) return lerErro(r, 'Não foi possível enviar.');
    await carregar(true);
    return null;
  };

  const Icone = ICONE_CANAL[canal.tipo];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="msg-topo">
        <button type="button" className="msg-voltar" onClick={aoVoltar} aria-label="Voltar pras conversas">←</button>
        <span className={`msg-icone ${canal.tipo}`}><Icone /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '15px' }}>{canal.nome}</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {canal.tipo === 'direto' ? 'Conversa com a coordenação da escola' : canal.tipo === 'grupo' ? 'Aprendizes da empresa e a coordenação' : 'Avisos da escola pra todos os alunos'}
          </div>
        </div>
      </div>
      {dados ? (
        <Conversa
          mensagens={dados.mensagens}
          minhaSe={(m) => m.minha}
          mostrarAutor={canal.tipo === 'grupo'}
          podeEscrever={dados.pode_escrever}
          avisoSomenteLeitura="Só a escola escreve neste canal. Pra falar com a coordenação, use a conversa direta."
          aoEnviar={enviar}
          vistoEm={canal.tipo === 'direto' ? dados.escola_leu_em : undefined}
        />
      ) : <p style={{ color: '#64748b', padding: '16px' }}>Carregando…</p>}
    </div>
  );
};

// ---------------------------------------------------------------- aba Chat
export const ESTILOS_MENSAGENS = `
  .msg-icone { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 19px; flex: 0 0 auto; }
  .msg-icone.direto { background: rgb(var(--accent-rgb) / 0.18); color: var(--accent-soft); }
  .msg-icone.grupo { background: rgba(52,211,153,0.15); color: #6ee7b7; }
  .msg-icone.geral { background: rgba(251,191,36,0.15); color: #fcd34d; }
  .notif-item { width: 100%; display: flex; gap: 10px; align-items: center; padding: 10px 14px; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; text-align: left; font-family: inherit; color: inherit; }
  .notif-item:hover { background: rgba(255,255,255,0.04); }
`;

const ChatAluno = ({ canalInicial, aoMudou }) => {
  const [canais, setCanais] = useState(null);
  const [abertoId, setAbertoId] = useState(canalInicial ?? null);

  useEffect(() => { if (canalInicial) setAbertoId(canalInicial); }, [canalInicial]);

  const carregar = useCallback(async () => {
    const r = await apiFetch('/api/mensagens/canais');
    if (r.ok) setCanais(await r.json());
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, INTERVALO_CONTADOR_MS);
    return () => clearInterval(id);
  }, [carregar]);

  const aoConversaMudar = useCallback(() => { carregar(); aoMudou(); }, [carregar, aoMudou]);
  const aberto = canais?.find((c) => c.id === abertoId);

  return (
    <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <style>{`
        ${ESTILOS_CONVERSA}
        .chat-caixa { display: grid; grid-template-columns: 320px minmax(0, 1fr); height: min(72vh, 760px); border-radius: 22px; overflow: hidden;
          background: rgba(255,255,255,0.045); border: 1px solid rgb(var(--accent-rgb) / 0.15); }
        .chat-lista { border-right: 1px solid rgba(255,255,255,0.06); overflow-y: auto; display: flex; flex-direction: column; }
        .msg-topo { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .msg-voltar { background: rgba(255,255,255,0.06); border: none; border-radius: 50%; width: 32px; height: 32px; color: #cbd5e1; cursor: pointer; font-size: 16px; display: none; align-items: center; justify-content: center; flex: 0 0 auto; }
        .msg-item { width: 100%; display: flex; gap: 12px; align-items: center; padding: 12px 14px; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; text-align: left; font-family: inherit; color: inherit; }
        .msg-item:hover { background: rgba(255,255,255,0.03); }
        .msg-item.ativo { background: rgb(var(--accent-rgb) / 0.1); }
        .chat-vazio { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; color: #64748b; font-size: 13px; text-align: center; padding: 20px; }
        @media (max-width: 760px) {
          .chat-caixa { grid-template-columns: 1fr; height: calc(100vh - 230px); min-height: 420px; }
          .chat-caixa.com-conversa .chat-lista { display: none; }
          .chat-caixa:not(.com-conversa) .chat-conversa { display: none; }
          .msg-voltar { display: flex; }
        }
      `}</style>
      <div className={`chat-caixa ${aberto ? 'com-conversa' : ''}`}>
        <div className="chat-lista">
          <div className="msg-topo"><div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '18px' }}>Chat</div></div>
          <div style={{ flex: 1 }}>
            {canais === null && <p style={{ color: '#64748b', padding: '16px' }}>Carregando…</p>}
            {canais?.map((c) => {
              const Icone = ICONE_CANAL[c.tipo];
              return (
                <button key={c.id} type="button" className={`msg-item ${c.id === abertoId ? 'ativo' : ''}`} onClick={() => setAbertoId(c.id)}>
                  <span className={`msg-icone ${c.tipo}`}><Icone /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ color: '#f1f5f9', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</strong>
                      <span style={{ fontSize: '11px', color: c.nao_lidas ? '#22c55e' : '#64748b', flex: '0 0 auto' }}>{horaCurta(c.ultima_mensagem?.enviada_em)}</span>
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ fontSize: '13px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.ultima_mensagem ? c.ultima_mensagem.texto : c.tipo === 'direto' ? 'Fale com a coordenação por aqui' : 'Nenhuma mensagem ainda'}
                      </span>
                      <ContadorBolinha total={c.nao_lidas} style={{ minWidth: '20px', height: '20px' }} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: '11px', color: '#475569', padding: '10px 14px', margin: 0, lineHeight: 1.5 }}>
            As conversas ficam registradas pela escola. No grupo da empresa, seus colegas veem só o seu nome curto.
          </p>
        </div>
        <div className="chat-conversa" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {aberto
            ? <ConversaAberta key={aberto.id} canal={aberto} aoVoltar={() => { setAbertoId(null); carregar(); }} aoMudou={aoConversaMudar} />
            : <div className="chat-vazio"><IconChat style={{ fontSize: '34px' }} /><div>Escolha uma conversa.</div></div>}
        </div>
      </div>
    </div>
  );
};

export default ChatAluno;
