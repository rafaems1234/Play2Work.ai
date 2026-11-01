// Modo demonstração do Simulado de Certificação -- as mesmas regras de
// certificacao.py: 20 questões do banco (16 do curso + 4 gerais), tentativa
// única por ciclo, 40 min, aprovação com 70%, gabarito só "no servidor".
import BANCO_QUESTOES from './data/banco_questoes.json';

const TOTAL_QUESTOES = 20;
const QUESTOES_GERAIS = 4;
const NOTA_MINIMA = 70;
const DURACAO_MINUTOS = 40;
const DIAS_ENTRE_TENTATIVAS = 7;
const REGRAS = { total_questoes: TOTAL_QUESTOES, nota_minima: NOTA_MINIMA, duracao_minutos: DURACAO_MINUTOS, dias_entre_tentativas: DIAS_ENTRE_TENTATIVAS };

const embaralhar = (lista) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};
const embaralharOpcoes = (p) => {
  const ordem = embaralhar(p.opcoes.map((_, i) => i));
  return { pergunta: p.pergunta, opcoes: ordem.map((i) => p.opcoes[i]), resposta_correta_index: ordem.indexOf(p.resposta_correta_index) };
};

export const criarMockCertificacao = ({ respostaFake, erroFake, registrarEvidencias }) => {
  const tentativas = new Map(); // alunoId -> [tentativa]
  let proximoId = 1;
  const isoDe = (ms) => new Date(ms).toISOString().slice(0, 19);
  const msDe = (iso) => new Date(`${iso}Z`).getTime();

  // Demonstração: a Bianca (2) já é certificada
  tentativas.set(2, [{
    id: proximoId++, itinerario: 'Ciência de Dados', status: 'aprovada', iniciada_em: isoDe(Date.now() - 6 * 864e5), expira_em: isoDe(Date.now() - 6 * 864e5 + 24e5),
    concluida_em: isoDe(Date.now() - 6 * 864e5 + 18e5), gabarito: [], respostas: [], acertos: 17, total: 20, percentual: 85, saidas_de_tela: 0,
  }]);

  const doAluno = (id) => tentativas.get(id) || [];
  const resultado = (t) => ({
    id: t.id, itinerario: t.itinerario, status: t.status, acertos: t.acertos ?? null, total: t.total ?? null, percentual: t.percentual ?? null,
    iniciada_em: t.iniciada_em, concluida_em: t.concluida_em ?? null, saidas_de_tela: t.saidas_de_tela,
  });
  const prova = (t) => ({ id: t.id, questoes: t.gabarito.map(({ pergunta, opcoes }) => ({ pergunta, opcoes })), respondidas: t.respostas.length, expira_em: t.expira_em });
  const finalizar = (t, alunoId) => {
    t.acertos = t.respostas.filter((r) => r.correta).length;
    t.total = t.gabarito.length;
    t.percentual = Math.round((t.acertos / t.total) * 100);
    t.status = t.percentual >= NOTA_MINIMA ? 'aprovada' : 'reprovada';
    t.concluida_em = isoDe(Math.min(Date.now(), msDe(t.expira_em)));
    if (t.status === 'aprovada') registrarEvidencias(alunoId, { conhecimento: t.percentual }, 'certificacao');
  };
  const fecharVencidas = (alunoId) => doAluno(alunoId).forEach((t) => { if (t.status === 'em_andamento' && Date.now() >= msDe(t.expira_em)) finalizar(t, alunoId); });
  const aprovacao = (aluno) => doAluno(aluno.id).find((t) => t.status === 'aprovada' && t.itinerario === aluno.itinerario) || null;
  const proxima = (aluno) => {
    const reprovadas = doAluno(aluno.id).filter((t) => t.status === 'reprovada' && t.itinerario === aluno.itinerario);
    if (!reprovadas.length) return null;
    const ms = Math.max(...reprovadas.map((t) => msDe(t.concluida_em))) + DIAS_ENTRE_TENTATIVAS * 864e5;
    return ms > Date.now() ? isoDe(ms) : null;
  };

  return {
    camposDoAluno: (aluno) => {
      const feitas = doAluno(aluno.id).filter((t) => t.status !== 'em_andamento');
      const ok = aprovacao(aluno);
      return { certificacao: { tentativas: feitas.length, aprovada: ok ? { itinerario: ok.itinerario, percentual: ok.percentual, em: ok.concluida_em } : null } };
    },
    historico: (alunoId) => [...doAluno(alunoId)].reverse().filter((t) => t.status !== 'em_andamento').map(resultado),

    aluno: (metodo, caminho, corpo, aluno) => {
      if (!caminho.startsWith('/api/certificacao')) return null;
      fecharVencidas(aluno.id);
      const lista = doAluno(aluno.id);
      if (metodo === 'GET' && caminho === '/api/certificacao') {
        const aberta = lista.find((t) => t.status === 'em_andamento');
        const ok = aprovacao(aluno);
        const prox = proxima(aluno);
        const ultima = [...lista].reverse().find((t) => t.status !== 'em_andamento');
        return respostaFake({
          regras: REGRAS, itinerario: aluno.itinerario, aprovacao: ok ? resultado(ok) : null, em_andamento: aberta ? prova(aberta) : null,
          ultima: ultima ? resultado(ultima) : null, proxima_tentativa_em: prox, pode_comecar: Boolean(aluno.itinerario) && !ok && !aberta && !prox,
        });
      }
      if (metodo === 'POST' && caminho === '/api/certificacao/iniciar') {
        if (!aluno.itinerario || !BANCO_QUESTOES[aluno.itinerario]) return erroFake('A escola ainda não definiu o seu curso. Fale com a coordenação.', 409);
        if (lista.some((t) => t.status === 'em_andamento')) return erroFake('Você já tem um simulado em andamento.', 409);
        if (aprovacao(aluno)) return erroFake('Você já foi aprovado no simulado de certificação deste curso.', 409);
        if (proxima(aluno)) return erroFake('Nova tentativa ainda não liberada. Até lá, treine nos quizzes diários.', 409);
        const questoes = [
          ...embaralhar(BANCO_QUESTOES[aluno.itinerario]).slice(0, TOTAL_QUESTOES - QUESTOES_GERAIS),
          ...embaralhar(BANCO_QUESTOES.Geral).slice(0, QUESTOES_GERAIS),
        ];
        const t = {
          id: proximoId++, itinerario: aluno.itinerario, status: 'em_andamento', iniciada_em: isoDe(Date.now()), expira_em: isoDe(Date.now() + DURACAO_MINUTOS * 6e4),
          gabarito: embaralhar(questoes).map(embaralharOpcoes), respostas: [], saidas_de_tela: 0,
        };
        tentativas.set(aluno.id, [...lista, t]);
        return respostaFake(prova(t), 201);
      }
      const rota = caminho.match(/^\/api\/certificacao\/(\d+)\/(responder|saida-de-tela|finalizar)$/);
      const t = rota && lista.find((x) => x.id === Number(rota[1]));
      if (rota && !t) return erroFake('Simulado não encontrado.', 404);
      if (rota && metodo === 'POST' && rota[2] === 'responder') {
        if (t.status !== 'em_andamento') return erroFake('Esse simulado já foi encerrado.', 409);
        if (corpo.indice !== t.respostas.length || corpo.indice >= t.gabarito.length) return erroFake('Responda as questões na ordem.', 400);
        t.respostas.push({ indice: corpo.indice, opcao: corpo.opcao, correta: corpo.opcao === t.gabarito[corpo.indice].resposta_correta_index });
        return respostaFake({ respondidas: t.respostas.length, total: t.gabarito.length });
      }
      if (rota && metodo === 'POST' && rota[2] === 'saida-de-tela') {
        if (t.status === 'em_andamento') t.saidas_de_tela += 1;
        return respostaFake({ saidas_de_tela: t.saidas_de_tela });
      }
      if (rota && metodo === 'POST' && rota[2] === 'finalizar') {
        if (t.status === 'em_andamento') finalizar(t, aluno.id);
        return respostaFake({ ...resultado(t), nota_minima: NOTA_MINIMA, dias_entre_tentativas: DIAS_ENTRE_TENTATIVAS });
      }
      return null;
    },
  };
};
