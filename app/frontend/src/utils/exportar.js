import { mascararCpf, mascararTelefone, dataIsoParaBr, dataHoraIsoParaBr } from './formatos';
import FICHA from '../data/ficha_pap.json';

// Exportação da lista de alunos do painel da escola. Roda no navegador, a
// partir da mesma lista filtrada que está na tela -- então o arquivo é
// exatamente o que a coordenação está vendo (e funciona no modo demonstração).

const simNao = (valor) => (valor == null ? '' : valor ? 'Sim' : 'Não');
const ROTULO_STATUS = FICHA.status_aprendiz; // os 4 status da planilha do PAP

// Campos da planilha do PAP (aluno e contrato atual) -- só no CSV, que vira a planilha da escola
const comoTexto = (campo, valor) => (valor == null ? '' : campo.tipo === 'data' ? dataIsoParaBr(valor) : valor);
const COLUNAS_PAP = [
  ['Data atualização', (a) => dataIsoParaBr(a.cadastro_atualizado_em), false],
  ...FICHA.aluno.map((c) => [c.rotulo, (a) => comoTexto(c, a[c.campo]), false]),
  ...FICHA.contrato.map((c) => [`Contrato: ${c.rotulo}`, (a) => comoTexto(c, a.contrato_atual?.[c.campo]), false]),
];

// [título, valor, entra no PDF?] -- o PDF (A4 deitado) leva só as colunas que cabem
export const COLUNAS_ALUNOS = [
  ['Nome', (a) => a.nome, true],
  ['Nome no ranking', (a) => a.nome_exibicao, false],
  ['CPF', (a) => mascararCpf(a.cpf || ''), true],
  ['Nascimento', (a) => dataIsoParaBr(a.data_nascimento), false],
  ['Idade', (a) => a.idade ?? '', true],
  ['E-mail', (a) => a.email, false],
  ['Celular', (a) => mascararTelefone(a.telefone || ''), true],
  ['Responsável', (a) => a.responsavel_nome || '', true],
  ['Celular do responsável', (a) => mascararTelefone(a.responsavel_telefone || ''), true],
  ['Turma', (a) => a.turma || '', true],
  ['Itinerário', (a) => a.itinerario || '', true],
  ['Status do aprendiz', (a) => ROTULO_STATUS[a.status_contratacao] || '', true],
  ['Empresa contratante', (a) => a.empresa_contratante || '', true],
  ['Contratado em', (a) => dataIsoParaBr(a.contratado_em), false],
  ['Já trabalhou', (a) => simNao(a.ja_trabalhou), false],
  ['XP', (a) => a.xp_total, false],
  ['Nível', (a) => a.nivel, false],
  ['Acerto no quiz (%)', (a) => a.taxa_acerto_quiz ?? '', true],
  ['Ofensiva (dias)', (a) => a.ofensiva_dias, false],
  ['Candidaturas', (a) => a.total_candidaturas, false],
  ['Indicações', (a) => a.total_indicacoes, false],
  ['Tem foto', (a) => simNao(a.tem_foto), false],
  ['Certificados a retirar', (a) => a.certificados_a_retirar ?? 0, false],
  ['Certificados retirados', (a) => a.certificados_retirados ?? 0, false],
  ['Currículo atualizado em', (a) => dataHoraIsoParaBr(a.curriculo_atualizado_em), false],
  ...COLUNAS_PAP,
];

// Célula de CSV: aspas quando precisa e, como o arquivo abre no Excel, um
// apóstrofo na frente de texto que começa com = + - @ (senão o Excel executa
// como fórmula -- um nome cadastrado como "=HYPERLINK(...)" viraria link).
const celula = (valor) => {
  let texto = valor == null ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

// colunas: [título, (linha) => valor]; padrão = a lista de alunos do painel
export const baixarCsv = (nomeArquivo, registros, colunas = COLUNAS_ALUNOS) => {
  const linhas = [
    colunas.map(([titulo]) => celula(titulo)).join(';'),
    ...registros.map((r) => colunas.map(([, valor]) => celula(valor(r))).join(';')),
  ];
  // Ponto e vírgula + BOM: é o que o Excel em português abre direto, com acentos
  const blob = new Blob([`﻿${linhas.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const carimboArquivo = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
};
