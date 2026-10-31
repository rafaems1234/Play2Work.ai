import React, { useState } from 'react';
import { IconWarning, IconCheck } from './icons';
import { apiFetch, lerErro } from '../api';
import { mascararData, dataBrParaIso, dataIsoParaBr, hojeLocalIso } from '../utils/formatos';

// Certificado de conclusão de um módulo da trilha EAD: o documento é entregue
// em mãos na escola. Aqui a coordenação marca quem já buscou (com a data e,
// se quiser, quem retirou) ou desfaz uma marcação errada.

export const ChipCertificado = ({ retiradoEm }) => (retiradoEm
  ? <span className="adm-chip verde">Retirado em {dataIsoParaBr(retiradoEm)}</span>
  : <span className="adm-chip amarelo">A retirar</span>);

const RetiradaCertificado = ({ estudanteId, certificado, aoMudar }) => {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState('');
  const [observacao, setObservacao] = useState('');
  const [confirmandoDesfazer, setConfirmandoDesfazer] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const caminho = `/api/admin/estudantes/${estudanteId}/certificados/${certificado.modulo_id}`;

  const abrir = () => {
    setData(dataIsoParaBr(certificado.retirado_em || hojeLocalIso()));
    setObservacao(certificado.observacao || '');
    setErro(null);
    setAberto(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    const iso = dataBrParaIso(data);
    if (!iso) { setErro('Data inválida (use dd/mm/aaaa).'); return; }
    setSalvando(true);
    setErro(null);
    const r = await apiFetch(caminho, { method: 'PUT', body: JSON.stringify({ retirado_em: iso, observacao }) });
    setSalvando(false);
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível registrar a retirada.')); return; }
    setAberto(false);
    aoMudar();
  };

  const desfazer = async () => {
    setSalvando(true);
    const r = await apiFetch(caminho, { method: 'DELETE' });
    setSalvando(false);
    setConfirmandoDesfazer(false);
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível desfazer.')); return; }
    aoMudar();
  };

  if (aberto) {
    return (
      <form onSubmit={salvar} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '8px' }}>
        <div style={{ flex: '0 1 130px' }}>
          <label className="adm-rotulo" htmlFor={`ret-d-${estudanteId}-${certificado.modulo_id}`}>Retirado em</label>
          <input id={`ret-d-${estudanteId}-${certificado.modulo_id}`} className="adm-input" inputMode="numeric" placeholder="dd/mm/aaaa" value={data} onChange={(e) => setData(mascararData(e.target.value))} required />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label className="adm-rotulo" htmlFor={`ret-o-${estudanteId}-${certificado.modulo_id}`}>Observação (opcional)</label>
          <input id={`ret-o-${estudanteId}-${certificado.modulo_id}`} className="adm-input" placeholder="Ex: retirado pela mãe" maxLength={200} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="adm-btn secundario pequeno" onClick={() => setAberto(false)}>Cancelar</button>
          <button type="submit" className="adm-btn pequeno" disabled={salvando}>{salvando ? 'Salvando...' : 'Confirmar retirada'}</button>
        </div>
        {erro && <div className="adm-erro" style={{ flexBasis: '100%' }}><IconWarning /> {erro}</div>}
      </form>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px' }}>
      {certificado.retirado_em ? (
        <>
          <button type="button" className="adm-link" onClick={abrir}>Corrigir</button>
          {confirmandoDesfazer ? (
            <span style={{ display: 'flex', gap: '8px' }}>
              Voltar pra "a retirar"? <button type="button" className="adm-link perigo" disabled={salvando} onClick={desfazer}>Sim</button>
              <button type="button" className="adm-link" onClick={() => setConfirmandoDesfazer(false)}>Não</button>
            </span>
          ) : <button type="button" className="adm-link perigo" onClick={() => setConfirmandoDesfazer(true)}>Desfazer</button>}
        </>
      ) : (
        <button type="button" className="adm-btn pequeno" onClick={abrir}><IconCheck style={{ verticalAlign: '-2px' }} /> Marcar como retirado</button>
      )}
      {erro && <div className="adm-erro" style={{ flexBasis: '100%' }}><IconWarning /> {erro}</div>}
    </div>
  );
};

export default RetiradaCertificado;
