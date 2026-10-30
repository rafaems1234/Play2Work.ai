import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconTarget, IconStar, IconCheckCircle, IconLightbulb, IconBriefcase, IconWarning } from './icons';
import { apiFetch, lerErro } from '../api';
import MapaCompetencias from './MapaCompetencias';
import { dataIsoParaBr } from '../utils/formatos';

// Aba inicial do aluno: o mapa de competências (o que ele já demonstrou),
// a atividade "O que você faria?" pra treinar soft skills, e as vagas pra
// que a escola o indicou -- o aluno não se candidata sozinho.

const STATUS_INDICACAO = {
  enviada: 'Enviada pra empresa',
  em_analise: 'Em análise pela empresa',
  aprovada: 'Aprovado',
  recusada: 'Não foi dessa vez',
};

const Cartao = ({ children, style }) => (
  <section className="comp-cartao" style={style}>{children}</section>
);

const OQueVoceFaria = ({ nomesEixos, aoConcluir }) => {
  const [dados, setDados] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [escolhida, setEscolhida] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setResultado(null);
    setEscolhida(null);
    setErro(null);
    const resposta = await apiFetch('/api/situacoes/proxima');
    if (resposta.ok) setDados(await resposta.json());
    else setErro('Não foi possível carregar a situação.');
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const responder = async (indice) => {
    setEscolhida(indice);
    setEnviando(true);
    setErro(null);
    const resposta = await apiFetch('/api/situacoes/responder', {
      method: 'POST',
      body: JSON.stringify({ situacao_id: dados.situacao.id, opcao_index: indice }),
    });
    setEnviando(false);
    if (!resposta.ok) {
      setErro(await lerErro(resposta, 'Não foi possível registrar sua resposta.'));
      setEscolhida(null);
      return;
    }
    const corpo = await resposta.json();
    setResultado(corpo);
    setDados((d) => ({ ...d, restantes_hoje: Math.max(0, d.restantes_hoje - 1) }));
    aoConcluir(corpo);
  };

  if (!dados) return <p style={{ color: '#64748b', fontSize: '14px' }}>{erro || 'Carregando…'}</p>;
  if (!dados.situacao) {
    return (
      <div style={{ textAlign: 'center', padding: '18px 8px', color: '#94a3b8', fontSize: '14px' }}>
        <IconCheckCircle style={{ fontSize: '26px', color: '#34d399', marginBottom: '6px' }} />
        <div>Você já fez as {dados.limite_diario} situações de hoje. Volte amanhã pra novas!</div>
      </div>
    );
  }

  const { situacao } = dados;
  return (
    <div>
      <div style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9', marginBottom: '8px' }}>{situacao.titulo}</div>
      <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.65, margin: '0 0 16px' }}>{situacao.cenario}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {situacao.opcoes.map((texto, i) => {
          const ehMelhor = resultado && (resultado.escolheu_a_melhor ? i === escolhida : resultado.melhor_opcao?.indice === i);
          const classe = resultado ? (i === escolhida ? 'escolhida' : ehMelhor ? 'melhor' : 'apagada') : '';
          return (
            <button key={i} type="button" className={`comp-opcao ${classe}`} disabled={Boolean(resultado) || enviando} onClick={() => responder(i)}>
              {texto}
            </button>
          );
        })}
      </div>
      {erro && <div className="comp-erro"><IconWarning /> {erro}</div>}

      <AnimatePresence>
        {resultado && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '16px' }}>
            <div className={`comp-consequencia ${resultado.escolheu_a_melhor ? 'boa' : ''}`}>
              <strong>{resultado.escolheu_a_melhor ? 'Ótima escolha!' : 'O que aconteceu:'}</strong> {resultado.consequencia}
            </div>
            {resultado.melhor_opcao && (
              <div className="comp-consequencia boa" style={{ marginTop: '8px' }}>
                <IconLightbulb style={{ verticalAlign: '-2px', color: '#fbbf24' }} /> <strong>O caminho que mais desenvolve você:</strong> "{resultado.melhor_opcao.texto}". {resultado.melhor_opcao.consequencia}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '12px 0' }}>
              {resultado.competencias.map((c) => (
                <span key={c.codigo} className="comp-chip">{nomesEixos[c.codigo] || c.codigo} · {c.pontos}</span>
              ))}
              <span className="comp-chip xp">+{resultado.xp_concedido} XP</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{dados.restantes_hoje} situaç{dados.restantes_hoje === 1 ? 'ão' : 'ões'} restante{dados.restantes_hoje === 1 ? '' : 's'} hoje</span>
              <button type="button" className="comp-btn" onClick={carregar}>{dados.restantes_hoje > 0 ? 'Próxima situação →' : 'Ver resumo'}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Competencias = ({ aoGanharXp }) => {
  const [mapa, setMapa] = useState(null);
  const [indicacoes, setIndicacoes] = useState([]);

  const carregarMapa = useCallback(async () => {
    const resposta = await apiFetch('/api/estudante/me/competencias');
    if (resposta.ok) setMapa(await resposta.json());
  }, []);

  useEffect(() => {
    carregarMapa();
    apiFetch('/api/jobs/minhas-candidaturas').then(async (r) => { if (r.ok) setIndicacoes(await r.json()); }).catch(() => {});
  }, [carregarMapa]);

  const nomesEixos = Object.fromEntries((mapa?.eixos || []).map((e) => [e.codigo, e.nome]));
  const medidos = (mapa?.eixos || []).filter((e) => e.pontuacao != null);

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', display: 'grid', gap: '18px' }}>
      <style>{`
        .comp-cartao { background: rgba(255,255,255,0.045); border: 1px solid rgb(var(--accent-rgb) / 0.15); border-radius: 22px; padding: 26px; }
        .comp-rotulo { font-size: 12px; font-weight: 700; color: var(--accent-2); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .comp-titulo { font-size: 22px; font-weight: 800; color: #f1f5f9; margin: 0 0 6px; letter-spacing: -0.3px; }
        .comp-texto { color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 18px; }
        .comp-opcao { text-align: left; padding: 13px 16px; border-radius: 14px; font-size: 14px; line-height: 1.5; font-family: inherit; cursor: pointer;
          background: rgba(255,255,255,0.04); border: 1px solid rgb(var(--accent-rgb) / 0.2); color: #e2e8f0; transition: border-color 0.2s, background 0.2s; }
        .comp-opcao:hover:not(:disabled) { border-color: rgb(var(--accent-rgb) / 0.55); background: rgb(var(--accent-rgb) / 0.08); }
        .comp-opcao:disabled { cursor: default; }
        .comp-opcao.escolhida { border-color: var(--accent); background: rgb(var(--accent-rgb) / 0.14); }
        .comp-opcao.melhor { border-color: rgba(52,211,153,0.6); background: rgba(52,211,153,0.08); }
        .comp-opcao.apagada { opacity: 0.45; }
        .comp-consequencia { padding: 12px 14px; border-radius: 12px; font-size: 13.5px; line-height: 1.6; color: #cbd5e1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
        .comp-consequencia.boa { background: rgba(52,211,153,0.07); border-color: rgba(52,211,153,0.25); }
        .comp-chip { font-size: 12px; font-weight: 700; color: var(--accent-soft); background: rgb(var(--accent-rgb) / 0.1); padding: 4px 10px; border-radius: 99px; }
        .comp-chip.xp { color: #fcd34d; background: rgba(251,191,36,0.1); }
        .comp-btn { padding: 10px 16px; border: none; border-radius: 12px; background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong)); color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }
        .comp-erro { margin-top: 10px; color: #f87171; font-size: 13px; display: flex; gap: 6px; align-items: center; }
        @media (max-width: 600px) { .comp-cartao { padding: 20px 16px; } }
      `}</style>

      <Cartao>
        <div className="comp-rotulo"><IconTarget /> Seu mapa</div>
        <h2 className="comp-titulo">Suas competências</h2>
        <p className="comp-texto">
          {medidos.length
            ? 'Cada atividade (quiz, simulador de entrevista e situações de trabalho) mostra uma parte do que você sabe fazer. A escola usa esse mapa na hora de te indicar pras vagas.'
            : 'Seu mapa começa vazio. Cada atividade que você faz (quiz, simulador de entrevista e as situações abaixo) preenche uma parte dele. A escola usa esse mapa na hora de te indicar pras vagas.'}
        </p>
        {mapa ? <MapaCompetencias eixos={mapa.eixos} referenciaMedia={mapa.referencia_media} /> : <p className="comp-texto">Carregando…</p>}
      </Cartao>

      <Cartao>
        <div className="comp-rotulo"><IconLightbulb /> Treino de soft skills</div>
        <h2 className="comp-titulo">O que você faria?</h2>
        <p className="comp-texto">Situações reais do dia a dia de trabalho. Não tem pegadinha: cada escolha tem uma consequência, e você vê o que cada uma desenvolve.</p>
        <OQueVoceFaria
          nomesEixos={nomesEixos}
          aoConcluir={(corpo) => {
            carregarMapa();
            aoGanharXp?.({
              xp_total: corpo.novos_pontos_totais,
              nivel_gamificacao: corpo.nivel_atual,
              ofensiva_dias: corpo.ofensiva_dias,
              categoria_status: corpo.categoria_status,
              liga: corpo.liga,
              mudanca_liga: corpo.mudanca_liga,
            });
          }}
        />
      </Cartao>

      <Cartao>
        <div className="comp-rotulo"><IconBriefcase /> Vagas</div>
        <h2 className="comp-titulo">Suas indicações</h2>
        <p className="comp-texto">Quem indica os alunos pras vagas de Jovem Aprendiz é a coordenação da escola, de acordo com as cotas de cada empresa parceira.</p>
        {indicacoes.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Você ainda não foi indicado pra nenhuma vaga. Continue treinando: seu mapa de competências conta na indicação.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {indicacoes.map((c) => (
              <div key={c.id} style={{ padding: '14px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14px' }}>{c.titulo_vaga}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{c.empresa}{c.criada_em ? ` · desde ${dataIsoParaBr(c.criada_em)}` : ''}</div>
                </div>
                <span className="comp-chip" style={c.status === 'aprovada' ? { color: '#6ee7b7', background: 'rgba(52,211,153,0.1)' } : undefined}>
                  {c.indicada_pela_escola && <IconStar style={{ verticalAlign: '-2px', marginRight: '4px' }} />}
                  {STATUS_INDICACAO[c.status] || c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </div>
  );
};

export default Competencias;
