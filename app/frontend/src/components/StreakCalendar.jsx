import React from 'react';
import { IconCalendar } from './icons';
import { hojeLocalIso } from '../utils/formatos';

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CORES_STATUS = {
  feito: { bg: 'rgba(52,211,153,0.25)', border: 'rgba(52,211,153,0.6)' },
  congelado: { bg: 'rgb(var(--accent-2-rgb) / 0.2)', border: 'rgb(var(--accent-2-rgb) / 0.55)' },
  perdido: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
};

const StreakCalendar = ({ ano, mes, dias = [] }) => {
  const statusPorDia = {};
  dias.forEach((d) => {
    statusPorDia[d.data] = d.status;
  });

  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const totalDias = new Date(ano, mes, 0).getDate();
  const hojeIso = hojeLocalIso();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    celulas.push({ dia, iso, status: statusPorDia[iso] });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <IconCalendar style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--txt-1b)' }}>{NOMES_MES[mes - 1]}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((letra, i) => (
          <div key={i} style={{ fontSize: '10px', color: 'var(--txt-5)', textAlign: 'center', fontWeight: '700' }}>{letra}</div>
        ))}
        {celulas.map((cel, i) => {
          if (!cel) return <div key={`vazio-${i}`} />;
          const cores = CORES_STATUS[cel.status];
          const ehHoje = cel.iso === hojeIso;
          return (
            <div
              key={cel.iso}
              title={cel.status || (ehHoje ? 'Hoje' : '')}
              style={{
                aspectRatio: '1',
                borderRadius: '7px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: '600',
                background: cores ? cores.bg : 'rgb(var(--tinta-rgb) / 0.03)',
                border: `1px solid ${cores ? cores.border : ehHoje ? 'rgb(var(--accent-rgb) / 0.5)' : 'rgb(var(--tinta-rgb) / 0.06)'}`,
                color: cores ? 'var(--txt-1b)' : 'var(--txt-5)',
              }}
            >
              {cel.dia}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--txt-4)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: CORES_STATUS.feito.bg, border: `1px solid ${CORES_STATUS.feito.border}` }} /> praticou
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--txt-4)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: CORES_STATUS.congelado.bg, border: `1px solid ${CORES_STATUS.congelado.border}` }} /> congelado
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--txt-4)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: CORES_STATUS.perdido.bg, border: `1px solid ${CORES_STATUS.perdido.border}` }} /> perdido
        </span>
      </div>
    </div>
  );
};

export default StreakCalendar;
