import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import TechBackground from './TechBackground';
import { IconWarning, IconClose, IconTrophy, IconBriefcase, IconGraduationCap, IconMask, IconCheck, IconCheckCircle, IconPencil, IconLock, IconFire, IconMedal, IconBook, IconTarget } from './icons';
import { apiFetch, salvarToken, limparToken, obterToken, aoExpirarSessao, DEMO_MODE } from '../api';
import { mascararCpf, mascararData, dataBrParaIso, dataIsoParaBr, cpfValido, normalizarBusca, somenteDigitos } from '../utils/formatos';

// Painel da escola: cadastro e gestão dos alunos (CPF, nascimento, e-mail,
// turma, itinerário), turmas, vagas das empresas parceiras e a seleção dos
// alunos com melhor desempenho pra indicar a cada vaga.

const ROTULOS_DESEMPENHO = {
  habilidades: 'Habilidades',
  itinerario: 'Itinerário',
  quiz: 'Quiz',
  engajamento: 'XP',
  constancia: 'Ofensiva',
};

const corDaNota = (nota) => {
  if (nota >= 75) return '#059669';
  if (nota >= 55) return '#2563eb';
  if (nota >= 35) return '#c98a04';
  return '#dc2626';
};

const lerErro = async (resposta, padrao) => {
  try {
    const dados = await resposta.json();
    if (typeof dados.detail === 'string') return dados.detail;
    if (Array.isArray(dados.detail)) return 'Confira os campos preenchidos.';
  } catch {
    // resposta sem JSON
  }
  return padrao;
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

// ------------------------------------------------------------------ formulário de aluno (cadastro e edição)
const FormAluno = ({ inicial, turmas, itinerarios, aoSalvar, aoCancelar }) => {
  const [campos, setCampos] = useState(() => ({
    nome: inicial?.nome || '',
    cpf: mascararCpf(inicial?.cpf || ''),
    nascimento: dataIsoParaBr(inicial?.data_nascimento),
    email: inicial?.email || '',
    turma_id: inicial?.turma_id ?? '',
    itinerario: inicial?.itinerario || '',
    habilidades: (inicial?.habilidades || []).join(', '),
  }));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const mudar = (campo) => (e) => setCampos((c) => ({ ...c, [campo]: e.target.value }));

  const cpfOk = cpfValido(campos.cpf);
  const dataIso = dataBrParaIso(campos.nascimento);

  const salvar = async (e) => {
    e.preventDefault();
    if (!cpfOk) { setErro('CPF inválido — confira os números.'); return; }
    if (campos.nascimento && !dataIso) { setErro('Data de nascimento inválida (use dd/mm/aaaa).'); return; }
    setSalvando(true);
    setErro(null);
    const erroServidor = await aoSalvar({
      nome: campos.nome.trim(),
      cpf: somenteDigitos(campos.cpf),
      ...(dataIso ? { data_nascimento: dataIso } : {}),
      email: campos.email.trim(),
      turma_id: campos.turma_id === '' ? null : Number(campos.turma_id),
      itinerario: campos.itinerario || null,
      habilidades: campos.habilidades.split(',').map((h) => h.trim()).filter(Boolean),
    });
    setSalvando(false);
    if (erroServidor) setErro(erroServidor);
  };

  return (
    <form onSubmit={salvar}>
      <div className="adm-form-grade">
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="adm-rotulo" htmlFor="fa-nome">Nome completo</label>
          <input id="fa-nome" className="adm-input" value={campos.nome} onChange={mudar('nome')} required minLength={2} />
        </div>
        <div>
          <label className="adm-rotulo" htmlFor="fa-cpf">CPF {campos.cpf.length === 14 && (cpfOk ? <IconCheck style={{ color: '#059669', verticalAlign: '-2px' }} /> : <span style={{ color: '#dc2626' }}>inválido</span>)}</label>
          <input id="fa-cpf" className="adm-input" inputMode="numeric" placeholder="000.000.000-00" value={campos.cpf} onChange={(e) => setCampos((c) => ({ ...c, cpf: mascararCpf(e.target.value) }))} required />
        </div>
        <div>
          <label className="adm-rotulo" htmlFor="fa-nasc">Nascimento (opcional)</label>
          <input id="fa-nasc" className="adm-input" inputMode="numeric" placeholder="dd/mm/aaaa" value={campos.nascimento} onChange={(e) => setCampos((c) => ({ ...c, nascimento: mascararData(e.target.value) }))} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="adm-rotulo" htmlFor="fa-email">E-mail</label>
          <input id="fa-email" type="email" className="adm-input" value={campos.email} onChange={mudar('email')} required />
        </div>
        <div>
          <label className="adm-rotulo" htmlFor="fa-turma">Turma</label>
          <select id="fa-turma" className="adm-input" value={campos.turma_id} onChange={mudar('turma_id')}>
            <option value="">Sem turma</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.turno ? ` · ${t.turno}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="adm-rotulo" htmlFor="fa-it">Itinerário</label>
          <select id="fa-it" className="adm-input" value={campos.itinerario} onChange={mudar('itinerario')}>
            <option value="">Não definido</option>
            {itinerarios.map((it) => <option key={it} value={it}>{it}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="adm-rotulo" htmlFor="fa-hab">Habilidades (separadas por vírgula)</label>
          <input id="fa-hab" className="adm-input" placeholder="Python, Comunicação, Pacote Office" value={campos.habilidades} onChange={mudar('habilidades')} />
        </div>
      </div>
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
      <div style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="adm-btn secundario" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="adm-btn" disabled={salvando}>{salvando ? 'Salvando...' : inicial ? 'Salvar alterações' : 'Cadastrar aluno'}</button>
      </div>
    </form>
  );
};

// Painel lateral/modal genérico
const Gaveta = ({ titulo, aoFechar, children }) => (
  <motion.div className="adm-fundo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={aoFechar}>
    <motion.div
      className="adm-gaveta"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.22 }}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={titulo}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--adm-forte)' }}>{titulo}</h2>
        <button className="adm-icone-btn" onClick={aoFechar} aria-label="Fechar"><IconClose /></button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

const FichaAluno = ({ aluno, turmas, itinerarios, aoSalvar }) => {
  const [editando, setEditando] = useState(false);
  // Ficha abre só pra leitura; editar exige destravar e confirmar em "Salvar",
  // pra ninguém mudar o cadastro de um aluno sem querer enquanto consulta.
  if (editando) {
    return (
      <>
        <div className="adm-ok" style={{ cursor: 'default', background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.3)', color: '#92400e' }}>
          <IconPencil style={{ verticalAlign: '-2px' }} /> Modo de edição. Nada é gravado até você clicar em "Salvar alterações".
        </div>
        <FormAluno
        inicial={aluno}
        turmas={turmas}
        itinerarios={itinerarios}
        aoCancelar={() => setEditando(false)}
        aoSalvar={async (dados) => {
          const erro = await aoSalvar(dados);
          if (!erro) setEditando(false);
          return erro;
        }}
      />
      </>
    );
  }
  const linhas = [
    ['No ranking', aluno.nome_exibicao],
    ['CPF (senha)', mascararCpf(aluno.cpf || '') || '—'],
    ['Nascimento', dataIsoParaBr(aluno.data_nascimento) || '—'],
    ['E-mail', aluno.email],
    ['Turma', aluno.turma || 'Sem turma'],
    ['Itinerário', aluno.itinerario || 'Não definido'],
    ['Habilidades', aluno.habilidades.length ? aluno.habilidades.join(', ') : '—'],
  ];
  return (
    <div>
      <div className="adm-ficha-stats">
        <div><strong>{aluno.xp_total}</strong><span>XP</span></div>
        <div><strong>{aluno.nivel}</strong><span>nível</span></div>
        <div><strong>{aluno.taxa_acerto_quiz ?? '—'}{aluno.taxa_acerto_quiz != null && '%'}</strong><span>acerto no quiz</span></div>
        <div><strong>{aluno.ofensiva_dias} <IconFire style={{ color: '#f97316', verticalAlign: '-2px' }} /></strong><span>ofensiva</span></div>
        <div><strong>{aluno.liga}</strong><span>liga</span></div>
        <div><strong>{aluno.total_indicacoes}</strong><span>indicações</span></div>
      </div>
      <dl className="adm-ficha">
        {linhas.map(([rotulo, valor]) => (
          <React.Fragment key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p style={{ fontSize: '12px', color: 'var(--adm-suave)', margin: '14px 0' }}>
        A senha do aluno é o CPF acima. Se ele não conseguir entrar, confira o CPF cadastrado.
      </p>
      <button className="adm-btn secundario" onClick={() => setEditando(true)}><IconLock style={{ verticalAlign: '-2px' }} /> Habilitar edição</button>
    </div>
  );
};

// ------------------------------------------------------------------ aba Alunos
const AbaAlunos = ({ alunos, turmas, itinerarios, filtroTurmaInicial, recarregar }) => {
  const [busca, setBusca] = useState('');
  const [turmaId, setTurmaId] = useState(filtroTurmaInicial ?? '');
  const [itinerario, setItinerario] = useState('');
  const [cadastrando, setCadastrando] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => { setTurmaId(filtroTurmaInicial ?? ''); }, [filtroTurmaInicial]);

  // Filtro instantâneo, a cada letra digitada
  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    const digitos = somenteDigitos(busca);
    return alunos.filter((a) => {
      if (turmaId !== '' && String(a.turma_id ?? '') !== String(turmaId)) return false;
      if (itinerario && (itinerario === '__nenhum' ? a.itinerario : a.itinerario !== itinerario)) return false;
      if (!termo) return true;
      return normalizarBusca(a.nome).includes(termo)
        || normalizarBusca(a.nome_exibicao).includes(termo)
        || normalizarBusca(a.email).includes(termo)
        || (digitos.length >= 3 && (a.cpf || '').includes(digitos));
    });
  }, [alunos, busca, turmaId, itinerario]);

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

  const limparFiltros = () => { setBusca(''); setTurmaId(''); setItinerario(''); };
  const temFiltro = busca || turmaId !== '' || itinerario;

  return (
    <div>
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
        <button className="adm-btn" onClick={() => setCadastrando(true)} style={{ flex: '0 0 auto' }}>+ Cadastrar aluno</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 2px 10px', fontSize: '12px', color: 'var(--adm-suave)' }}>
        <span>{filtrados.length} de {alunos.length} aluno{alunos.length !== 1 ? 's' : ''}</span>
        {temFiltro && <button className="adm-link" onClick={limparFiltros}>Limpar filtros</button>}
      </div>

      {aviso && <div className="adm-ok" onClick={() => setAviso(null)}><IconCheckCircle style={{ verticalAlign: '-2px' }} /> {aviso}</div>}

      <div className="adm-tabela-wrap">
        <table className="adm-tabela">
          <thead>
            <tr>
              <th>Aluno</th><th>CPF</th><th>Turma</th><th>Itinerário</th><th className="num">XP</th><th className="num">Quiz</th><th className="num">Ofensiva</th><th className="num">Indicações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => (
              <tr key={a.id} onClick={() => setSelecionadoId(a.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelecionadoId(a.id)}>
                <td><div style={{ fontWeight: 700, color: 'var(--adm-texto-forte)' }}>{a.nome}</div><div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>no ranking: <span style={{ color: 'var(--accent-soft)' }}>{a.nome_exibicao}</span> · {a.email}</div></td>
                <td className="mono">{mascararCpf(a.cpf || '') || '—'}</td>
                <td>{a.turma || <span className="adm-vazio">—</span>}</td>
                <td>{a.itinerario || <span className="adm-vazio">não definido</span>}</td>
                <td className="num">{a.xp_total}</td>
                <td className="num">{a.taxa_acerto_quiz != null ? `${a.taxa_acerto_quiz}%` : '—'}</td>
                <td className="num">{a.ofensiva_dias}</td>
                <td className="num">{a.total_indicacoes || <span className="adm-vazio">—</span>}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--adm-suave)', padding: '28px' }}>Nenhum aluno com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {cadastrando && (
          <Gaveta titulo="Cadastrar aluno" aoFechar={() => setCadastrando(false)}>
            <FormAluno turmas={turmas} itinerarios={itinerarios} aoSalvar={cadastrar} aoCancelar={() => setCadastrando(false)} />
          </Gaveta>
        )}
        {selecionado && (
          <Gaveta titulo={selecionado.nome} aoFechar={() => setSelecionadoId(null)}>
            <FichaAluno key={selecionado.id} aluno={selecionado} turmas={turmas} itinerarios={itinerarios} aoSalvar={atualizar} />
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
          Nota de 0 a 100: habilidades exigidas pela vaga (até 35), itinerário igual ao da vaga (20), acerto no quiz (25), XP comparado ao melhor aluno (15) e ofensiva (5).
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
];

// Cartões do topo: tons fechados e dessaturados, pra dar identidade sem virar arco-íris
const CARTOES_RESUMO = [
  { campo: 'total_alunos', rotulo: 'alunos', Icon: IconGraduationCap, cor: '#2f5fb3' },
  { campo: 'total_turmas', rotulo: 'turmas', Icon: IconBook, cor: '#5a5f9e' },
  { campo: 'total_vagas', rotulo: 'vagas', Icon: IconBriefcase, cor: '#2c7a7b' },
  { campo: 'total_indicacoes', rotulo: 'indicações', Icon: IconTarget, cor: '#a16a1f' },
];

const AdminPanel = ({ aoSair }) => {
  const [logado, setLogado] = useState(() => Boolean(obterToken('admin')));
  const [aba, setAba] = useState('alunos');
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
            <div style={{ display: 'flex', gap: '8px' }}>
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
              </button>
            ))}
          </nav>

          {aba === 'alunos' && <AbaAlunos alunos={alunos} turmas={turmas} itinerarios={itinerarios} filtroTurmaInicial={filtroTurma} recarregar={recarregar} />}
          {aba === 'turmas' && <AbaTurmas turmas={turmas} recarregar={recarregar} aoVerAlunos={(id) => { setFiltroTurma(String(id)); setAba('alunos'); }} />}
          {aba === 'vagas' && <AbaVagas vagas={vagas} turmas={turmas} itinerarios={itinerarios} recarregar={recarregar} />}
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
  .adm-resumo { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
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
  @media (max-width: 700px) { .adm-tabela { min-width: 720px; } }
  .adm-tabela th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--adm-suave); padding: 10px 12px; border-bottom: 1px solid rgb(var(--accent-rgb) / 0.25); background: rgb(var(--adm-tinta) / 0.04); white-space: nowrap; }
  .adm-tabela td { padding: 10px 12px; border-bottom: 1px solid rgb(var(--adm-tinta) / 0.08); vertical-align: middle; }
  .adm-tabela tbody tr { cursor: pointer; transition: background 0.15s; }
  .adm-tabela tbody tr:hover, .adm-tabela tbody tr:focus { background: rgb(var(--accent-rgb) / 0.12); outline: none; }
  .adm-tabela tbody tr.marcada { background: rgb(var(--accent-rgb) / 0.2); }
  .adm-tabela .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .adm-tabela .mono { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .adm-vazio { color: #7a879f; font-style: italic; }
  .adm-chip { display: inline-block; font-size: 11px; font-weight: 700; color: var(--adm-texto-forte); background: rgb(var(--adm-tinta) / 0.09); border: 1px solid rgb(var(--adm-tinta) / 0.16); padding: 2px 8px; border-radius: 99px; white-space: nowrap; }
  .adm-chip.pequeno { font-size: 10px; padding: 1px 6px; }
  .adm-chip.verde { color: #047857; background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.35); }
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
