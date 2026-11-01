// Modo demonstração do acesso do aluno -- as mesmas regras de acesso.py:
// login por usuário + senha, primeiro acesso com CPF + código da escola,
// pedido de senha nova aprovado no painel e troca de senha em "Minha conta".

const CODIGO_VALIDADE_DIAS = 7;
const CODIGO_TENTATIVAS_MAX = 5;
const LOGIN_FALHAS_MAX = 5;
const LOGIN_BLOQUEIO_MINUTOS = 10;
const ERRO_CODIGO = 'CPF ou código incorretos, ou o código venceu. Confira com a coordenação da escola.';
const ERRO_LOGIN = 'Usuário ou senha incorretos.';
const STATUS_PEDIDO = { pendente: 'Aguardando aprovação', aprovado: 'Aprovado (código entregue)', recusado: 'Recusado', concluido: 'Senha nova criada' };
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

const soLetras = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

// Mesma regra de nomes.escolher_usuario
export const escolherUsuario = (nomeCompleto, ocupados) => {
  let partes = nomeCompleto.split(/\s+/).map(soLetras).filter(Boolean);
  if (!partes.length) partes = ['aluno'];
  const [primeiro] = partes;
  const candidatos = partes.length === 1 ? [primeiro] : [];
  if (partes.length > 1) {
    const ultimo = partes[partes.length - 1];
    const meios = partes.slice(1, -1).filter((p) => !PARTICULAS.has(p));
    candidatos.push(`${primeiro}.${ultimo}`);
    meios.forEach((m) => candidatos.push(`${primeiro}.${m[0]}.${ultimo}`));
    meios.forEach((m) => candidatos.push(`${primeiro}.${m}.${ultimo}`));
  }
  const livre = candidatos.map((c) => c.slice(0, 40)).find((c) => !ocupados.has(c));
  if (livre) return livre;
  const base = candidatos[0].slice(0, 36);
  let n = 2;
  while (ocupados.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
};

const validarNovaSenha = (senha, aluno, acesso) => {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[a-zA-ZÀ-ÿ]/.test(senha) || !/\d/.test(senha)) return 'Misture letras e números na senha.';
  const digitos = senha.replace(/\D/g, '');
  if (aluno.cpf && (digitos.includes(aluno.cpf) || (digitos.length >= 6 && aluno.cpf.includes(digitos)))) return 'A senha não pode ser o seu CPF nem um pedaço dele.';
  if (acesso.usuario && senha.toLowerCase().replace(/\./g, '').includes(acesso.usuario.replace(/\./g, ''))) return 'A senha não pode conter o seu usuário.';
  return null;
};

const sortearCodigo = () => String(Math.floor(Math.random() * 1e6)).padStart(6, '0');

export const criarMockAcesso = ({ ALUNOS, TURMAS, respostaFake, erroFake, agoraIso, diasAtras }) => {
  const agora = () => Date.now();
  const emDias = (dias) => new Date(agora() + dias * 86400000).toISOString().slice(0, 19);

  // alunoId -> { usuario, senha, senhaEm, codigo, codigoExpira, tentativas, falhas, bloqueadoAte, versao }
  const acessos = new Map();
  const ocupados = new Set();
  const novoAcesso = (aluno) => {
    const usuario = escolherUsuario(aluno.nome, ocupados);
    ocupados.add(usuario);
    const acesso = { usuario, senha: null, senhaEm: null, codigo: null, codigoExpira: null, tentativas: 0, falhas: 0, bloqueadoAte: 0, versao: 0 };
    acessos.set(aluno.id, acesso);
    return acesso;
  };
  ALUNOS.forEach(novoAcesso);

  // Situação inicial da demonstração: Rafael já tem senha, Bianca vai fazer o
  // primeiro acesso, os alunos 3 a 8 já entraram e os últimos ainda não.
  Object.assign(acessos.get(1), { senha: 'first2work123', senhaEm: diasAtras(20) });
  Object.assign(acessos.get(2), { codigo: '246810', codigoExpira: emDias(CODIGO_VALIDADE_DIAS) });
  ALUNOS.filter((a) => a.id >= 3 && a.id <= 8).forEach((a) => Object.assign(acessos.get(a.id), { senha: `demo-${a.id}-senha1`, senhaEm: diasAtras(10 + a.id) }));

  let proximoPedidoId = 3;
  const pedidos = [
    { id: 1, estudante_id: 4, status: 'concluido', criado_em: diasAtras(6, 9), decidido_em: diasAtras(6, 11), concluido_em: diasAtras(5, 8), motivo_recusa: null },
    { id: 2, estudante_id: 3, status: 'pendente', criado_em: diasAtras(0, 8), decidido_em: null, concluido_em: null, motivo_recusa: null },
  ];

  const codigoValido = (acesso) => Boolean(acesso.codigo && acesso.codigoExpira > agoraIso() && acesso.tentativas < CODIGO_TENTATIVAS_MAX);
  const statusAcesso = (acesso) => (codigoValido(acesso) ? 'codigo_gerado' : acesso.senha ? 'ativo' : 'sem_acesso');
  const token = (aluno) => `demo-aluno-${aluno.id}-v${acessos.get(aluno.id).versao}`;
  const sessao = (aluno) => respostaFake({ token: token(aluno), estudante: { id: aluno.id, nome: aluno.nome, usuario: acessos.get(aluno.id).usuario } });
  const porUsuario = (texto) => ALUNOS.find((a) => acessos.get(a.id)?.usuario === String(texto || '').trim().toLowerCase());
  const porCpf = (texto) => {
    const cpf = String(texto || '').replace(/\D/g, '');
    return cpf.length === 11 ? ALUNOS.find((a) => a.cpf === cpf) : null;
  };

  const conferir = (corpo) => {
    const aluno = porCpf(corpo.cpf);
    const acesso = aluno && acessos.get(aluno.id);
    if (!acesso || !codigoValido(acesso)) return [null, erroFake(ERRO_CODIGO, 401)];
    if (String(corpo.codigo || '').replace(/\D/g, '') !== acesso.codigo) {
      acesso.tentativas += 1;
      return [null, erroFake(ERRO_CODIGO, 401)];
    }
    return [aluno, null];
  };

  const definirSenha = (aluno, senha) => {
    const acesso = acessos.get(aluno.id);
    const problema = validarNovaSenha(senha || '', aluno, acesso);
    if (problema) return erroFake(problema, 422);
    Object.assign(acesso, { senha, senhaEm: agoraIso(), codigo: null, codigoExpira: null, tentativas: 0, falhas: 0, bloqueadoAte: 0, versao: acesso.versao + 1 });
    pedidos.filter((p) => p.estudante_id === aluno.id && p.status === 'aprovado').forEach((p) => Object.assign(p, { status: 'concluido', concluido_em: agoraIso() }));
    return null;
  };

  const emitir = (aluno) => {
    const acesso = acessos.get(aluno.id) || novoAcesso(aluno);
    Object.assign(acesso, { codigo: sortearCodigo(), codigoExpira: emDias(CODIGO_VALIDADE_DIAS), tentativas: 0 });
    pedidos.filter((p) => p.estudante_id === aluno.id && p.status === 'pendente').forEach((p) => Object.assign(p, { status: 'aprovado', decidido_em: agoraIso() }));
    return {
      estudante_id: aluno.id, nome: aluno.nome, turma: TURMAS.find((t) => t.id === aluno.turma_id)?.nome ?? null,
      usuario: acesso.usuario, codigo: acesso.codigo, expira_em: acesso.codigoExpira, ja_tinha_senha: Boolean(acesso.senha),
    };
  };

  return {
    // Campos de acesso na lista de alunos do painel (o código em si nunca vai)
    camposDoAluno: (aluno) => {
      const acesso = acessos.get(aluno.id) || novoAcesso(aluno);
      return { usuario: acesso.usuario, status_acesso: statusAcesso(acesso), codigo_acesso_expira_em: codigoValido(acesso) ? acesso.codigoExpira : null, senha_definida_em: acesso.senhaEm };
    },
    pendentes: () => pedidos.filter((p) => p.status === 'pendente').length,
    // "Lucas Andrade (pedido #2)" -- pra descrição da auditoria
    nomeDoPedido: (id) => {
      const pedido = pedidos.find((p) => p.id === Number(id));
      const aluno = pedido && ALUNOS.find((a) => a.id === pedido.estudante_id);
      return aluno ? `${aluno.nome} (pedido #${id})` : `pedido #${id}`;
    },
    usuarioDe: (alunoId) => acessos.get(alunoId)?.usuario ?? null,

    // Token do aluno: "demo-aluno-<id>-v<versão>" -- senha nova derruba os antigos
    alunoDoToken: (tokenRecebido) => {
      const m = /^demo-aluno-(\d+)-v(\d+)$/.exec(tokenRecebido || '');
      if (!m) return null;
      const aluno = ALUNOS.find((a) => a.id === Number(m[1]));
      return aluno && acessos.get(aluno.id)?.versao === Number(m[2]) ? aluno : null;
    },

    // Rotas abertas (sem token). Devolve null se não for uma delas.
    publico: (metodo, caminho, corpo) => {
      if (metodo !== 'POST') return null;
      if (caminho === '/api/auth/login') {
        const aluno = porUsuario(corpo.usuario);
        const acesso = aluno && acessos.get(aluno.id);
        if (!acesso?.senha) return erroFake(ERRO_LOGIN, 401);
        if (acesso.bloqueadoAte > agora()) return erroFake(`Muitas tentativas erradas. Espere ${LOGIN_BLOQUEIO_MINUTOS} minutos ou peça ajuda à coordenação.`, 429);
        if (corpo.senha !== acesso.senha) {
          acesso.falhas += 1;
          if (acesso.falhas >= LOGIN_FALHAS_MAX) Object.assign(acesso, { falhas: 0, bloqueadoAte: agora() + LOGIN_BLOQUEIO_MINUTOS * 60000 });
          return erroFake(ERRO_LOGIN, 401);
        }
        acesso.falhas = 0;
        return sessao(aluno);
      }
      if (caminho === '/api/auth/primeiro-acesso/conferir') {
        const [aluno, erro] = conferir(corpo);
        if (erro) return erro;
        const acesso = acessos.get(aluno.id);
        return respostaFake({ usuario: acesso.usuario, primeiro_nome: aluno.nome.split(' ')[0], ja_tinha_senha: Boolean(acesso.senha) });
      }
      if (caminho === '/api/auth/primeiro-acesso') {
        const [aluno, erro] = conferir(corpo);
        if (erro) return erro;
        return definirSenha(aluno, corpo.nova_senha) || sessao(aluno);
      }
      if (caminho === '/api/auth/esqueci-senha') {
        const texto = String(corpo.identificador || '').trim();
        const aluno = /[a-z]/i.test(texto) ? porUsuario(texto) : porCpf(texto);
        if (aluno && !pedidos.some((p) => p.estudante_id === aluno.id && p.status === 'pendente')) {
          pedidos.push({ id: proximoPedidoId++, estudante_id: aluno.id, status: 'pendente', criado_em: agoraIso(), decidido_em: null, concluido_em: null, motivo_recusa: null });
        }
        return respostaFake({ mensagem: 'Pedido enviado para a coordenação. Quando for aprovado, a escola entrega um código pra você: use em "Tenho um código" na tela de entrada, com o seu CPF.' });
      }
      return null;
    },

    // Rotas do aluno logado
    logado: (metodo, caminho, corpo, aluno) => {
      if (metodo === 'POST' && caminho === '/api/auth/trocar-senha') {
        const acesso = acessos.get(aluno.id);
        if (corpo.senha_atual !== acesso.senha) return erroFake('Senha atual incorreta.', 403);
        if (corpo.nova_senha === corpo.senha_atual) return erroFake('A senha nova precisa ser diferente da atual.', 422);
        return definirSenha(aluno, corpo.nova_senha) || respostaFake({ token: token(aluno) });
      }
      return null;
    },

    admin: (metodo, caminho, query, corpo) => {
      const doAluno = metodo === 'POST' && caminho.match(/^\/api\/admin\/estudantes\/(\d+)\/codigo-acesso$/);
      if (doAluno) {
        const aluno = ALUNOS.find((a) => a.id === Number(doAluno[1]));
        if (!aluno) return erroFake('Aluno não encontrado', 404);
        if (!aluno.cpf) return erroFake(`${aluno.nome} não tem CPF cadastrado: o primeiro acesso é com CPF + código.`, 422);
        return respostaFake(emitir(aluno));
      }
      const daTurma = metodo === 'POST' && caminho.match(/^\/api\/admin\/turmas\/(\d+)\/codigos-acesso$/);
      if (daTurma) {
        const turma = TURMAS.find((t) => t.id === Number(daTurma[1]));
        if (!turma) return erroFake('Turma não encontrada', 404);
        const alvo = ALUNOS
          .filter((a) => a.turma_id === turma.id && a.cpf && (corpo.apenas_sem_acesso === false || !acessos.get(a.id)?.senha))
          .sort((x, y) => x.nome.localeCompare(y.nome));
        return respostaFake({ turma: turma.nome, codigos: alvo.map(emitir), validade_dias: CODIGO_VALIDADE_DIAS });
      }
      if (metodo === 'GET' && caminho === '/api/admin/pedidos-senha') {
        const lista = (query.get('situacao') === 'todos' ? pedidos : pedidos.filter((p) => p.status === 'pendente'))
          .slice().sort((x, y) => y.criado_em.localeCompare(x.criado_em));
        return respostaFake(lista.map((p) => {
          const aluno = ALUNOS.find((a) => a.id === p.estudante_id);
          return {
            ...p, nome: aluno.nome, usuario: acessos.get(aluno.id)?.usuario, turma: TURMAS.find((t) => t.id === aluno.turma_id)?.nome ?? null,
            telefone: aluno.telefone ?? null, responsavel_telefone: aluno.responsavel_telefone ?? null, status_rotulo: STATUS_PEDIDO[p.status],
          };
        }));
      }
      const decisao = metodo === 'POST' && caminho.match(/^\/api\/admin\/pedidos-senha\/(\d+)\/(aprovar|recusar)$/);
      if (decisao) {
        const pedido = pedidos.find((p) => p.id === Number(decisao[1]));
        if (!pedido) return erroFake('Pedido não encontrado', 404);
        if (pedido.status !== 'pendente') return erroFake('Esse pedido já foi respondido.', 409);
        if (decisao[2] === 'aprovar') return respostaFake(emitir(ALUNOS.find((a) => a.id === pedido.estudante_id)));
        Object.assign(pedido, { status: 'recusado', decidido_em: agoraIso(), motivo_recusa: (corpo.motivo || '').trim() || null });
        return respostaFake({ sucesso: true });
      }
      return null;
    },
  };
};
