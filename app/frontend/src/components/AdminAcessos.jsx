import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Imprimir } from './FolhaCurriculo';
import { IconWarning, IconLock, IconCheckCircle, IconPdf } from './icons';
import { apiFetch, lerErro } from '../api';
import { dataHoraIsoParaBr, dataIsoParaBr, linkWhatsapp, normalizarBusca } from '../utils/formatos';
import { carimboArquivo, registrarExportacao } from '../utils/exportar';

// Aba Acessos do Painel da Escola (regras em acesso.py):
// - pedidos de senha nova que os alunos fizeram na tela de entrada;
// - código de acesso (6 dígitos) de um aluno ou da turma inteira, pra
//   entregar em mãos. O código só aparece aqui na hora em que é gerado.

const SITUACOES = {
  sem_acesso: { rotulo: 'Ainda não entrou', cor: 'amarelo' },
  codigo_gerado: { rotulo: 'Código entregue', cor: 'azul' },
  ativo: { rotulo: 'Com senha', cor: 'verde' },
};
const FILTROS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'sem_acesso', rotulo: 'Ainda não entraram' },
  { valor: 'codigo_gerado', rotulo: 'Com código' },
  { valor: 'ativo', rotulo: 'Com senha' },
];
const CORES_PEDIDO = { pendente: 'amarelo', aprovado: 'azul', recusado: '', concluido: 'verde' };

const enderecoDoApp = () => `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '');
const codigoLegivel = (codigo) => `${codigo.slice(0, 3)} ${codigo.slice(3)}`;

// Bilhetes pra recortar e entregar: um por aluno
const BilhetesDeAcesso = ({ codigos }) => (
  <div className="adm-bilhetes">
    <style>{`
      .adm-bilhetes { font-family: 'Inter', Arial, sans-serif; color: #0f172a; display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
      .adm-bilhete { border: 1px dashed #94a3b8; padding: 12px 14px; break-inside: avoid; font-size: 10.5px; line-height: 1.45; }
      .adm-bilhete .marca { font-weight: 800; font-size: 12px; margin-bottom: 4px; }
      .adm-bilhete .nome { font-weight: 700; font-size: 12px; }
      .adm-bilhete .codigo { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 22px; font-weight: 800; letter-spacing: 3px; margin: 4px 0; }
      .adm-bilhete ol { margin: 6px 0 0; padding-left: 16px; }
      .adm-bilhete .aviso { margin-top: 6px; font-weight: 700; }
    `}</style>
    {codigos.map((c) => (
      <div key={`${c.estudante_id}-${c.codigo}`} className="adm-bilhete">
        <div className="marca">Play2Work.ai — acesso do aluno</div>
        <div className="nome">{c.nome}{c.turma ? ` · ${c.turma}` : ''}</div>
        <div>Usuário: <strong>{c.usuario}</strong></div>
        <div className="codigo">{codigoLegivel(c.codigo)}</div>
        <div>Vale até {dataIsoParaBr(c.expira_em)}</div>
        <ol>
          <li>Abra {enderecoDoApp()}</li>
          <li>Toque em “Tenho um código da escola”</li>
          <li>Digite o seu CPF e este código e crie a sua senha</li>
        </ol>
        <div className="aviso">Não mostre este papel pra ninguém. Depois de criar a senha, jogue fora.</div>
      </div>
    ))}
  </div>
);

const CodigosGerados = ({ codigos, aoImprimir, aoFechar }) => (
  <div className="adm-card" style={{ borderColor: 'rgb(var(--accent-rgb) / 0.5)', marginBottom: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
      <div style={{ fontWeight: 800, color: 'var(--adm-forte)' }}>
        <IconLock style={{ verticalAlign: '-2px' }} /> {codigos.length === 1 ? 'Código gerado' : `${codigos.length} códigos gerados`}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="adm-btn pequeno" onClick={aoImprimir}><IconPdf /> Imprimir {codigos.length === 1 ? 'bilhete' : 'bilhetes'}</button>
        <button type="button" className="adm-btn secundario pequeno" onClick={aoFechar}>Já entreguei</button>
      </div>
    </div>
    <div className="adm-aviso" style={{ marginBottom: '10px' }}>
      <IconWarning /> Entregue em mãos, só pro próprio aluno. Os códigos não aparecem de novo depois que você fechar este quadro (dá pra gerar outro, e o antigo deixa de valer).
    </div>
    <div className="adm-tabela-wrap">
      <table className="adm-tabela">
        <thead><tr><th>Aluno</th><th>Usuário</th><th>Código</th><th>Vale até</th></tr></thead>
        <tbody>
          {codigos.map((c) => (
            <tr key={`${c.estudante_id}-${c.codigo}`} style={{ cursor: 'default' }}>
              <td>{c.nome}{c.turma && <div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{c.turma}</div>}</td>
              <td className="mono">{c.usuario}</td>
              <td className="mono" style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '2px', color: 'var(--adm-forte)' }}>{codigoLegivel(c.codigo)}</td>
              <td className="mono">{dataIsoParaBr(c.expira_em)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const AbaAcessos = ({ alunos, turmas, recarregar }) => {
  const [pedidos, setPedidos] = useState([]);
  const [verHistorico, setVerHistorico] = useState(false);
  const [codigos, setCodigos] = useState([]);
  const [imprimindo, setImprimindo] = useState(false);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(null); // id da ação em andamento
  const [recusando, setRecusando] = useState(null); // { id, motivo }
  const [confirmarAluno, setConfirmarAluno] = useState(null); // aluno com senha que vai ganhar um código
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [turmaLote, setTurmaLote] = useState('');
  const [loteTodos, setLoteTodos] = useState(false);

  const carregarPedidos = useCallback(async () => {
    const r = await apiFetch(`/api/admin/pedidos-senha?situacao=${verHistorico ? 'todos' : 'pendente'}`);
    if (r.ok) setPedidos(await r.json());
  }, [verHistorico]);
  useEffect(() => { carregarPedidos(); }, [carregarPedidos]);

  const executar = async (chave, caminho, corpo) => {
    setErro(null);
    setOcupado(chave);
    try {
      const r = await apiFetch(caminho, { method: 'POST', ...(corpo ? { body: JSON.stringify(corpo) } : {}) });
      if (!r.ok) { setErro(await lerErro(r, 'Não foi possível concluir.')); return null; }
      const dados = await r.json();
      await Promise.all([carregarPedidos(), recarregar()]);
      return dados;
    } finally {
      setOcupado(null);
    }
  };

  const mostrarCodigos = (lista) => {
    setCodigos(lista);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const aprovar = async (pedido) => {
    const dados = await executar(`aprovar-${pedido.id}`, `/api/admin/pedidos-senha/${pedido.id}/aprovar`);
    if (dados) mostrarCodigos([dados]);
  };
  const recusar = async () => {
    const dados = await executar(`recusar-${recusando.id}`, `/api/admin/pedidos-senha/${recusando.id}/recusar`, { motivo: recusando.motivo || null });
    if (dados) setRecusando(null);
  };
  const gerarDoAluno = async (aluno) => {
    setConfirmarAluno(null);
    const dados = await executar(`aluno-${aluno.id}`, `/api/admin/estudantes/${aluno.id}/codigo-acesso`);
    if (dados) mostrarCodigos([dados]);
  };
  const gerarDaTurma = async () => {
    const dados = await executar('turma', `/api/admin/turmas/${turmaLote}/codigos-acesso`, { apenas_sem_acesso: !loteTodos });
    if (!dados) return;
    if (!dados.codigos.length) { setErro(`Todos os alunos de ${dados.turma} já criaram a senha.`); return; }
    mostrarCodigos(dados.codigos);
  };

  const pendentes = pedidos.filter((p) => p.status === 'pendente');
  const contagem = useMemo(() => alunos.reduce((t, a) => ({ ...t, [a.status_acesso]: (t[a.status_acesso] || 0) + 1 }), {}), [alunos]);
  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    return alunos
      .filter((a) => !filtro || a.status_acesso === filtro)
      .filter((a) => !turmaId || String(a.turma_id) === turmaId)
      .filter((a) => !termo || normalizarBusca(`${a.nome} ${a.usuario || ''}`).includes(termo))
      .sort((x, y) => x.nome.localeCompare(y.nome));
  }, [alunos, filtro, turmaId, busca]);

  return (
    <div>
      {codigos.length > 0 && <CodigosGerados codigos={codigos} aoImprimir={() => { registrarExportacao(`bilhetes de código de acesso (${codigos.length})`, codigos.length); setImprimindo(true); }} aoFechar={() => setCodigos([])} />}
      {erro && <div className="adm-erro" style={{ marginTop: 0, marginBottom: '12px' }}><IconWarning /> {erro}</div>}

      {/* ---------------------------------------------- pedidos de senha nova */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div className="adm-subtitulo" style={{ marginTop: 0 }}>Pedidos de senha nova {pendentes.length > 0 && <span className="adm-contador" style={{ background: '#d97706', color: '#fff' }}>{pendentes.length}</span>}</div>
        <label className="adm-check" style={{ fontSize: '12px', color: 'var(--adm-suave)', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={verHistorico} onChange={(e) => setVerHistorico(e.target.checked)} /> Ver histórico
        </label>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--adm-suave)', margin: '0 0 10px', lineHeight: 1.5 }}>
        Aprovar não troca a senha de ninguém: gera um código que você entrega em mãos, e só com ele (e o CPF) o aluno cria a senha nova. Na dúvida se foi o próprio aluno que pediu, fale com ele ou com o responsável antes.
      </p>
      {pedidos.length === 0 ? (
        <div className="adm-card" style={{ color: 'var(--adm-suave)', fontSize: '13px', marginBottom: '20px' }}>
          <IconCheckCircle style={{ verticalAlign: '-2px', color: '#059669' }} /> {verHistorico ? 'Nenhum pedido ainda.' : 'Nenhum pedido esperando.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
          {pedidos.map((p) => (
            <div key={p.id} className="adm-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 14px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: 'var(--adm-forte)' }}>{p.nome} <span className={`adm-chip pequeno ${CORES_PEDIDO[p.status] || ''}`}>{p.status_rotulo}</span></div>
                <div style={{ fontSize: '12px', color: 'var(--adm-suave)' }}>
                  <span className="mono">{p.usuario}</span>{p.turma && ` · ${p.turma}`} · pedido em {dataHoraIsoParaBr(p.criado_em)}
                  {p.motivo_recusa && ` · motivo: ${p.motivo_recusa}`}
                </div>
                {p.status === 'pendente' && (p.telefone || p.responsavel_telefone) && (
                  <div style={{ fontSize: '12px', marginTop: '2px' }}>
                    Confirmar com: {p.telefone && <a className="adm-a" href={linkWhatsapp(p.telefone)} target="_blank" rel="noreferrer">aluno (WhatsApp)</a>}
                    {p.telefone && p.responsavel_telefone && ' · '}
                    {p.responsavel_telefone && <a className="adm-a" href={linkWhatsapp(p.responsavel_telefone)} target="_blank" rel="noreferrer">responsável (WhatsApp)</a>}
                  </div>
                )}
              </div>
              {p.status === 'pendente' && (
                recusando?.id === p.id ? (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input className="adm-input" style={{ width: '220px' }} placeholder="Motivo (opcional)" maxLength={200} value={recusando.motivo} onChange={(e) => setRecusando({ ...recusando, motivo: e.target.value })} autoFocus />
                    <button type="button" className="adm-btn pequeno" disabled={ocupado === `recusar-${p.id}`} onClick={recusar}>Confirmar recusa</button>
                    <button type="button" className="adm-btn secundario pequeno" onClick={() => setRecusando(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="adm-btn pequeno" disabled={ocupado === `aprovar-${p.id}`} onClick={() => aprovar(p)}>
                      {ocupado === `aprovar-${p.id}` ? 'Gerando...' : 'Aprovar e gerar código'}
                    </button>
                    <button type="button" className="adm-btn secundario pequeno so-quem-altera" onClick={() => setRecusando({ id: p.id, motivo: '' })}>Recusar</button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------------------------------------------- códigos da turma */}
      <div className="adm-subtitulo">Primeiro acesso da turma</div>
      <div className="adm-card" style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: 'var(--adm-suave)', margin: '0 0 10px', lineHeight: 1.5 }}>
          Gera um código pra cada aluno da turma e imprime os bilhetes pra recortar e entregar em sala. Cada código vale 7 dias e é de uso único.
        </p>
        <div className="adm-filtros" style={{ marginBottom: 0 }}>
          <select className="adm-input" value={turmaLote} onChange={(e) => setTurmaLote(e.target.value)} style={{ flex: '1 1 160px' }} aria-label="Turma">
            <option value="">Escolha a turma</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <label style={{ fontSize: '12px', color: 'var(--adm-texto)', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={loteTodos} onChange={(e) => setLoteTodos(e.target.checked)} /> Incluir quem já tem senha
          </label>
          <button type="button" className="adm-btn" disabled={!turmaLote || ocupado === 'turma'} onClick={gerarDaTurma}>
            {ocupado === 'turma' ? 'Gerando...' : 'Gerar códigos da turma'}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------- situação de cada aluno */}
      <div className="adm-subtitulo">Situação de cada aluno</div>
      <div className="adm-segmentado" role="tablist">
        {FILTROS.map((f) => (
          <button key={f.valor} type="button" className={filtro === f.valor ? 'ativo' : ''} onClick={() => setFiltro(f.valor)}>
            {f.rotulo}<span>{f.valor ? contagem[f.valor] || 0 : alunos.length}</span>
          </button>
        ))}
      </div>
      <div className="adm-filtros">
        <input className="adm-input" placeholder="Buscar por nome ou usuário" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: '2 1 220px' }} />
        <select className="adm-input" value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={{ flex: '1 1 140px' }} aria-label="Filtrar por turma">
          <option value="">Todas as turmas</option>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>
      <div className="adm-tabela-wrap">
        <table className="adm-tabela">
          <thead><tr><th>Aluno</th><th>Usuário</th><th>Turma</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {filtrados.map((a) => {
              const situacao = SITUACOES[a.status_acesso] || SITUACOES.sem_acesso;
              return (
                <tr key={a.id} style={{ cursor: 'default' }}>
                  <td>{a.nome}</td>
                  <td className="mono">{a.usuario || <span className="adm-vazio">—</span>}</td>
                  <td>{a.turma || <span className="adm-vazio">—</span>}</td>
                  <td>
                    <span className={`adm-chip pequeno ${situacao.cor}`}>{situacao.rotulo}</span>
                    <div style={{ fontSize: '11px', color: 'var(--adm-suave)', marginTop: '2px' }}>
                      {a.status_acesso === 'codigo_gerado' && `código vale até ${dataIsoParaBr(a.codigo_acesso_expira_em)}`}
                      {a.status_acesso === 'ativo' && a.senha_definida_em && `senha criada em ${dataIsoParaBr(a.senha_definida_em)}`}
                    </div>
                  </td>
                  <td className="num">
                    {confirmarAluno?.id === a.id ? (
                      <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', whiteSpace: 'normal', textAlign: 'left' }}>
                        <span style={{ fontSize: '11px', color: 'var(--adm-texto)', maxWidth: '220px' }}>Ele já tem senha. A atual continua valendo até ele usar o código.</span>
                        <button type="button" className="adm-btn pequeno" onClick={() => gerarDoAluno(a)}>Gerar</button>
                        <button type="button" className="adm-btn secundario pequeno" onClick={() => setConfirmarAluno(null)}>Cancelar</button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="adm-btn secundario pequeno so-quem-altera"
                        disabled={!a.cpf || ocupado === `aluno-${a.id}`}
                        title={a.cpf ? undefined : 'Cadastre o CPF do aluno primeiro'}
                        onClick={() => (a.status_acesso === 'ativo' ? setConfirmarAluno(a) : gerarDoAluno(a))}
                      >
                        {a.status_acesso === 'codigo_gerado' ? 'Gerar outro código' : 'Gerar código'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--adm-suave)', padding: '28px' }}>Nenhum aluno com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {imprimindo && (
        <Imprimir nomeDoArquivo={`Codigos de acesso ${carimboArquivo()}`} aoTerminar={() => setImprimindo(false)}>
          <BilhetesDeAcesso codigos={codigos} />
        </Imprimir>
      )}
    </div>
  );
};

export default AbaAcessos;
