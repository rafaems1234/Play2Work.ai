import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconEnviar, IconEyeSlash } from './icons';

// Conversa no estilo WhatsApp, usada pelo aluno (tema escuro) e pela escola
// (tema claro): balões à direita (minhas) e à esquerda (dos outros), nome do
// autor em grupo, separador por dia, "✓✓ visto" na conversa direta.

const p2 = (n) => String(n).padStart(2, '0');
// O servidor manda horário em UTC sem fuso no texto
const paraData = (iso) => new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
const hora = (iso) => { const d = paraData(iso); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const rotuloDia = (iso) => {
  const d = paraData(iso);
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const mesmo = (a, b) => a.toDateString() === b.toDateString();
  if (mesmo(d, hoje)) return 'Hoje';
  if (mesmo(d, ontem)) return 'Ontem';
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const ESTILOS_CONVERSA = `
  .cv-chat { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  .cv-lista { flex: 1; overflow-y: auto; padding: 14px 12px; display: flex; flex-direction: column; gap: 4px; }
  .cv-dia { align-self: center; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 8px; margin: 8px 0; }
  .cv-balao { max-width: min(78%, 520px); padding: 7px 10px 5px; border-radius: 12px; font-size: 14px; line-height: 1.45; position: relative; word-wrap: break-word; white-space: pre-wrap; }
  .cv-balao.minha { align-self: flex-end; border-top-right-radius: 4px; }
  .cv-balao.outra { align-self: flex-start; border-top-left-radius: 4px; }
  .cv-autor { font-size: 12px; font-weight: 800; margin-bottom: 2px; }
  .cv-meta { display: flex; justify-content: flex-end; align-items: center; gap: 4px; font-size: 10.5px; margin-top: 2px; }
  .cv-oculta { font-style: italic; opacity: 0.75; }
  .cv-entrada { display: flex; gap: 8px; padding: 10px; align-items: flex-end; }
  .cv-entrada textarea { flex: 1; resize: none; border-radius: 20px; padding: 10px 14px; font-size: 14px; font-family: inherit; outline: none; max-height: 120px; }
  .cv-enviar { width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; flex: 0 0 auto;
    background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong)); color: #fff; }
  .cv-enviar:disabled { opacity: 0.45; cursor: not-allowed; }
  .cv-somente-leitura { text-align: center; font-size: 12px; padding: 12px; }
  .cv-acao { background: none; border: none; cursor: pointer; font-size: 11px; padding: 0; font-family: inherit; opacity: 0; transition: opacity 0.15s; }
  .cv-balao:hover .cv-acao { opacity: 1; }

  .cv-escuro .cv-lista { background: rgba(0,0,0,0.25); }
  .cv-escuro .cv-dia { background: rgba(255,255,255,0.07); color: #94a3b8; }
  .cv-escuro .cv-balao.minha { background: linear-gradient(135deg, rgb(var(--accent-strong-rgb) / 0.85), rgb(var(--accent-rgb) / 0.75)); color: #fff; }
  .cv-escuro .cv-balao.outra { background: rgba(255,255,255,0.08); color: #e2e8f0; }
  .cv-escuro .cv-balao.escola { background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.25); }
  .cv-escuro .cv-autor { color: var(--accent-soft); }
  .cv-escuro .cv-balao.escola .cv-autor { color: #fcd34d; }
  .cv-escuro .cv-meta { color: rgba(226,232,240,0.6); }
  .cv-escuro .cv-entrada { background: rgba(255,255,255,0.03); border-top: 1px solid rgba(255,255,255,0.06); }
  .cv-escuro .cv-entrada textarea { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; }
  .cv-escuro .cv-somente-leitura { color: #64748b; }

  .cv-claro .cv-lista { background: #eef3fb; }
  .cv-claro .cv-dia { background: #fff; color: #5f6f8c; box-shadow: 0 1px 2px rgba(15,30,61,0.08); }
  .cv-claro .cv-balao.minha { background: #d6e6ff; color: #0f1e3d; }
  .cv-claro .cv-balao.outra { background: #fff; color: #1e2b45; box-shadow: 0 1px 2px rgba(15,30,61,0.08); }
  .cv-claro .cv-autor { color: #1d5fd6; }
  .cv-claro .cv-meta { color: #5f6f8c; }
  .cv-claro .cv-balao.removida { background: #fff1f2; border: 1px dashed #fda4af; }
  .cv-claro .cv-entrada { background: #f8fbff; border-top: 1px solid rgba(30,64,120,0.1); }
  .cv-claro .cv-entrada textarea { background: #fff; border: 1px solid rgba(30,64,120,0.2); color: #0f1e3d; }
  .cv-claro .cv-somente-leitura { color: #5f6f8c; }
  .cv-claro .cv-acao { color: #b91c1c; }
`;

// mensagens: [{ id, autor, minha, da_escola, texto, oculta?, oculta_em?, oculta_motivo?, enviada_em }]
const Conversa = ({
  mensagens, minhaSe, mostrarAutor, podeEscrever = true, avisoSomenteLeitura, aoEnviar,
  vistoEm, tema = 'escuro', aoOcultar, placeholder = 'Mensagem', limite = 1000,
}) => {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const listaRef = useRef(null);
  const noFimRef = useRef(true);

  // Acompanha se o usuário está no fim da conversa: só rola sozinho se estiver
  const aoRolar = () => {
    const el = listaRef.current;
    noFimRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const el = listaRef.current;
    if (el && noFimRef.current) el.scrollTop = el.scrollHeight;
  }, [mensagens.length]);
  useEffect(() => { noFimRef.current = true; }, []);

  const enviar = async () => {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    setErro(null);
    const falha = await aoEnviar(limpo);
    setEnviando(false);
    if (falha) { setErro(falha); return; }
    setTexto('');
    noFimRef.current = true;
  };

  const minhaUltima = [...mensagens].reverse().find((m) => minhaSe(m));
  let diaAnterior = null;
  return (
    <div className={`cv-chat cv-${tema}`}>
      <div className="cv-lista" ref={listaRef} onScroll={aoRolar} role="log" aria-live="polite">
        {mensagens.length === 0 && <div className="cv-dia">Nenhuma mensagem ainda</div>}
        {mensagens.map((m) => {
          const dia = rotuloDia(m.enviada_em);
          const separador = dia !== diaAnterior ? <div className="cv-dia">{dia}</div> : null;
          diaAnterior = dia;
          const minha = minhaSe(m);
          const removida = m.oculta || m.oculta_em;
          return (
            <React.Fragment key={m.id}>
              {separador}
              <div className={`cv-balao ${minha ? 'minha' : 'outra'} ${m.da_escola && !minha ? 'escola' : ''} ${removida && aoOcultar ? 'removida' : ''}`}>
                {!minha && mostrarAutor && <div className="cv-autor">{m.autor}</div>}
                <div className={m.oculta ? 'cv-oculta' : undefined}>{m.texto}</div>
                {aoOcultar && m.oculta_em && <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}><IconEyeSlash style={{ verticalAlign: '-2px' }} /> Oculta pros alunos: {m.oculta_motivo}</div>}
                <div className="cv-meta">
                  {aoOcultar && !m.da_escola && !m.oculta_em && <button type="button" className="cv-acao" onClick={() => aoOcultar(m)}>Ocultar</button>}
                  <span>{hora(m.enviada_em)}</span>
                  {minha && m === minhaUltima && vistoEm !== undefined && (
                    <span title={vistoEm ? 'Visto' : 'Enviado'} style={{ color: vistoEm && paraData(vistoEm) >= paraData(m.enviada_em) ? '#38bdf8' : undefined }}>
                      {vistoEm && paraData(vistoEm) >= paraData(m.enviada_em) ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {podeEscrever ? (
        <div className="cv-entrada">
          <textarea
            rows={1}
            value={texto}
            maxLength={limite}
            placeholder={placeholder}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            aria-label="Escrever mensagem"
          />
          <button type="button" className="cv-enviar" onClick={enviar} disabled={!texto.trim() || enviando} aria-label="Enviar"><IconEnviar /></button>
        </div>
      ) : (
        <div className="cv-somente-leitura">{avisoSomenteLeitura}</div>
      )}
      {erro && <div style={{ color: '#f87171', fontSize: '12px', padding: '0 12px 10px' }}>{erro}</div>}
    </div>
  );
};

export default Conversa;
