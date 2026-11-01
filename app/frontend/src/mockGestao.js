// Modo demonstração das contas da gestão e da auditoria -- as mesmas regras de
// gestao_routes.py / auth.PERFIS_GESTAO / auditoria.py, em memória.

export const PERFIS_GESTAO = {
  administrador: { rotulo: 'Administrador', alterar: true, auditar: true, contas: true },
  auditor: { rotulo: 'Auditor', alterar: false, auditar: true, contas: false },
  alterar: { rotulo: 'Alterar', alterar: true, auditar: false, contas: false },
  visualizar: { rotulo: 'Visualizar', alterar: false, auditar: false, contas: false },
};
const ACOES = { incluiu: 'Incluiu', alterou: 'Alterou', excluiu: 'Excluiu', exportou: 'Exportou', entrou: 'Entrou no painel', falhou_login: 'Errou o login', negado: 'Tentou sem permissão' };
const ROTAS_LIVRES = ['/api/admin/auditoria/exportacao', '/api/admin/gestao/minha-senha'];

// Descrições legíveis (espelho resumido de auditoria.ROTAS)
const ROTAS = [
  ['POST', /^\/turmas$/, 'incluiu', 'turma', (c) => `Cadastrou a turma ${c.nome || ''}`],
  ['POST', /^\/estudantes$/, 'incluiu', 'aluno', (c) => `Cadastrou o aluno ${c.nome || ''}`],
  ['PUT', /^\/estudantes\/(\d+)$/, 'alterou', 'aluno', (_, id, nome) => `Alterou o cadastro de ${nome(id)}`],
  ['PUT', /^\/estudantes\/(\d+)\/status$/, 'alterou', 'aluno', (c, id, nome) => `Mudou o status de contratação de ${nome(id)} para ${c.status || '—'}`],
  ['POST', /^\/estudantes\/(\d+)\/observacoes$/, 'incluiu', 'observacao', (_, id, nome) => `Anotou uma observação na ficha de ${nome(id)}`],
  ['DELETE', /^\/observacoes\/(\d+)$/, 'excluiu', 'observacao', (_, id) => `Excluiu a observação #${id}`],
  ['POST', /^\/vagas$/, 'incluiu', 'vaga', (c) => `Cadastrou a vaga ${c.titulo_vaga || ''}`],
  ['POST', /^\/vagas\/(\d+)\/indicar$/, 'incluiu', 'indicacao', (_, id) => `Indicou aluno(s) para a vaga #${id}`],
  ['POST', /^\/estudantes\/(\d+)\/codigo-acesso$/, 'incluiu', 'codigo_acesso', (_, id, nome) => `Gerou código de acesso para ${nome(id)}`],
  ['POST', /^\/pedidos-senha\/(\d+)\/aprovar$/, 'alterou', 'pedido_senha', (_, id, __, alunoDoPedido) => `Aprovou o pedido de senha nova de ${alunoDoPedido(id)}`],
  ['POST', /^\/pedidos-senha\/(\d+)\/recusar$/, 'alterou', 'pedido_senha', (_, id, __, alunoDoPedido) => `Recusou o pedido de senha nova de ${alunoDoPedido(id)}`],
  ['POST', /^\/gestao\/usuarios$/, 'incluiu', 'usuario_gestao', (c) => `Criou a conta de ${c.nome} (${c.papel})`],
  ['PUT', /^\/gestao\/usuarios\/(\d+)$/, 'alterou', 'usuario_gestao', (_, id) => `Alterou a conta da gestão #${id}`],
  ['POST', /^\/auditoria\/exportacao$/, 'exportou', 'exportacao', (c) => `Exportou ${c.descricao}`],
  ['POST', /^\/rodadas-entrevista\/(\d+)\/confirmar$/, 'alterou', 'rodada_entrevista', (_, id) => `Confirmou a Meta de Entrevista (rodada #${id})`],
  ['POST', /^\/rodadas-entrevista\/(\d+)\/nao-confirmar$/, 'alterou', 'rodada_entrevista', (_, id) => `Não confirmou a meta e abriu nova rodada (rodada #${id})`],
  ['POST', /^\/estudantes\/(\d+)\/contratos$/, 'incluiu', 'contrato', (_, id, nome) => `Incluiu contrato de aprendizagem de ${nome(id)}`],
  ['PUT', /^\/contratos\/(\d+)$/, 'alterou', 'contrato', (_, id) => `Alterou o contrato de aprendizagem #${id}`],
  ['DELETE', /^\/contratos\/(\d+)$/, 'excluiu', 'contrato', (_, id) => `Excluiu o contrato de aprendizagem #${id}`],
  ['PUT', /^\/estudantes\/(\d+)\/foto$/, 'alterou', 'foto', (_, id, nome) => `Trocou a foto de ${nome(id)}`],
  ['DELETE', /^\/estudantes\/(\d+)\/foto$/, 'excluiu', 'foto', (_, id, nome) => `Excluiu a foto de ${nome(id)}`],
  ['PUT', /^\/candidaturas\/(\d+)$/, 'alterou', 'candidatura', (_, id) => `Atualizou a candidatura #${id}`],
  ['POST', /^\/turmas\/(\d+)\/codigos-acesso$/, 'incluiu', 'codigo_acesso', (_, id) => `Gerou códigos de acesso da turma #${id}`],
  ['POST', /^\/modulos$/, 'incluiu', 'modulo', (c) => `Criou o módulo ${c.titulo || ''}`],
  ['PUT', /^\/modulos\/(\d+)$/, 'alterou', 'modulo', (_, id) => `Alterou o módulo #${id}`],
  ['DELETE', /^\/modulos\/(\d+)$/, 'excluiu', 'modulo', (_, id) => `Excluiu o módulo #${id}`],
  ['POST', /^\/modulos\/(\d+)\/aulas$/, 'incluiu', 'aula', (c) => `Criou a aula ${c.titulo || ''}`],
  ['PUT', /^\/aulas\/(\d+)$/, 'alterou', 'aula', (_, id) => `Alterou a aula #${id}`],
  ['DELETE', /^\/aulas\/(\d+)$/, 'excluiu', 'aula', (_, id) => `Excluiu a aula #${id}`],
  ['PUT', /^\/aulas\/(\d+)\/perguntas$/, 'alterou', 'aula', (_, id) => `Alterou as perguntas de fixação da aula #${id}`],
  ['PUT', /^\/estudantes\/(\d+)\/certificados\/(\d+)$/, 'alterou', 'certificado', (_, id, nome) => `Marcou a retirada do certificado de ${nome(id)}`],
  ['DELETE', /^\/estudantes\/(\d+)\/certificados\/(\d+)$/, 'excluiu', 'certificado', (_, id, nome) => `Desfez a retirada do certificado de ${nome(id)}`],
  ['POST', /^\/mensagens\/diretos$/, 'incluiu', 'conversa', () => 'Abriu conversa com aluno'],
  ['POST', /^\/mensagens\/grupos$/, 'incluiu', 'grupo', (c) => `Criou o grupo ${c.nome || ''}`],
  ['POST', /^\/mensagens\/canais\/(\d+)\/mensagens$/, 'incluiu', 'mensagem', (_, id) => `Enviou mensagem no canal #${id}`],
  ['POST', /^\/mensagens\/(\d+)\/ocultar$/, 'alterou', 'mensagem', (_, id) => `Ocultou a mensagem #${id}`],
  ['POST', /^\/gestao\/usuarios\/(\d+)\/resetar-senha$/, 'alterou', 'usuario_gestao', (_, id) => `Gerou senha temporária para a conta #${id}`],
  ['POST', /^\/gestao\/minha-senha$/, 'alterou', 'usuario_gestao', () => 'Trocou a própria senha'],
];

export const criarMockGestao = ({ ALUNOS, respostaFake, erroFake, agoraIso, diasAtras, alunoDoPedido = (id) => `pedido #${id}` }) => {
  let proximaContaId = 5;
  let proximoRegistroId = 1;
  const contas = [
    { id: 1, nome: 'Coordenação (demo)', usuario: 'coordenacao', papel: 'administrador' },
    { id: 2, nome: 'Auditoria (demo)', usuario: 'auditoria', papel: 'auditor' },
    { id: 3, nome: 'Secretaria (demo)', usuario: 'secretaria', papel: 'alterar' },
    { id: 4, nome: 'Professor (demo)', usuario: 'professor', papel: 'visualizar' },
  ].map((c) => ({ ...c, senha: 'escola123', ativo: true, deve_trocar_senha: false, versao: 0, ultimo_acesso_em: null, criado_em: diasAtras(30) }));
  const registros = [];
  const registrar = (conta, acao, entidade, descricao, dados = null, antes = null) => {
    registros.unshift({
      id: proximoRegistroId++, criado_em: agoraIso(), usuario_gestao_id: conta?.id ?? null, usuario_nome: conta?.nome ?? '(desconhecido)',
      papel: conta?.papel ?? null, acao, acao_rotulo: ACOES[acao], entidade, entidade_id: null, descricao, dados, antes, ip: '127.0.0.1 (demo)',
    });
  };
  // Um pouco de histórico pra aba Auditoria não abrir vazia
  registros.push(
    { id: proximoRegistroId++, criado_em: diasAtras(2, 9), usuario_gestao_id: 3, usuario_nome: 'Secretaria (demo)', papel: 'alterar', acao: 'alterou', acao_rotulo: 'Alterou', entidade: 'aluno', entidade_id: '2', descricao: 'Alterou o cadastro de Bianca Ferreira (#2)', dados: { telefone: '67991112222' }, antes: { telefone: '67990000000' }, ip: '127.0.0.1 (demo)' },
    { id: proximoRegistroId++, criado_em: diasAtras(3, 14), usuario_gestao_id: 4, usuario_nome: 'Professor (demo)', papel: 'visualizar', acao: 'exportou', acao_rotulo: 'Exportou', entidade: 'exportacao', entidade_id: null, descricao: 'Exportou alunos (CSV, 12 registros)', dados: null, antes: null, ip: '127.0.0.1 (demo)' },
  );

  const nomeAluno = (id) => {
    const a = ALUNOS.find((x) => x.id === Number(id));
    return a ? `${a.nome} (#${id})` : `aluno #${id}`;
  };
  const tokenDe = (c) => `demo-admin-${c.id}-v${c.versao}`;
  const gestorParaApi = (c) => ({ id: c.id, nome: c.nome, usuario: c.usuario, papel: c.papel, instalacao: false, deve_trocar_senha: c.deve_trocar_senha, permissoes: PERFIS_GESTAO[c.papel], perfis: PERFIS_GESTAO, escola: { id: 1, nome: 'Escola de demonstração' } });
  const contaParaApi = (c) => ({ id: c.id, nome: c.nome, usuario: c.usuario, papel: c.papel, ativo: c.ativo, deve_trocar_senha: c.deve_trocar_senha, ultimo_acesso_em: c.ultimo_acesso_em, criado_em: c.criado_em });
  const senhaTemporaria = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8).toUpperCase();

  return {
    login: (corpo) => {
      const conta = contas.find((c) => c.usuario === String(corpo.usuario || '').trim().toLowerCase());
      if (!conta || !conta.ativo || conta.senha !== corpo.senha) {
        registrar(null, 'falhou_login', null, 'Errou usuário ou senha do painel', { usuario: corpo.usuario || '' });
        return erroFake('Usuário ou senha incorretos.', 401);
      }
      conta.ultimo_acesso_em = agoraIso();
      registrar(conta, 'entrou', null, 'Entrou no painel');
      return respostaFake({ token: tokenDe(conta), gestor: gestorParaApi(conta) });
    },

    contaDoToken: (token) => {
      const m = /^demo-admin-(\d+)-v(\d+)$/.exec(token || '');
      const conta = m && contas.find((c) => c.id === Number(m[1]));
      return conta && conta.ativo && conta.versao === Number(m[2]) ? conta : null;
    },

    // Mesmas travas de auth.get_admin_atual. Devolve um erro ou null.
    barrar: (conta, metodo, caminho) => {
      if (conta.deve_trocar_senha && !['/api/admin/gestao/minha-senha', '/api/admin/gestao/eu'].includes(caminho)) return erroFake('Troque a senha temporária antes de continuar.', 403);
      if (metodo !== 'GET' && !PERFIS_GESTAO[conta.papel].alterar && !ROTAS_LIVRES.includes(caminho)) {
        registrar(conta, 'negado', null, `Tentou sem permissão: ${metodo} ${caminho.replace('/api/admin', '')}`);
        return erroFake(`O seu perfil (${PERFIS_GESTAO[conta.papel].rotulo}) é só de visualização.`, 403);
      }
      return null;
    },

    // Depois de uma alteração bem-sucedida: vira registro de auditoria
    auditar: (conta, metodo, caminho, corpo) => {
      if (metodo === 'GET') return;
      const resto = caminho.replace('/api/admin', '');
      const regra = ROTAS.find(([m, padrao]) => m === metodo && padrao.test(resto));
      const id = regra ? (resto.match(regra[1]) || [])[1] : null;
      const acao = regra ? regra[2] : ({ POST: 'incluiu', PUT: 'alterou', DELETE: 'excluiu' }[metodo] || 'alterou');
      const descricao = regra ? regra[4](corpo || {}, id, nomeAluno, alunoDoPedido) : `${metodo} ${resto}`;
      const dados = corpo && !(corpo instanceof FormData)
        ? Object.fromEntries(Object.entries(corpo).map(([k, v]) => [k, /senha|codigo|imagem|base64/i.test(k) ? '[omitido]' : v]))
        : null;
      registrar(conta, acao, regra ? regra[3] : null, descricao, dados);
    },

    rotas: (metodo, caminho, query, corpo, conta) => {
      if (metodo === 'GET' && caminho === '/api/admin/gestao/eu') return respostaFake(gestorParaApi(conta));
      if (metodo === 'POST' && caminho === '/api/admin/gestao/minha-senha') {
        if (corpo.senha_atual !== conta.senha) return erroFake('Senha atual incorreta.', 403);
        if ((corpo.nova_senha || '').length < 10 || !/[a-zA-Z]/.test(corpo.nova_senha) || !/\d/.test(corpo.nova_senha)) return erroFake('A senha precisa de pelo menos 10 caracteres, com letras e números.', 422);
        Object.assign(conta, { senha: corpo.nova_senha, deve_trocar_senha: false, versao: conta.versao + 1 });
        return respostaFake({ token: tokenDe(conta) });
      }
      if (caminho.startsWith('/api/admin/gestao/usuarios') && !PERFIS_GESTAO[conta.papel].contas) return erroFake('Só o perfil Administrador gerencia as contas da gestão.', 403);
      if (metodo === 'GET' && caminho === '/api/admin/gestao/usuarios') return respostaFake(contas.map(contaParaApi));
      if (metodo === 'POST' && caminho === '/api/admin/gestao/usuarios') {
        const usuario = String(corpo.usuario || '').trim().toLowerCase();
        if (contas.some((c) => c.usuario === usuario)) return erroFake('Esse usuário já existe. Escolha outro.', 409);
        const senha = senhaTemporaria();
        const nova = { id: proximaContaId++, nome: corpo.nome.trim(), usuario, papel: corpo.papel, senha, ativo: true, deve_trocar_senha: true, versao: 0, ultimo_acesso_em: null, criado_em: agoraIso() };
        contas.push(nova);
        return respostaFake({ ...contaParaApi(nova), senha_temporaria: senha }, 201);
      }
      const daConta = caminho.match(/^\/api\/admin\/gestao\/usuarios\/(\d+)(\/resetar-senha)?$/);
      if (daConta) {
        const alvo = contas.find((c) => c.id === Number(daConta[1]));
        if (!alvo) return erroFake('Conta não encontrada', 404);
        if (daConta[2]) {
          const senha = senhaTemporaria();
          Object.assign(alvo, { senha, deve_trocar_senha: true, versao: alvo.versao + 1 });
          return respostaFake({ senha_temporaria: senha });
        }
        const outrosAdmins = contas.some((c) => c.id !== alvo.id && c.papel === 'administrador' && c.ativo);
        const tiraAdmin = alvo.papel === 'administrador' && ((corpo.papel && corpo.papel !== 'administrador') || corpo.ativo === false);
        if (tiraAdmin && !outrosAdmins) return erroFake('Precisa existir pelo menos um Administrador ativo. Crie outro antes.', 409);
        if (alvo.id === conta.id && corpo.ativo === false) return erroFake('Você não pode desativar a sua própria conta.', 409);
        const mudouAcesso = (corpo.papel && corpo.papel !== alvo.papel) || (corpo.ativo != null && corpo.ativo !== alvo.ativo);
        if (corpo.nome) alvo.nome = corpo.nome;
        if (corpo.papel) alvo.papel = corpo.papel;
        if (corpo.ativo != null) alvo.ativo = corpo.ativo;
        if (mudouAcesso) alvo.versao += 1;
        return respostaFake(contaParaApi(alvo));
      }
      if (caminho.startsWith('/api/admin/auditoria') && caminho !== '/api/admin/auditoria/exportacao' && !PERFIS_GESTAO[conta.papel].auditar) return erroFake('Só os perfis Administrador e Auditor veem a auditoria.', 403);
      const filtrar = () => registros.filter((r) => (!query.get('usuario_id') || String(r.usuario_gestao_id) === query.get('usuario_id'))
        && (!query.get('acao') || r.acao === query.get('acao')) && (!query.get('entidade') || r.entidade === query.get('entidade'))
        && (!query.get('de') || r.criado_em.slice(0, 10) >= query.get('de')) && (!query.get('ate') || r.criado_em.slice(0, 10) <= query.get('ate'))
        && (!query.get('busca') || `${r.descricao} ${r.usuario_nome}`.toLowerCase().includes(query.get('busca').toLowerCase())));
      if (metodo === 'GET' && caminho === '/api/admin/auditoria') {
        const lista = filtrar();
        const pagina = Number(query.get('pagina') || 1);
        const porPagina = Number(query.get('por_pagina') || 50);
        return respostaFake({
          itens: lista.slice((pagina - 1) * porPagina, pagina * porPagina), total: lista.length, pagina, por_pagina: porPagina, acoes: ACOES,
          entidades: [...new Set(registros.map((r) => r.entidade).filter(Boolean))].sort(), pessoas: contas.map((c) => ({ id: c.id, nome: c.nome })), retencao_dias: 730,
        });
      }
      if (metodo === 'GET' && caminho === '/api/admin/auditoria/exportar') {
        const lista = filtrar();
        registrar(conta, 'exportou', 'auditoria', `Exportou a auditoria (CSV, ${lista.length} registros)`);
        const csv = ['Data e hora;Quem;Perfil;Ação;O quê;IP', ...lista.map((r) => [r.criado_em, r.usuario_nome, r.papel || '', r.acao_rotulo, r.descricao, r.ip].join(';'))].join('\r\n');
        return Promise.resolve({ ok: true, status: 200, blob: async () => new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), json: async () => ({}) });
      }
      if (metodo === 'POST' && caminho === '/api/admin/auditoria/exportacao') return respostaFake({ registrado: true });
      return null;
    },
  };
};
