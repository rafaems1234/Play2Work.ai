// Modo demonstração da trilha EAD: simula no navegador as rotas de
// aulas_routes.py com as mesmas regras de aulas.py (blocos de 10 s, só conta
// o trecho reproduzido em 1x dentro do tempo real, fixação com nota de corte,
// certificado de conclusão retirado na escola e registrado pela coordenação).
//
// Os vídeos aqui são simulados (player "demo"), curtos, pra apresentação
// funcionar sem internet e sem depender de vídeos que a escola ainda não gravou.

import { hojeLocalIso } from './utils/formatos';

const BLOCO = 10;
const FOLGA = 15;

// ---------------------------------------------------------------- arquivos gerados no navegador
// PDF mínimo de uma página (A4 deitado), Helvetica com acentos em WinAnsi
const gerarPdf = (linhas) => {
  const escapar = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const conteudo = linhas.map(([texto, tamanho, y]) => `BT /F1 ${tamanho} Tf 60 ${y} Td (${escapar(texto)}) Tj ET`).join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posicoes = objetos.map((objeto, i) => {
    const posicao = pdf.length;
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
    return posicao;
  });
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return new Blob([Uint8Array.from(pdf, (c) => c.charCodeAt(0) & 0xff)], { type: 'application/pdf' });
};

// Áudio de apoio: 12 s de tom suave (WAV), só pra demonstrar o player
const gerarAudio = (segundos = 12) => {
  const taxa = 8000;
  const amostras = taxa * segundos;
  const buffer = new ArrayBuffer(44 + amostras * 2);
  const v = new DataView(buffer);
  const texto = (pos, s) => [...s].forEach((c, i) => v.setUint8(pos + i, c.charCodeAt(0)));
  texto(0, 'RIFF'); v.setUint32(4, 36 + amostras * 2, true); texto(8, 'WAVE'); texto(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); texto(36, 'data'); v.setUint32(40, amostras * 2, true);
  for (let i = 0; i < amostras; i += 1) {
    const envelope = Math.min(1, i / 2000, (amostras - i) / 2000);
    v.setInt16(44 + i * 2, Math.sin((2 * Math.PI * (i % (taxa * 2) < taxa ? 440 : 523) * i) / taxa) * 6000 * envelope, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

// ---------------------------------------------------------------- conteúdo de exemplo
const pergunta = (id, enunciado, opcoes, correta, explicacao) => ({ id, enunciado, opcoes, resposta_correta_index: correta, explicacao });

// Fisher-Yates: a fixação sorteia a ordem das perguntas e das alternativas a cada tentativa
const embaralhar = (lista) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

export const criarMockTrilha = (ctx) => {
  const { ALUNOS, estado, respostaFake, erroFake, registrarEvidencias, concederXp, nomeTurma, agoraIso, diasAtras } = ctx;

  const MODULOS = [
    { id: 1, titulo: 'Integração ao Programa de Aprendizagem', descricao: 'A semana de integração, agora a distância: como funciona a aprendizagem, seus direitos e deveres e a postura no trabalho.', itinerario: null, ordem: 0, publicado: true },
    { id: 2, titulo: 'Primeiros passos em Dados', descricao: 'Planilhas e organização de informação no dia a dia da empresa.', itinerario: 'Ciência de Dados', ordem: 1, publicado: true },
    { id: 3, titulo: 'Segurança do trabalho', descricao: 'Em produção pelos professores.', itinerario: null, ordem: 2, publicado: false },
  ];
  let proximoModuloId = 4;

  const AULAS = [
    {
      id: 1, modulo_id: 1, ordem: 0, titulo: 'Boas-vindas: como funciona a aprendizagem', video_provedor: 'demo', video_id: null, duracao_segundos: 60,
      descricao: 'O que é o contrato de aprendizagem e quem te acompanha.', carga_horaria_minutos: 60, percentual_minimo_assistido: 80, nota_minima: 70, publicada: true,
      texto: 'O contrato de aprendizagem junta duas partes: a formação teórica, com a escola, e as atividades práticas, na empresa.\n\nNa empresa, um profissional fica responsável por te orientar no dia a dia. Na escola, a coordenação acompanha sua frequência e seu desenvolvimento.',
      perguntas: [
        pergunta(1, 'O contrato de aprendizagem combina:', ['Só trabalho na empresa', 'Formação teórica e atividades práticas', 'Só aulas na escola', 'Trabalho por conta própria'], 1, 'A aprendizagem une teoria (escola) e prática (empresa).'),
        pergunta(2, 'Quem acompanha sua frequência e seu desenvolvimento na formação teórica?', ['A coordenação da escola', 'Os colegas de turma', 'Ninguém', 'O cliente da empresa'], 0, 'É a coordenação que acompanha e emite os relatórios.'),
      ],
      materiais: [{ id: 1, tipo: 'documento', nome_arquivo: 'Guia do aprendiz (demonstração).pdf', tipo_mime: 'application/pdf', gerar: () => gerarPdf([['Guia do aprendiz', 26, 480], ['Material de apoio da aula 1 (demonstração).', 14, 430], ['Aqui entra o PDF ou os slides que o professor preparou.', 12, 400]]) }],
    },
    {
      id: 2, modulo_id: 1, ordem: 1, titulo: 'Seus direitos e deveres como aprendiz', video_provedor: 'demo', video_id: null, duracao_segundos: 90,
      descricao: 'Carteira assinada, jornada, frequência e compromissos.', carga_horaria_minutos: 90, percentual_minimo_assistido: 80, nota_minima: 70, publicada: true,
      texto: 'O aprendiz tem carteira de trabalho assinada e direitos trabalhistas. A jornada do aprendiz não pode ser prorrogada com horas extras.\n\nEm troca, ele se compromete a cumprir as atividades com responsabilidade e a manter a frequência na formação teórica.',
      perguntas: [
        pergunta(3, 'O aprendiz tem carteira de trabalho assinada?', ['Não, é só estágio', 'Sim, é um contrato de trabalho', 'Só depois de 1 ano', 'Só se pedir'], 1, 'O contrato de aprendizagem é anotado na carteira de trabalho.'),
        pergunta(4, 'O aprendiz pode fazer horas extras pra compensar outro dia?', ['Sim, sempre', 'Sim, se o chefe pedir', 'Não, a jornada não pode ser prorrogada', 'Só no fim de semana'], 2, 'A lei proíbe prorrogar ou compensar a jornada do aprendiz.'),
        pergunta(5, 'Faltar à formação teórica:', ['Não tem problema', 'Prejudica o contrato de aprendizagem', 'Só importa na empresa', 'Dá direito a folga'], 1, 'A frequência na formação teórica faz parte do contrato.'),
      ],
      materiais: [{ id: 2, tipo: 'audio', nome_arquivo: 'Resumo em áudio (demonstração).wav', tipo_mime: 'audio/wav', gerar: () => gerarAudio() }],
    },
    {
      id: 3, modulo_id: 1, ordem: 2, titulo: 'Postura e comunicação no trabalho', video_provedor: null, video_id: null, duracao_segundos: 45,
      descricao: 'Aula de leitura: avisos, atrasos e como pedir ajuda.', carga_horaria_minutos: 30, percentual_minimo_assistido: 80, nota_minima: 70, publicada: true,
      texto: 'Avise com antecedência: se vai atrasar ou faltar, mande mensagem pro seu responsável assim que souber, dizendo o motivo e quando volta.\n\nPergunte quando não souber: ninguém espera que o aprendiz saiba tudo. Dizer "nunca fiz isso, pode me mostrar?" é sinal de responsabilidade.\n\nCuide dos dados: não fotografe telas, documentos ou informações de clientes.',
      perguntas: [
        pergunta(6, 'Você vai se atrasar porque o ônibus quebrou. O melhor é:', ['Não avisar e explicar ao chegar', 'Avisar seu responsável na hora, com o horário previsto', 'Faltar o dia todo', 'Pedir pra um colega bater seu ponto'], 1, 'Avisar na hora mostra responsabilidade.'),
        pergunta(7, 'Pediram uma tarefa que você nunca fez. O melhor é:', ['Fingir que sabe', 'Recusar', 'Dizer que nunca fez e pedir uma orientação', 'Passar pra um colega'], 2, 'Pedir orientação é o caminho pra aprender.'),
      ],
      materiais: [],
    },
    {
      id: 4, modulo_id: 2, ordem: 0, titulo: 'Planilhas na prática', video_provedor: 'demo', video_id: null, duracao_segundos: 75,
      descricao: 'Organizar uma lista de estoque.', carga_horaria_minutos: 45, percentual_minimo_assistido: 80, nota_minima: 70, publicada: true,
      texto: 'Uma planilha bem organizada tem um cabeçalho por coluna, um registro por linha e nenhuma linha em branco no meio dos dados.',
      perguntas: [pergunta(8, 'Numa planilha organizada, cada linha deve ter:', ['Vários registros', 'Um registro', 'Só títulos', 'Linhas em branco entre os dados'], 1, 'Um registro por linha facilita filtrar e somar.')],
      materiais: [],
    },
  ];
  let proximaAulaId = 5;
  let proximaPerguntaId = 9;
  let proximoMaterialId = 3;
  const blobs = new Map(); // materialId -> Blob

  const progressos = new Map(); // `${alunoId}-${aulaId}` -> progresso
  const logs = new Map();       // alunoId -> [{...}]
  const RETIRADAS = new Map();  // `${alunoId}-${moduloId}` -> { retirado_em, observacao }

  const modulo = (id) => MODULOS.find((m) => m.id === id);
  const aulasDoModulo = (m) => AULAS.filter((a) => a.modulo_id === m.id).sort((x, y) => x.ordem - y.ordem);
  const totalBlocos = (a) => Math.max(1, Math.ceil(a.duracao_segundos / BLOCO));
  const chave = (alunoId, aulaId) => `${alunoId}-${aulaId}`;

  const registrarLog = (alunoId, aula, evento, percentual, nota = null, quando = agoraIso()) => {
    logs.set(alunoId, [{ aula_id: aula.id, aula: aula.titulo, evento, percentual_assistido: percentual, nota, nota_de_corte: nota != null ? aula.nota_minima : null, registrado_em: quando }, ...(logs.get(alunoId) || [])]);
  };

  // Histórico de exemplo: Bianca concluiu a integração (e já retirou o
  // certificado na escola), Ana concluiu e ainda não buscou, outros pela metade
  const concluirDemo = (alunoId, aula, dias) => {
    progressos.set(chave(alunoId, aula.id), { blocos: '1'.repeat(totalBlocos(aula)), percentual: 100, ultimo: 0, melhor: 100, tentativas: 1, concluida_em: diasAtras(dias) });
    registrarLog(alunoId, aula, 'inicio', 0, null, diasAtras(dias, 9));
    registrarLog(alunoId, aula, 'conclusao', 100, 100, diasAtras(dias));
  };
  [2, 6].forEach((alunoId) => AULAS.filter((a) => a.modulo_id === 1).forEach((a, i) => concluirDemo(alunoId, a, 12 - i)));
  [4, 8].forEach((alunoId) => concluirDemo(alunoId, AULAS[0], 5));
  progressos.set(chave(8, 2), { blocos: '1'.repeat(5) + '0'.repeat(4), percentual: 56, ultimo: 0, melhor: null, tentativas: 0, concluida_em: null });

  RETIRADAS.set(chave(2, 1), { retirado_em: diasAtras(8).slice(0, 10), observacao: null });

  // ---------------------------------------------------------------- regras (espelho de aulas.py)
  const situacao = (alunoId, m) => {
    const publicadas = aulasDoModulo(m).filter((a) => a.publicada);
    const concluidas = publicadas.filter((a) => progressos.get(chave(alunoId, a.id))?.concluida_em).length;
    return { aulas_total: publicadas.length, aulas_concluidas: concluidas, concluido: publicadas.length > 0 && concluidas >= publicadas.length };
  };

  // Um certificado por módulo publicado concluído (certificados_dos_alunos em aulas.py)
  const certificadosDoAluno = (alunoId, comObservacao = true) => {
    const aluno = ALUNOS.find((a) => a.id === alunoId);
    return [...MODULOS].filter((m) => m.publicado).sort((a, b) => a.ordem - b.ordem).flatMap((m) => {
      const publicadas = aulasDoModulo(m).filter((a) => a.publicada);
      const datas = publicadas.map((a) => progressos.get(chave(alunoId, a.id))?.concluida_em);
      const concluiu = publicadas.length > 0 && [null, aluno?.itinerario].includes(m.itinerario) && datas.every(Boolean);
      const retirada = RETIRADAS.get(chave(alunoId, m.id));
      if (!concluiu && !retirada) return [];
      return [{
        modulo_id: m.id, modulo: m.titulo, concluido_em: concluiu ? datas.sort().at(-1) : null, retirado_em: retirada?.retirado_em ?? null,
        ...(comObservacao ? { observacao: retirada?.observacao ?? null } : {}),
      }];
    });
  };

  const pontoSemPular = (aula, p) => {
    const blocos = p?.blocos || '';
    const continuos = blocos.length - blocos.replace(/^1+/, '').length;
    return Math.min(aula.duracao_segundos, continuos * BLOCO);
  };

  const estadoDoProgresso = (aula, p) => ({
    percentual_assistido: p?.percentual ?? 0,
    pode_avancar_ate_segundo: pontoSemPular(aula, p),
    percentual_minimo: aula.percentual_minimo_assistido,
    pode_fazer_fixacao: (p?.percentual ?? 0) >= aula.percentual_minimo_assistido && aula.perguntas.length > 0,
    melhor_nota_fixacao: p?.melhor ?? null,
    tentativas_fixacao: p?.tentativas ?? 0,
    nota_minima: aula.nota_minima,
    concluida_em: p?.concluida_em ?? null,
  });

  const resumoAula = (a) => ({
    id: a.id, modulo_id: a.modulo_id, titulo: a.titulo, descricao: a.descricao, ordem: a.ordem, video_provedor: a.video_provedor, video_id: a.video_id,
    duracao_segundos: a.duracao_segundos, carga_horaria_minutos: a.carga_horaria_minutos, percentual_minimo_assistido: a.percentual_minimo_assistido,
    nota_minima: a.nota_minima, publicada: a.publicada, total_perguntas: a.perguntas.length, total_materiais: a.materiais.length,
  });
  const materialParaApi = ({ id, tipo, nome_arquivo, tipo_mime, tamanho_bytes }) => ({ id, tipo, nome_arquivo, tipo_mime, tamanho_bytes });
  const moduloParaApi = (m, aulas) => ({ ...m, aulas, carga_horaria_minutos: aulas.reduce((t, a) => t + a.carga_horaria_minutos, 0) });

  const arquivo = (blob) => Promise.resolve({ ok: true, status: 200, blob: async () => blob, json: async () => ({}) });
  const blobDoMaterial = (m) => {
    if (!blobs.has(m.id)) blobs.set(m.id, m.gerar());
    return blobs.get(m.id);
  };
  AULAS.forEach((a) => a.materiais.forEach((m) => { m.tamanho_bytes = blobDoMaterial(m).size; }));

  const extrairVideo = (link) => {
    const texto = (link || '').trim();
    if (!texto) return [null, null];
    const yt = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/.exec(texto);
    if (yt) return ['youtube', yt[1]];
    const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(texto);
    if (vimeo) return ['vimeo', vimeo[1]];
    return null;
  };

  const lerArquivoEnviado = async (corpo) => {
    const enviado = corpo instanceof FormData ? corpo.get('arquivo') : null;
    if (!enviado) return [null, erroFake('Arquivo vazio.', 400)];
    if (enviado.size > 10 * 1024 * 1024) return [null, erroFake('Arquivo grande demais (máximo 10 MB).', 413)];
    const inicio = new Uint8Array(await enviado.slice(0, 16).arrayBuffer());
    return [{ arquivo: enviado, inicio }, null];
  };
  const tipoDoMaterial = (b) => {
    const comeca = (...bytes) => bytes.every((x, i) => b[i] === x);
    if (comeca(0x25, 0x50, 0x44, 0x46)) return ['documento', 'application/pdf'];
    if (comeca(0x49, 0x44, 0x33) || (b[0] === 0xff && [0xfb, 0xf3, 0xf2].includes(b[1]))) return ['audio', 'audio/mpeg'];
    if (comeca(0x4f, 0x67, 0x67, 0x53)) return ['audio', 'audio/ogg'];
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return ['audio', 'audio/mp4'];
    return null;
  };

  // ---------------------------------------------------------------- escola
  const admin = async (metodo, caminho, query, corpo) => {
    if (metodo === 'GET' && caminho === '/api/admin/trilha') {
      return respostaFake([...MODULOS].sort((a, b) => a.ordem - b.ordem).map((m) => moduloParaApi(m, aulasDoModulo(m).map(resumoAula))));
    }
    if (metodo === 'POST' && caminho === '/api/admin/modulos') {
      const m = { id: proximoModuloId++, titulo: corpo.titulo, descricao: corpo.descricao || null, itinerario: corpo.itinerario || null, ordem: corpo.ordem ?? MODULOS.length, publicado: Boolean(corpo.publicado) };
      MODULOS.push(m);
      return respostaFake(moduloParaApi(m, []), 201);
    }
    let r = metodo === 'PUT' && caminho.match(/^\/api\/admin\/modulos\/(\d+)$/);
    if (r) {
      const m = modulo(Number(r[1]));
      if (!m) return erroFake('Módulo não encontrado', 404);
      Object.assign(m, corpo);
      return respostaFake(moduloParaApi(m, aulasDoModulo(m).map(resumoAula)));
    }
    r = metodo === 'POST' && caminho.match(/^\/api\/admin\/modulos\/(\d+)\/aulas$/);
    if (r) {
      if (!modulo(Number(r[1]))) return erroFake('Módulo não encontrado', 404);
      const video = extrairVideo(corpo.link_video);
      if (!video) return erroFake('Link de vídeo não reconhecido. Use um link do YouTube (pode ser não listado) ou do Vimeo.', 400);
      const { link_video: _link, ...campos } = corpo; // eslint-disable-line no-unused-vars
      const aula = { ...campos, id: proximaAulaId++, modulo_id: Number(r[1]), video_provedor: video[0], video_id: video[1], perguntas: [], materiais: [] };
      AULAS.push(aula);
      return respostaFake(resumoAula(aula), 201);
    }
    r = caminho.match(/^\/api\/admin\/aulas\/(\d+)(\/perguntas|\/materiais)?$/);
    if (r) {
      const aula = AULAS.find((a) => a.id === Number(r[1]));
      if (!aula) return erroFake('Aula não encontrada', 404);
      if (!r[2] && metodo === 'GET') return respostaFake({ ...resumoAula(aula), texto: aula.texto, perguntas: aula.perguntas, materiais: aula.materiais.map(materialParaApi) });
      if (!r[2] && metodo === 'PUT') {
        const { link_video: link, ...campos } = corpo;
        if ('link_video' in corpo) {
          const video = extrairVideo(link);
          if (!video) return erroFake('Link de vídeo não reconhecido. Use um link do YouTube (pode ser não listado) ou do Vimeo.', 400);
          [aula.video_provedor, aula.video_id] = video;
        }
        Object.assign(aula, campos);
        return respostaFake(resumoAula(aula));
      }
      if (!r[2] && metodo === 'DELETE') {
        if ([...progressos.keys()].some((k) => k.endsWith(`-${aula.id}`))) return erroFake('Alunos já assistiram esta aula. Despublique em vez de apagar, pra manter o registro de frequência.', 409);
        AULAS.splice(AULAS.indexOf(aula), 1);
        return respostaFake({ sucesso: true });
      }
      if (r[2] === '/perguntas' && metodo === 'PUT') {
        const ruim = corpo.perguntas.findIndex((p) => !(p.resposta_correta_index >= 0 && p.resposta_correta_index < p.opcoes.length));
        if (ruim >= 0) return erroFake(`Pergunta ${ruim + 1}: marque qual alternativa é a correta`, 400);
        aula.perguntas = corpo.perguntas.map((p) => ({ ...p, id: proximaPerguntaId++ }));
        return respostaFake({ total_perguntas: aula.perguntas.length });
      }
      if (r[2] === '/materiais' && metodo === 'POST') {
        const [lido, erro] = await lerArquivoEnviado(corpo);
        if (erro) return erro;
        const tipo = tipoDoMaterial(lido.inicio);
        if (!tipo) return erroFake('Formato não suportado: envie áudio (MP3, M4A, OGG) ou PDF. Slides: exporte como PDF.', 400);
        const m = { id: proximoMaterialId++, tipo: tipo[0], tipo_mime: tipo[1], nome_arquivo: lido.arquivo.name, tamanho_bytes: lido.arquivo.size, gerar: () => lido.arquivo };
        aula.materiais.push(m);
        return respostaFake(materialParaApi(m), 201);
      }
    }
    r = caminho.match(/^\/api\/admin\/materiais\/(\d+)$/);
    if (r) {
      const aula = AULAS.find((a) => a.materiais.some((m) => m.id === Number(r[1])));
      const m = aula?.materiais.find((x) => x.id === Number(r[1]));
      if (!m) return erroFake('Material não encontrado', 404);
      if (metodo === 'GET') return arquivo(blobDoMaterial(m));
      if (metodo === 'DELETE') { aula.materiais = aula.materiais.filter((x) => x !== m); return respostaFake({ sucesso: true }); }
    }
    if (metodo === 'GET' && caminho === '/api/admin/relatorios/frequencia') {
      const turmaId = query.get('turma_id');
      const moduloId = query.get('modulo_id');
      const publicadas = AULAS.filter((a) => a.publicada && modulo(a.modulo_id)?.publicado && (!moduloId || String(a.modulo_id) === moduloId));
      const alunos = ALUNOS.filter((a) => !turmaId || String(a.turma_id) === turmaId).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
      return respostaFake({
        gerado_em: agoraIso(),
        alunos: alunos.map((aluno) => {
          const aplicaveis = publicadas.filter((a) => [null, aluno.itinerario].includes(modulo(a.modulo_id).itinerario));
          const detalhes = aplicaveis.map((a) => {
            const p = progressos.get(chave(aluno.id, a.id));
            return { aula_id: a.id, aula: a.titulo, modulo: modulo(a.modulo_id).titulo, carga_horaria_minutos: a.carga_horaria_minutos, percentual_assistido: p?.percentual ?? 0, melhor_nota: p?.melhor ?? null, nota_minima: a.nota_minima, tentativas: p?.tentativas ?? 0, concluida_em: p?.concluida_em ?? null };
          });
          const concluidas = detalhes.filter((d) => d.concluida_em);
          const modulosConcluidos = [...new Set(aplicaveis.map((a) => a.modulo_id))].map(modulo)
            .filter((m) => detalhes.filter((d) => d.modulo === m.titulo).every((d) => d.concluida_em))
            .map((m) => ({ modulo_id: m.id, modulo: m.titulo, retirado_em: RETIRADAS.get(chave(aluno.id, m.id))?.retirado_em ?? null }));
          return {
            estudante_id: aluno.id, nome: aluno.nome, cpf: aluno.cpf, turma: nomeTurma(aluno.turma_id), itinerario: aluno.itinerario,
            aulas_previstas: detalhes.length, aulas_concluidas: concluidas.length,
            carga_prevista_minutos: detalhes.reduce((t, d) => t + d.carga_horaria_minutos, 0),
            carga_concluida_minutos: concluidas.reduce((t, d) => t + d.carga_horaria_minutos, 0),
            modulos_concluidos: modulosConcluidos, aulas: detalhes,
          };
        }),
      });
    }
    r = caminho.match(/^\/api\/admin\/estudantes\/(\d+)\/(frequencia|certificados)$/);
    if (r) {
      const alunoId = Number(r[1]);
      const aluno = ALUNOS.find((a) => a.id === alunoId);
      if (!aluno) return erroFake('Aluno não encontrado', 404);
      if (r[2] === 'frequencia' && metodo === 'GET') return respostaFake(logs.get(alunoId) || []);
      if (r[2] === 'certificados' && metodo === 'GET') return respostaFake(certificadosDoAluno(alunoId));
    }
    if (metodo === 'GET' && caminho === '/api/admin/certificados') {
      const turmaId = query.get('turma_id');
      const situacaoFiltro = query.get('situacao');
      const linhas = ALUNOS.filter((a) => !turmaId || String(a.turma_id) === turmaId).flatMap((a) => certificadosDoAluno(a.id)
        .filter((c) => !(situacaoFiltro === 'a_retirar' && c.retirado_em) && !(situacaoFiltro === 'retirado' && !c.retirado_em))
        .map((c) => ({
          estudante_id: a.id, nome: a.nome, cpf: a.cpf, turma: nomeTurma(a.turma_id), telefone: a.telefone,
          responsavel_nome: a.responsavel_nome, responsavel_telefone: a.responsavel_telefone, ...c,
        })));
      linhas.sort((x, y) => Number(Boolean(x.retirado_em)) - Number(Boolean(y.retirado_em)) || x.nome.localeCompare(y.nome, 'pt-BR'));
      return respostaFake(linhas);
    }
    r = caminho.match(/^\/api\/admin\/estudantes\/(\d+)\/certificados\/(\d+)$/);
    if (r) {
      const aluno = ALUNOS.find((a) => a.id === Number(r[1]));
      const m = modulo(Number(r[2]));
      if (!aluno) return erroFake('Aluno não encontrado', 404);
      if (!m) return erroFake('Módulo não encontrado', 404);
      if (metodo === 'PUT') {
        if (!certificadosDoAluno(aluno.id).some((c) => c.modulo_id === m.id)) return erroFake(`${aluno.nome} ainda não concluiu todas as aulas de "${m.titulo}".`, 409);
        const retiradoEm = corpo.retirado_em || hojeLocalIso();
        if (retiradoEm > hojeLocalIso()) return erroFake('A data da retirada não pode ser no futuro.', 400);
        const retirada = { retirado_em: retiradoEm, observacao: (corpo.observacao || '').trim() || null };
        RETIRADAS.set(chave(aluno.id, m.id), retirada);
        return respostaFake({ modulo_id: m.id, ...retirada });
      }
      if (metodo === 'DELETE') { RETIRADAS.delete(chave(aluno.id, m.id)); return respostaFake({ sucesso: true }); }
    }
    return null;
  };

  // ---------------------------------------------------------------- aluno
  const aulaDoAluno = (id) => {
    const aula = AULAS.find((a) => a.id === id);
    const aluno = ALUNOS.find((a) => a.id === estado.alunoId);
    const m = aula && modulo(aula.modulo_id);
    return aula && aula.publicada && m.publicado && [null, aluno?.itinerario].includes(m.itinerario) ? aula : null;
  };

  const aluno = async (metodo, caminho, query, corpo) => {
    const alunoId = estado.alunoId;
    if (metodo === 'GET' && caminho === '/api/trilha') {
      const meu = ALUNOS.find((a) => a.id === alunoId);
      return respostaFake(MODULOS.filter((m) => m.publicado && [null, meu?.itinerario].includes(m.itinerario)).sort((a, b) => a.ordem - b.ordem).map((m) => moduloParaApi(m,
        aulasDoModulo(m).filter((a) => a.publicada).map((a) => {
          const p = progressos.get(chave(alunoId, a.id));
          const { video_id: _v, video_provedor: _p, publicada: _pub, ...resumo } = resumoAula(a); // eslint-disable-line no-unused-vars
          return { ...resumo, tem_video: Boolean(a.video_provedor), percentual_assistido: p?.percentual ?? 0, concluida_em: p?.concluida_em ?? null };
        }))));
    }
    if (metodo === 'GET' && caminho === '/api/certificados') return respostaFake(certificadosDoAluno(alunoId, false));
    const r = caminho.match(/^\/api\/aulas\/(\d+)(\/progresso|\/fixacao|\/materiais\/(\d+))?$/);
    if (!r) return null;
    const aula = aulaDoAluno(Number(r[1]));
    if (!aula) return erroFake('Aula não encontrada', 404);
    const k = chave(alunoId, aula.id);

    if (!r[2] && metodo === 'GET') {
      return respostaFake({ ...resumoAula(aula), texto: aula.texto, materiais: aula.materiais.map(materialParaApi), ...estadoDoProgresso(aula, progressos.get(k)) });
    }
    if (r[3] && metodo === 'GET') {
      const m = aula.materiais.find((x) => x.id === Number(r[3]));
      return m ? arquivo(blobDoMaterial(m)) : erroFake('Material não encontrado', 404);
    }
    if (r[2] === '/progresso' && metodo === 'POST') {
      let p = progressos.get(k);
      if (!p) {
        p = { blocos: '0'.repeat(totalBlocos(aula)), percentual: 0, ultimo: Date.now(), melhor: null, tentativas: 0, concluida_em: null };
        progressos.set(k, p);
        registrarLog(alunoId, aula, 'inicio', 0);
      }
      const de = Math.max(0, corpo.de_segundo);
      let ate = Math.min(aula.duracao_segundos, corpo.ate_segundo);
      if (ate <= de) return erroFake('Trecho inválido.', 400);
      const permitido = Math.max(0, (Date.now() - p.ultimo) / 1000) + FOLGA; // 1x: sem acelerar
      if (ate - de > permitido) ate = de + permitido;
      const blocos = [...p.blocos];
      blocos.forEach((_, i) => {
        const inicio = i * BLOCO;
        const fim = Math.min((i + 1) * BLOCO, aula.duracao_segundos);
        if (Math.min(fim, ate) - Math.max(inicio, de) >= (fim - inicio) / 2) blocos[i] = '1';
      });
      const antes = p.percentual;
      p.blocos = blocos.join('');
      p.percentual = Math.round((blocos.filter((b) => b === '1').length / blocos.length) * 100);
      p.ultimo = Date.now();
      if (Math.floor(p.percentual / 10) > Math.floor(antes / 10)) registrarLog(alunoId, aula, 'progresso', p.percentual);
      return respostaFake(estadoDoProgresso(aula, p)); // XP e ofensiva só ao concluir a aula
    }
    const p = progressos.get(k);
    if (r[2] === '/fixacao' && metodo === 'GET') {
      if (!p || p.percentual < aula.percentual_minimo_assistido) return erroFake(`Assista pelo menos ${aula.percentual_minimo_assistido}% da aula antes da atividade.`, 403);
      const ids = new Set(aula.perguntas.map((q) => q.id));
      if (!p.sorteio || p.sorteio.length !== ids.size || p.sorteio.some((item) => !ids.has(item.pergunta_id))) {
        p.sorteio = embaralhar(aula.perguntas).map((q) => ({ pergunta_id: q.id, opcoes: embaralhar(q.opcoes.map((_, i) => i)) }));
      }
      const porId = Object.fromEntries(aula.perguntas.map((q) => [q.id, q]));
      return respostaFake({
        perguntas: p.sorteio.map((item) => ({ id: item.pergunta_id, enunciado: porId[item.pergunta_id].enunciado, opcoes: item.opcoes.map((i) => porId[item.pergunta_id].opcoes[i]) })),
        nota_minima: aula.nota_minima,
      });
    }
    if (r[2] === '/fixacao' && metodo === 'POST') {
      if (!p || p.percentual < aula.percentual_minimo_assistido) return erroFake(`Assista pelo menos ${aula.percentual_minimo_assistido}% da aula antes da atividade.`, 403);
      const respostas = corpo.respostas || [];
      if (!p.sorteio) return erroFake('A atividade mudou. Abra de novo pra responder.', 409);
      if (respostas.length !== p.sorteio.length) return erroFake('Responda todas as perguntas.', 400);
      const porId = Object.fromEntries(aula.perguntas.map((q) => [q.id, q]));
      const sorteio = p.sorteio;
      // Respostas na ordem sorteada -> alternativa original de cada pergunta
      const acertos = sorteio.map((item, i) => respostas[i] != null && item.opcoes[respostas[i]] === porId[item.pergunta_id].resposta_correta_index);
      const nota = Math.round((acertos.filter(Boolean).length / sorteio.length) * 100);
      const aprovado = nota >= aula.nota_minima;
      p.sorteio = null;
      p.tentativas += 1;
      p.melhor = Math.max(p.melhor ?? 0, nota);
      registrarLog(alunoId, aula, 'fixacao', p.percentual, nota);
      const concluiuAgora = aprovado && !p.concluida_em;
      let xp = 0;
      let moduloConcluido = false;
      if (concluiuAgora) {
        p.concluida_em = agoraIso();
        registrarLog(alunoId, aula, 'conclusao', p.percentual, nota);
        registrarEvidencias(alunoId, { conhecimento: nota }, 'aula');
        moduloConcluido = situacao(alunoId, modulo(aula.modulo_id)).concluido;
        xp = 20 + 25 + (moduloConcluido ? 50 : 0); // assistir + fixação, + bônus por terminar o módulo
        concederXp(xp);
      }
      return respostaFake({
        nota, nota_minima: aula.nota_minima, aprovado, concluiu_agora: concluiuAgora, xp_concedido: xp,
        correcao: sorteio.map((item, i) => {
          const q = porId[item.pergunta_id];
          return { pergunta_id: q.id, acertou: acertos[i], ...(aprovado ? { resposta_correta_index: item.opcoes.indexOf(q.resposta_correta_index), explicacao: q.explicacao } : {}) };
        }),
        ...estadoDoProgresso(aula, p),
        novos_pontos_totais: estado.xp_total, nivel_atual: estado.nivel_gamificacao, mudanca_liga: null,
        modulo_concluido_agora: moduloConcluido, modulo: modulo(aula.modulo_id).titulo, xp_bonus_modulo: moduloConcluido ? 50 : 0,
      });
    }
    return null;
  };

  const resumoCertificados = (alunoId) => {
    const lista = certificadosDoAluno(alunoId);
    return { certificados_a_retirar: lista.filter((c) => !c.retirado_em).length, certificados_retirados: lista.filter((c) => c.retirado_em).length };
  };
  return { admin, aluno, resumoCertificados };
};
