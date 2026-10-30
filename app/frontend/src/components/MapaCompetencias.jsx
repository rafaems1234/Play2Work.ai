import React from 'react';

// Mapa de competências (10 eixos da BNCC) em barras horizontais -- uma por
// eixo, na ordem oficial, de 0 a 100. Barra = o aluno; traço cinza = média da
// turma (contexto, não série colorida). Barra e não radar: com 10 eixos o
// radar fica ilegível, e eixo ainda sem atividade deformaria o polígono
// parecendo nota zero. Aqui ele aparece escrito: "ainda sem atividades".
//
// Cores validadas com o validate_palette da skill de dataviz (contraste e
// separação pra daltonismo) nos dois fundos: escuro do app e claro do painel.

const TEMAS = {
  escuro: { barra: '#2e7bff', trilho: 'rgba(255,255,255,0.07)', media: '#94a3b8', texto: '#e2e8f0', suave: '#94a3b8', vazio: '#64748b' },
  claro: { barra: '#1d5fd6', trilho: 'rgba(30,64,120,0.08)', media: '#64748b', texto: '#1e2b45', suave: '#5f6f8c', vazio: '#7a879f' },
};

const MapaCompetencias = ({ eixos, tema = 'escuro', referenciaMedia = 'turma' }) => {
  const cores = TEMAS[tema];
  const temMedia = eixos.some((e) => e.media_turma != null);
  const rotuloMedia = referenciaMedia === 'turma' ? 'Média da turma' : 'Média da escola';

  return (
    <figure style={{ margin: 0 }}>
      <style>{`
        .mapa-linha { display: grid; grid-template-columns: minmax(120px, 210px) 1fr 44px; align-items: center; gap: 10px; padding: 6px 0; }
        .mapa-trilho { position: relative; height: 10px; border-radius: 4px; }
        .mapa-barra { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 0 4px 4px 0; transition: width 0.6s ease; }
        .mapa-media { position: absolute; top: -4px; bottom: -4px; width: 2px; border-radius: 1px; }
        @media (max-width: 520px) {
          .mapa-linha { grid-template-columns: 1fr 44px; row-gap: 4px; }
          .mapa-linha .mapa-nome { grid-column: 1 / -1; }
        }
      `}</style>

      {temMedia && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: cores.suave, marginBottom: '8px' }} aria-hidden="true">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '18px', height: '10px', borderRadius: '0 4px 4px 0', background: cores.barra }} /> Você
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '2px', height: '16px', background: cores.media }} /> {rotuloMedia}
          </span>
        </div>
      )}

      <div role="list">
        {eixos.map((eixo) => {
          const semDados = eixo.pontuacao == null;
          const dica = semDados
            ? `${eixo.nome}: ainda sem atividades`
            : `${eixo.nome}: ${eixo.pontuacao} de 100 · ${eixo.total_evidencias} atividade${eixo.total_evidencias !== 1 ? 's' : ''}${eixo.media_turma != null ? ` · ${rotuloMedia.toLowerCase()}: ${eixo.media_turma}` : ''}`;
          return (
            <div key={eixo.codigo} className="mapa-linha" role="listitem" title={`${dica}\n${eixo.descricao}`} aria-label={dica}>
              <div className="mapa-nome" style={{ fontSize: '13px', color: cores.texto, fontWeight: 600, lineHeight: 1.3 }}>
                {eixo.nome}
              </div>
              <div className="mapa-trilho" style={{ background: cores.trilho }}>
                {!semDados && <div className="mapa-barra" style={{ width: `${eixo.pontuacao}%`, background: cores.barra }} />}
                {eixo.media_turma != null && <div className="mapa-media" style={{ left: `calc(${eixo.media_turma}% - 1px)`, background: cores.media }} />}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: semDados ? cores.vazio : cores.texto }}>
                {semDados ? '—' : eixo.pontuacao}
              </div>
            </div>
          );
        })}
      </div>
      <figcaption style={{ fontSize: '11px', color: cores.vazio, marginTop: '8px', lineHeight: 1.5 }}>
        Eixos das 10 competências gerais da BNCC, de 0 a 100. "—" = ainda sem atividades nesse eixo. Atividades recentes pesam mais.
      </figcaption>
    </figure>
  );
};

export default MapaCompetencias;
