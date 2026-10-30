import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconBook, IconCheckCircle, IconLock, IconDocument, IconWarning, IconClose, IconStar, IconTimer } from './icons';
import { apiFetch, lerErro, baixarArquivo } from '../api';
import { PlayerYouTube, PlayerDemo, TempoDeEstudo, PlayerAudio, ESTILOS_PLAYER, formatarTempo } from './PlayerAula';
import { dataIsoParaBr } from '../utils/formatos';

// Aba Aulas do aluno: a trilha EAD (ex: a integração do Programa de
// Aprendizagem, gravada pelos professores), com frequência registrada, a
// atividade de fixação que libera a conclusão e os certificados do PAP.

const horas = (minutos) => {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
};

// ---------------------------------------------------------------- fixação
const ModalFixacao = ({ aula, aoFechar, aoConcluir }) => {
  const [dados, setDados] = useState(null);
  const [respostas, setRespostas] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    apiFetch(`/api/aulas/${aula.id}/fixacao`).then(async (r) => {
      if (!r.ok) { setErro(await lerErro(r, 'Não foi possível abrir a atividade.')); return; }
      const corpo = await r.json();
      setDados(corpo);
      setRespostas(corpo.perguntas.map(() => null));
    });
  }, [aula.id]);

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    const r = await apiFetch(`/api/aulas/${aula.id}/fixacao`, { method: 'POST', body: JSON.stringify({ respostas }) });
    setEnviando(false);
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível enviar.')); return; }
    const corpo = await r.json();
    setResultado(corpo);
    if (corpo.concluiu_agora) aoConcluir(corpo);
  };

  const tentarDeNovo = () => {
    setResultado(null);
    setRespostas(dados.perguntas.map(() => null));
  };

  const correcao = Object.fromEntries((resultado?.correcao || []).map((c) => [c.pergunta_id, c]));
  return (
    <div className="trilha-fundo" onMouseDown={aoFechar}>
      <motion.div className="trilha-modal" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Atividade de fixação">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
          <div>
            <div className="trilha-rotulo">Atividade de fixação</div>
            <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '18px' }}>{aula.titulo}</h3>
            {dados && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Nota mínima pra concluir: {dados.nota_minima}</div>}
          </div>
          <button type="button" className="trilha-fechar" onClick={aoFechar} aria-label="Fechar"><IconClose /></button>
        </div>

        {erro && <div className="trilha-erro"><IconWarning /> {erro}</div>}
        {dados?.perguntas.map((p, i) => {
          const c = correcao[p.id];
          return (
            <div key={p.id} className={`trilha-pergunta ${c ? (c.acertou ? 'certa' : 'errada') : ''}`}>
              <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '8px', fontSize: '14px' }}>{i + 1}. {p.enunciado}</div>
              {p.opcoes.map((opcao, j) => (
                <label key={j} className={`trilha-opcao ${respostas[i] === j ? 'marcada' : ''} ${c?.resposta_correta_index === j ? 'gabarito' : ''}`}>
                  <input type="radio" name={`p-${p.id}`} checked={respostas[i] === j} disabled={Boolean(resultado)} onChange={() => setRespostas((r) => r.map((v, k) => (k === i ? j : v)))} />
                  {opcao}
                </label>
              ))}
              {c && !c.acertou && !resultado.aprovado && <div className="trilha-dica">Essa você errou. Revise a aula antes de tentar de novo.</div>}
              {c?.explicacao && <div className="trilha-dica ok">{c.explicacao}</div>}
            </div>
          );
        })}

        {resultado ? (
          <div className={`trilha-resultado ${resultado.aprovado ? 'aprovado' : ''}`}>
            <div style={{ fontSize: '28px', fontWeight: 800 }}>{resultado.nota}</div>
            <div>
              {resultado.aprovado
                ? <>Aula concluída!{resultado.xp_concedido ? ` +${resultado.xp_concedido} XP` : ''}</>
                : <>Faltou pouco: a nota mínima é {resultado.nota_minima}. Você pode rever a aula e tentar de novo.</>}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              {!resultado.aprovado && <button type="button" className="trilha-btn secundario" onClick={tentarDeNovo}>Tentar de novo</button>}
              <button type="button" className="trilha-btn" onClick={aoFechar}>{resultado.aprovado ? 'Voltar pra aula' : 'Rever a aula'}</button>
            </div>
          </div>
        ) : dados && (
          <button type="button" className="trilha-btn" style={{ width: '100%', marginTop: '6px' }} disabled={enviando || respostas.some((r) => r === null)} onClick={enviar}>
            {enviando ? 'Enviando...' : respostas.some((r) => r === null) ? 'Responda todas as perguntas' : 'Enviar respostas'}
          </button>
        )}
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------- uma aula
const AulaAberta = ({ aulaId, aoVoltar, aoGanharXp }) => {
  const [aula, setAula] = useState(null);
  const [estado, setEstado] = useState(null);
  const [fixacaoAberta, setFixacaoAberta] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    apiFetch(`/api/aulas/${aulaId}`).then(async (r) => {
      if (!r.ok) { setErro(await lerErro(r, 'Aula não encontrada.')); return; }
      const corpo = await r.json();
      setAula(corpo);
      setEstado(corpo);
    });
  }, [aulaId]);

  const enviarTrecho = useCallback(async (de, ate) => {
    const r = await apiFetch(`/api/aulas/${aulaId}/progresso`, { method: 'POST', body: JSON.stringify({ de_segundo: de, ate_segundo: ate }) });
    if (r.ok) {
      const corpo = await r.json();
      setEstado((e) => ({ ...e, ...corpo }));
    }
  }, [aulaId]);

  if (erro) return <div className="trilha-cartao"><button type="button" className="trilha-link" onClick={aoVoltar}>← Voltar</button><div className="trilha-erro"><IconWarning /> {erro}</div></div>;
  if (!aula) return <div className="trilha-cartao"><p style={{ color: '#64748b' }}>Carregando aula…</p></div>;

  const limite = estado?.pode_avancar_ate_segundo || 0;
  const concluida = Boolean(estado?.concluida_em);
  const player = aula.video_provedor === 'youtube'
    ? <PlayerYouTube videoId={aula.video_id} duracao={aula.duracao_segundos} limiteInicial={limite} aoTrecho={enviarTrecho} />
    : aula.video_provedor === 'demo'
      ? <PlayerDemo titulo={aula.titulo} duracao={aula.duracao_segundos} limiteInicial={limite} aoTrecho={enviarTrecho} />
      : <TempoDeEstudo duracao={aula.duracao_segundos} limiteInicial={limite} aoTrecho={enviarTrecho} />;

  return (
    <div className="trilha-cartao">
      <button type="button" className="trilha-link" onClick={aoVoltar}>← Voltar pra trilha</button>
      <h2 style={{ margin: '10px 0 4px', color: '#f1f5f9', fontSize: '22px', fontWeight: 800 }}>{aula.titulo}</h2>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <IconTimer style={{ verticalAlign: '-2px' }} /> {formatarTempo(aula.duracao_segundos)} · vale {horas(aula.carga_horaria_minutos)} de carga horária
      </div>
      {aula.descricao && <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, marginTop: 0 }}>{aula.descricao}</p>}

      {player}

      <div className="trilha-status">
        <div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Frequência nesta aula</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9' }}>{estado?.percentual_assistido ?? 0}% <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>de {estado?.percentual_minimo}% exigidos</span></div>
        </div>
        {concluida ? (
          <span className="trilha-chip ok"><IconCheckCircle /> Concluída em {dataIsoParaBr(estado.concluida_em)}</span>
        ) : (
          <button type="button" className="trilha-btn" disabled={!estado?.pode_fazer_fixacao} onClick={() => setFixacaoAberta(true)}>
            {estado?.pode_fazer_fixacao ? 'Fazer atividade de fixação' : <><IconLock /> Assista {estado?.percentual_minimo}% pra liberar a atividade</>}
          </button>
        )}
      </div>

      {aula.texto && (
        <section style={{ marginTop: '18px' }}>
          <div className="trilha-rotulo">Texto da aula</div>
          <div className="trilha-texto">{aula.texto}</div>
        </section>
      )}

      {aula.materiais?.length > 0 && (
        <section style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
          <div className="trilha-rotulo">Material de apoio</div>
          {aula.materiais.map((m) => (m.tipo === 'audio'
            ? <PlayerAudio key={m.id} caminho={`/api/aulas/${aula.id}/materiais/${m.id}`} nome={m.nome_arquivo} />
            : (
              <button key={m.id} type="button" className="trilha-material" onClick={() => baixarArquivo(`/api/aulas/${aula.id}/materiais/${m.id}`, m.nome_arquivo)}>
                <IconDocument /> {m.nome_arquivo} <span>{Math.max(1, Math.round(m.tamanho_bytes / 1024))} KB · baixar</span>
              </button>
            )))}
        </section>
      )}

      <AnimatePresence>
        {fixacaoAberta && (
          <ModalFixacao
            aula={aula}
            aoFechar={() => setFixacaoAberta(false)}
            aoConcluir={(corpo) => {
              setEstado((e) => ({ ...e, ...corpo }));
              aoGanharXp?.({ xp_total: corpo.novos_pontos_totais, nivel_gamificacao: corpo.nivel_atual, mudanca_liga: corpo.mudanca_liga });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------- trilha
const Trilha = ({ aoGanharXp }) => {
  const [modulos, setModulos] = useState(null);
  const [certificados, setCertificados] = useState([]);
  const [aulaAberta, setAulaAberta] = useState(null);
  const [erroDownload, setErroDownload] = useState(null);

  const carregar = useCallback(async () => {
    const [rTrilha, rCert] = await Promise.all([apiFetch('/api/trilha'), apiFetch('/api/certificados')]);
    if (rTrilha.ok) setModulos(await rTrilha.json());
    if (rCert.ok) setCertificados(await rCert.json());
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const baixarCertificado = async (c) => {
    setErroDownload(null);
    const erro = await baixarArquivo(`/api/certificados/${c.id}`, c.nome_arquivo);
    if (erro) setErroDownload(erro);
  };

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', display: 'grid', gap: '18px' }}>
      <style>{`
        ${ESTILOS_PLAYER}
        .trilha-cartao { background: rgba(255,255,255,0.045); border: 1px solid rgb(var(--accent-rgb) / 0.15); border-radius: 22px; padding: 26px; }
        .trilha-rotulo { font-size: 12px; font-weight: 700; color: var(--accent-2); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .trilha-btn { padding: 10px 16px; border: none; border-radius: 12px; background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong)); color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
        .trilha-btn.secundario { background: rgba(255,255,255,0.08); color: #e2e8f0; }
        .trilha-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .trilha-link { background: none; border: none; color: #94a3b8; font-weight: 700; font-size: 13px; cursor: pointer; padding: 0; font-family: inherit; }
        .trilha-aula { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); color: #e2e8f0; cursor: pointer; text-align: left; font-family: inherit; }
        .trilha-aula:hover { border-color: rgb(var(--accent-rgb) / 0.45); }
        .trilha-barra { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); overflow: hidden; }
        .trilha-barra > div { height: 100%; background: var(--accent); border-radius: 0 3px 3px 0; }
        .trilha-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 99px; background: rgb(var(--accent-rgb) / 0.12); color: var(--accent-soft); white-space: nowrap; }
        .trilha-chip.ok { background: rgba(52,211,153,0.1); color: #6ee7b7; }
        .trilha-chip.bloq { background: rgba(255,255,255,0.06); color: #94a3b8; }
        .trilha-status { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 14px; padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); }
        .trilha-texto { white-space: pre-wrap; color: #cbd5e1; font-size: 14px; line-height: 1.75; background: rgba(255,255,255,0.02); border-radius: 14px; padding: 16px 18px; }
        .trilha-material { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #e2e8f0; font-family: inherit; font-size: 13px; cursor: pointer; text-align: left; }
        .trilha-material span { margin-left: auto; color: #64748b; font-size: 12px; }
        .trilha-fundo { position: fixed; inset: 0; z-index: 120; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .trilha-modal { width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto; background: rgb(var(--surface-rgb)); border: 1px solid rgb(var(--accent-rgb) / 0.25); border-radius: 22px; padding: 22px; }
        .trilha-fechar { background: rgba(255,255,255,0.06); border: none; border-radius: 50%; width: 32px; height: 32px; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .trilha-pergunta { padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); margin-bottom: 10px; }
        .trilha-pergunta.certa { border-color: rgba(52,211,153,0.4); }
        .trilha-pergunta.errada { border-color: rgba(248,113,113,0.45); }
        .trilha-opcao { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: 10px; color: #cbd5e1; font-size: 13.5px; cursor: pointer; }
        .trilha-opcao.marcada { background: rgb(var(--accent-rgb) / 0.12); }
        .trilha-opcao.gabarito { background: rgba(52,211,153,0.12); color: #e2e8f0; }
        .trilha-opcao input { margin-top: 3px; accent-color: var(--accent); }
        .trilha-dica { margin-top: 6px; font-size: 12px; color: #fca5a5; }
        .trilha-dica.ok { color: #6ee7b7; }
        .trilha-resultado { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 16px; border-radius: 14px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); color: #fecaca; font-size: 14px; }
        .trilha-resultado.aprovado { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.3); color: #a7f3d0; }
        .trilha-erro { margin-top: 10px; color: #f87171; font-size: 13px; display: flex; gap: 6px; align-items: center; }
        @media (max-width: 600px) { .trilha-cartao { padding: 20px 16px; } }
      `}</style>

      {aulaAberta ? (
        <AulaAberta aulaId={aulaAberta} aoVoltar={() => { setAulaAberta(null); carregar(); }} aoGanharXp={aoGanharXp} />
      ) : (
        <>
          <div className="trilha-cartao">
            <div className="trilha-rotulo"><IconBook /> Trilha EAD</div>
            <h2 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: '22px', fontWeight: 800 }}>Suas aulas</h2>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              Aulas gravadas pelos professores da escola. Assista, faça a atividade de fixação e conclua: sua frequência fica registrada pra escola.
            </p>
          </div>

          {certificados.length > 0 && (
            <div className="trilha-cartao">
              <div className="trilha-rotulo"><IconStar /> Certificados</div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {certificados.map((c) => (
                  <div key={c.id} className="trilha-status" style={{ marginTop: 0 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14px' }}>{c.titulo}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {c.liberado ? `Liberado${c.emitido_em ? ` · emitido em ${dataIsoParaBr(c.emitido_em)}` : ''}` : `Conclua todas as aulas pra liberar (${c.aulas_concluidas} de ${c.aulas_total})`}
                      </div>
                    </div>
                    {c.liberado
                      ? <button type="button" className="trilha-btn" onClick={() => baixarCertificado(c)}><IconDocument /> Baixar PDF</button>
                      : <span className="trilha-chip bloq"><IconLock /> Bloqueado</span>}
                  </div>
                ))}
              </div>
              {erroDownload && <div className="trilha-erro"><IconWarning /> {erroDownload}</div>}
            </div>
          )}

          {modulos === null && <div className="trilha-cartao"><p style={{ color: '#64748b', margin: 0 }}>Carregando…</p></div>}
          {modulos?.length === 0 && <div className="trilha-cartao"><p style={{ color: '#94a3b8', margin: 0 }}>A escola ainda não publicou aulas pro seu itinerário.</p></div>}
          {modulos?.map((m) => {
            const concluidas = m.aulas.filter((a) => a.concluida_em).length;
            return (
              <div key={m.id} className="trilha-cartao">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '18px', fontWeight: 800 }}>{m.titulo}</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{concluidas} de {m.aulas.length} aulas · {horas(m.carga_horaria_minutos)}</span>
                </div>
                {m.descricao && <p style={{ color: '#94a3b8', fontSize: '13.5px', lineHeight: 1.6, margin: '6px 0 0' }}>{m.descricao}</p>}
                <div className="trilha-barra" style={{ margin: '12px 0 14px' }}><div style={{ width: `${m.aulas.length ? (concluidas / m.aulas.length) * 100 : 0}%` }} /></div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {m.aulas.map((a, i) => (
                    <button key={a.id} type="button" className="trilha-aula" onClick={() => setAulaAberta(a.id)}>
                      <span style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0, background: a.concluida_em ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)', color: a.concluida_em ? '#6ee7b7' : '#94a3b8' }}>
                        {a.concluida_em ? <IconCheckCircle /> : i + 1}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: '14px' }}>{a.titulo}</span>
                        <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>
                          {a.tem_video ? 'Vídeo' : 'Leitura'} · {formatarTempo(a.duracao_segundos)}{a.total_materiais ? ` · ${a.total_materiais} material${a.total_materiais > 1 ? 'is' : ''}` : ''}
                        </span>
                      </span>
                      {a.concluida_em
                        ? <span className="trilha-chip ok">Concluída</span>
                        : a.percentual_assistido > 0 ? <span className="trilha-chip">{a.percentual_assistido}%</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default Trilha;
