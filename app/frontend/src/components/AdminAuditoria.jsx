import React, { useCallback, useEffect, useState } from 'react';
import { IconWarning, IconCsv } from './icons';
import { apiFetch, baixarArquivo } from '../api';
import { dataHoraIsoParaBr } from '../utils/formatos';

// Aba Auditoria (perfis Administrador e Auditor): o que cada conta da gestão
// fez -- incluiu, alterou, excluiu, exportou, entrou -- com filtros e o
// detalhe de cada registro (o que foi enviado e, nas exclusões e alterações,
// como estava antes). Os registros ficam guardados por 2 anos.

const COR_ACAO = { incluiu: 'verde', alterou: 'azul', excluiu: 'amarelo', exportou: '', entrou: '', falhou_login: 'amarelo', negado: 'amarelo' };
const ROTULO_ENTIDADE = (e) => (e ? e.replace(/_/g, ' ') : '—');

const Valores = ({ titulo, dados }) => (
  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--adm-suave)', marginBottom: '4px' }}>{titulo}</div>
    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 10px', fontSize: '12px' }}>
      {Object.entries(dados).map(([k, v]) => (
        <React.Fragment key={k}>
          <dt style={{ color: 'var(--adm-suave)' }}>{k}</dt>
          <dd style={{ margin: 0, wordBreak: 'break-word', color: 'var(--adm-texto-forte)' }}>{v === null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
        </React.Fragment>
      ))}
    </dl>
  </div>
);

const LinhaRegistro = ({ r }) => {
  const [aberto, setAberto] = useState(false);
  const temDetalhe = (r.dados && Object.keys(r.dados).length) || r.antes;
  return (
    <>
      <tr onClick={() => temDetalhe && setAberto((v) => !v)} style={{ cursor: temDetalhe ? 'pointer' : 'default' }}>
        <td className="mono" style={{ whiteSpace: 'nowrap' }}>{dataHoraIsoParaBr(r.criado_em)}</td>
        <td><strong>{r.usuario_nome}</strong>{r.papel && <div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{r.papel}</div>}</td>
        <td><span className={`adm-chip pequeno ${COR_ACAO[r.acao] || ''}`}>{r.acao_rotulo}</span></td>
        <td>{r.descricao}{temDetalhe && <span style={{ color: 'var(--accent-soft)', fontSize: '11px' }}> · {aberto ? 'esconder' : 'ver detalhes'}</span>}</td>
        <td className="mono" style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{r.ip || '—'}</td>
      </tr>
      {aberto && (
        <tr style={{ cursor: 'default' }}>
          <td colSpan={5} style={{ background: 'rgb(var(--adm-tinta) / 0.03)' }}>
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              {r.antes && <Valores titulo="Como estava antes" dados={r.antes} />}
              {r.dados && Object.keys(r.dados).length > 0 && <Valores titulo={r.acao === 'excluiu' ? 'Enviado' : 'O que foi enviado'} dados={r.dados} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const AbaAuditoria = () => {
  const [filtros, setFiltros] = useState({ usuario_id: '', acao: '', entidade: '', de: '', ate: '', busca: '' });
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  const consulta = useCallback((extra = {}) => {
    const p = new URLSearchParams();
    Object.entries({ ...filtros, ...extra }).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
    return p.toString();
  }, [filtros]);

  useEffect(() => {
    let cancelado = false;
    const id = setTimeout(async () => {
      const r = await apiFetch(`/api/admin/auditoria?${consulta({ pagina, por_pagina: 50 })}`);
      if (cancelado) return;
      if (r.ok) { setDados(await r.json()); setErro(null); } else setErro('Não foi possível carregar a auditoria.');
    }, 250);
    return () => { cancelado = true; clearTimeout(id); };
  }, [consulta, pagina]);

  const mudar = (campo) => (e) => { setPagina(1); setFiltros((f) => ({ ...f, [campo]: e.target.value })); };
  const exportar = async () => {
    const falha = await baixarArquivo(`/api/admin/auditoria/exportar?${consulta()}`, `auditoria_${new Date().toISOString().slice(0, 10)}.csv`);
    if (falha) setErro(falha);
  };
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.por_pagina)) : 1;

  return (
    <div>
      <p style={{ fontSize: '12px', color: 'var(--adm-suave)', margin: '0 0 10px', lineHeight: 1.5 }}>
        Tudo o que as contas da gestão incluíram, alteraram, excluíram ou exportaram, os logins e as tentativas sem permissão.
        Os registros não podem ser editados nem apagados por ninguém e ficam guardados por 2 anos{dados ? ` (${dados.retencao_dias} dias)` : ''}; depois disso saem sozinhos.
      </p>
      <div className="adm-filtros">
        <select className="adm-input" value={filtros.usuario_id} onChange={mudar('usuario_id')} aria-label="Pessoa" style={{ flex: '1 1 160px' }}>
          <option value="">Todas as pessoas</option>
          {dados?.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select className="adm-input" value={filtros.acao} onChange={mudar('acao')} aria-label="Ação" style={{ flex: '1 1 140px' }}>
          <option value="">Todas as ações</option>
          {dados && Object.entries(dados.acoes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="adm-input" value={filtros.entidade} onChange={mudar('entidade')} aria-label="O que foi mexido" style={{ flex: '1 1 140px' }}>
          <option value="">Tudo</option>
          {dados?.entidades.map((e) => <option key={e} value={e}>{ROTULO_ENTIDADE(e)}</option>)}
        </select>
        <label style={{ fontSize: '12px', color: 'var(--adm-texto)', display: 'flex', alignItems: 'center', gap: '4px' }}>de <input type="date" className="adm-input" value={filtros.de} onChange={mudar('de')} style={{ padding: '6px 8px' }} /></label>
        <label style={{ fontSize: '12px', color: 'var(--adm-texto)', display: 'flex', alignItems: 'center', gap: '4px' }}>até <input type="date" className="adm-input" value={filtros.ate} onChange={mudar('ate')} style={{ padding: '6px 8px' }} /></label>
        <input className="adm-input" placeholder="Buscar (nome, aluno, turma...)" value={filtros.busca} onChange={mudar('busca')} style={{ flex: '2 1 200px' }} />
        <button type="button" className="adm-btn secundario pequeno" onClick={exportar}><IconCsv style={{ verticalAlign: '-2px' }} /> Exportar CSV</button>
      </div>
      {erro && <div className="adm-erro" style={{ marginTop: 0, marginBottom: '10px' }}><IconWarning /> {erro}</div>}
      <div className="adm-tabela-wrap">
        <table className="adm-tabela">
          <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>O quê</th><th>IP</th></tr></thead>
          <tbody>
            {dados?.itens.map((r) => <LinhaRegistro key={r.id} r={r} />)}
            {dados && dados.itens.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--adm-suave)', padding: '24px' }}>Nenhum registro com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      {dados && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--adm-suave)' }}>
          <span>{dados.total} registro{dados.total !== 1 ? 's' : ''}</span>
          <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
            <button type="button" className="adm-btn secundario pequeno" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>← Anterior</button>
            {pagina} de {paginas}
            <button type="button" className="adm-btn secundario pequeno" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Próxima →</button>
          </span>
        </div>
      )}
    </div>
  );
};

export default AbaAuditoria;
