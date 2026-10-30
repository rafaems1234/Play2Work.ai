import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { IconWarning, IconCheckCircle, IconTrash, IconCsv, IconDocument, IconBook } from './icons';
import { apiFetch, lerErro, baixarArquivo } from '../api';
import Gaveta from './Gaveta';
import { dataHoraIsoParaBr } from '../utils/formatos';
import { baixarCsv, carimboArquivo } from '../utils/exportar';

// Trilha EAD no painel da escola: os professores montam módulos e aulas
// (vídeo do YouTube não listado, texto, áudio/PDF de apoio, fixação), e a
// coordenação acompanha a carga horária concluída por aluno.

const horas = (minutos) => `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
const segundosParaMmSs = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');
const mmSsParaSegundos = (texto) => {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec((texto || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// ---------------------------------------------------------------- editor de perguntas
const novaPergunta = () => ({ enunciado: '', opcoes: ['', '', '', ''], resposta_correta_index: null, explicacao: '' });

const EditorPerguntas = ({ aulaId, iniciais }) => {
  const [perguntas, setPerguntas] = useState(() => (iniciais?.length ? iniciais.map((p) => ({ ...p, explicacao: p.explicacao || '' })) : [novaPergunta()]));
  const [aviso, setAviso] = useState(null);

  const mudar = (i, campo, valor) => setPerguntas((ps) => ps.map((p, k) => (k === i ? { ...p, [campo]: valor } : p)));
  const mudarOpcao = (i, j, valor) => setPerguntas((ps) => ps.map((p, k) => (k === i ? { ...p, opcoes: p.opcoes.map((o, l) => (l === j ? valor : o)) } : p)));

  const salvar = async () => {
    setAviso(null);
    const prontas = perguntas.filter((p) => p.enunciado.trim());
    const faltaGabarito = prontas.findIndex((p) => p.resposta_correta_index == null);
    if (faltaGabarito >= 0) { setAviso({ erro: true, texto: `Pergunta ${faltaGabarito + 1}: marque a alternativa correta.` }); return; }
    const corpo = {
      perguntas: prontas.map((p) => {
        const opcoes = p.opcoes.map((o) => o.trim()).filter(Boolean);
        const correta = p.opcoes[p.resposta_correta_index]?.trim();
        return { enunciado: p.enunciado.trim(), opcoes, resposta_correta_index: opcoes.indexOf(correta), explicacao: p.explicacao.trim() || null };
      }),
    };
    if (corpo.perguntas.some((p) => p.opcoes.length < 2 || p.resposta_correta_index < 0)) {
      setAviso({ erro: true, texto: 'Cada pergunta precisa de pelo menos 2 alternativas preenchidas, e a correta não pode ficar em branco.' });
      return;
    }
    const r = await apiFetch(`/api/admin/aulas/${aulaId}/perguntas`, { method: 'PUT', body: JSON.stringify(corpo) });
    setAviso(r.ok ? { erro: false, texto: `${corpo.perguntas.length} pergunta(s) salva(s).` } : { erro: true, texto: await lerErro(r, 'Não foi possível salvar.') });
  };

  return (
    <div>
      {perguntas.map((p, i) => (
        <div key={i} className="adm-hist-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="adm-rotulo" htmlFor={`pf-${i}`} style={{ margin: 0 }}>Pergunta {i + 1}</label>
            <button type="button" className="adm-link perigo" onClick={() => setPerguntas((ps) => ps.filter((_, k) => k !== i))} aria-label={`Remover pergunta ${i + 1}`}><IconTrash /></button>
          </div>
          <textarea id={`pf-${i}`} className="adm-input" rows={2} value={p.enunciado} onChange={(e) => mudar(i, 'enunciado', e.target.value)} maxLength={1000} />
          <div style={{ display: 'grid', gap: '6px', marginTop: '8px' }}>
            {p.opcoes.map((o, j) => (
              <label key={j} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="radio" name={`correta-${i}`} checked={p.resposta_correta_index === j} onChange={() => mudar(i, 'resposta_correta_index', j)} aria-label={`Alternativa ${j + 1} é a correta`} />
                <input className="adm-input" placeholder={`Alternativa ${j + 1}${j > 1 ? ' (opcional)' : ''}`} value={o} onChange={(e) => mudarOpcao(i, j, e.target.value)} maxLength={300} />
              </label>
            ))}
          </div>
          <input className="adm-input" style={{ marginTop: '8px' }} placeholder="Explicação (aparece pro aluno depois de aprovado)" value={p.explicacao} onChange={(e) => mudar(i, 'explicacao', e.target.value)} maxLength={1000} />
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" className="adm-btn secundario pequeno" onClick={() => setPerguntas((ps) => [...ps, novaPergunta()])} disabled={perguntas.length >= 30}>+ Pergunta</button>
        <button type="button" className="adm-btn pequeno" onClick={salvar}>Salvar perguntas</button>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--adm-suave)', margin: '8px 0 0' }}>Marque o círculo ao lado da alternativa correta. O gabarito nunca vai pro aluno antes de ele ser aprovado.</p>
      {aviso && <div className={aviso.erro ? 'adm-erro' : 'adm-ok'} style={{ marginTop: '8px' }}>{aviso.erro ? <IconWarning /> : <IconCheckCircle />} {aviso.texto}</div>}
    </div>
  );
};

// ---------------------------------------------------------------- materiais
const Materiais = ({ aulaId, iniciais }) => {
  const [materiais, setMateriais] = useState(iniciais || []);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef(null);

  const enviar = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) { setErro('Arquivo grande demais (máximo 10 MB). Pra áudio, exporte em MP3 de 64 kbps.'); return; }
    setErro(null);
    setEnviando(true);
    const corpo = new FormData();
    corpo.append('arquivo', arquivo);
    const r = await apiFetch(`/api/admin/aulas/${aulaId}/materiais`, { method: 'POST', body: corpo });
    setEnviando(false);
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível enviar.')); return; }
    const novo = await r.json();
    setMateriais((ms) => [...ms, novo]);
  };

  const remover = async (id) => {
    const r = await apiFetch(`/api/admin/materiais/${id}`, { method: 'DELETE' });
    if (r.ok) setMateriais((ms) => ms.filter((m) => m.id !== id));
  };

  return (
    <div>
      {materiais.map((m) => (
        <div key={m.id} className="adm-hist-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{m.tipo === 'audio' ? '🎧' : <IconDocument />}</span>
          <button type="button" className="adm-link" style={{ fontSize: '13px', color: 'var(--adm-texto-forte)' }} onClick={() => baixarArquivo(`/api/admin/materiais/${m.id}`, m.nome_arquivo)}>{m.nome_arquivo}</button>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--adm-suave)' }}>{Math.max(1, Math.round(m.tamanho_bytes / 1024))} KB</span>
          <button type="button" className="adm-link perigo" onClick={() => remover(m.id)} aria-label={`Remover ${m.nome_arquivo}`}><IconTrash /></button>
        </div>
      ))}
      <input ref={entrada} type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,application/pdf,.mp3,.m4a,.ogg,.pdf" onChange={enviar} hidden />
      <button type="button" className="adm-btn secundario pequeno" onClick={() => entrada.current?.click()} disabled={enviando}>{enviando ? 'Enviando...' : '+ Enviar áudio ou PDF'}</button>
      <p style={{ fontSize: '11px', color: 'var(--adm-suave)', margin: '8px 0 0' }}>Até 10 MB: áudio em MP3/M4A/OGG ou PDF. Slides: exporte como PDF.</p>
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
    </div>
  );
};

// ---------------------------------------------------------------- editor de aula
const EditorAula = ({ moduloId, aulaId, aoSalvar }) => {
  const [id, setId] = useState(aulaId);
  const [completa, setCompleta] = useState(null);
  const [campos, setCampos] = useState({ titulo: '', descricao: '', link_video: '', duracao: '', texto: '', carga_horaria_minutos: '30', percentual_minimo_assistido: '80', nota_minima: '70', publicada: false });
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (!aulaId) return;
    apiFetch(`/api/admin/aulas/${aulaId}`).then(async (r) => {
      if (!r.ok) return;
      const a = await r.json();
      setCompleta(a);
      setCampos({
        titulo: a.titulo, descricao: a.descricao || '',
        link_video: a.video_provedor === 'youtube' ? `https://youtu.be/${a.video_id}` : a.video_provedor === 'vimeo' ? `https://vimeo.com/${a.video_id}` : '',
        duracao: segundosParaMmSs(a.duracao_segundos), texto: a.texto || '',
        carga_horaria_minutos: String(a.carga_horaria_minutos), percentual_minimo_assistido: String(a.percentual_minimo_assistido),
        nota_minima: String(a.nota_minima), publicada: a.publicada,
      });
    });
  }, [aulaId]);

  const mudar = (campo) => (e) => setCampos((c) => ({ ...c, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const salvar = async (e) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    const duracao = mmSsParaSegundos(campos.duracao);
    if (!duracao || duracao < 30) { setErro('Duração inválida: use minutos:segundos, ex 12:30 (mínimo 0:30).'); return; }
    const corpo = {
      titulo: campos.titulo.trim(), descricao: campos.descricao.trim() || null, link_video: campos.link_video.trim() || null,
      duracao_segundos: duracao, texto: campos.texto.trim() || null, carga_horaria_minutos: Number(campos.carga_horaria_minutos),
      percentual_minimo_assistido: Number(campos.percentual_minimo_assistido), nota_minima: Number(campos.nota_minima), publicada: campos.publicada,
    };
    const r = id
      ? await apiFetch(`/api/admin/aulas/${id}`, { method: 'PUT', body: JSON.stringify(corpo) })
      : await apiFetch(`/api/admin/modulos/${moduloId}/aulas`, { method: 'POST', body: JSON.stringify(corpo) });
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível salvar a aula.')); return; }
    const salva = await r.json();
    if (!id) { setId(salva.id); setCompleta({ ...salva, perguntas: [], materiais: [] }); }
    setAviso(id ? 'Aula salva.' : 'Aula criada. Agora cadastre a fixação e os materiais abaixo.');
    aoSalvar();
  };

  return (
    <div>
      <form onSubmit={salvar}>
        <div className="adm-form-grade">
          <div style={{ gridColumn: '1 / -1' }}><label className="adm-rotulo" htmlFor="au-t">Título</label><input id="au-t" className="adm-input" value={campos.titulo} onChange={mudar('titulo')} required minLength={2} maxLength={150} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label className="adm-rotulo" htmlFor="au-d">Descrição curta</label><input id="au-d" className="adm-input" value={campos.descricao} onChange={mudar('descricao')} maxLength={2000} /></div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="adm-rotulo" htmlFor="au-v">Link do vídeo (YouTube não listado)</label>
            <input id="au-v" className="adm-input" placeholder="https://youtu.be/... (deixe vazio pra aula só de leitura)" value={campos.link_video} onChange={mudar('link_video')} maxLength={300} />
          </div>
          <div><label className="adm-rotulo" htmlFor="au-du">{campos.link_video.trim() ? 'Duração do vídeo' : 'Tempo de estudo'} (min:seg)</label><input id="au-du" className="adm-input" placeholder="12:30" value={campos.duracao} onChange={mudar('duracao')} required /></div>
          <div><label className="adm-rotulo" htmlFor="au-ch">Carga horária (minutos)</label><input id="au-ch" type="number" min={1} max={600} className="adm-input" value={campos.carga_horaria_minutos} onChange={mudar('carga_horaria_minutos')} required /></div>
          <div><label className="adm-rotulo" htmlFor="au-pm">Frequência mínima (%)</label><input id="au-pm" type="number" min={0} max={100} className="adm-input" value={campos.percentual_minimo_assistido} onChange={mudar('percentual_minimo_assistido')} required /></div>
          <div><label className="adm-rotulo" htmlFor="au-nm">Nota de corte da fixação</label><input id="au-nm" type="number" min={0} max={100} className="adm-input" value={campos.nota_minima} onChange={mudar('nota_minima')} required /></div>
          <div style={{ gridColumn: '1 / -1' }}><label className="adm-rotulo" htmlFor="au-tx">Texto da aula</label><textarea id="au-tx" className="adm-input" rows={6} value={campos.texto} onChange={mudar('texto')} maxLength={50000} /></div>
          <label className="adm-check" style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={campos.publicada} onChange={mudar('publicada')} /> Publicada (os alunos já veem)</label>
        </div>
        {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
        {aviso && <div className="adm-ok" style={{ marginTop: '10px' }}><IconCheckCircle /> {aviso}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}><button type="submit" className="adm-btn">{id ? 'Salvar aula' : 'Criar aula'}</button></div>
      </form>

      {id && completa && (
        <>
          <h3 className="adm-subtitulo">Atividade de fixação</h3>
          <EditorPerguntas key={`p-${id}`} aulaId={id} iniciais={completa.perguntas} />
          <h3 className="adm-subtitulo">Material de apoio</h3>
          <Materiais key={`m-${id}`} aulaId={id} iniciais={completa.materiais} />
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- conteúdo
const Conteudo = ({ itinerarios, trilha, recarregar }) => {
  const [novo, setNovo] = useState({ titulo: '', itinerario: '' });
  const [erro, setErro] = useState(null);
  const [editando, setEditando] = useState(null); // { moduloId, aulaId }

  const criarModulo = async (e) => {
    e.preventDefault();
    setErro(null);
    const r = await apiFetch('/api/admin/modulos', { method: 'POST', body: JSON.stringify({ titulo: novo.titulo.trim(), itinerario: novo.itinerario || null, ordem: trilha.length }) });
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível criar o módulo.')); return; }
    setNovo({ titulo: '', itinerario: '' });
    recarregar();
  };

  const alternarPublicado = async (m) => {
    await apiFetch(`/api/admin/modulos/${m.id}`, { method: 'PUT', body: JSON.stringify({ publicado: !m.publicado }) });
    recarregar();
  };

  return (
    <div>
      <form onSubmit={criarModulo} className="adm-filtros">
        <input className="adm-input" placeholder="Novo módulo (ex: Integração ao Programa de Aprendizagem)" value={novo.titulo} onChange={(e) => setNovo((n) => ({ ...n, titulo: e.target.value }))} required minLength={2} style={{ flex: '2 1 260px' }} />
        <select className="adm-input" value={novo.itinerario} onChange={(e) => setNovo((n) => ({ ...n, itinerario: e.target.value }))} style={{ flex: '1 1 200px' }} aria-label="Itinerário do módulo">
          <option value="">Todos os itinerários</option>
          {itinerarios.map((it) => <option key={it} value={it}>{it}</option>)}
        </select>
        <button type="submit" className="adm-btn">+ Criar módulo</button>
      </form>
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
      {trilha.length === 0 && <div className="adm-vazio-bloco"><IconBook style={{ fontSize: '24px' }} /><p>Nenhum módulo ainda. Comece criando o da integração.</p></div>}

      {trilha.map((m) => (
        <div key={m.id} className="adm-card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800, color: 'var(--adm-forte)', fontSize: '16px' }}>{m.titulo}</div>
              <div style={{ fontSize: '12px', color: 'var(--adm-suave)' }}>{m.itinerario || 'Todos os itinerários'} · {m.aulas.length} aula{m.aulas.length !== 1 ? 's' : ''} · {horas(m.carga_horaria_minutos)} de carga horária</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={`adm-chip ${m.publicado ? 'verde' : ''}`}>{m.publicado ? 'Publicado' : 'Rascunho'}</span>
              <button type="button" className="adm-btn secundario pequeno" onClick={() => alternarPublicado(m)}>{m.publicado ? 'Despublicar' : 'Publicar'}</button>
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'grid', gap: '6px' }}>
            {m.aulas.map((a, i) => (
              <button key={a.id} type="button" className="adm-vaga-item" style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: 0 }} onClick={() => setEditando({ moduloId: m.id, aulaId: a.id })}>
                <strong style={{ color: 'var(--adm-suave)', width: '18px' }}>{i + 1}</strong>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, color: 'var(--adm-texto-forte)', fontSize: '13px' }}>{a.titulo}</span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--adm-suave)' }}>
                    {a.video_provedor ? 'Vídeo' : 'Leitura'} · {segundosParaMmSs(a.duracao_segundos)} · {a.carga_horaria_minutos} min · {a.total_perguntas} pergunta{a.total_perguntas !== 1 ? 's' : ''} · {a.total_materiais} material{a.total_materiais !== 1 ? 'is' : ''}
                  </span>
                </span>
                {a.total_perguntas === 0 && <span className="adm-chip" title="Sem fixação o aluno não consegue concluir">sem fixação</span>}
                <span className={`adm-chip ${a.publicada ? 'verde' : ''}`}>{a.publicada ? 'Publicada' : 'Rascunho'}</span>
              </button>
            ))}
          </div>
          <button type="button" className="adm-btn secundario pequeno" style={{ marginTop: '10px' }} onClick={() => setEditando({ moduloId: m.id, aulaId: null })}>+ Nova aula</button>
        </div>
      ))}

      <AnimatePresence>
        {editando && (
          <Gaveta titulo={editando.aulaId ? 'Editar aula' : 'Nova aula'} aoFechar={() => setEditando(null)} larga>
            <EditorAula moduloId={editando.moduloId} aulaId={editando.aulaId} aoSalvar={recarregar} />
          </Gaveta>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------- relatório de carga horária
const COLUNAS_RELATORIO = [
  ['Aluno', (l) => l.nome],
  ['CPF', (l) => l.cpf || ''],
  ['Turma', (l) => l.turma || ''],
  ['Itinerário', (l) => l.itinerario || ''],
  ['Aulas concluídas', (l) => l.aulas_concluidas],
  ['Aulas previstas', (l) => l.aulas_previstas],
  ['Carga concluída (min)', (l) => l.carga_concluida_minutos],
  ['Carga prevista (min)', (l) => l.carga_prevista_minutos],
  ['Módulos concluídos', (l) => l.modulos_concluidos.map((m) => m.modulo).join(' | ')],
  ['Certificados enviados', (l) => l.total_certificados],
];

const Relatorio = ({ turmas, trilha }) => {
  const [turmaId, setTurmaId] = useState('');
  const [moduloId, setModuloId] = useState('');
  const [dados, setDados] = useState(null);
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(async () => {
    const params = new URLSearchParams();
    if (turmaId) params.set('turma_id', turmaId);
    if (moduloId) params.set('modulo_id', moduloId);
    const r = await apiFetch(`/api/admin/relatorios/frequencia?${params}`);
    if (r.ok) setDados(await r.json());
  }, [turmaId, moduloId]);

  useEffect(() => { carregar(); }, [carregar]);

  const linhas = dados?.alunos || [];
  const faltaCertificado = linhas.filter((l) => l.modulos_concluidos.some((m) => !m.tem_certificado));
  return (
    <div>
      <div className="adm-filtros">
        <select className="adm-input" value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={{ flex: '1 1 160px' }} aria-label="Turma">
          <option value="">Todas as turmas</option>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select className="adm-input" value={moduloId} onChange={(e) => setModuloId(e.target.value)} style={{ flex: '2 1 240px' }} aria-label="Módulo">
          <option value="">Todos os módulos publicados</option>
          {trilha.filter((m) => m.publicado).map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
        </select>
        <button type="button" className="adm-btn secundario pequeno" disabled={!linhas.length} onClick={() => baixarCsv(`carga_horaria_${carimboArquivo()}.csv`, linhas, COLUNAS_RELATORIO)}>
          <IconCsv style={{ verticalAlign: '-2px' }} /> Exportar CSV
        </button>
      </div>
      {faltaCertificado.length > 0 && (
        <div className="adm-aviso" style={{ marginBottom: '12px' }}>
          <IconWarning /> {faltaCertificado.length} aluno{faltaCertificado.length > 1 ? 's' : ''} {faltaCertificado.length > 1 ? 'concluíram' : 'concluiu'} um módulo e ainda {faltaCertificado.length > 1 ? 'estão' : 'está'} sem certificado: {faltaCertificado.slice(0, 3).map((l) => l.nome).join(', ')}{faltaCertificado.length > 3 ? '…' : ''}. Envie pela ficha do aluno (aba Certificados).
        </div>
      )}
      <div className="adm-tabela-wrap">
        <table className="adm-tabela">
          <thead><tr><th>Aluno</th><th>Turma</th><th className="num">Aulas</th><th className="num">Carga horária</th><th>Módulos concluídos</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <React.Fragment key={l.estudante_id}>
                <tr onClick={() => setAberto(aberto === l.estudante_id ? null : l.estudante_id)}>
                  <td style={{ fontWeight: 700, color: 'var(--adm-texto-forte)' }}>{l.nome}</td>
                  <td>{l.turma || <span className="adm-vazio">—</span>}</td>
                  <td className="num">{l.aulas_concluidas} / {l.aulas_previstas}</td>
                  <td className="num">{horas(l.carga_concluida_minutos)} / {horas(l.carga_prevista_minutos)}</td>
                  <td>
                    {l.modulos_concluidos.length === 0 ? <span className="adm-vazio">—</span> : l.modulos_concluidos.map((m) => (
                      <span key={m.modulo_id} className={`adm-chip ${m.tem_certificado ? 'verde' : ''}`} style={{ marginRight: '4px' }}>{m.modulo}{m.tem_certificado ? ' · certificado' : ' · sem certificado'}</span>
                    ))}
                  </td>
                </tr>
                {aberto === l.estudante_id && (
                  <tr><td colSpan={5} style={{ background: 'rgb(var(--adm-tinta) / 0.03)' }}>
                    <table className="adm-tabela" style={{ background: 'transparent' }}>
                      <thead><tr><th>Aula</th><th className="num">Assistido</th><th className="num">Melhor nota</th><th className="num">Tentativas</th><th>Concluída em</th></tr></thead>
                      <tbody>
                        {l.aulas.map((a) => (
                          <tr key={a.aula_id} style={{ cursor: 'default' }}>
                            <td>{a.aula}<div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{a.modulo}</div></td>
                            <td className="num">{a.percentual_assistido}%</td>
                            <td className="num">{a.melhor_nota ?? '—'}{a.melhor_nota != null && <span style={{ color: 'var(--adm-suave)' }}> / corte {a.nota_minima}</span>}</td>
                            <td className="num">{a.tentativas}</td>
                            <td>{a.concluida_em ? dataHoraIsoParaBr(a.concluida_em) : <span className="adm-vazio">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
            {dados && linhas.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--adm-suave)', padding: '28px' }}>Nenhum aluno com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--adm-suave)', margin: '10px 2px' }}>
        Clique num aluno pra ver aula por aula. A aula só conta como concluída com a frequência mínima assistida (sem adiantar nem acelerar) e a nota de corte na fixação; o registro completo de cada acesso fica na ficha do aluno (aba Certificados).
      </p>
    </div>
  );
};

// ---------------------------------------------------------------- aba
const AbaTrilha = ({ itinerarios, turmas }) => {
  const [secao, setSecao] = useState('conteudo');
  const [trilha, setTrilha] = useState([]);

  const recarregar = useCallback(async () => {
    const r = await apiFetch('/api/admin/trilha');
    if (r.ok) setTrilha(await r.json());
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);

  return (
    <div>
      <div className="adm-segmentado" role="group" aria-label="Seção da trilha">
        <button className={secao === 'conteudo' ? 'ativo' : ''} onClick={() => setSecao('conteudo')} aria-pressed={secao === 'conteudo'}>Módulos e aulas</button>
        <button className={secao === 'relatorio' ? 'ativo' : ''} onClick={() => setSecao('relatorio')} aria-pressed={secao === 'relatorio'}>Relatório de carga horária</button>
      </div>
      {secao === 'conteudo'
        ? <Conteudo itinerarios={itinerarios} trilha={trilha} recarregar={recarregar} />
        : <Relatorio turmas={turmas} trilha={trilha} />}
    </div>
  );
};

export default AbaTrilha;
