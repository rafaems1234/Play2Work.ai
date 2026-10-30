import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import TechBackground from './TechBackground';
import FichaAluno, { FormAluno, ChipStatus, fotoDoAluno } from './FichaAluno';
import Gaveta from './Gaveta';
import AbaTrilha from './AdminTrilha';
import AbaMensagens, { SinoEscola } from './AdminMensagens';
import { somEstaAtivado, tocarSomMensagem } from '../utils/sound';
import { Avatar } from './FotoPerfil';
import { Imprimir } from './FolhaCurriculo';
import { IconWarning, IconTrophy, IconBriefcase, IconGraduationCap, IconMask, IconCheckCircle, IconMedal, IconBook, IconTarget, IconHandshake, IconCsv, IconPdf, IconChat } from './icons';
import { apiFetch, lerErro, salvarToken, limparToken, obterToken, aoExpirarSessao, DEMO_MODE } from '../api';
import { mascararCpf, dataHoraIsoParaBr, normalizarBusca, somenteDigitos } from '../utils/formatos';
import { COLUNAS_ALUNOS, baixarCsv, carimboArquivo } from '../utils/exportar';

// Painel da escola: cadastro e gestão dos alunos (CPF, nascimento, e-mail,
// turma, itinerário), turmas, vagas das empresas parceiras e a seleção dos
// alunos com melhor desempenho pra indicar a cada vaga.

const ROTULOS_DESEMPENHO = {
  habilidades: 'Habilidades',
  itinerario: 'Itinerário',
  competencias: 'Competências',
  quiz: 'Quiz',
};

const corDaNota = (nota) => {
  if (nota >= 75) return '#059669';
  if (nota >= 55) return '#2563eb';
  if (nota >= 35) return '#c98a04';
  return '#dc2626';
};

// ------------------------------------------------------------------ login
const LoginAdmin = ({ aoEntrar, aoSair }) => {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    try {
      setEnviando(true);
      setErro(null);
      const resposta = await apiFetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ senha }) });
      if (!resposta.ok) {
        setErro(await lerErro(resposta, 'Não foi possível entrar.'));
        return;
      }
      salvarToken('admin', (await resposta.json()).token);
      aoEntrar();
    } catch (err) {
      console.error(err);
      setErro('Não foi possível conectar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative' }}>
      <form onSubmit={entrar} className="adm-card" style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <Logo size={30} />
          <div>
            <div style={{ fontWeight: '800', color: 'var(--adm-forte)', fontSize: '17px' }}>Painel da Escola</div>
            <div style={{ fontSize: '12px', color: 'var(--adm-suave)' }}>Acesso da coordenação</div>
          </div>
        </div>
        <label className="adm-rotulo" htmlFor="adm-senha">Senha do painel</label>
        <input id="adm-senha" type="password" className="adm-input" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
        {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
        <button type="submit" className="adm-btn" disabled={enviando || !senha} style={{ width: '100%', marginTop: '16px' }}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
        {DEMO_MODE && (
          <div style={{ marginTop: '14px', fontSize: '12px', color: '#c98a04', display: 'flex', alignItems: 'center', gap: '6px' }}><IconMask /> Demonstração: a senha é <strong>escola123</strong></div>
        )}
        <button type="button" className="adm-link" onClick={aoSair} style={{ marginTop: '14px' }}>← Voltar</button>
      </form>
    </div>
  );
};

// ------------------------------------------------------------------ busca com autocomplete
const BuscaAlunos = ({ valor, aoMudar, alunos, aoEscolher }) => {
  const [aberta, setAberta] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const caixaRef = useRef(null);

  const sugestoes = useMemo(() => {
    const termo = normalizarBusca(valor);
    if (!termo) return [];
    const digitos = somenteDigitos(valor);
    return alunos.filter((a) => normalizarBusca(a.nome).includes(termo) || normalizarBusca(a.nome_exibicao).includes(termo) || (digitos.length >= 3 && (a.cpf || '').includes(digitos))).slice(0, 6);
  }, [valor, alunos]);

  useEffect(() => {
    const fechar = (e) => { if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberta(false); };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  const teclar = (e) => {
    if (!aberta || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setDestaque((d) => (d + 1) % sugestoes.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setDestaque((d) => (d - 1 + sugestoes.length) % sugestoes.length); }
    if (e.key === 'Enter') { e.preventDefault(); aoEscolher(sugestoes[destaque]); setAberta(false); }
    if (e.key === 'Escape') setAberta(false);
  };

  // Realça no nome o trecho que bate com o que foi digitado
  const realcar = (nome) => {
    const termo = normalizarBusca(valor);
    const idx = normalizarBusca(nome).indexOf(termo);
    if (!termo || idx < 0) return nome;
    return <>{nome.slice(0, idx)}<mark className="adm-mark">{nome.slice(idx, idx + termo.length)}</mark>{nome.slice(idx + termo.length)}</>;
  };

  return (
    <div ref={caixaRef} style={{ position: 'relative', flex: '2 1 260px' }}>
      <input
        className="adm-input"
        placeholder="Buscar por nome, CPF ou e-mail…"
        value={valor}
        onChange={(e) => { aoMudar(e.target.value); setAberta(true); setDestaque(0); }}
        onFocus={() => setAberta(true)}
        onKeyDown={teclar}
        role="combobox"
        aria-expanded={aberta && sugestoes.length > 0}
        aria-autocomplete="list"
      />
      {aberta && sugestoes.length > 0 && (
        <ul className="adm-sugestoes" role="listbox">
          {sugestoes.map((a, i) => (
            <li
              key={a.id}
              role="option"
              aria-selected={i === destaque}
              className={i === destaque ? 'ativa' : ''}
              onMouseEnter={() => setDestaque(i)}
              onMouseDown={(e) => { e.preventDefault(); aoEscolher(a); setAberta(false); }}
            >
              <span style={{ fontWeight: 700, color: 'var(--adm-texto-forte)' }}>{realcar(a.nome)}</span>
              <span style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{a.nome_exibicao} · {mascararCpf(a.cpf || '')} · {a.turma || 'sem turma'} · {a.itinerario || 'sem itinerário'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ aba Alunos
// Filtros rápidos por status de contratação (com a contagem já respeitando os outros filtros)
const FILTROS_STATUS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'disponivel', rotulo: 'Disponíveis (em espera)' },
  { valor: 'contratado', rotulo: 'Contratados' },
];

const RelatorioAlunos = ({ alunos, descricaoFiltros }) => {
  const colunas = COLUNAS_ALUNOS.filter(([, , noPdf]) => noPdf);
  return (
    <div className="adm-relatorio">
      <style>{`
        .adm-relatorio { font-family: 'Inter', Arial, sans-serif; color: #0f172a; font-size: 9.5px; }
        .adm-relatorio h1 { font-size: 16px; margin: 0 0 2px; }
        .adm-relatorio .sub { color: #475569; margin: 0 0 10px; font-size: 10px; }
        .adm-relatorio table { width: 100%; border-collapse: collapse; }
        .adm-relatorio th { text-align: left; background: #e6eefa; padding: 4px 5px; border-bottom: 1px solid #94a3b8; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .adm-relatorio td { padding: 3px 5px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .adm-relatorio tr { break-inside: avoid; }
      `}</style>
      <h1>Relatório de alunos — Play2Work.ai</h1>
      <p className="sub">
        {alunos.length} aluno{alunos.length !== 1 ? 's' : ''} · {descricaoFiltros || 'sem filtros'} · gerado em {dataHoraIsoParaBr(new Date().toISOString())}
      </p>
      <table>
        <thead><tr>{colunas.map(([titulo]) => <th key={titulo}>{titulo}</th>)}</tr></thead>
        <tbody>
          {alunos.map((a) => <tr key={a.id}>{colunas.map(([titulo, valor]) => <td key={titulo}>{valor(a)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
};

const AbaAlunos = ({ alunos, turmas, itinerarios, filtroTurmaInicial, recarregar }) => {
  const [busca, setBusca] = useState('');
  const [turmaId, setTurmaId] = useState(filtroTurmaInicial ?? '');
  const [itinerario, setItinerario] = useState('');
  const [status, setStatus] = useState('');
  const [idadeMin, setIdadeMin] = useState('');
  const [idadeMax, setIdadeMax] = useState('');
  const [soSemFoto, setSoSemFoto] = useState(false);
  const [empresa, setEmpresa] = useState('');
  const [certificado, setCertificado] = useState('');
  const [cadastrando, setCadastrando] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [imprimindo, setImprimindo] = useState(false);

  useEffect(() => { setTurmaId(filtroTurmaInicial ?? ''); }, [filtroTurmaInicial]);

  // Filtro instantâneo, a cada letra digitada. Tudo menos o status -- que é
  // aplicado por último, pra os botões rápidos mostrarem a contagem de cada um.
  const { semStatus, semNascimento } = useMemo(() => {
    const termo = normalizarBusca(busca);
    const digitos = somenteDigitos(busca);
    const min = idadeMin === '' ? null : Number(idadeMin);
    const max = idadeMax === '' ? null : Number(idadeMax);
    const filtraIdade = min != null || max != null;
    const passaOutrosFiltros = (a) => {
      if (turmaId !== '' && String(a.turma_id ?? '') !== String(turmaId)) return false;
      if (itinerario && (itinerario === '__nenhum' ? a.itinerario : a.itinerario !== itinerario)) return false;
      if (soSemFoto && a.tem_foto) return false;
      if (empresa && a.empresa_contratante !== empresa) return false;
      if (certificado === 'com' && !a.total_certificados) return false;
      if (certificado === 'sem' && a.total_certificados) return false;
      if (!termo) return true;
      return normalizarBusca(a.nome).includes(termo)
        || normalizarBusca(a.nome_exibicao).includes(termo)
        || normalizarBusca(a.email).includes(termo)
        || normalizarBusca(a.responsavel_nome).includes(termo)
        || (digitos.length >= 3 && ((a.cpf || '').includes(digitos) || (a.telefone || '').includes(digitos) || (a.responsavel_telefone || '').includes(digitos)));
    };
    const candidatos = alunos.filter(passaOutrosFiltros);
    if (!filtraIdade) return { semStatus: candidatos, semNascimento: [] };
    // Com filtro de idade, quem não tem nascimento cadastrado fica de fora --
    // mas separado, pra o painel avisar (senão a coordenação exporta "todos os
    // de 16 a 18" e faltam alunos sem perceber)
    return {
      semStatus: candidatos.filter((a) => a.idade != null && (min == null || a.idade >= min) && (max == null || a.idade <= max)),
      semNascimento: candidatos.filter((a) => a.idade == null && (!status || a.status_contratacao === status)),
    };
  }, [alunos, busca, turmaId, itinerario, idadeMin, idadeMax, soSemFoto, empresa, certificado, status]);

  // Empresas onde há aluno contratado -- é o que alimenta o filtro e as sugestões na ficha
  const empresas = useMemo(
    () => [...new Set(alunos.map((a) => a.empresa_contratante).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [alunos],
  );

  const filtrados = useMemo(() => (status ? semStatus.filter((a) => a.status_contratacao === status) : semStatus), [semStatus, status]);
  const contagem = (valor) => (valor ? semStatus.filter((a) => a.status_contratacao === valor).length : semStatus.length);

  const selecionado = alunos.find((a) => a.id === selecionadoId);

  const cadastrar = async (dados) => {
    const resposta = await apiFetch('/api/admin/estudantes', { method: 'POST', body: JSON.stringify(dados) });
    if (!resposta.ok) return lerErro(resposta, 'Não foi possível cadastrar.');
    setCadastrando(false);
    setAviso(`${dados.nome} cadastrado(a). A senha de acesso é o CPF.`);
    await recarregar();
    return null;
  };

  const atualizar = async (dados) => {
    const resposta = await apiFetch(`/api/admin/estudantes/${selecionadoId}`, { method: 'PUT', body: JSON.stringify(dados) });
    if (!resposta.ok) return lerErro(resposta, 'Não foi possível salvar.');
    setAviso(`Dados de ${dados.nome} atualizados.`);
    await recarregar();
    return null;
  };

  const limparFiltros = () => {
    setBusca(''); setTurmaId(''); setItinerario(''); setStatus(''); setIdadeMin(''); setIdadeMax(''); setSoSemFoto(false); setEmpresa(''); setCertificado('');
  };
  const temFiltro = busca || turmaId !== '' || itinerario || status || idadeMin !== '' || idadeMax !== '' || soSemFoto || empresa || certificado;

  // Descrição dos filtros aplicados, que vai no cabeçalho do PDF
  const descricaoFiltros = [
    status && FILTROS_STATUS.find((f) => f.valor === status)?.rotulo,
    turmaId !== '' && `turma ${turmas.find((t) => String(t.id) === String(turmaId))?.nome ?? ''}`,
    itinerario && (itinerario === '__nenhum' ? 'sem itinerário' : itinerario),
    (idadeMin !== '' || idadeMax !== '') && `idade ${idadeMin || '…'} a ${idadeMax || '…'}`,
    soSemFoto && 'sem foto',
    empresa && `empresa ${empresa}`,
    certificado && (certificado === 'com' ? 'com certificado' : 'sem certificado'),
    busca && `busca "${busca}"`,
  ].filter(Boolean).join(' · ');

  return (
    <div>
      <div className="adm-segmentado" role="group" aria-label="Status de contratação">
        {FILTROS_STATUS.map((f) => (
          <button key={f.valor || 'todos'} className={status === f.valor ? 'ativo' : ''} onClick={() => setStatus(f.valor)} aria-pressed={status === f.valor}>
            {f.rotulo} <span>{contagem(f.valor)}</span>
          </button>
        ))}
      </div>

      <div className="adm-filtros">
        <BuscaAlunos valor={busca} aoMudar={setBusca} alunos={alunos} aoEscolher={(a) => setSelecionadoId(a.id)} />
        <select className="adm-input" value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={{ flex: '1 1 140px' }} aria-label="Filtrar por turma">
          <option value="">Todas as turmas</option>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select className="adm-input" value={itinerario} onChange={(e) => setItinerario(e.target.value)} style={{ flex: '1 1 200px' }} aria-label="Filtrar por itinerário">
          <option value="">Todos os itinerários</option>
          {itinerarios.map((it) => <option key={it} value={it}>{it}</option>)}
          <option value="__nenhum">Sem itinerário</option>
        </select>
        <select className="adm-input" value={empresa} onChange={(e) => setEmpresa(e.target.value)} style={{ flex: '1 1 180px' }} aria-label="Filtrar por empresa" disabled={!empresas.length}>
          <option value="">{empresas.length ? 'Todas as empresas' : 'Nenhum aluno contratado'}</option>
          {empresas.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
        </select>
        <select className="adm-input" value={certificado} onChange={(e) => setCertificado(e.target.value)} style={{ flex: '1 1 160px' }} aria-label="Filtrar por certificado">
          <option value="">Certificado: todos</option>
          <option value="com">Com certificado</option>
          <option value="sem">Sem certificado</option>
        </select>
        <div className="adm-idade" role="group" aria-label="Filtrar por idade">
          <span>Idade</span>
          <input type="number" min={10} max={30} className="adm-input" placeholder="de" value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} aria-label="Idade mínima" />
          <input type="number" min={10} max={30} className="adm-input" placeholder="até" value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} aria-label="Idade máxima" />
        </div>
        <label className="adm-check">
          <input type="checkbox" checked={soSemFoto} onChange={(e) => setSoSemFoto(e.target.checked)} /> Só sem foto
        </label>
        <button className="adm-btn" onClick={() => setCadastrando(true)} style={{ flex: '0 0 auto' }}>+ Cadastrar aluno</button>
      </div>

      <div className="adm-barra-lista">
        <span>
          {filtrados.length} de {alunos.length} aluno{alunos.length !== 1 ? 's' : ''}
          {temFiltro && <> · <button className="adm-link" onClick={limparFiltros}>Limpar filtros</button></>}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="adm-btn secundario pequeno" disabled={!filtrados.length} onClick={() => baixarCsv(`alunos_${carimboArquivo()}.csv`, filtrados)}>
            <IconCsv style={{ verticalAlign: '-2px' }} /> Exportar CSV
          </button>
          <button className="adm-btn secundario pequeno" disabled={!filtrados.length} onClick={() => setImprimindo(true)}>
            <IconPdf style={{ verticalAlign: '-2px' }} /> Exportar PDF
          </button>
        </div>
      </div>

      {aviso && <div className="adm-ok" onClick={() => setAviso(null)}><IconCheckCircle style={{ verticalAlign: '-2px' }} /> {aviso}</div>}

      {semNascimento.length > 0 && (
        <div className="adm-aviso" style={{ marginBottom: '12px', flexWrap: 'wrap' }} role="status">
          <IconWarning />
          <span>
            {semNascimento.length} aluno{semNascimento.length > 1 ? 's' : ''} sem data de nascimento {semNascimento.length > 1 ? 'ficaram' : 'ficou'} de fora do filtro de idade
            {' '}(e da exportação): {semNascimento.slice(0, 3).map((a) => a.nome).join(', ')}{semNascimento.length > 3 ? '…' : ''}.
          </span>
          <button className="adm-link" onClick={() => { setIdadeMin(''); setIdadeMax(''); }}>Tirar filtro de idade</button>
        </div>
      )}

      <div className="adm-tabela-wrap">
        <table className="adm-tabela">
          <thead>
            <tr>
              <th>Aluno</th><th>CPF</th><th className="num">Idade</th><th>Turma</th><th>Itinerário</th><th>Status</th><th className="num">XP</th><th className="num">Quiz</th><th className="num">Indicações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => (
              <tr key={a.id} onClick={() => setSelecionadoId(a.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelecionadoId(a.id)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar caminho={fotoDoAluno(a.id)} versao={a.foto_atualizada_em} nome={a.nome} tamanho={34} />
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--adm-texto-forte)' }}>{a.nome}</div>
                      <div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>no ranking: <span style={{ color: 'var(--accent-soft)' }}>{a.nome_exibicao}</span> · {a.email}</div>
                    </div>
                  </div>
                </td>
                <td className="mono">{mascararCpf(a.cpf || '') || '—'}</td>
                <td className="num">{a.idade ?? <span className="adm-vazio">—</span>}</td>
                <td>{a.turma || <span className="adm-vazio">—</span>}</td>
                <td>{a.itinerario || <span className="adm-vazio">não definido</span>}</td>
                <td>
                  <ChipStatus status={a.status_contratacao} />
                  {a.empresa_contratante && <div style={{ fontSize: '11px', color: 'var(--adm-suave)', marginTop: '2px' }}>{a.empresa_contratante}</div>}
                </td>
                <td className="num">{a.xp_total}</td>
                <td className="num">{a.taxa_acerto_quiz != null ? `${a.taxa_acerto_quiz}%` : '—'}</td>
                <td className="num">{a.total_indicacoes || <span className="adm-vazio">—</span>}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--adm-suave)', padding: '28px' }}>Nenhum aluno com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {imprimindo && (
        <Imprimir nomeDoArquivo={`Relatorio de alunos ${carimboArquivo()}`} paisagem aoTerminar={() => setImprimindo(false)}>
          <RelatorioAlunos alunos={filtrados} descricaoFiltros={descricaoFiltros} />
        </Imprimir>
      )}

      <AnimatePresence>
        {cadastrando && (
          <Gaveta titulo="Cadastrar aluno" aoFechar={() => setCadastrando(false)}>
            <FormAluno turmas={turmas} itinerarios={itinerarios} aoSalvar={cadastrar} aoCancelar={() => setCadastrando(false)} />
          </Gaveta>
        )}
        {selecionado && (
          <Gaveta titulo={selecionado.nome} aoFechar={() => setSelecionadoId(null)} larga>
            <FichaAluno key={selecionado.id} aluno={selecionado} turmas={turmas} itinerarios={itinerarios} empresas={empresas} aoSalvar={atualizar} aoAtualizar={recarregar} />
          </Gaveta>
        )}
      </AnimatePresence>
    </div>
  );
};

// ------------------------------------------------------------------ aba Turmas
const AbaTurmas = ({ turmas, recarregar, aoVerAlunos }) => {
  const [nome, setNome] = useState('');
  const [turno, setTurno] = useState('Manhã');
  const [erro, setErro] = useState(null);

  const criar = async (e) => {
    e.preventDefault();
    setErro(null);
    const resposta = await apiFetch('/api/admin/turmas', { method: 'POST', body: JSON.stringify({ nome, turno }) });
    if (!resposta.ok) { setErro(await lerErro(resposta, 'Não foi possível criar a turma.')); return; }
    setNome('');
    await recarregar();
  };

  return (
    <div>
      <form onSubmit={criar} className="adm-filtros">
        <input className="adm-input" placeholder="Nome da turma (ex: 3º C)" value={nome} onChange={(e) => setNome(e.target.value)} required style={{ flex: '2 1 200px' }} />
        <select className="adm-input" value={turno} onChange={(e) => setTurno(e.target.value)} style={{ flex: '1 1 120px' }} aria-label="Turno">
          {['Manhã', 'Tarde', 'Noite', 'Integral'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="adm-btn" type="submit">+ Criar turma</button>
      </form>
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
      <div className="adm-grade-cards">
        {turmas.map((t) => (
          <button key={t.id} className="adm-card adm-card-clicavel" onClick={() => aoVerAlunos(t.id)}>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--adm-forte)' }}>{t.nome}</div>
            <div style={{ fontSize: '12px', color: 'var(--adm-suave)', marginBottom: '12px' }}>{t.turno || 'Turno não informado'}</div>
            <div style={{ fontSize: '13px', color: 'var(--accent-soft)', fontWeight: 700 }}>{t.total_alunos} aluno{t.total_alunos !== 1 ? 's' : ''} →</div>
          </button>
        ))}
        {turmas.length === 0 && <p style={{ color: 'var(--adm-suave)' }}>Nenhuma turma ainda.</p>}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ aba Vagas e indicação
const FormVaga = ({ itinerarios, aoSalvar, aoCancelar }) => {
  const [campos, setCampos] = useState({ titulo_vaga: '', empresa: '', localizacao: '', tipo_modalidade: 'Presencial', area_itinerario: '', habilidades: '', descricao_completa: '' });
  const [erro, setErro] = useState(null);
  const mudar = (campo) => (e) => setCampos((c) => ({ ...c, [campo]: e.target.value }));
  const salvar = async (e) => {
    e.preventDefault();
    const habilidades = campos.habilidades.split(',').map((h) => h.trim()).filter(Boolean);
    if (!habilidades.length) { setErro('Informe pelo menos uma habilidade exigida.'); return; }
    const erroServidor = await aoSalvar({
      titulo_vaga: campos.titulo_vaga, empresa: campos.empresa, localizacao: campos.localizacao,
      tipo_modalidade: campos.tipo_modalidade, area_itinerario: campos.area_itinerario || null,
      habilidades_exigidas: habilidades, descricao_completa: campos.descricao_completa || null,
    });
    if (erroServidor) setErro(erroServidor);
  };
  return (
    <form onSubmit={salvar}>
      <div className="adm-form-grade">
        <div style={{ gridColumn: '1 / -1' }}><label className="adm-rotulo" htmlFor="fv-t">Título da vaga</label><input id="fv-t" className="adm-input" value={campos.titulo_vaga} onChange={mudar('titulo_vaga')} required /></div>
        <div style={{ gridColumn: '1 / -1' }}><label className="adm-rotulo" htmlFor="fv-e">Empresa</label><input id="fv-e" className="adm-input" value={campos.empresa} onChange={mudar('empresa')} required /></div>
        <div><label className="adm-rotulo" htmlFor="fv-l">Cidade</label><input id="fv-l" className="adm-input" value={campos.localizacao} onChange={mudar('localizacao')} required /></div>
        <div><label className="adm-rotulo" htmlFor="fv-m">Modalidade</label>
          <select id="fv-m" className="adm-input" value={campos.tipo_modalidade} onChange={mudar('tipo_modalidade')}>{['Presencial', 'Híbrido', 'Remoto'].map((m) => <option key={m}>{m}</option>)}</select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}><label className="adm-rotulo" htmlFor="fv-a">Itinerário da vaga</label>
          <select id="fv-a" className="adm-input" value={campos.area_itinerario} onChange={mudar('area_itinerario')}>
            <option value="">Qualquer itinerário</option>
            {itinerarios.map((it) => <option key={it} value={it}>{it}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}><label className="adm-rotulo" htmlFor="fv-h">Habilidades exigidas (separadas por vírgula)</label><input id="fv-h" className="adm-input" value={campos.habilidades} onChange={mudar('habilidades')} required /></div>
        <div style={{ gridColumn: '1 / -1' }}><label className="adm-rotulo" htmlFor="fv-d">Descrição</label><textarea id="fv-d" className="adm-input" rows={3} value={campos.descricao_completa} onChange={mudar('descricao_completa')} /></div>
      </div>
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
      <div style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end' }}>
        <button type="button" className="adm-btn secundario" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="adm-btn">Cadastrar vaga</button>
      </div>
    </form>
  );
};

const AbaVagas = ({ vagas, turmas, itinerarios, recarregar }) => {
  const [vagaId, setVagaId] = useState(null);
  const [turmaId, setTurmaId] = useState('');
  const [soDoItinerario, setSoDoItinerario] = useState(true);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [marcados, setMarcados] = useState(new Set());
  const [quantidadeTop, setQuantidadeTop] = useState(3);
  const [aviso, setAviso] = useState(null);
  const [cadastrando, setCadastrando] = useState(false);

  useEffect(() => {
    if (vagaId == null && vagas.length) setVagaId(vagas[0].id);
  }, [vagas, vagaId]);

  const carregarRanking = async () => {
    if (vagaId == null) return;
    setCarregando(true);
    const params = new URLSearchParams({ limite: '50', somente_itinerario_da_vaga: String(soDoItinerario) });
    if (turmaId !== '') params.set('turma_id', turmaId);
    const resposta = await apiFetch(`/api/admin/vagas/${vagaId}/ranking?${params}`);
    if (resposta.ok) setDados(await resposta.json());
    setCarregando(false);
  };

  useEffect(() => {
    setMarcados(new Set());
    setAviso(null);
    carregarRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vagaId, turmaId, soDoItinerario]);

  const alternar = (id) => setMarcados((atual) => {
    const novo = new Set(atual);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });

  const selecionarTop = () => {
    const disponiveis = (dados?.ranking || []).filter((r) => !r.indicado).slice(0, quantidadeTop);
    setMarcados(new Set(disponiveis.map((r) => r.estudante_id)));
  };

  const indicar = async () => {
    const resposta = await apiFetch(`/api/admin/vagas/${vagaId}/indicar`, { method: 'POST', body: JSON.stringify({ estudante_ids: [...marcados] }) });
    if (!resposta.ok) { setAviso({ erro: true, texto: await lerErro(resposta, 'Não foi possível indicar.') }); return; }
    const corpo = await resposta.json();
    setAviso({ erro: false, texto: corpo.mensagem });
    setMarcados(new Set());
    await Promise.all([carregarRanking(), recarregar()]);
  };

  const cadastrarVaga = async (corpoVaga) => {
    const resposta = await apiFetch('/api/admin/vagas', { method: 'POST', body: JSON.stringify(corpoVaga) });
    if (!resposta.ok) return lerErro(resposta, 'Não foi possível cadastrar a vaga.');
    const vaga = await resposta.json();
    setCadastrando(false);
    await recarregar();
    setVagaId(vaga.id);
    return null;
  };

  const vaga = dados?.vaga;

  return (
    <div className="adm-vagas">
      <aside className="adm-vagas-lista">
        <button className="adm-btn" onClick={() => setCadastrando(true)} style={{ width: '100%', marginBottom: '10px' }}>+ Cadastrar vaga</button>
        {vagas.map((v) => (
          <button key={v.id} className={`adm-vaga-item ${v.id === vagaId ? 'ativa' : ''}`} onClick={() => setVagaId(v.id)}>
            <div style={{ fontWeight: 700, color: 'var(--adm-texto-forte)', fontSize: '13px' }}>{v.titulo_vaga}</div>
            <div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{v.empresa}</div>
            <div style={{ fontSize: '11px', color: 'var(--accent-soft)', marginTop: '4px' }}>
              {v.area_itinerario || 'Qualquer itinerário'}{v.total_indicados ? ` · ${v.total_indicados} indicado${v.total_indicados > 1 ? 's' : ''}` : ''}
            </div>
          </button>
        ))}
      </aside>

      <section style={{ minWidth: 0 }}>
        {/* No celular a lista lateral vira um seletor, pra não rolar de lado */}
        <div className="adm-vagas-seletor">
          <select className="adm-input" value={vagaId ?? ''} onChange={(e) => setVagaId(Number(e.target.value))} aria-label="Escolher vaga">
            {vagas.map((v) => <option key={v.id} value={v.id}>{v.titulo_vaga} · {v.empresa}</option>)}
          </select>
          <button className="adm-btn" onClick={() => setCadastrando(true)}>+ Nova vaga</button>
        </div>

        {vaga && (
          <div className="adm-card" style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#0e7490', textTransform: 'uppercase', letterSpacing: '1px' }}>{vaga.empresa}</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--adm-forte)', margin: '4px 0 8px' }}>{vaga.titulo_vaga}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {vaga.habilidades_exigidas.map((h) => <span key={h} className="adm-chip">{h}</span>)}
            </div>
          </div>
        )}

        <div className="adm-filtros">
          <select className="adm-input" value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={{ flex: '1 1 140px' }} aria-label="Filtrar ranking por turma">
            <option value="">Todas as turmas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--adm-texto)', flex: '1 1 220px', cursor: 'pointer' }}>
            <input type="checkbox" checked={soDoItinerario} onChange={(e) => setSoDoItinerario(e.target.checked)} disabled={!vaga?.area_itinerario} />
            Só alunos do itinerário da vaga
          </label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--adm-texto)' }}>Top</span>
            <input type="number" min={1} max={50} className="adm-input" value={quantidadeTop} onChange={(e) => setQuantidadeTop(Math.max(1, Number(e.target.value) || 1))} style={{ width: '64px' }} aria-label="Quantidade" />
            <button className="adm-btn secundario" onClick={selecionarTop}>Selecionar</button>
          </div>
        </div>

        {aviso && <div className={aviso.erro ? 'adm-erro' : 'adm-ok'}>{aviso.erro ? <IconWarning /> : <IconCheckCircle style={{ verticalAlign: '-2px' }} />} {aviso.texto}</div>}

        <div className="adm-tabela-wrap" style={{ opacity: carregando ? 0.5 : 1 }}>
          <table className="adm-tabela">
            <thead>
              <tr><th aria-label="Selecionar" /><th className="num">#</th><th>Aluno</th><th>Nota de desempenho</th><th>Composição</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {(dados?.ranking || []).map((r) => (
                <tr key={r.estudante_id} onClick={() => !r.indicado && alternar(r.estudante_id)} className={marcados.has(r.estudante_id) ? 'marcada' : ''}>
                  <td><input type="checkbox" checked={r.indicado || marcados.has(r.estudante_id)} disabled={r.indicado} onChange={() => alternar(r.estudante_id)} onClick={(e) => e.stopPropagation()} aria-label={`Selecionar ${r.nome}`} /></td>
                  <td className="num">{r.posicao <= 3 ? <IconMedal style={{ fontSize: '18px', verticalAlign: '-3px', color: ['#c98a04', '#94a3b8', '#b45309'][r.posicao - 1] }} aria-label={`${r.posicao}º`} /> : r.posicao}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--adm-texto-forte)' }}>{r.nome}</div>
                    <div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{r.nome_exibicao} · {r.turma || 'sem turma'} · {r.itinerario || 'sem itinerário'}</div>
                  </td>
                  <td style={{ minWidth: '150px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '8px', borderRadius: '99px', background: 'rgb(var(--adm-tinta) / 0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${r.pontuacao}%`, height: '100%', background: corDaNota(r.pontuacao), borderRadius: '99px' }} />
                      </div>
                      <strong style={{ color: corDaNota(r.pontuacao), fontSize: '15px', minWidth: '28px', textAlign: 'right' }}>{r.pontuacao}</strong>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {Object.entries(r.detalhes).map(([chave, valor]) => (
                        <span key={chave} className="adm-chip pequeno" title={chave === 'quiz' && r.taxa_acerto_quiz != null ? `${r.taxa_acerto_quiz}% de acerto` : undefined}>
                          {ROTULOS_DESEMPENHO[chave]} {Math.round(valor)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {r.indicado ? <span className="adm-chip verde">Indicado</span> : r.candidatou_se ? <span className="adm-chip">Candidatou-se</span> : <span className="adm-vazio">—</span>}
                  </td>
                </tr>
              ))}
              {dados && dados.ranking.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--adm-suave)', padding: '28px' }}>Nenhum aluno com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--adm-suave)', margin: '10px 2px' }}>
          Nota de 0 a 100: habilidades exigidas pela vaga (até 30), itinerário igual ao da vaga (20), mapa de competências (35) e acerto no quiz (15).
          Tempo de uso no app (XP e dias seguidos) não entra, pra não favorecer quem tem mais acesso à internet em casa.
        </p>

        <AnimatePresence>
          {marcados.size > 0 && (
            <motion.div className="adm-barra-acao" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}>
              <span>{marcados.size} aluno{marcados.size > 1 ? 's' : ''} selecionado{marcados.size > 1 ? 's' : ''}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="adm-btn secundario" onClick={() => setMarcados(new Set())}>Limpar</button>
                <button className="adm-btn" onClick={indicar}>Indicar para a vaga →</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {cadastrando && (
          <Gaveta titulo="Cadastrar vaga" aoFechar={() => setCadastrando(false)}>
            <FormVaga itinerarios={itinerarios} aoSalvar={cadastrarVaga} aoCancelar={() => setCadastrando(false)} />
          </Gaveta>
        )}
      </AnimatePresence>
    </div>
  );
};

// ------------------------------------------------------------------ painel
const ABAS = [
  { id: 'alunos', rotulo: 'Alunos', Icon: IconGraduationCap },
  { id: 'turmas', rotulo: 'Turmas', Icon: IconTrophy },
  { id: 'vagas', rotulo: 'Vagas e indicação', Icon: IconBriefcase },
  { id: 'trilha', rotulo: 'Trilha EAD', Icon: IconBook },
  { id: 'mensagens', rotulo: 'Chat', Icon: IconChat },
];

// Cartões do topo: tons fechados e dessaturados, pra dar identidade sem virar arco-íris
const CARTOES_RESUMO = [
  { campo: 'total_alunos', rotulo: 'alunos', Icon: IconGraduationCap, cor: '#2f5fb3' },
  { campo: 'total_turmas', rotulo: 'turmas', Icon: IconBook, cor: '#5a5f9e' },
  { campo: 'total_vagas', rotulo: 'vagas', Icon: IconBriefcase, cor: '#2c7a7b' },
  { campo: 'total_indicacoes', rotulo: 'indicações', Icon: IconTarget, cor: '#a16a1f' },
  { campo: 'total_contratados', rotulo: 'contratados', Icon: IconHandshake, cor: '#2f7a4f' },
];

const AdminPanel = ({ aoSair }) => {
  const [logado, setLogado] = useState(() => Boolean(obterToken('admin')));
  const [aba, setAba] = useState('alunos');
  // Conversa que a notificação do sininho mandou abrir na aba Chat
  const [canalChat, setCanalChat] = useState(null);
  const abrirChat = (canalId) => { setCanalChat(canalId); setAba('mensagens'); };
  const [verItinerarios, setVerItinerarios] = useState(false);
  const [filtroTurma, setFiltroTurma] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [vagas, setVagas] = useState([]);
  const [itinerarios, setItinerarios] = useState([]);

  useEffect(() => aoExpirarSessao((papel) => { if (papel === 'admin') setLogado(false); }), []);

  const recarregar = async () => {
    const [rResumo, rAlunos, rTurmas, rVagas, rIt] = await Promise.all([
      apiFetch('/api/admin/resumo'),
      apiFetch('/api/admin/estudantes'),
      apiFetch('/api/admin/turmas'),
      apiFetch('/api/admin/vagas'),
      apiFetch('/api/admin/itinerarios'),
    ]);
    if (rResumo.ok) setResumo(await rResumo.json());
    if (rAlunos.ok) setAlunos(await rAlunos.json());
    if (rTurmas.ok) setTurmas(await rTurmas.json());
    if (rVagas.ok) setVagas(await rVagas.json());
    if (rIt.ok) setItinerarios((await rIt.json()).itinerarios);
  };

  useEffect(() => {
    if (logado) recarregar();
  }, [logado]);

  // Só o resumo, a cada 30 s: mantém o contador de mensagens não lidas da aba Mensagens em dia
  const atualizarResumo = useCallback(async () => {
    const r = await apiFetch('/api/admin/resumo');
    if (r.ok) setResumo(await r.json());
  }, []);
  useEffect(() => {
    if (!logado) return undefined;
    const id = setInterval(atualizarResumo, 30000);
    return () => clearInterval(id);
  }, [logado, atualizarResumo]);

  // Mensagem nova de aluno: som (se o som do app estiver ligado) e "(n)" no título da aba
  const naoLidas = resumo?.mensagens_nao_lidas || 0;
  const naoLidasAntesRef = useRef(null);
  useEffect(() => {
    if (naoLidasAntesRef.current != null && naoLidas > naoLidasAntesRef.current && somEstaAtivado()) tocarSomMensagem();
    naoLidasAntesRef.current = naoLidas;
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = logado && naoLidas ? `(${naoLidas}) ${base}` : base;
    return () => { document.title = document.title.replace(/^\(\d+\)\s*/, ''); };
  }, [naoLidas, logado]);

  const sair = () => {
    limparToken('admin');
    setLogado(false);
  };

  return (
    <div className="adm-raiz">
      <style>{ESTILOS}</style>
      <TechBackground />
      {!logado ? (
        <LoginAdmin aoEntrar={() => setLogado(true)} aoSair={aoSair} />
      ) : (
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1320px', margin: '0 auto', padding: '20px 16px 100px' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Logo size={30} />
              <div>
                <div style={{ fontWeight: '800', color: 'var(--adm-forte)', fontSize: '18px' }}>Painel da Escola</div>
                <div style={{ fontSize: '12px', color: 'var(--adm-suave)' }}>Play2Work.ai{DEMO_MODE && <> · <IconMask style={{ verticalAlign: '-2px' }} /> demonstração</>}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <SinoEscola total={naoLidas} aoAbrirCanal={abrirChat} />
              <button className="adm-btn secundario" onClick={aoSair}>Voltar ao app</button>
              <button className="adm-btn secundario" onClick={sair}>Sair</button>
            </div>
          </header>

          {resumo && (
            <div className="adm-resumo">
              {CARTOES_RESUMO.map(({ campo, rotulo, Icon, cor }) => (
                <div key={campo} className="adm-card adm-resumo-num" style={{ '--cor': cor }}>
                  <span className="adm-resumo-icone"><Icon /></span>
                  <div><strong>{resumo[campo]}</strong><span>{rotulo}</span></div>
                </div>
              ))}
              <div className={`adm-card adm-resumo-it ${verItinerarios ? 'aberto' : ''}`}>
                {/* No celular a lista fica recolhida atrás deste botão */}
                <button type="button" className="adm-resumo-it-botao" onClick={() => setVerItinerarios((v) => !v)} aria-expanded={verItinerarios}>
                  Alunos por itinerário <span aria-hidden="true">{verItinerarios ? '▴' : '▾'}</span>
                </button>
                <div className="adm-resumo-it-lista">
                  {resumo.alunos_por_itinerario.map((i) => (
                    <div key={i.itinerario ?? 'nenhum'}><span>{i.itinerario ?? 'Sem itinerário'}</span><b>{i.total}</b></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <nav className="adm-abas" role="tablist">
            {ABAS.map(({ id, rotulo, Icon }) => (
              <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'ativa' : ''} onClick={() => { setAba(id); if (id !== 'alunos') setFiltroTurma(null); }}>
                <Icon /> {rotulo}
                {id === 'mensagens' && resumo?.mensagens_nao_lidas > 0 && <span className="adm-contador" style={{ background: '#16a34a', color: '#fff' }}>{resumo.mensagens_nao_lidas}</span>}
              </button>
            ))}
          </nav>

          {aba === 'alunos' && <AbaAlunos alunos={alunos} turmas={turmas} itinerarios={itinerarios} filtroTurmaInicial={filtroTurma} recarregar={recarregar} />}
          {aba === 'turmas' && <AbaTurmas turmas={turmas} recarregar={recarregar} aoVerAlunos={(id) => { setFiltroTurma(String(id)); setAba('alunos'); }} />}
          {aba === 'vagas' && <AbaVagas vagas={vagas} turmas={turmas} itinerarios={itinerarios} recarregar={recarregar} />}
          {aba === 'trilha' && <AbaTrilha itinerarios={itinerarios} turmas={turmas} />}
          {aba === 'mensagens' && <AbaMensagens alunos={alunos} aoMudou={atualizarResumo} canalInicial={canalChat} />}
        </div>
      )}
    </div>
  );
};

const ESTILOS = `
  /* Painel em tema claro (azul-gelo), diferente do app escuro do aluno.
     --adm-tinta é a cor das películas/bordas neutras, que no app eram branco translúcido. */
  .adm-raiz {
    --bg: #e6eefa;
    --surface-rgb: 248 251 255;
    --accent-soft: #1d5fd6;
    --adm-tinta: 30 64 120;
    --adm-forte: #0f1e3d;
    --adm-texto-forte: #1e2b45;
    --adm-texto: #3b4a66;
    --adm-suave: #5f6f8c;
    min-height: 100vh; background: var(--bg); color: var(--adm-texto); font-family: var(--sans); position: relative; }
  .adm-raiz .tech-bg-grid, .adm-raiz .tech-bg-scan { display: none; }
  .adm-raiz .tech-bg-glow-1 { background: radial-gradient(circle, rgb(var(--accent-rgb) / 0.22), transparent 70%); }
  .adm-raiz .tech-bg-glow-2 { background: radial-gradient(circle, rgb(var(--accent-2-rgb) / 0.2), transparent 70%); }
  .adm-raiz input[type=checkbox] { accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer; }
  .adm-raiz input[type=checkbox]:disabled { cursor: not-allowed; }
  .adm-card {
    background: rgb(var(--surface-rgb) / 0.9);
    backdrop-filter: blur(16px);
    border: 1px solid rgb(var(--accent-rgb) / 0.25);
    box-shadow: 0 4px 16px rgb(var(--adm-tinta) / 0.08);
    border-radius: 18px;
    padding: 18px;
    text-align: left;
    font-family: inherit;
  }
  .adm-card-clicavel { cursor: pointer; transition: border-color 0.2s, transform 0.2s; }
  .adm-card-clicavel:hover { border-color: rgb(var(--accent-rgb) / 0.45); transform: translateY(-2px); }
  .adm-rotulo { display: block; font-size: 11px; font-weight: 700; color: var(--adm-texto); text-transform: uppercase; letter-spacing: 0.6px; margin: 0 0 6px 2px; }
  .adm-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgb(var(--accent-rgb) / 0.32);
    background: rgb(var(--adm-tinta) / 0.07);
    color: var(--adm-forte);
    font-size: 14px;
    font-family: inherit;
    outline: none;
  }
  .adm-input:focus { border-color: rgb(var(--accent-rgb) / 0.6); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.12); }
  select.adm-input option { background: #fff; color: var(--adm-texto-forte); }
  .adm-btn {
    padding: 10px 16px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong));
    color: white;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }
  .adm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .adm-btn.secundario { background: rgb(var(--adm-tinta) / 0.08); border: 1px solid rgb(var(--adm-tinta) / 0.2); color: var(--adm-texto-forte); }
  .adm-btn.secundario:hover { border-color: rgb(var(--accent-rgb) / 0.4); }
  .adm-link { background: none; border: none; color: var(--adm-suave); cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; padding: 0; }
  .adm-link:hover { color: var(--accent-soft); }
  .adm-icone-btn { background: rgb(var(--adm-tinta) / 0.09); border: none; color: var(--adm-texto); width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .adm-erro { margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #b91c1c; font-size: 13px; display: flex; gap: 6px; align-items: center; }
  .adm-ok { margin: 0 0 12px; padding: 10px 12px; border-radius: 12px; background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.3); color: #047857; font-size: 13px; cursor: pointer; }
  .adm-resumo { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
  .adm-resumo > .adm-card { padding: 14px; }
  .adm-resumo-num { display: flex; align-items: center; gap: 14px; }
  .adm-resumo-icone { flex: 0 0 auto; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 21px; color: var(--cor); background: color-mix(in srgb, var(--cor) 10%, transparent); }
  .adm-resumo-num strong { display: block; font-size: 26px; line-height: 1.1; color: var(--adm-forte); font-weight: 800; }
  .adm-resumo-num div > span { font-size: 12px; }
  .adm-resumo-it { grid-column: 1 / -1; font-size: 12px; }
  .adm-resumo .adm-resumo-it { padding: 10px 14px; }
  .adm-resumo-it-lista { display: flex; flex-wrap: wrap; gap: 6px 22px; }
  .adm-resumo-it-lista div { display: flex; gap: 6px; }
  .adm-resumo-it-botao { display: none; width: 100%; justify-content: space-between; align-items: center; background: none; border: none; padding: 0; font-family: inherit; font-size: 13px; font-weight: 700; color: var(--adm-texto); cursor: pointer; }
  @media (max-width: 600px) {
    .adm-resumo-num { gap: 10px; }
    .adm-resumo-icone { width: 36px; height: 36px; font-size: 18px; }
    .adm-resumo-num strong { font-size: 22px; }
    .adm-resumo-it-botao { display: flex; }
    .adm-resumo-it-lista { display: none; }
    .adm-resumo-it.aberto .adm-resumo-it-lista { display: flex; flex-direction: column; margin-top: 10px; }
    .adm-resumo-it.aberto .adm-resumo-it-lista div { justify-content: space-between; }
  }
  .adm-resumo-it b { color: var(--adm-texto-forte); }
  @media (max-width: 900px) {
    .adm-resumo { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .adm-resumo > .adm-resumo-num:nth-child(5) { grid-column: 1 / -1; }
  }
  .adm-abas { display: flex; gap: 4px; border-bottom: 1px solid rgb(var(--accent-rgb) / 0.25); margin-bottom: 16px; overflow-x: auto; }
  .adm-abas button { display: flex; align-items: center; gap: 6px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--adm-texto); padding: 10px 14px; font-weight: 700; font-size: 14px; cursor: pointer; font-family: inherit; white-space: nowrap; }
  .adm-abas button.ativa { color: var(--accent-soft); border-bottom-color: var(--accent); }
  .adm-filtros { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
  .adm-sugestoes { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; list-style: none; margin: 0; padding: 6px; background: rgb(var(--surface-rgb) / 0.98); border: 1px solid rgb(var(--accent-rgb) / 0.25); border-radius: 12px; box-shadow: 0 16px 40px rgb(var(--adm-tinta) / 0.18); }
  .adm-sugestoes li { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
  .adm-sugestoes li.ativa { background: rgb(var(--accent-rgb) / 0.14); }
  .adm-mark { background: rgb(var(--accent-rgb) / 0.2); color: var(--adm-forte); border-radius: 3px; padding: 0 1px; }
  .adm-tabela-wrap { overflow-x: auto; border: 1px solid rgb(var(--accent-rgb) / 0.25); border-radius: 16px; background: rgb(var(--surface-rgb) / 0.9); }
  .adm-tabela { width: 100%; border-collapse: collapse; font-size: 13px; }
  /* No celular a tabela rola dentro do card em vez de espremer as colunas */
  @media (max-width: 700px) { .adm-tabela { min-width: 860px; } }
  .adm-tabela th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--adm-suave); padding: 10px 12px; border-bottom: 1px solid rgb(var(--accent-rgb) / 0.25); background: rgb(var(--adm-tinta) / 0.04); white-space: nowrap; }
  .adm-tabela td { padding: 10px 12px; border-bottom: 1px solid rgb(var(--adm-tinta) / 0.08); vertical-align: middle; }
  .adm-tabela tbody tr { cursor: pointer; transition: background 0.15s; }
  .adm-tabela tbody tr:hover, .adm-tabela tbody tr:focus { background: rgb(var(--accent-rgb) / 0.12); outline: none; }
  .adm-tabela tbody tr.marcada { background: rgb(var(--accent-rgb) / 0.2); }
  .adm-tabela .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .adm-tabela .mono { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .adm-vazio { color: #7a879f; font-style: italic; }
  p.adm-vazio { font-size: 13px; margin: 0 0 8px; }
  .adm-chip { display: inline-block; font-size: 11px; font-weight: 700; color: var(--adm-texto-forte); background: rgb(var(--adm-tinta) / 0.09); border: 1px solid rgb(var(--adm-tinta) / 0.16); padding: 2px 8px; border-radius: 99px; white-space: nowrap; }
  .adm-chip.pequeno { font-size: 10px; padding: 1px 6px; }
  .adm-chip.verde { color: #047857; background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.35); }
  .adm-chip.azul { color: #1d4ed8; background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.3); }
  .adm-btn.pequeno { padding: 7px 12px; font-size: 12px; border-radius: 10px; }
  .adm-a { color: var(--accent-soft); font-weight: 600; text-decoration: none; }
  .adm-a:hover { text-decoration: underline; }
  .adm-link.perigo { color: #b91c1c; }
  .adm-segmentado { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 4px; margin-bottom: 12px; border-radius: 14px; background: rgb(var(--adm-tinta) / 0.07); border: 1px solid rgb(var(--adm-tinta) / 0.12); }
  .adm-segmentado button { border: none; background: none; padding: 8px 14px; border-radius: 10px; font-family: inherit; font-size: 13px; font-weight: 700; color: var(--adm-texto); cursor: pointer; }
  .adm-segmentado button span { margin-left: 4px; font-size: 11px; padding: 1px 7px; border-radius: 99px; background: rgb(var(--adm-tinta) / 0.1); }
  .adm-segmentado button.ativo { background: rgb(var(--surface-rgb)); color: var(--accent-soft); box-shadow: 0 1px 4px rgb(var(--adm-tinta) / 0.15); }
  .adm-idade { display: flex; align-items: center; gap: 6px; flex: 0 1 auto; font-size: 12px; color: var(--adm-texto); }
  .adm-idade .adm-input { width: 68px; }
  .adm-check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--adm-texto); cursor: pointer; white-space: nowrap; }
  .adm-barra-lista { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin: 4px 2px 10px; font-size: 12px; color: var(--adm-suave); }
  .adm-gaveta.larga { max-width: 720px; }
  .adm-ficha-topo { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
  .adm-aviso { padding: 9px 12px; border-radius: 12px; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.35); color: #92400e; font-size: 12px; display: flex; gap: 6px; align-items: center; }
  /* Barra de rolagem fina e discreta quando as abas não cabem (em vez da padrão do navegador) */
  .adm-abas { scrollbar-width: thin; scrollbar-color: rgb(var(--adm-tinta) / 0.25) transparent; }
  .adm-abas::-webkit-scrollbar { height: 4px; }
  .adm-abas::-webkit-scrollbar-track { background: transparent; }
  .adm-abas::-webkit-scrollbar-thumb { background: rgb(var(--adm-tinta) / 0.25); border-radius: 99px; }
  /* Na ficha do aluno as abas quebram linha em vez de rolar de lado */
  .adm-abas-ficha { margin-bottom: 14px; flex-wrap: wrap; overflow: visible; gap: 2px 0; }
  .adm-abas-ficha button { padding: 8px 7px; font-size: 12.5px; gap: 5px; }
  .adm-contador { font-size: 10px; background: rgb(var(--accent-rgb) / 0.15); color: var(--accent-soft); border-radius: 99px; padding: 0 6px; }
  .adm-subtitulo { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--adm-suave); margin: 18px 0 8px; }
  .adm-form-secao { grid-column: 1 / -1; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--accent-soft); margin-top: 6px; padding-top: 10px; border-top: 1px solid rgb(var(--adm-tinta) / 0.1); }
  .adm-status-bloco { padding: 12px 14px; border-radius: 14px; margin-bottom: 14px; background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.22); }
  .adm-status-bloco.contratado { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.35); }
  .adm-hist-item { padding: 12px; border-radius: 12px; margin-bottom: 10px; background: rgb(var(--adm-tinta) / 0.04); border: 1px solid rgb(var(--adm-tinta) / 0.1); }
  .adm-detalhes { margin-bottom: 8px; border-radius: 12px; border: 1px solid rgb(var(--adm-tinta) / 0.12); background: rgb(var(--adm-tinta) / 0.03); font-size: 13px; }
  .adm-detalhes summary { cursor: pointer; padding: 10px 12px; color: var(--adm-texto-forte); font-weight: 600; }
  .adm-detalhes > p { margin: 0; padding: 0 12px 12px; white-space: pre-wrap; }
  .adm-entrevista-item { padding: 8px 12px 10px; border-top: 1px solid rgb(var(--adm-tinta) / 0.08); font-size: 12px; line-height: 1.5; }
  .adm-entrevista-p { color: var(--adm-suave); }
  .adm-entrevista-r { color: var(--adm-texto-forte); margin: 2px 0; }
  .adm-entrevista-f { color: #0e7490; }
  .adm-citacao { margin: 0; padding: 8px 12px; border-left: 3px solid rgb(var(--accent-rgb) / 0.4); background: rgb(var(--adm-tinta) / 0.04); font-size: 13px; white-space: pre-wrap; }
  .adm-linha-tempo { list-style: none; margin: 0; padding: 0; font-size: 13px; }
  .adm-linha-tempo li { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 6px 0; border-bottom: 1px solid rgb(var(--adm-tinta) / 0.08); }
  .adm-linha-tempo li span:last-child { margin-left: auto; font-size: 11px; color: var(--adm-suave); }
  .adm-vazio-bloco { text-align: center; padding: 28px 16px; color: var(--adm-suave); border: 1px dashed rgb(var(--adm-tinta) / 0.2); border-radius: 14px; font-size: 13px; }
        .amsg-item { width: 100%; display: flex; gap: 10px; align-items: center; padding: 11px 12px; border: none; border-bottom: 1px solid rgb(var(--adm-tinta) / 0.06); background: none; cursor: pointer; text-align: left; font-family: inherit; }
        .amsg-item:hover { background: rgb(var(--adm-tinta) / 0.04); }
        .amsg-item.ativo { background: rgb(var(--accent-rgb) / 0.1); }
        .amsg-icone { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex: 0 0 auto; }
        .amsg-icone.direto { background: rgba(29,95,214,0.12); color: #1d5fd6; }
        .amsg-icone.grupo { background: rgba(5,150,105,0.12); color: #047857; }
        .amsg-icone.geral { background: rgba(201,138,4,0.14); color: #a16207; }
        .amsg-badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 99px; background: #16a34a; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .adm-folha-wrap .cv-folha { box-shadow: 0 8px 24px rgb(var(--adm-tinta) / 0.15); padding: 28px 26px; }
  .adm-grade-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; }
  .adm-fundo { position: fixed; inset: 0; background: rgba(15,30,61,0.3); z-index: 80; display: flex; justify-content: flex-end; }
  .adm-gaveta { width: 100%; max-width: 480px; height: 100%; overflow-y: auto; background: rgb(var(--surface-rgb)); border-left: 1px solid rgb(var(--accent-rgb) / 0.35); padding: 22px 18px; }
  .adm-form-grade { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 480px) { .adm-form-grade { grid-template-columns: 1fr; } }
  .adm-ficha { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; font-size: 13px; margin: 0; }
  .adm-ficha dt { color: var(--adm-suave); font-weight: 600; }
  .adm-ficha dd { color: var(--adm-texto-forte); margin: 0; word-break: break-word; }
  .adm-ficha-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
  .adm-ficha-stats div { background: rgb(var(--adm-tinta) / 0.07); border-radius: 12px; padding: 10px; text-align: center; }
  .adm-ficha-stats strong { display: block; color: var(--adm-forte); font-size: 17px; }
  .adm-ficha-stats span { font-size: 11px; }
  .adm-vagas { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 16px; align-items: start; }
  .adm-vagas-seletor { display: none; gap: 8px; margin-bottom: 12px; }
  .adm-vagas-seletor .adm-input { flex: 1; min-width: 0; }
  @media (max-width: 860px) { .adm-vagas { grid-template-columns: 1fr; } .adm-vagas-lista { display: none; } .adm-vagas-seletor { display: flex; } }
  .adm-vaga-item { display: block; width: 100%; text-align: left; background: rgb(var(--adm-tinta) / 0.03); border: 1px solid rgb(var(--adm-tinta) / 0.08); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; font-family: inherit; }
  .adm-vaga-item.ativa { border-color: rgb(var(--accent-rgb) / 0.5); background: rgb(var(--accent-rgb) / 0.1); }
  .adm-barra-acao { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 60; width: calc(100% - 32px); max-width: 560px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 12px 14px; border-radius: 16px; background: rgb(var(--surface-rgb) / 0.97); border: 1px solid rgb(var(--accent-rgb) / 0.35); box-shadow: 0 16px 40px rgb(var(--adm-tinta) / 0.2); color: var(--adm-texto-forte); font-weight: 700; font-size: 13px; }
`;

export default AdminPanel;
