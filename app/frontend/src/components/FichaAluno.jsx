import React, { useCallback, useEffect, useState } from 'react';
import { IconWarning, IconCheck, IconPencil, IconLock, IconFire, IconPdf, IconTrash, IconHandshake, IconDocument, IconHistory, IconNote, IconUser, IconTarget, IconStar } from './icons';
import { apiFetch, lerErro, urlDeArquivo } from '../api';
import { Avatar, SeletorFoto } from './FotoPerfil';
import { FolhaCurriculo, ESTILOS_FOLHA, Imprimir } from './FolhaCurriculo';
import MapaCompetencias from './MapaCompetencias';
import AbaPap from './FichaPap';
import FICHA from '../data/ficha_pap.json';
import RetiradaCertificado, { ChipCertificado } from './RetiradaCertificado';
import {
  mascararCpf, mascararData, mascararTelefone, dataBrParaIso, dataIsoParaBr, dataHoraIsoParaBr,
  cpfValido, telefoneValido, somenteDigitos, linkWhatsapp, hojeLocalIso,
} from '../utils/formatos';

// Ficha do aluno no painel da escola: dados e contato, status de contratação,
// currículo sincronizado, histórico (entrevistas, indicações, retorno das
// empresas) e observações internas da coordenação/PAP.

// Status do aprendiz como na planilha do PAP (rótulos de data/ficha_pap.json)
export const STATUS_CONTRATACAO = {
  disponivel: { rotulo: FICHA.status_aprendiz.disponivel, descricao: 'Na fila de espera por uma vaga', cor: 'azul' },
  contratado: { rotulo: FICHA.status_aprendiz.contratado, descricao: 'Já está trabalhando', cor: 'verde' },
  desistencia: { rotulo: FICHA.status_aprendiz.desistencia, descricao: 'Desistiu do programa', cor: '' },
  expirado: { rotulo: FICHA.status_aprendiz.expirado, descricao: 'Prazo do programa expirado', cor: '' },
};

const STATUS_CANDIDATURA = { enviada: 'Enviada', em_analise: 'Em análise', aprovada: 'Aprovada', recusada: 'Recusada' };

export const fotoDoAluno = (id) => `/api/admin/estudantes/${id}/foto`;

export const ChipStatus = ({ status }) => {
  const info = STATUS_CONTRATACAO[status] || STATUS_CONTRATACAO.disponivel;
  return <span className={`adm-chip ${info.cor}`}>{info.rotulo}</span>;
};

// ------------------------------------------------------------------ formulário (cadastro e edição)
export const FormAluno = ({ inicial, turmas, itinerarios, aoSalvar, aoCancelar }) => {
  const [campos, setCampos] = useState(() => ({
    nome: inicial?.nome || '',
    cpf: mascararCpf(inicial?.cpf || ''),
    nascimento: dataIsoParaBr(inicial?.data_nascimento),
    email: inicial?.email || '',
    telefone: mascararTelefone(inicial?.telefone || ''),
    responsavel_nome: inicial?.responsavel_nome || '',
    responsavel_telefone: mascararTelefone(inicial?.responsavel_telefone || ''),
    turma_id: inicial?.turma_id ?? '',
    itinerario: inicial?.itinerario || '',
    habilidades: (inicial?.habilidades || []).join(', '),
    ja_trabalhou: inicial?.ja_trabalhou == null ? '' : String(inicial.ja_trabalhou),
    experiencia_previa: inicial?.experiencia_previa || '',
  }));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const mudar = (campo) => (e) => setCampos((c) => ({ ...c, [campo]: e.target.value }));
  const mudarTelefone = (campo) => (e) => setCampos((c) => ({ ...c, [campo]: mascararTelefone(e.target.value) }));

  const cpfOk = cpfValido(campos.cpf);
  const dataIso = dataBrParaIso(campos.nascimento);

  const salvar = async (e) => {
    e.preventDefault();
    if (!cpfOk) { setErro('CPF inválido — confira os números.'); return; }
    if (campos.nascimento && !dataIso) { setErro('Data de nascimento inválida (use dd/mm/aaaa).'); return; }
    for (const [campo, rotulo] of [['telefone', 'Celular do aluno'], ['responsavel_telefone', 'Celular do responsável']]) {
      if (campos[campo] && !telefoneValido(campos[campo])) { setErro(`${rotulo}: use DDD + número.`); return; }
    }
    setSalvando(true);
    setErro(null);
    const jaTrabalhou = campos.ja_trabalhou === '' ? null : campos.ja_trabalhou === 'true';
    const erroServidor = await aoSalvar({
      nome: campos.nome.trim(),
      cpf: somenteDigitos(campos.cpf),
      ...(dataIso ? { data_nascimento: dataIso } : {}),
      email: campos.email.trim(),
      telefone: somenteDigitos(campos.telefone) || null,
      responsavel_nome: campos.responsavel_nome.trim() || null,
      responsavel_telefone: somenteDigitos(campos.responsavel_telefone) || null,
      turma_id: campos.turma_id === '' ? null : Number(campos.turma_id),
      itinerario: campos.itinerario || null,
      habilidades: campos.habilidades.split(',').map((h) => h.trim()).filter(Boolean),
      ...(inicial ? { ja_trabalhou: jaTrabalhou, experiencia_previa: jaTrabalhou ? campos.experiencia_previa : null } : {}),
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

        <div className="adm-form-secao">Contato</div>
        <div>
          <label className="adm-rotulo" htmlFor="fa-email">E-mail</label>
          <input id="fa-email" type="email" className="adm-input" value={campos.email} onChange={mudar('email')} required />
        </div>
        <div>
          <label className="adm-rotulo" htmlFor="fa-tel">Celular do aluno</label>
          <input id="fa-tel" className="adm-input" inputMode="tel" placeholder="(67) 99999-0000" value={campos.telefone} onChange={mudarTelefone('telefone')} />
        </div>
        <div>
          <label className="adm-rotulo" htmlFor="fa-resp">Nome do responsável</label>
          <input id="fa-resp" className="adm-input" value={campos.responsavel_nome} onChange={mudar('responsavel_nome')} maxLength={100} />
        </div>
        <div>
          <label className="adm-rotulo" htmlFor="fa-resp-tel">Celular do responsável</label>
          <input id="fa-resp-tel" className="adm-input" inputMode="tel" placeholder="(67) 99999-0000" value={campos.responsavel_telefone} onChange={mudarTelefone('responsavel_telefone')} />
        </div>

        <div className="adm-form-secao">Escola</div>
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
        {inicial && (
          <>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="adm-rotulo" htmlFor="fa-trab">Já trabalhou?</label>
              <select id="fa-trab" className="adm-input" value={campos.ja_trabalhou} onChange={mudar('ja_trabalhou')}>
                <option value="">Não informado</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </div>
            {campos.ja_trabalhou === 'true' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="adm-rotulo" htmlFor="fa-exp">Experiência anterior</label>
                <textarea id="fa-exp" className="adm-input" rows={3} value={campos.experiencia_previa} onChange={mudar('experiencia_previa')} maxLength={2000} />
              </div>
            )}
          </>
        )}
      </div>
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
      <div style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="adm-btn secundario" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="adm-btn" disabled={salvando}>{salvando ? 'Salvando...' : inicial ? 'Salvar alterações' : 'Cadastrar aluno'}</button>
      </div>
    </form>
  );
};

// ------------------------------------------------------------------ cabeçalho: foto + status
const CabecalhoFicha = ({ aluno, aoAtualizar }) => {
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviarFoto = async (dataUrl) => {
    setErro(null);
    setEnviando(true);
    const resposta = await apiFetch(fotoDoAluno(aluno.id), { method: 'PUT', body: JSON.stringify({ imagem_base64: dataUrl }) });
    setEnviando(false);
    if (!resposta.ok) { setErro(await lerErro(resposta, 'Não foi possível enviar a foto.')); return; }
    await aoAtualizar();
  };

  const removerFoto = async () => {
    const resposta = await apiFetch(fotoDoAluno(aluno.id), { method: 'DELETE' });
    if (resposta.ok) await aoAtualizar();
  };

  return (
    <div className="adm-ficha-topo">
      <Avatar caminho={fotoDoAluno(aluno.id)} versao={aluno.foto_atualizada_em} nome={aluno.nome} tamanho={88} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          <ChipStatus status={aluno.status_contratacao} />
          {aluno.idade != null && <span className="adm-chip">{aluno.idade} anos</span>}
          {aluno.turma && <span className="adm-chip">{aluno.turma}</span>}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--adm-suave)', marginBottom: '8px' }}>{aluno.itinerario || 'Itinerário não definido'}</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <SeletorFoto className="adm-btn secundario pequeno" rotulo={enviando ? 'Enviando...' : aluno.tem_foto ? 'Trocar foto' : 'Enviar foto'} disabled={enviando} aoEscolher={enviarFoto} aoErro={setErro} />
          {aluno.tem_foto && <button type="button" className="adm-link" onClick={removerFoto}>Remover</button>}
        </div>
      </div>
      {!aluno.tem_foto && (
        <div className="adm-aviso" style={{ flexBasis: '100%' }}>
          <IconWarning /> Aluno sem foto. Peça pra ele adicionar no app (Minha conta) ou envie aqui.
        </div>
      )}
      {erro && <div className="adm-erro" style={{ flexBasis: '100%', marginTop: 0 }}><IconWarning /> {erro}</div>}
    </div>
  );
};

const BlocoStatus = ({ aluno, empresas = [], aoAtualizar }) => {
  const [marcando, setMarcando] = useState(false);
  const [empresa, setEmpresa] = useState('');
  const [data, setData] = useState(() => dataIsoParaBr(hojeLocalIso()));
  const [erro, setErro] = useState(null);

  const mudar = async (corpo) => {
    setErro(null);
    const resposta = await apiFetch(`/api/admin/estudantes/${aluno.id}/status`, { method: 'PUT', body: JSON.stringify(corpo) });
    if (!resposta.ok) { setErro(await lerErro(resposta, 'Não foi possível mudar o status.')); return; }
    setMarcando(false);
    await aoAtualizar();
  };

  const confirmarContratacao = (e) => {
    e.preventDefault();
    const iso = dataBrParaIso(data);
    if (!iso) { setErro('Data inválida (use dd/mm/aaaa).'); return; }
    mudar({ status: 'contratado', empresa, contratado_em: iso });
  };

  const contratado = aluno.status_contratacao === 'contratado';
  const atual = STATUS_CONTRATACAO[aluno.status_contratacao] || STATUS_CONTRATACAO.disponivel;
  const outros = Object.entries(STATUS_CONTRATACAO).filter(([chave]) => chave !== 'contratado' && chave !== aluno.status_contratacao);
  return (
    <div className={`adm-status-bloco ${contratado ? 'contratado' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--adm-forte)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconHandshake /> {contratado ? `Contratado por ${aluno.empresa_contratante || '—'}` : atual.rotulo}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--adm-suave)' }}>
            {contratado ? `Desde ${dataIsoParaBr(aluno.contratado_em) || '—'}` : atual.descricao}
          </div>
        </div>
        {!marcando && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!contratado && <button className="adm-btn pequeno" onClick={() => setMarcando(true)}>Marcar como contratado</button>}
            <select className="adm-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }} value="" onChange={(e) => e.target.value && mudar({ status: e.target.value })} aria-label="Mudar status do aprendiz">
              <option value="">{contratado ? 'Encerrar como…' : 'Mudar para…'}</option>
              {outros.map(([chave, info]) => <option key={chave} value={chave}>{info.rotulo}</option>)}
            </select>
          </div>
        )}
      </div>
      {marcando && (
        <form onSubmit={confirmarContratacao} className="adm-form-grade" style={{ marginTop: '12px' }}>
          <div>
            <label className="adm-rotulo" htmlFor="st-emp">Empresa</label>
            {/* Sugere as empresas já cadastradas, pra "Eldorado" e "Eldorado Brasil" não virarem duas no filtro */}
            <input id="st-emp" className="adm-input" list="st-emp-sugestoes" value={empresa} onChange={(e) => setEmpresa(e.target.value)} required maxLength={100} autoFocus autoComplete="off" />
            <datalist id="st-emp-sugestoes">{empresas.map((nome) => <option key={nome} value={nome} />)}</datalist>
          </div>
          <div>
            <label className="adm-rotulo" htmlFor="st-data">Contratado em</label>
            <input id="st-data" className="adm-input" inputMode="numeric" value={data} onChange={(e) => setData(mascararData(e.target.value))} required />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="adm-btn secundario pequeno" onClick={() => setMarcando(false)}>Cancelar</button>
            <button type="submit" className="adm-btn pequeno">Confirmar contratação</button>
          </div>
        </form>
      )}
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
    </div>
  );
};

// ------------------------------------------------------------------ aba Dados
const Telefone = ({ numero }) => {
  if (!numero) return '—';
  return (
    <>
      <a className="adm-a" href={`tel:+55${numero}`}>{mascararTelefone(numero)}</a>
      {' · '}
      <a className="adm-a" href={linkWhatsapp(numero)} target="_blank" rel="noreferrer">WhatsApp</a>
    </>
  );
};

const AbaDados = ({ aluno, turmas, itinerarios, empresas, aoSalvar, aoAtualizar }) => {
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

  const contato = [
    ['CPF (senha)', mascararCpf(aluno.cpf || '') || '—'],
    ['E-mail', aluno.email ? <a className="adm-a" href={`mailto:${aluno.email}`}>{aluno.email}</a> : '—'],
    ['Celular', <Telefone numero={aluno.telefone} />],
    ['Responsável', aluno.responsavel_nome || '—'],
    ['Celular do responsável', <Telefone numero={aluno.responsavel_telefone} />],
  ];
  const escola = [
    ['No ranking', aluno.nome_exibicao],
    ['Nascimento', aluno.data_nascimento ? `${dataIsoParaBr(aluno.data_nascimento)} (${aluno.idade} anos)` : '—'],
    ['Turma', aluno.turma || 'Sem turma'],
    ['Itinerário', aluno.itinerario || 'Não definido'],
    ['Habilidades', aluno.habilidades.length ? aluno.habilidades.join(', ') : '—'],
    ['Já trabalhou', aluno.ja_trabalhou == null ? 'Não informado' : aluno.ja_trabalhou ? 'Sim' : 'Não'],
  ];

  return (
    <div>
      <BlocoStatus aluno={aluno} empresas={empresas} aoAtualizar={aoAtualizar} />
      <div className="adm-ficha-stats">
        <div><strong>{aluno.xp_total}</strong><span>XP</span></div>
        <div><strong>{aluno.nivel}</strong><span>nível</span></div>
        <div><strong>{aluno.taxa_acerto_quiz ?? '—'}{aluno.taxa_acerto_quiz != null && '%'}</strong><span>acerto no quiz</span></div>
        <div><strong>{aluno.ofensiva_dias} <IconFire style={{ color: '#f97316', verticalAlign: '-2px' }} /></strong><span>ofensiva</span></div>
        <div><strong>{aluno.liga}</strong><span>liga</span></div>
        <div><strong>{aluno.total_indicacoes}</strong><span>indicações</span></div>
      </div>
      <h3 className="adm-subtitulo">Contato</h3>
      <dl className="adm-ficha">
        {contato.map(([rotulo, valor]) => <React.Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></React.Fragment>)}
      </dl>
      <h3 className="adm-subtitulo">Escola</h3>
      <dl className="adm-ficha">
        {escola.map(([rotulo, valor]) => <React.Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></React.Fragment>)}
      </dl>
      <p style={{ fontSize: '12px', color: 'var(--adm-suave)', margin: '14px 0' }}>
        A senha do aluno é o CPF acima. Se ele não conseguir entrar, confira o CPF cadastrado.
      </p>
      <button className="adm-btn secundario" onClick={() => setEditando(true)}><IconLock style={{ verticalAlign: '-2px' }} /> Habilitar edição</button>
    </div>
  );
};

// ------------------------------------------------------------------ aba Currículo
const AbaCurriculo = ({ aluno }) => {
  const [dados, setDados] = useState(null);
  const [versaoId, setVersaoId] = useState(null);
  const [imprimindo, setImprimindo] = useState(false);

  const carregar = useCallback(async () => {
    const query = versaoId ? `?versao_id=${versaoId}` : '';
    const resposta = await apiFetch(`/api/admin/estudantes/${aluno.id}/curriculo${query}`);
    if (resposta.ok) setDados(await resposta.json());
  }, [aluno.id, versaoId]);

  // Busca de novo ao voltar pra janela: se o aluno gerou um currículo novo
  // enquanto a ficha estava aberta, a coordenação já vê a versão nova.
  useEffect(() => {
    carregar();
    const aoFocar = () => { if (!versaoId) carregar(); };
    window.addEventListener('focus', aoFocar);
    return () => window.removeEventListener('focus', aoFocar);
  }, [carregar, versaoId]);

  // Foto do currículo (outra, que o aluno envia): só entra se ele marcou "com foto"
  const [fotoUrl, setFotoUrl] = useState(null);
  useEffect(() => {
    if (!aluno.foto_no_curriculo || !aluno.tem_foto_curriculo) { setFotoUrl(null); return undefined; }
    let ativo = true;
    let criada = null;
    urlDeArquivo(`/api/admin/estudantes/${aluno.id}/foto-curriculo`).then((u) => { if (ativo) { criada = u; setFotoUrl(u); } });
    return () => { ativo = false; if (criada) URL.revokeObjectURL(criada); };
  }, [aluno.id, aluno.foto_no_curriculo, aluno.tem_foto_curriculo, aluno.foto_curriculo_atualizada_em]);

  if (!dados) return <p className="adm-vazio">Carregando…</p>;
  if (!dados.atual) {
    return (
      <div className="adm-vazio-bloco">
        <IconDocument style={{ fontSize: '26px' }} />
        <p>{aluno.nome} ainda não gerou o currículo. Assim que gerar no app, ele aparece aqui automaticamente.</p>
      </div>
    );
  }

  // Mesmo cabeçalho que o aluno vê: o cadastro da escola
  const perfil = { nome: aluno.nome, idade: aluno.idade, data_nascimento: aluno.data_nascimento, email: aluno.email, telefone: aluno.telefone, linkedin: aluno.linkedin, turma: aluno.turma, itinerario: aluno.itinerario };
  const nomeArquivo = `Curriculo - ${aluno.nome}`;
  return (
    <div>
      <style>{ESTILOS_FOLHA}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <select className="adm-input" style={{ flex: '1 1 220px' }} value={versaoId ?? ''} onChange={(e) => setVersaoId(e.target.value ? Number(e.target.value) : null)} aria-label="Versão do currículo">
          {dados.versoes.map((v) => (
            <option key={v.id} value={v.mais_recente ? '' : v.id}>
              {dataHoraIsoParaBr(v.gerado_em)}{v.mais_recente ? ' (mais recente)' : ''}
            </option>
          ))}
        </select>
        <button className="adm-btn" onClick={() => setImprimindo(true)}><IconPdf style={{ verticalAlign: '-2px' }} /> Baixar PDF</button>
      </div>
      {dados.atual.texto_original && (
        <details className="adm-detalhes">
          <summary>O que o aluno escreveu</summary>
          <p>{dados.atual.texto_original}</p>
        </details>
      )}
      <div className="adm-folha-wrap">
        <FolhaCurriculo cv={dados.atual.curriculo} perfil={perfil} foto={fotoUrl} />
      </div>
      {imprimindo && (
        <Imprimir nomeDoArquivo={nomeArquivo} aoTerminar={() => setImprimindo(false)}>
          <FolhaCurriculo cv={dados.atual.curriculo} perfil={perfil} foto={fotoUrl} />
        </Imprimir>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ aba Competências
const AbaCompetencias = ({ aluno }) => {
  const [dados, setDados] = useState(null);
  useEffect(() => {
    apiFetch(`/api/admin/estudantes/${aluno.id}/competencias`).then(async (r) => { if (r.ok) setDados(await r.json()); });
  }, [aluno.id]);

  if (!dados) return <p className="adm-vazio">Carregando…</p>;
  const nomes = Object.fromEntries(dados.eixos.map((e) => [e.codigo, e.nome]));
  return (
    <div>
      <MapaCompetencias eixos={dados.eixos} tema="claro" referenciaMedia={dados.referencia_media} />

      <h3 className="adm-subtitulo">De onde vêm as pontuações</h3>
      {dados.evidencias.length === 0 ? <p className="adm-vazio">{aluno.nome} ainda não fez atividades que medem competências.</p> : (
        <ul className="adm-linha-tempo">
          {dados.evidencias.map((e, i) => (
            <li key={i}>
              <strong>{nomes[e.competencia] || e.competencia}</strong> {e.pontos}
              <span style={{ color: 'var(--adm-suave)', fontSize: '12px' }}>{e.origem}</span>
              <span>{dataHoraIsoParaBr(e.criada_em)}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="adm-subtitulo">O que você faria? (escolhas recentes)</h3>
      {dados.situacoes.length === 0 ? <p className="adm-vazio">Nenhuma situação respondida ainda.</p> : dados.situacoes.map((s, i) => (
        <div key={i} className="adm-hist-item">
          <div style={{ fontWeight: 700, color: 'var(--adm-texto-forte)', fontSize: '13px' }}>{s.titulo}</div>
          <div style={{ fontSize: '12px', color: 'var(--adm-texto)', margin: '4px 0' }}>Escolheu: "{s.escolha}"</div>
          <div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{dataHoraIsoParaBr(s.criada_em)}</div>
        </div>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ aba Certificados e frequência
const EVENTOS_FREQUENCIA = { inicio: 'Começou a aula', progresso: 'Assistiu', fixacao: 'Fez a fixação', conclusao: 'Concluiu a aula' };

const AbaCertificados = ({ aluno, aoAtualizar }) => {
  const [certificados, setCertificados] = useState(null);
  const [log, setLog] = useState([]);

  const carregar = useCallback(async () => {
    const [rc, rl] = await Promise.all([
      apiFetch(`/api/admin/estudantes/${aluno.id}/certificados`),
      apiFetch(`/api/admin/estudantes/${aluno.id}/frequencia`),
    ]);
    if (rc.ok) setCertificados(await rc.json());
    if (rl.ok) setLog(await rl.json());
  }, [aluno.id]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div>
      <h3 className="adm-subtitulo" style={{ marginTop: 0 }}>Certificados de conclusão</h3>
      <p style={{ fontSize: '12px', color: 'var(--adm-suave)', margin: '0 0 10px' }}>
        O certificado é entregue na escola. Quando o aluno conclui todas as aulas de um módulo, o app avisa pra ele procurar a coordenação; marque aqui quando ele (ou o responsável) retirar.
      </p>
      {certificados === null ? <p className="adm-vazio">Carregando…</p> : certificados.length === 0 ? <p className="adm-vazio">{aluno.nome} ainda não concluiu nenhum módulo da trilha EAD.</p> : certificados.map((c) => (
        <div key={c.modulo_id} className="adm-hist-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--adm-texto-forte)', fontSize: '13px' }}>{c.modulo}</div>
              <div style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>
                {c.concluido_em ? `Concluiu em ${dataIsoParaBr(c.concluido_em)}` : 'O módulo ganhou aulas novas depois da retirada'}{c.observacao ? ` · ${c.observacao}` : ''}
              </div>
            </div>
            <ChipCertificado retiradoEm={c.retirado_em} />
          </div>
          <RetiradaCertificado estudanteId={aluno.id} certificado={c} aoMudar={() => { carregar(); aoAtualizar(); }} />
        </div>
      ))}

      <h3 className="adm-subtitulo">Registro de frequência na trilha EAD</h3>
      {log.length === 0 ? <p className="adm-vazio">{aluno.nome} ainda não abriu nenhuma aula.</p> : (
        <ul className="adm-linha-tempo">
          {log.map((l, i) => (
            <li key={i}>
              <strong>{EVENTOS_FREQUENCIA[l.evento] || l.evento}</strong> {l.aula}
              <span style={{ fontSize: '12px', color: 'var(--adm-suave)' }}>
                {l.percentual_assistido}% assistido{l.nota != null ? ` · nota ${l.nota} (corte ${l.nota_de_corte})` : ''}
              </span>
              <span>{dataHoraIsoParaBr(l.registrado_em)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ aba Histórico
const ItemCandidatura = ({ c, aoSalvo }) => {
  const [status, setStatus] = useState(c.status);
  const [resposta, setResposta] = useState(c.resposta_empresa || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const mudou = status !== c.status || resposta !== (c.resposta_empresa || '');

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    const r = await apiFetch(`/api/admin/candidaturas/${c.id}`, { method: 'PUT', body: JSON.stringify({ status, resposta_empresa: resposta }) });
    setSalvando(false);
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível salvar.')); return; }
    aoSalvo();
  };

  return (
    <div className="adm-hist-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--adm-texto-forte)' }}>{c.titulo_vaga || 'Vaga removida'}</div>
          <div style={{ fontSize: '12px', color: 'var(--adm-suave)' }}>{c.empresa} · {dataIsoParaBr(c.criada_em)}</div>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {c.indicada_pela_escola
            ? <span className="adm-chip verde">Indicado pela escola{c.pontuacao_indicacao != null ? ` · nota ${c.pontuacao_indicacao}` : ''}</span>
            : <span className="adm-chip">Candidatou-se</span>}
        </div>
      </div>
      <div className="adm-form-grade" style={{ marginTop: '10px' }}>
        <div>
          <label className="adm-rotulo" htmlFor={`cand-st-${c.id}`}>Resposta da empresa</label>
          <select id={`cand-st-${c.id}`} className="adm-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS_CANDIDATURA).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="adm-rotulo" htmlFor={`cand-txt-${c.id}`}>Retorno / observação</label>
          <textarea id={`cand-txt-${c.id}`} className="adm-input" rows={2} value={resposta} onChange={(e) => setResposta(e.target.value)} maxLength={2000} placeholder="Ex: Gostaram da entrevista, retorno até sexta." />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{c.atualizada_em ? `Atualizado em ${dataHoraIsoParaBr(c.atualizada_em)}` : ''}</span>
        {mudou && <button className="adm-btn pequeno" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar retorno'}</button>}
      </div>
      {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
    </div>
  );
};

// Conversa direta com a coordenação e o que o aluno escreveu nos grupos
const MensagensDoAluno = ({ aluno }) => {
  const [dados, setDados] = useState(null);
  useEffect(() => {
    apiFetch(`/api/admin/estudantes/${aluno.id}/mensagens`).then(async (r) => { if (r.ok) setDados(await r.json()); });
  }, [aluno.id]);
  if (!dados) return <p className="adm-vazio">Carregando…</p>;
  const linha = (m, canal) => (
    <li key={`${canal || 'd'}-${m.id}`}>
      <strong>{m.da_escola ? 'Coordenação' : aluno.nome.split(' ')[0]}{canal ? ` em ${canal}` : ''}:</strong>
      <span style={{ color: 'var(--adm-texto-forte)', textDecoration: m.oculta_em ? 'line-through' : undefined }}>{m.texto}</span>
      {m.oculta_em && <span style={{ color: '#b91c1c', fontSize: '11px' }}>oculta: {m.oculta_motivo}</span>}
      <span>{dataHoraIsoParaBr(m.enviada_em)}</span>
    </li>
  );
  return (
    <>
      {dados.conversa_direta.length === 0 ? <p className="adm-vazio">Nenhuma conversa direta ainda (abra pela aba Mensagens).</p> : (
        <ul className="adm-linha-tempo">{dados.conversa_direta.slice(-20).map((m) => linha(m))}</ul>
      )}
      {dados.nos_grupos.length > 0 && (
        <>
          <div style={{ fontSize: '12px', color: 'var(--adm-suave)', margin: '10px 0 4px' }}>Nos grupos:</div>
          <ul className="adm-linha-tempo">{dados.nos_grupos.slice(0, 20).map((m) => linha(m, m.canal))}</ul>
        </>
      )}
    </>
  );
};

const AbaHistorico = ({ aluno, historico, recarregar }) => {
  if (!historico) return <p className="adm-vazio">Carregando…</p>;
  const { experiencia, entrevistas, candidaturas, mudancas_status: mudancas } = historico;
  return (
    <div>
      <h3 className="adm-subtitulo">Experiência anterior</h3>
      <p style={{ fontSize: '13px', color: 'var(--adm-texto-forte)', margin: '0 0 6px' }}>
        {experiencia.ja_trabalhou == null ? 'O aluno ainda não informou.' : experiencia.ja_trabalhou ? 'Já trabalhou.' : 'Ainda não trabalhou.'}
      </p>
      {experiencia.experiencia_previa && <p className="adm-citacao">{experiencia.experiencia_previa}</p>}

      <h3 className="adm-subtitulo">Status de contratação</h3>
      {mudancas.length === 0 ? <p className="adm-vazio">Sempre esteve disponível (nenhuma mudança registrada).</p> : (
        <ul className="adm-linha-tempo">
          {mudancas.map((m, i) => (
            <li key={i}>
              <ChipStatus status={m.status} /> {m.empresa && <strong>{m.empresa}</strong>}
              <span>{dataHoraIsoParaBr(m.registrada_em)}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="adm-subtitulo">Indicações e candidaturas ({candidaturas.length})</h3>
      {candidaturas.length === 0
        ? <p className="adm-vazio">Nenhuma candidatura ainda.</p>
        : candidaturas.map((c) => <ItemCandidatura key={`${c.id}-${c.atualizada_em}`} c={c} aoSalvo={recarregar} />)}

      <h3 className="adm-subtitulo">Mensagens</h3>
      <MensagensDoAluno aluno={aluno} />

      <h3 className="adm-subtitulo">Simulador de entrevista com IA</h3>
      {entrevistas.length === 0 ? <p className="adm-vazio">{aluno.nome} ainda não treinou no simulador.</p> : entrevistas.map((dia) => (
        <details key={dia.data} className="adm-detalhes">
          <summary>
            {dataIsoParaBr(dia.data)} · {dia.total_respostas} resposta{dia.total_respostas !== 1 ? 's' : ''}
            {dia.nota_media != null && <> · nota média <strong>{dia.nota_media}</strong>/50</>}
          </summary>
          {dia.itens.map((item, i) => (
            <div key={i} className="adm-entrevista-item">
              {item.pergunta && <div className="adm-entrevista-p">IA: {item.pergunta}</div>}
              <div className="adm-entrevista-r">Aluno: {item.resposta}</div>
              {item.feedback && <div className="adm-entrevista-f">Feedback: {item.feedback}{item.nota != null && <> · <strong>{item.nota} XP</strong></>}</div>}
            </div>
          ))}
        </details>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ aba Observações
const AbaObservacoes = ({ aluno, historico, recarregar }) => {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(null);
  const [apagandoId, setApagandoId] = useState(null);

  const adicionar = async (e) => {
    e.preventDefault();
    setErro(null);
    const r = await apiFetch(`/api/admin/estudantes/${aluno.id}/observacoes`, { method: 'POST', body: JSON.stringify({ texto }) });
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível salvar.')); return; }
    setTexto('');
    recarregar();
  };

  const apagar = async (id) => {
    const r = await apiFetch(`/api/admin/observacoes/${id}`, { method: 'DELETE' });
    setApagandoId(null);
    if (r.ok) recarregar();
  };

  if (!historico) return <p className="adm-vazio">Carregando…</p>;
  return (
    <div>
      <form onSubmit={adicionar}>
        <label className="adm-rotulo" htmlFor="obs-nova">Nova observação (só a escola vê)</label>
        <textarea id="obs-nova" className="adm-input" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} placeholder="Ex: Comportamento exemplar na entrevista da empresa X; precisa melhorar a pontualidade." />
        {erro && <div className="adm-erro"><IconWarning /> {erro}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="submit" className="adm-btn" disabled={!texto.trim()}>Adicionar observação</button>
        </div>
      </form>
      {historico.observacoes.length === 0 && <p className="adm-vazio">Nenhuma observação ainda.</p>}
      {historico.observacoes.map((o) => (
        <div key={o.id} className="adm-hist-item">
          <p style={{ margin: '0 0 6px', whiteSpace: 'pre-wrap', color: 'var(--adm-texto-forte)', fontSize: '13px' }}>{o.texto}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--adm-suave)' }}>
            <span>{o.autor} · {dataHoraIsoParaBr(o.criada_em)}</span>
            {apagandoId === o.id ? (
              <span style={{ display: 'flex', gap: '8px' }}>
                Apagar?
                <button className="adm-link perigo" onClick={() => apagar(o.id)}>Sim</button>
                <button className="adm-link" onClick={() => setApagandoId(null)}>Não</button>
              </span>
            ) : (
              <button className="adm-link" onClick={() => setApagandoId(o.id)} aria-label="Apagar observação"><IconTrash /></button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ ficha
const ABAS_FICHA = [
  { id: 'dados', rotulo: 'Dados', Icon: IconUser },
  { id: 'competencias', rotulo: 'Competências', Icon: IconTarget },
  { id: 'curriculo', rotulo: 'Currículo', Icon: IconDocument },
  { id: 'historico', rotulo: 'Histórico', Icon: IconHistory },
  { id: 'observacoes', rotulo: 'Observações', Icon: IconNote },
  { id: 'certificados', rotulo: 'Certificados', Icon: IconStar },
  { id: 'pap', rotulo: 'PAP', Icon: IconHandshake },
];

const FichaAluno = ({ aluno, turmas, itinerarios, empresas, aoSalvar, aoAtualizar }) => {
  const [aba, setAba] = useState('dados');
  const [historico, setHistorico] = useState(null);

  const carregarHistorico = useCallback(async () => {
    const r = await apiFetch(`/api/admin/estudantes/${aluno.id}/historico`);
    if (r.ok) setHistorico(await r.json());
  }, [aluno.id]);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico, aluno.status_contratacao]);

  return (
    <div>
      <CabecalhoFicha aluno={aluno} aoAtualizar={aoAtualizar} />
      <nav className="adm-abas adm-abas-ficha" role="tablist">
        {ABAS_FICHA.map(({ id, rotulo, Icon }) => (
          <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'ativa' : ''} onClick={() => setAba(id)}>
            <Icon /> {rotulo}
            {id === 'observacoes' && historico?.observacoes.length > 0 && <span className="adm-contador">{historico.observacoes.length}</span>}
          </button>
        ))}
      </nav>
      {aba === 'dados' && <AbaDados aluno={aluno} turmas={turmas} itinerarios={itinerarios} empresas={empresas} aoSalvar={aoSalvar} aoAtualizar={aoAtualizar} />}
      {aba === 'competencias' && <AbaCompetencias aluno={aluno} />}
      {aba === 'curriculo' && <AbaCurriculo aluno={aluno} />}
      {aba === 'historico' && <AbaHistorico aluno={aluno} historico={historico} recarregar={carregarHistorico} />}
      {aba === 'observacoes' && <AbaObservacoes aluno={aluno} historico={historico} recarregar={carregarHistorico} />}
      {aba === 'certificados' && <AbaCertificados aluno={aluno} aoAtualizar={aoAtualizar} />}
      {aba === 'pap' && <AbaPap aluno={aluno} aoAtualizar={aoAtualizar} />}
    </div>
  );
};

export default FichaAluno;
