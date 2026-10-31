import React, { useCallback, useEffect, useState } from 'react';
import { IconWarning, IconPencil, IconCheck, IconTrash } from './icons';
import { apiFetch, lerErro } from '../api';
import { mascararData, dataBrParaIso, dataIsoParaBr, somenteDigitos } from '../utils/formatos';
import FICHA from '../data/ficha_pap.json';

// Aba "PAP" da ficha do aluno: as colunas da planilha de controle do PAP
// (dados escolares e contratos). Os campos, rótulos e opções vêm de
// data/ficha_pap.json -- o mesmo arquivo que o backend usa pra validar.

export const CAMPOS_ALUNO = FICHA.aluno;
export const CAMPOS_CONTRATO = FICHA.contrato;

const mascararCnpj = (texto) => somenteDigitos(texto).slice(0, 14)
  .replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
  .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');

// Valor guardado (ISO, dígitos) -> texto do campo, e o caminho de volta
export const valorParaTela = (campo, valor) => {
  if (valor == null) return '';
  if (campo.tipo === 'data') return dataIsoParaBr(valor);
  if (campo.tipo === 'cnpj') return mascararCnpj(valor);
  return String(valor);
};
const telaParaValor = (campo, texto) => {
  if (texto === '' || texto == null) return null;
  if (campo.tipo === 'data') return dataBrParaIso(texto) || undefined; // undefined = data inválida
  if (campo.tipo === 'cnpj') return somenteDigitos(texto);
  if (campo.tipo === 'inteiro') return Number(texto);
  return texto;
};

const Campo = ({ campo, valor, aoMudar, id, desabilitado }) => {
  const comum = { id, className: 'adm-input', disabled: desabilitado };
  if (campo.tipo === 'opcao') {
    return (
      <select {...comum} value={valor} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">—</option>
        {campo.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (campo.tipo === 'data') return <input {...comum} inputMode="numeric" placeholder="dd/mm/aaaa" value={valor} onChange={(e) => aoMudar(mascararData(e.target.value))} />;
  if (campo.tipo === 'cnpj') return <input {...comum} inputMode="numeric" placeholder="00.000.000/0000-00" value={valor} onChange={(e) => aoMudar(mascararCnpj(e.target.value))} />;
  if (campo.tipo === 'inteiro') return <input {...comum} type="number" min={0} max={campo.max} value={valor} onChange={(e) => aoMudar(e.target.value)} />;
  if (campo.campo === 'observacao') return <textarea {...comum} rows={3} maxLength={campo.max} value={valor} onChange={(e) => aoMudar(e.target.value)} />;
  return <input {...comum} maxLength={campo.max} value={valor} onChange={(e) => aoMudar(e.target.value)} />;
};

// Monta o corpo pra API; devolve [corpo, erro]
const coletar = (campos, textos) => {
  const corpo = {};
  for (const campo of campos) {
    const valor = telaParaValor(campo, textos[campo.campo]);
    if (valor === undefined) return [null, `${campo.rotulo}: data inválida (use dd/mm/aaaa).`];
    if (campo.obrigatorio && valor == null) return [null, `Preencha: ${campo.rotulo}`];
    corpo[campo.campo] = valor;
  }
  return [corpo, null];
};

const textosDe = (campos, origem) => Object.fromEntries(campos.map((c) => [c.campo, valorParaTela(c, origem?.[c.campo])]));

const GradeCampos = ({ campos, textos, setTextos, prefixo, desabilitado }) => (
  <div className="adm-form-grade">
    {campos.map((c) => (
      <div key={c.campo} style={c.campo === 'observacao' || c.campo === 'endereco' ? { gridColumn: '1 / -1' } : undefined}>
        <label className="adm-rotulo" htmlFor={`${prefixo}-${c.campo}`}>
          {c.rotulo}{c.obrigatorio ? ' *' : ''}{c.sensivel ? ' (só a escola vê)' : ''}
        </label>
        <Campo id={`${prefixo}-${c.campo}`} campo={c} valor={textos[c.campo] ?? ''} desabilitado={desabilitado} aoMudar={(v) => setTextos((t) => ({ ...t, [c.campo]: v }))} />
      </div>
    ))}
  </div>
);

// ------------------------------------------------------------------ dados escolares (aluno)
const DadosPap = ({ aluno, aoAtualizar }) => {
  const [editando, setEditando] = useState(false);
  const [textos, setTextos] = useState(() => textosDe(CAMPOS_ALUNO, aluno));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => { if (!editando) setTextos(textosDe(CAMPOS_ALUNO, aluno)); }, [aluno, editando]);

  const salvar = async (e) => {
    e.preventDefault();
    const [ficha, problema] = coletar(CAMPOS_ALUNO, textos);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro(null);
    const r = await apiFetch(`/api/admin/estudantes/${aluno.id}`, { method: 'PUT', body: JSON.stringify({ ficha }) });
    setSalvando(false);
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível salvar.')); return; }
    setEditando(false);
    aoAtualizar();
  };

  return (
    <form onSubmit={salvar} className="adm-hist-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--adm-suave)' }}>
          {aluno.cadastro_atualizado_em ? `Atualizado em ${dataIsoParaBr(aluno.cadastro_atualizado_em)}` : 'Ainda não atualizado'}
        </div>
        {!editando && <button type="button" className="adm-btn secundario pequeno" onClick={() => setEditando(true)}><IconPencil style={{ verticalAlign: '-2px' }} /> Habilitar edição</button>}
      </div>
      <GradeCampos campos={CAMPOS_ALUNO} textos={textos} setTextos={setTextos} prefixo={`pap-${aluno.id}`} desabilitado={!editando} />
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
      {editando && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="button" className="adm-btn secundario pequeno" onClick={() => { setEditando(false); setErro(null); }}>Cancelar</button>
          <button type="submit" className="adm-btn pequeno" disabled={salvando}><IconCheck style={{ verticalAlign: '-2px' }} /> {salvando ? 'Salvando...' : 'Salvar alterações'}</button>
        </div>
      )}
    </form>
  );
};

// ------------------------------------------------------------------ contratos
const CONTRATO_NOVO = { status: 'Ativo', aditivo: 'Não' };

const FormContrato = ({ inicial, aoSalvar, aoCancelar }) => {
  const [textos, setTextos] = useState(() => textosDe(CAMPOS_CONTRATO, inicial || CONTRATO_NOVO));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    const [corpo, problema] = coletar(CAMPOS_CONTRATO, textos);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro(null);
    const r = await aoSalvar(corpo);
    setSalvando(false);
    if (r) setErro(r);
  };

  return (
    <form onSubmit={enviar} className="adm-hist-item">
      <GradeCampos campos={CAMPOS_CONTRATO} textos={textos} setTextos={setTextos} prefixo={`ct-${inicial?.id ?? 'novo'}`} />
      <p style={{ fontSize: '11px', color: 'var(--adm-suave)', margin: '8px 0 0' }}>
        Contrato <strong>Ativo</strong> marca o aluno como contratado por essa empresa. Ao finalizar, escolha no status do aprendiz se ele volta pro "No aguardo", desistiu ou expirou.
      </p>
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
        <button type="button" className="adm-btn secundario pequeno" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="adm-btn pequeno" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar contrato'}</button>
      </div>
    </form>
  );
};

const vigencia = (c) => [dataIsoParaBr(c.data_inicial), c.data_final ? dataIsoParaBr(c.data_final) : 'sem data final'].join(' a ');

const CartaoContrato = ({ contrato, aoEditar, aoApagar }) => {
  const [apagando, setApagando] = useState(false);
  const detalhes = [
    contrato.local_atuacao && `Local: ${contrato.local_atuacao}`,
    contrato.turno_trabalho && `Turno: ${contrato.turno_trabalho}`,
    contrato.tipo_contratacao && `Contratação ${contrato.tipo_contratacao.toLowerCase()}`,
    (contrato.horas_teoria != null || contrato.horas_pratica != null) && `${contrato.horas_teoria ?? 0}h teoria + ${contrato.horas_pratica ?? 0}h prática por semana`,
    contrato.aditivo === 'Sim' && `Aditivo: ${dataIsoParaBr(contrato.aditivo_inicio) || '?'} a ${dataIsoParaBr(contrato.aditivo_fim) || '?'}`,
    contrato.cnpj && `CNPJ ${mascararCnpj(contrato.cnpj)}`,
  ].filter(Boolean);
  return (
    <div className="adm-hist-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--adm-texto-forte)', fontSize: '13px' }}>{contrato.empresa}</div>
          <div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{vigencia(contrato)}</div>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <span className={`adm-chip ${contrato.status === 'Ativo' ? 'verde' : ''}`}>{contrato.status}</span>
          {contrato.efetivado && <span className={`adm-chip ${contrato.efetivado === 'Efetivado' ? 'azul' : ''}`}>{contrato.efetivado}</span>}
        </div>
      </div>
      {detalhes.length > 0 && <div style={{ fontSize: '12px', color: 'var(--adm-texto)', marginTop: '6px' }}>{detalhes.join(' · ')}</div>}
      {contrato.motivo && <div style={{ fontSize: '12px', color: 'var(--adm-texto)', marginTop: '4px' }}>Motivo do encerramento: {contrato.motivo}</div>}
      {contrato.observacao && <div style={{ fontSize: '12px', color: 'var(--adm-suave)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{contrato.observacao}</div>}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px' }}>
        <button type="button" className="adm-link" onClick={aoEditar}><IconPencil style={{ verticalAlign: '-2px' }} /> Editar</button>
        {apagando ? (
          <span style={{ display: 'flex', gap: '8px' }}>Apagar? <button type="button" className="adm-link perigo" onClick={aoApagar}>Sim</button><button type="button" className="adm-link" onClick={() => setApagando(false)}>Não</button></span>
        ) : <button type="button" className="adm-link perigo" onClick={() => setApagando(true)}><IconTrash style={{ verticalAlign: '-2px' }} /> Apagar</button>}
      </div>
    </div>
  );
};

const Contratos = ({ aluno, aoAtualizar }) => {
  const [contratos, setContratos] = useState(null);
  const [editandoId, setEditandoId] = useState(null); // 'novo' | id

  const carregar = useCallback(async () => {
    const r = await apiFetch(`/api/admin/estudantes/${aluno.id}/contratos`);
    if (r.ok) setContratos(await r.json());
  }, [aluno.id]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = (id) => async (corpo) => {
    const r = id === 'novo'
      ? await apiFetch(`/api/admin/estudantes/${aluno.id}/contratos`, { method: 'POST', body: JSON.stringify(corpo) })
      : await apiFetch(`/api/admin/contratos/${id}`, { method: 'PUT', body: JSON.stringify(corpo) });
    if (!r.ok) return lerErro(r, 'Não foi possível salvar o contrato.');
    setEditandoId(null);
    await carregar();
    aoAtualizar();
    return null;
  };

  const apagar = async (id) => {
    const r = await apiFetch(`/api/admin/contratos/${id}`, { method: 'DELETE' });
    if (r.ok) { await carregar(); aoAtualizar(); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', margin: '18px 0 8px' }}>
        <h3 className="adm-subtitulo" style={{ margin: 0 }}>Contratos de aprendizagem</h3>
        {editandoId !== 'novo' && <button type="button" className="adm-btn pequeno" onClick={() => setEditandoId('novo')}>+ Novo contrato</button>}
      </div>
      {editandoId === 'novo' && <FormContrato aoSalvar={salvar('novo')} aoCancelar={() => setEditandoId(null)} />}
      {contratos === null ? <p className="adm-vazio">Carregando…</p> : contratos.length === 0 && editandoId !== 'novo'
        ? <p className="adm-vazio">Nenhum contrato cadastrado.</p>
        : contratos.map((c) => (editandoId === c.id
          ? <FormContrato key={c.id} inicial={c} aoSalvar={salvar(c.id)} aoCancelar={() => setEditandoId(null)} />
          : <CartaoContrato key={c.id} contrato={c} aoEditar={() => setEditandoId(c.id)} aoApagar={() => apagar(c.id)} />))}
    </div>
  );
};

const AbaPap = ({ aluno, aoAtualizar }) => (
  <div>
    <h3 className="adm-subtitulo" style={{ marginTop: 0 }}>Dados do PAP</h3>
    <DadosPap aluno={aluno} aoAtualizar={aoAtualizar} />
    <Contratos aluno={aluno} aoAtualizar={aoAtualizar} />
  </div>
);

export default AbaPap;
