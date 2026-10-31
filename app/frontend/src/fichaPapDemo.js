// Ficha do PAP no modo demonstração: a mesma validação de ficha_pap.py, a
// partir do mesmo data/ficha_pap.json. Devolve [limpos, mensagemDeErro].
import FICHA from './data/ficha_pap.json';

export const validarFicha = (secao, dados, parcial = false) => {
  const limpos = {};
  for (const def of FICHA[secao]) {
    if (!(def.campo in dados)) {
      if (def.obrigatorio && !parcial) return [null, `Preencha: ${def.rotulo}`];
      continue;
    }
    let valor = typeof dados[def.campo] === 'string' ? dados[def.campo].trim() : dados[def.campo];
    if (valor == null || valor === '') {
      if (def.obrigatorio) return [null, `Preencha: ${def.rotulo}`];
      limpos[def.campo] = null;
      continue;
    }
    if (def.tipo === 'opcao' && !def.opcoes.includes(valor)) return [null, `${def.rotulo}: opção inválida`];
    if (def.tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) return [null, `${def.rotulo}: data inválida`];
    if (def.tipo === 'inteiro') {
      valor = Number(valor);
      if (!Number.isInteger(valor) || valor < 0 || valor > (def.max ?? 10000)) return [null, `${def.rotulo}: valor fora do permitido`];
    }
    if (def.tipo === 'cnpj') {
      valor = String(valor).replace(/\D/g, '');
      if (valor.length !== 14) return [null, `${def.rotulo}: precisa ter 14 dígitos`];
    }
    if (def.tipo === 'texto') valor = String(valor).slice(0, def.max ?? 255);
    limpos[def.campo] = valor;
  }
  return [limpos, null];
};

export const conferirContrato = (c) => {
  if (c.data_final && c.data_inicial && c.data_final < c.data_inicial) return 'A data final não pode ser antes da data inicial.';
  if (c.aditivo_fim && c.aditivo_inicio && c.aditivo_fim < c.aditivo_inicio) return 'O fim do aditivo não pode ser antes do início.';
  if (c.status === 'Finalizado' && !c.motivo) return 'Informe o motivo do encerramento do contrato.';
  return null;
};

export const STATUS_APRENDIZ = FICHA.status_aprendiz;
