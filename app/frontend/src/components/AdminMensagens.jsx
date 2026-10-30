import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconWarning, IconGrupo, IconMegafone, IconGraduationCap, IconChat, IconSino } from './icons';
import { apiFetch, lerErro } from '../api';
import Conversa, { ESTILOS_CONVERSA } from './Conversa';
import { normalizarBusca } from '../utils/formatos';

// Central de mensagens da escola: todas as conversas (diretas com alunos,
// grupos de empresa/turno e o canal geral) com filtros por empresa, turno,
// turma e aluno, abertura de conversa e de grupo, e moderação.

const INTERVALO_LISTA_MS = 15000;
const INTERVALO_CONVERSA_MS = 5000;
const ICONE = { direto: IconGraduationCap, grupo: IconGrupo, geral: IconMegafone };
const TIPOS = [['', 'Todas'], ['direto', 'Diretas'], ['grupo', 'Grupos'], ['geral', 'Geral']];

const p2 = (n) => String(n).padStart(2, '0');
const horaCurta = (iso) => {
  if (!iso) return '';
  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
  return d.toDateString() === new Date().toDateString() ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
};

// ---------------------------------------------------------------- conversa aberta
const ConversaEscola = ({ canalId, aoMudou, aoVoltar }) => {
  const [dados, setDados] = useState(null);
  const [verMembros, setVerMembros] = useState(false);
  const [ocultando, setOcultando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const ultimoIdRef = useRef(0);

  const carregar = useCallback(async (incremental) => {
    const query = incremental && ultimoIdRef.current ? `?depois_de=${ultimoIdRef.current}` : '';
    const r = await apiFetch(`/api/admin/mensagens/canais/${canalId}${query}`);
    if (!r.ok) return;
    const corpo = await r.json();
    setDados((atual) => ({ ...corpo, mensagens: incremental && atual ? [...atual.mensagens, ...corpo.mensagens] : corpo.mensagens }));
    if (corpo.mensagens.length) ultimoIdRef.current = corpo.mensagens[corpo.mensagens.length - 1].id;
    if (corpo.mensagens.length || !incremental) aoMudou();
  }, [canalId, aoMudou]);

  useEffect(() => {
    ultimoIdRef.current = 0;
    setDados(null);
    carregar(false);
    const id = setInterval(() => carregar(true), INTERVALO_CONVERSA_MS);
    return () => clearInterval(id);
  }, [carregar]);

  const enviar = async (texto) => {
    const r = await apiFetch(`/api/admin/mensagens/canais/${canalId}/mensagens`, { method: 'POST', body: JSON.stringify({ texto }) });
    if (!r.ok) return lerErro(r, 'Não foi possível enviar.');
    await carregar(true);
    return null;
  };

  const confirmarOcultar = async () => {
    const r = await apiFetch(`/api/admin/mensagens/${ocultando.id}/ocultar`, { method: 'POST', body: JSON.stringify({ motivo }) });
    if (r.ok) {
      const atualizada = await r.json();
      setDados((d) => ({ ...d, mensagens: d.mensagens.map((m) => (m.id === atualizada.id ? atualizada : m)) }));
      setOcultando(null);
      setMotivo('');
    }
  };

  const alternarArquivado = async () => {
    await apiFetch(`/api/admin/mensagens/grupos/${canalId}`, { method: 'PUT', body: JSON.stringify({ arquivado: !dados.arquivado }) });
    await carregar(false);
  };

  if (!dados) return <p className="adm-vazio" style={{ padding: '16px' }}>Carregando…</p>;
  const Icone = ICONE[dados.tipo];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="amsg-topo">
        <button type="button" className="adm-icone-btn amsg-voltar" onClick={aoVoltar} aria-label="Voltar pra lista">←</button>
        <span className={`amsg-icone ${dados.tipo}`}><Icone /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, color: 'var(--adm-forte)' }}>{dados.nome}</div>
          <div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>
            {dados.tipo === 'direto' && 'Conversa direta com o aluno'}
            {dados.tipo === 'geral' && 'Todos os alunos leem · só a escola escreve'}
            {dados.tipo === 'grupo' && (
              <>
                {dados.empresa}{dados.turno ? ` · turno ${dados.turno}` : ' · todos os turnos'} ·{' '}
                <button type="button" className="adm-link" onClick={() => setVerMembros((v) => !v)}>{dados.membros.length} membro{dados.membros.length !== 1 ? 's' : ''}</button>
                {dados.arquivado && ' · arquivado'}
              </>
            )}
          </div>
        </div>
        {dados.tipo === 'grupo' && <button type="button" className="adm-btn secundario pequeno" onClick={alternarArquivado}>{dados.arquivado ? 'Reativar' : 'Arquivar'}</button>}
      </div>
      {verMembros && dados.membros && (
        <div style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--adm-texto)', borderBottom: '1px solid rgb(var(--adm-tinta) / 0.08)' }}>
          Entram sozinhos os alunos contratados por {dados.empresa}{dados.turno ? ` no turno ${dados.turno}` : ''}: {dados.membros.map((m) => m.nome).join(', ') || 'nenhum no momento'}.
        </div>
      )}
      {ocultando && (
        <div className="amsg-ocultar">
          <span>Ocultar a mensagem de <strong>{ocultando.autor}</strong> pros alunos. Motivo:</span>
          <input className="adm-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: linguagem ofensiva" maxLength={200} autoFocus />
          <button type="button" className="adm-btn pequeno" disabled={motivo.trim().length < 3} onClick={confirmarOcultar}>Ocultar</button>
          <button type="button" className="adm-btn secundario pequeno" onClick={() => setOcultando(null)}>Cancelar</button>
        </div>
      )}
      <Conversa
        tema="claro"
        mensagens={dados.mensagens}
        minhaSe={(m) => m.da_escola}
        mostrarAutor={dados.tipo !== 'direto'}
        aoEnviar={enviar}
        vistoEm={dados.tipo === 'direto' ? dados.aluno_leu_em : undefined}
        aoOcultar={(m) => { setOcultando(m); setMotivo(''); }}
        placeholder={dados.tipo === 'geral' ? 'Aviso pra todos os alunos' : 'Mensagem'}
      />
    </div>
  );
};

// ---------------------------------------------------------------- sininho da escola
// Mesma ideia do app do aluno: lista as conversas com mensagem de aluno ainda
// não lida pela coordenação; clicar abre a conversa na aba Chat.
export const SinoEscola = ({ total, aoAbrirCanal }) => {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState(null);
  const caixaRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    apiFetch('/api/admin/mensagens/canais').then(async (r) => { if (r.ok) setItens((await r.json()).filter((c) => c.nao_lidas > 0)); });
    const fechar = (e) => { if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [aberto, total]);

  const ir = (canalId) => { setAberto(false); aoAbrirCanal(canalId); };
  return (
    <div ref={caixaRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="adm-btn secundario"
        onClick={() => setAberto((a) => !a)}
        aria-label={total ? `Notificações: ${total} mensage${total > 1 ? 'ns' : 'm'} de alunos` : 'Notificações'}
        aria-expanded={aberto}
        style={{ position: 'relative', padding: '10px 12px', fontSize: '16px', lineHeight: 1 }}
      >
        <IconSino />
        {total > 0 && <span className="amsg-badge" style={{ position: 'absolute', top: '-7px', right: '-7px' }}>{total > 99 ? '99+' : total}</span>}
      </button>
      {aberto && (
        <div className="adm-card" role="dialog" aria-label="Notificações" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '340px', maxWidth: '90vw', padding: 0, zIndex: 90, overflow: 'hidden', boxShadow: '0 16px 40px rgb(var(--adm-tinta) / 0.2)' }}>
          <div style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--adm-forte)', borderBottom: '1px solid rgb(var(--adm-tinta) / 0.08)' }}>Notificações</div>
          {itens === null && <div className="adm-vazio" style={{ padding: '14px' }}>Carregando…</div>}
          {itens?.length === 0 && <div style={{ padding: '18px 14px', fontSize: '13px', color: 'var(--adm-suave)', textAlign: 'center' }}>Nenhuma mensagem nova de aluno.</div>}
          {itens?.map((c) => {
            const Icone = ICONE[c.tipo];
            return (
              <button key={c.id} type="button" className="amsg-item" onClick={() => ir(c.id)}>
                <span className={`amsg-icone ${c.tipo}`} style={{ width: '34px', height: '34px', fontSize: '16px' }}><Icone /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--adm-texto-forte)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</strong>
                    <span style={{ fontSize: '11px', color: '#16a34a', flex: '0 0 auto' }}>{horaCurta(c.ultima_mensagem?.enviada_em)}</span>
                  </span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--adm-suave)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nao_lidas > 1 ? `${c.nao_lidas} mensagens novas · ` : ''}{c.ultima_mensagem?.texto}
                  </span>
                </span>
              </button>
            );
          })}
          <button type="button" onClick={() => ir(null)} style={{ width: '100%', padding: '11px', background: 'rgb(var(--adm-tinta) / 0.04)', border: 'none', borderTop: '1px solid rgb(var(--adm-tinta) / 0.08)', color: 'var(--accent-soft)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Ver todas as conversas
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- central
const AbaMensagens = ({ alunos, aoMudou, canalInicial }) => {
  const [filtros, setFiltros] = useState({ tipo: '', empresa: '', turno: '', turma_id: '', busca: '' });
  const [opcoes, setOpcoes] = useState({ empresas: [], turnos: [], turmas: [] });
  const [canais, setCanais] = useState(null);
  const [abertoId, setAbertoId] = useState(canalInicial ?? null);
  // A notificação do sininho manda abrir uma conversa específica
  useEffect(() => { if (canalInicial) setAbertoId(canalInicial); }, [canalInicial]);
  const [criando, setCriando] = useState(null); // 'direto' | 'grupo'
  const [novo, setNovo] = useState({ aluno: '', empresa: '', turno: '', nome: '' });
  const [erro, setErro] = useState(null);

  useEffect(() => {
    apiFetch('/api/admin/mensagens/opcoes').then(async (r) => { if (r.ok) setOpcoes(await r.json()); });
  }, []);

  const carregar = useCallback(async () => {
    const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== ''));
    const r = await apiFetch(`/api/admin/mensagens/canais?${params}`);
    if (r.ok) setCanais(await r.json());
  }, [filtros]);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, INTERVALO_LISTA_MS);
    return () => clearInterval(id);
  }, [carregar]);

  const aoConversaMudar = useCallback(() => { carregar(); aoMudou?.(); }, [carregar, aoMudou]);
  const mudar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  const abrirConversaComAluno = async () => {
    setErro(null);
    const aluno = alunos.find((a) => normalizarBusca(a.nome) === normalizarBusca(novo.aluno));
    if (!aluno) { setErro('Escolha um aluno da lista.'); return; }
    const r = await apiFetch('/api/admin/mensagens/diretos', { method: 'POST', body: JSON.stringify({ estudante_id: aluno.id }) });
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível abrir a conversa.')); return; }
    setAbertoId((await r.json()).id);
    setCriando(null);
    setNovo({ aluno: '', empresa: '', turno: '', nome: '' });
    carregar();
  };

  const criarGrupo = async () => {
    setErro(null);
    const r = await apiFetch('/api/admin/mensagens/grupos', { method: 'POST', body: JSON.stringify({ empresa: novo.empresa, turno: novo.turno || null, nome: novo.nome || null }) });
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível criar o grupo.')); return; }
    setAbertoId((await r.json()).id);
    setCriando(null);
    setNovo({ aluno: '', empresa: '', turno: '', nome: '' });
    carregar();
  };

  const filtrando = Object.values(filtros).some((v) => v !== '');
  return (
    <div>
      <style>{`
        ${ESTILOS_CONVERSA}
        .amsg { display: grid; grid-template-columns: 340px minmax(0, 1fr); height: min(72vh, 760px); border: 1px solid rgb(var(--accent-rgb) / 0.25); border-radius: 16px; overflow: hidden; background: rgb(var(--surface-rgb)); }
        .amsg-lista { border-right: 1px solid rgb(var(--adm-tinta) / 0.1); overflow-y: auto; }
        .amsg-topo { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid rgb(var(--adm-tinta) / 0.1); }
        .amsg-voltar { display: none !important; }
        .amsg-vazio { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; color: var(--adm-suave); font-size: 13px; text-align: center; padding: 20px; }
        .amsg-ocultar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 14px; background: #fff7ed; border-bottom: 1px solid #fed7aa; font-size: 12px; color: #9a3412; }
        .amsg-ocultar .adm-input { flex: 1 1 180px; padding: 6px 10px; }
        @media (max-width: 860px) {
          .amsg { grid-template-columns: 1fr; height: 78vh; }
          .amsg.com-conversa .amsg-lista { display: none; }
          .amsg:not(.com-conversa) .amsg-conversa { display: none; }
          .amsg-voltar { display: flex !important; }
        }
      `}</style>

      <div className="adm-filtros">
        <div className="adm-segmentado" role="group" aria-label="Tipo de conversa" style={{ marginBottom: 0 }}>
          {TIPOS.map(([valor, rotulo]) => (
            <button key={valor || 'todas'} className={filtros.tipo === valor ? 'ativo' : ''} onClick={() => setFiltros((f) => ({ ...f, tipo: valor }))} aria-pressed={filtros.tipo === valor}>{rotulo}</button>
          ))}
        </div>
        <input className="adm-input" placeholder="Buscar aluno ou grupo…" value={filtros.busca} onChange={mudar('busca')} style={{ flex: '2 1 200px' }} />
        <select className="adm-input" value={filtros.empresa} onChange={mudar('empresa')} style={{ flex: '1 1 160px' }} aria-label="Empresa">
          <option value="">Todas as empresas</option>
          {opcoes.empresas.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="adm-input" value={filtros.turno} onChange={mudar('turno')} style={{ flex: '1 1 120px' }} aria-label="Turno">
          <option value="">Todos os turnos</option>
          {opcoes.turnos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="adm-input" value={filtros.turma_id} onChange={mudar('turma_id')} style={{ flex: '1 1 120px' }} aria-label="Turma">
          <option value="">Todas as turmas</option>
          {opcoes.turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        {filtrando && <button className="adm-link" onClick={() => setFiltros({ tipo: '', empresa: '', turno: '', turma_id: '', busca: '' })}>Limpar</button>}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button type="button" className="adm-btn pequeno" onClick={() => { setCriando(criando === 'direto' ? null : 'direto'); setErro(null); }}>+ Conversa com aluno</button>
        <button type="button" className="adm-btn secundario pequeno" onClick={() => { setCriando(criando === 'grupo' ? null : 'grupo'); setErro(null); }}>+ Grupo de empresa</button>
      </div>
      {criando === 'direto' && (
        <div className="adm-filtros adm-hist-item">
          <input className="adm-input" list="amsg-alunos" placeholder="Nome do aluno" value={novo.aluno} onChange={(e) => setNovo((n) => ({ ...n, aluno: e.target.value }))} style={{ flex: '2 1 240px' }} autoFocus />
          <datalist id="amsg-alunos">{alunos.map((a) => <option key={a.id} value={a.nome}>{a.turma || ''}</option>)}</datalist>
          <button type="button" className="adm-btn pequeno" onClick={abrirConversaComAluno}>Abrir conversa</button>
        </div>
      )}
      {criando === 'grupo' && (
        <div className="adm-filtros adm-hist-item">
          <select className="adm-input" value={novo.empresa} onChange={(e) => setNovo((n) => ({ ...n, empresa: e.target.value }))} style={{ flex: '2 1 200px' }} aria-label="Empresa do grupo">
            <option value="">Empresa…</option>
            {opcoes.empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select className="adm-input" value={novo.turno} onChange={(e) => setNovo((n) => ({ ...n, turno: e.target.value }))} style={{ flex: '1 1 140px' }} aria-label="Turno do grupo">
            <option value="">Todos os turnos</option>
            {opcoes.turnos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="adm-input" placeholder={novo.empresa ? `${novo.empresa} — Aprendizes${novo.turno ? ` ${novo.turno}` : ''}` : 'Nome (opcional)'} value={novo.nome} onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))} style={{ flex: '2 1 200px' }} />
          <button type="button" className="adm-btn pequeno" disabled={!novo.empresa} onClick={criarGrupo}>Criar grupo</button>
          <span style={{ fontSize: '11px', color: 'var(--adm-suave)', flexBasis: '100%' }}>Entram sozinhos os alunos com status Contratado nessa empresa (e turma do turno escolhido). Quem sai da empresa perde o acesso; o histórico fica.</span>
        </div>
      )}
      {erro && <div className="adm-erro" style={{ marginBottom: '10px' }}><IconWarning /> {erro}</div>}

      <div className={`amsg ${abertoId ? 'com-conversa' : ''}`}>
        <div className="amsg-lista">
          {canais === null && <p className="adm-vazio" style={{ padding: '14px' }}>Carregando…</p>}
          {canais?.length === 0 && <p className="adm-vazio" style={{ padding: '14px' }}>Nenhuma conversa com esses filtros.</p>}
          {canais?.map((c) => {
            const Icone = ICONE[c.tipo];
            const sub = c.tipo === 'direto' ? (c.aluno?.turma || 'Sem turma') : c.tipo === 'grupo' ? `${c.total_membros} membro${c.total_membros !== 1 ? 's' : ''}${c.arquivado ? ' · arquivado' : ''}` : 'Todos os alunos';
            return (
              <button key={c.id} type="button" className={`amsg-item ${c.id === abertoId ? 'ativo' : ''}`} onClick={() => setAbertoId(c.id)}>
                <span className={`amsg-icone ${c.tipo}`}><Icone /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--adm-texto-forte)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</strong>
                    <span style={{ fontSize: '11px', color: c.nao_lidas ? '#16a34a' : 'var(--adm-suave)', flex: '0 0 auto' }}>{horaCurta(c.ultima_mensagem?.enviada_em)}</span>
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--adm-suave)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.ultima_mensagem ? `${c.ultima_mensagem.da_escola ? 'Você: ' : ''}${c.ultima_mensagem.texto}` : sub}
                    </span>
                    {c.nao_lidas > 0 && <span className="amsg-badge">{c.nao_lidas}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="amsg-conversa" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {abertoId
            ? <ConversaEscola key={abertoId} canalId={abertoId} aoMudou={aoConversaMudar} aoVoltar={() => setAbertoId(null)} />
            : <div className="amsg-vazio"><IconChat style={{ fontSize: '32px' }} /><div>Escolha uma conversa ou abra uma nova.</div><div style={{ fontSize: '11px' }}>Tudo fica registrado. Ninguém edita nem apaga mensagens; mensagem imprópria se oculta (o original fica guardado).</div></div>}
        </div>
      </div>
    </div>
  );
};

export default AbaMensagens;
