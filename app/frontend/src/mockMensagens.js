// Modo demonstração das mensagens: espelha mensagens.py (conversa direta
// aluno <-> coordenação, grupo da empresa/turno pelos contratados, canal
// geral só leitura pros alunos, ocultar com o original guardado).

const OCULTA = 'Mensagem removida pela coordenação.';
const ALUNOS_ESCREVEM_NO_GERAL = false;

export const criarMockMensagens = ({ ALUNOS, TURMAS, estado, respostaFake, erroFake, agoraIso, diasAtras }) => {
  const turnoDo = (aluno) => TURMAS.find((t) => t.id === aluno.turma_id)?.turno ?? null;
  const horasAtras = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString().slice(0, 19);

  const canais = [
    { id: 1, tipo: 'geral', nome: 'Geral da escola', estudante_id: null, empresa: null, turno: null, arquivado: false, escola_leu_em: null },
    { id: 2, tipo: 'grupo', nome: 'Eldorado Brasil Celulose — Aprendizes Manhã', estudante_id: null, empresa: 'Eldorado Brasil Celulose', turno: 'Manhã', arquivado: false, escola_leu_em: horasAtras(20) },
    { id: 3, tipo: 'direto', nome: 'Ana Clara Lima', estudante_id: 6, empresa: null, turno: null, arquivado: false, escola_leu_em: diasAtras(2) },
    { id: 4, tipo: 'direto', nome: 'Rafael Sozza', estudante_id: 1, empresa: null, turno: null, arquivado: false, escola_leu_em: horasAtras(1) },
  ];
  let proximoCanalId = 5;
  const mensagens = [
    { id: 1, canal_id: 1, autor_tipo: 'escola', estudante_id: null, texto: 'Bem-vindos! A integração do Programa de Aprendizagem agora pode ser feita a distância, na aba Aulas. Qualquer dúvida, falem com a coordenação por aqui.', enviada_em: diasAtras(2, 9) },
    { id: 2, canal_id: 1, autor_tipo: 'escola', estudante_id: null, texto: 'Lembrete: sexta tem feira de profissões no pátio, das 14h às 17h.', enviada_em: horasAtras(5) },
    { id: 3, canal_id: 2, autor_tipo: 'escola', estudante_id: null, texto: 'Pessoal, reunião com o RH da Eldorado na sexta às 14h, na portaria principal. Levem a carteira de trabalho.', enviada_em: horasAtras(26) },
    { id: 4, canal_id: 2, autor_tipo: 'aluno', estudante_id: 2, texto: 'Confirmado! 👍', enviada_em: horasAtras(25) },
    { id: 5, canal_id: 2, autor_tipo: 'aluno', estudante_id: 4, texto: 'Eu também. Alguém sabe se precisa ir de uniforme?', enviada_em: horasAtras(24) },
    { id: 6, canal_id: 3, autor_tipo: 'aluno', estudante_id: 6, texto: 'Bom dia! A empresa pediu o certificado da integração. Onde eu pego?', enviada_em: horasAtras(3) },
    { id: 7, canal_id: 4, autor_tipo: 'escola', estudante_id: null, texto: 'Oi, Rafael! Vi que você ainda não montou seu currículo. Ele ajuda na hora de te indicar pras vagas. Qualquer dúvida, me chama aqui.', enviada_em: horasAtras(1) },
  ];
  let proximaMensagemId = 8;
  const leituras = new Map([['2-2', horasAtras(24)], ['2-4', horasAtras(24)]]); // `${canal}-${aluno}` -> quando leu

  const aluno = (id) => ALUNOS.find((a) => a.id === id);
  const membros = (c) => ALUNOS.filter((a) => a.status_contratacao === 'contratado' && a.empresa_contratante === c.empresa && (!c.turno || turnoDo(a) === c.turno));
  const ehMembro = (c, a) => {
    if (c.tipo === 'geral') return true;
    if (c.tipo === 'direto') return c.estudante_id === a.id;
    return !c.arquivado && membros(c).some((m) => m.id === a.id);
  };
  const direto = (a) => {
    let c = canais.find((x) => x.tipo === 'direto' && x.estudante_id === a.id);
    if (!c) {
      c = { id: proximoCanalId++, tipo: 'direto', nome: a.nome, estudante_id: a.id, empresa: null, turno: null, arquivado: false, escola_leu_em: null };
      canais.push(c);
    }
    return c;
  };
  const doCanal = (id) => mensagens.filter((m) => m.canal_id === id).sort((x, y) => x.id - y.id);
  const ultima = (id) => doCanal(id).at(-1) || null;

  const paraAluno = (m, eu) => {
    const autor = m.autor_tipo === 'escola' ? 'Coordenação' : m.estudante_id === eu.id ? 'Você' : (aluno(m.estudante_id)?.nome_exibicao || 'Aluno');
    return { id: m.id, autor, da_escola: m.autor_tipo === 'escola', minha: m.autor_tipo === 'aluno' && m.estudante_id === eu.id, texto: m.oculta_em ? OCULTA : m.texto, oculta: Boolean(m.oculta_em), enviada_em: m.enviada_em };
  };
  const paraEscola = (m) => ({
    id: m.id, autor: m.autor_tipo === 'escola' ? 'Coordenação' : (aluno(m.estudante_id)?.nome || 'Aluno'), estudante_id: m.estudante_id,
    da_escola: m.autor_tipo === 'escola', texto: m.texto, oculta_em: m.oculta_em || null, oculta_motivo: m.oculta_motivo || null, enviada_em: m.enviada_em,
  });
  const previa = (m, paraOAluno) => (m ? { texto: (m.oculta_em && paraOAluno ? OCULTA : m.texto).slice(0, 120), da_escola: m.autor_tipo === 'escola', enviada_em: m.enviada_em } : null);

  const naoLidasEscola = (c) => doCanal(c.id).filter((m) => m.autor_tipo === 'aluno' && (!c.escola_leu_em || m.enviada_em > c.escola_leu_em)).length;
  const naoLidasAluno = (c, a) => {
    const leu = leituras.get(`${c.id}-${a.id}`);
    return doCanal(c.id).filter((m) => m.estudante_id !== a.id && (!leu || m.enviada_em > leu)).length;
  };
  const canaisDoAluno = (a) => [direto(a), canais.find((c) => c.tipo === 'geral'), ...canais.filter((c) => c.tipo === 'grupo' && ehMembro(c, a))];

  // ---------------------------------------------------------------- escola
  const admin = (metodo, caminho, query, corpo) => {
    if (metodo === 'GET' && caminho === '/api/admin/mensagens/opcoes') {
      const empresas = [...new Set(ALUNOS.filter((a) => a.status_contratacao === 'contratado' && a.empresa_contratante).map((a) => a.empresa_contratante))].sort();
      const turnos = [...new Set(TURMAS.map((t) => t.turno).filter(Boolean))].sort();
      return respostaFake({ empresas, turnos, turmas: TURMAS.map(({ id, nome }) => ({ id, nome })) });
    }
    if (metodo === 'GET' && caminho === '/api/admin/mensagens/canais') {
      const tipo = query.get('tipo'); const empresa = query.get('empresa'); const turno = query.get('turno');
      const turmaId = query.get('turma_id'); const busca = (query.get('busca') || '').toLowerCase();
      const lista = canais.filter((c) => {
        const a = c.estudante_id ? aluno(c.estudante_id) : null;
        if (tipo && c.tipo !== tipo) return false;
        if (empresa && c.empresa !== empresa && a?.empresa_contratante !== empresa) return false;
        if (turno && c.turno !== turno && (!a || turnoDo(a) !== turno)) return false;
        if (turmaId && String(a?.turma_id) !== turmaId) return false;
        if (busca && !c.nome.toLowerCase().includes(busca)) return false;
        return true;
      }).map((c) => {
        const a = c.estudante_id ? aluno(c.estudante_id) : null;
        return {
          id: c.id, tipo: c.tipo, nome: c.nome, empresa: c.empresa, turno: c.turno, arquivado: c.arquivado,
          aluno: a ? { id: a.id, nome: a.nome, turma: TURMAS.find((t) => t.id === a.turma_id)?.nome ?? null } : null,
          total_membros: c.tipo === 'grupo' ? membros(c).length : null,
          ultima_mensagem: previa(ultima(c.id), false), nao_lidas: naoLidasEscola(c),
        };
      }).sort((x, y) => (x.tipo === 'geral' ? -1 : y.tipo === 'geral' ? 1 : (ultima(y.id)?.id || 0) - (ultima(x.id)?.id || 0)));
      return respostaFake(lista);
    }
    if (metodo === 'POST' && caminho === '/api/admin/mensagens/diretos') {
      const a = aluno(corpo.estudante_id);
      return a ? respostaFake({ id: direto(a).id }) : erroFake('Aluno não encontrado', 404);
    }
    if (metodo === 'POST' && caminho === '/api/admin/mensagens/grupos') {
      const empresa = (corpo.empresa || '').trim();
      const turno = (corpo.turno || '').trim() || null;
      if (canais.some((c) => c.tipo === 'grupo' && c.empresa === empresa && c.turno === turno)) return erroFake('Já existe um grupo dessa empresa nesse turno.', 409);
      const c = { id: proximoCanalId++, tipo: 'grupo', nome: (corpo.nome || '').trim() || `${empresa} — Aprendizes${turno ? ` ${turno}` : ''}`, estudante_id: null, empresa, turno, arquivado: false, escola_leu_em: null };
      canais.push(c);
      return respostaFake({ id: c.id, nome: c.nome, total_membros: membros(c).length }, 201);
    }
    let r = metodo === 'PUT' && caminho.match(/^\/api\/admin\/mensagens\/grupos\/(\d+)$/);
    if (r) {
      const c = canais.find((x) => x.id === Number(r[1]) && x.tipo === 'grupo');
      if (!c) return erroFake('Grupo não encontrado', 404);
      if (corpo.nome) c.nome = corpo.nome.trim();
      if (typeof corpo.arquivado === 'boolean') c.arquivado = corpo.arquivado;
      return respostaFake({ id: c.id, nome: c.nome, arquivado: c.arquivado });
    }
    r = caminho.match(/^\/api\/admin\/mensagens\/canais\/(\d+)(\/mensagens)?$/);
    if (r) {
      const c = canais.find((x) => x.id === Number(r[1]));
      if (!c) return erroFake('Canal não encontrado', 404);
      if (!r[2] && metodo === 'GET') {
        const depois = Number(query.get('depois_de')) || 0;
        c.escola_leu_em = agoraIso();
        return respostaFake({
          id: c.id, tipo: c.tipo, nome: c.nome, empresa: c.empresa, turno: c.turno, arquivado: c.arquivado,
          aluno_leu_em: c.tipo === 'direto' ? (leituras.get(`${c.id}-${c.estudante_id}`) || null) : null,
          membros: c.tipo === 'grupo' ? membros(c).map((a) => ({ id: a.id, nome: a.nome, turma: TURMAS.find((t) => t.id === a.turma_id)?.nome ?? null })) : null,
          mensagens: doCanal(c.id).filter((m) => m.id > depois).map(paraEscola),
        });
      }
      if (r[2] && metodo === 'POST') {
        const texto = (corpo.texto || '').trim();
        if (!texto) return erroFake('Escreva a mensagem.', 400);
        const m = { id: proximaMensagemId++, canal_id: c.id, autor_tipo: 'escola', estudante_id: null, texto, enviada_em: agoraIso() };
        mensagens.push(m);
        c.escola_leu_em = m.enviada_em;
        return respostaFake(paraEscola(m), 201);
      }
    }
    r = metodo === 'POST' && caminho.match(/^\/api\/admin\/mensagens\/(\d+)\/ocultar$/);
    if (r) {
      const m = mensagens.find((x) => x.id === Number(r[1]));
      if (!m) return erroFake('Mensagem não encontrada', 404);
      if (!m.oculta_em) { m.oculta_em = agoraIso(); m.oculta_motivo = (corpo.motivo || '').trim(); }
      return respostaFake(paraEscola(m));
    }
    r = metodo === 'GET' && caminho.match(/^\/api\/admin\/estudantes\/(\d+)\/mensagens$/);
    if (r) {
      const a = aluno(Number(r[1]));
      if (!a) return erroFake('Aluno não encontrado', 404);
      const d = canais.find((x) => x.tipo === 'direto' && x.estudante_id === a.id);
      return respostaFake({
        canal_direto_id: d?.id ?? null,
        conversa_direta: d ? doCanal(d.id).map(paraEscola) : [],
        nos_grupos: mensagens.filter((m) => m.estudante_id === a.id && canais.find((c) => c.id === m.canal_id)?.tipo !== 'direto')
          .sort((x, y) => y.id - x.id).map((m) => ({ ...paraEscola(m), canal: canais.find((c) => c.id === m.canal_id).nome })),
      });
    }
    return null;
  };

  // ---------------------------------------------------------------- aluno
  const doAluno = (metodo, caminho, query, corpo) => {
    const eu = aluno(estado.alunoId);
    if (!eu) return null;
    if (metodo === 'GET' && caminho === '/api/mensagens/nao-lidas') {
      return respostaFake({ total: canaisDoAluno(eu).reduce((t, c) => t + naoLidasAluno(c, eu), 0) });
    }
    if (metodo === 'GET' && caminho === '/api/mensagens/canais') {
      return respostaFake(canaisDoAluno(eu).map((c) => ({
        id: c.id, tipo: c.tipo, nome: c.tipo === 'direto' ? 'Coordenação' : c.nome, pode_escrever: c.tipo !== 'geral' || ALUNOS_ESCREVEM_NO_GERAL,
        ultima_mensagem: previa(ultima(c.id), true), nao_lidas: naoLidasAluno(c, eu),
      })));
    }
    const r = caminho.match(/^\/api\/mensagens\/canais\/(\d+)(\/mensagens)?$/);
    if (!r) return null;
    const c = canais.find((x) => x.id === Number(r[1]));
    if (!c || !ehMembro(c, eu)) return erroFake('Conversa não encontrada', 404);
    if (!r[2] && metodo === 'GET') {
      const depois = Number(query.get('depois_de')) || 0;
      leituras.set(`${c.id}-${eu.id}`, agoraIso());
      return respostaFake({
        id: c.id, tipo: c.tipo, nome: c.tipo === 'direto' ? 'Coordenação' : c.nome, pode_escrever: c.tipo !== 'geral' || ALUNOS_ESCREVEM_NO_GERAL,
        escola_leu_em: c.tipo === 'direto' ? c.escola_leu_em : null,
        mensagens: doCanal(c.id).filter((m) => m.id > depois).map((m) => paraAluno(m, eu)),
      });
    }
    if (r[2] && metodo === 'POST') {
      if (c.tipo === 'geral' && !ALUNOS_ESCREVEM_NO_GERAL) return erroFake('No canal geral só a escola escreve. Fale com a coordenação na conversa direta.', 403);
      const texto = (corpo.texto || '').trim();
      if (!texto) return erroFake('Escreva a mensagem.', 400);
      const m = { id: proximaMensagemId++, canal_id: c.id, autor_tipo: 'aluno', estudante_id: eu.id, texto, enviada_em: agoraIso() };
      mensagens.push(m);
      leituras.set(`${c.id}-${eu.id}`, m.enviada_em);
      return respostaFake(paraAluno(m, eu), 201);
    }
    return null;
  };

  const naoLidasDaEscola = () => canais.reduce((t, c) => t + naoLidasEscola(c), 0);
  return { admin, aluno: doAluno, naoLidasDaEscola };
};
