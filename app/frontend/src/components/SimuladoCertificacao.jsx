import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import AreaProva from './AreaProva';
import useTravarRolagem from '../hooks/useTravarRolagem';
import { IconGraduationCap, IconTimer, IconWarning, IconCheckCircle, IconLock, IconBook } from './icons';
import { apiFetch, lerErro } from '../api';
import { dataHoraIsoParaBr, dataIsoParaBr } from '../utils/formatos';

// Simulado de Certificação (regras em certificacao.py): 20 questões do banco,
// tentativa única por ciclo, 40 min, aprovação com 70%. Uma questão por vez,
// sem voltar e sem mostrar se acertou; no fim, só a nota.

const segundosAte = (iso) => {
  if (!iso) return 0;
  const alvo = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`).getTime();
  return Math.max(0, Math.round((alvo - Date.now()) / 1000));
};
const relogio = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ------------------------------------------------------------------ prova em tela cheia
const Prova = ({ prova, aoTerminar }) => {
  useTravarRolagem();
  const [atual, setAtual] = useState(prova.respondidas);
  const [escolha, setEscolha] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [restante, setRestante] = useState(() => segundosAte(prova.expira_em));
  const finalizandoRef = useRef(false);

  const finalizar = useCallback(async () => {
    if (finalizandoRef.current) return;
    finalizandoRef.current = true;
    const r = await apiFetch(`/api/certificacao/${prova.id}/finalizar`, { method: 'POST' });
    aoTerminar(r.ok ? await r.json() : null);
  }, [prova.id, aoTerminar]);

  // Relógio: no zero, corrige o que foi respondido
  useEffect(() => {
    const id = setInterval(() => {
      const s = segundosAte(prova.expira_em);
      setRestante(s);
      if (s === 0) finalizar();
    }, 1000);
    return () => clearInterval(id);
  }, [prova.expira_em, finalizar]);

  // Trocar de aba ou minimizar fica registrado pra escola ver
  useEffect(() => {
    const aoMudar = () => {
      if (document.visibilityState === 'hidden') apiFetch(`/api/certificacao/${prova.id}/saida-de-tela`, { method: 'POST' }).catch(() => {});
    };
    document.addEventListener('visibilitychange', aoMudar);
    return () => document.removeEventListener('visibilitychange', aoMudar);
  }, [prova.id]);

  const confirmar = async () => {
    if (escolha == null || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await apiFetch(`/api/certificacao/${prova.id}/responder`, { method: 'POST', body: JSON.stringify({ indice: atual, opcao: escolha }) });
      if (!r.ok) {
        const msg = await lerErro(r, 'Não foi possível registrar a resposta.');
        if (r.status === 409) { finalizar(); return; }
        throw new Error(msg);
      }
      setEscolha(null);
      if (atual + 1 >= prova.questoes.length) finalizar();
      else setAtual(atual + 1);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const questao = prova.questoes[atual];
  const total = prova.questoes.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'var(--bg)', overflowY: 'auto', padding: '20px 16px' }}>
      <AreaProva style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ fontWeight: 800, color: 'var(--txt-1)', display: 'flex', alignItems: 'center', gap: '8px' }}><IconGraduationCap /> Simulado de Certificação</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px' }}>
            <span style={{ color: 'var(--txt-3)' }}>Questão <strong style={{ color: 'var(--txt-1)' }}>{Math.min(atual + 1, total)}</strong> de {total}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: restante < 300 ? 'var(--erro)' : 'var(--accent-soft)', fontVariantNumeric: 'tabular-nums' }}><IconTimer /> {relogio(restante)}</span>
          </div>
        </div>
        <div style={{ height: '5px', borderRadius: '3px', background: 'rgb(var(--tinta-rgb) / 0.08)', marginBottom: '22px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(atual / total) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', transition: 'width 0.3s' }} />
        </div>

        {questao ? (
          <AnimatePresence mode="wait">
            <motion.div key={atual} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h2 style={{ fontSize: '18px', lineHeight: 1.5, color: 'var(--txt-1)', fontWeight: 700, margin: '0 0 18px' }}>{questao.pergunta}</h2>
              <div style={{ display: 'grid', gap: '10px' }} role="radiogroup" aria-label="Alternativas">
                {questao.opcoes.map((opcao, i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={escolha === i}
                    onClick={() => setEscolha(i)}
                    style={{
                      textAlign: 'left', padding: '14px 16px', borderRadius: '14px', fontSize: '15px', lineHeight: 1.5, cursor: 'pointer', fontFamily: 'inherit',
                      background: escolha === i ? 'rgb(var(--accent-rgb) / 0.16)' : 'rgb(var(--tinta-rgb) / 0.04)',
                      border: `1px solid ${escolha === i ? 'rgb(var(--accent-rgb) / 0.6)' : 'rgb(var(--accent-rgb) / 0.15)'}`,
                      color: 'var(--txt-1b)',
                    }}
                  >
                    <strong style={{ marginRight: '8px', color: 'var(--accent-soft)' }}>{String.fromCharCode(65 + i)})</strong>{opcao}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <p style={{ color: 'var(--txt-3)' }}>Corrigindo...</p>
        )}

        {erro && <div role="alert" style={{ marginTop: '14px', color: 'var(--erro-suave)', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}><IconWarning /> {erro}</div>}

        <button
          type="button"
          onClick={confirmar}
          disabled={escolha == null || enviando || !questao}
          style={{ marginTop: '20px', width: '100%', padding: '15px', border: 'none', borderRadius: '14px', background: 'linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong))', color: 'white', fontWeight: 800, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', opacity: escolha == null || enviando ? 0.5 : 1 }}
        >
          {enviando ? 'Registrando...' : atual + 1 >= total ? 'Confirmar e terminar a prova' : 'Confirmar resposta →'}
        </button>
        <p style={{ fontSize: '12px', color: 'var(--txt-4)', textAlign: 'center', marginTop: '10px' }}>
          Depois de confirmar não dá pra voltar. Sair desta tela fica registrado pra escola.
        </p>
      </AreaProva>
    </motion.div>
  );
};

// ------------------------------------------------------------------ cartão na aba Quiz
const SimuladoCertificacao = () => {
  const [situacao, setSituacao] = useState(null);
  const [prova, setProva] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await apiFetch('/api/certificacao');
    if (r.ok) setSituacao(await r.json());
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const comecar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await apiFetch('/api/certificacao/iniciar', { method: 'POST' });
      if (!r.ok) { setErro(await lerErro(r, 'Não foi possível começar o simulado.')); await carregar(); return; }
      setResultado(null);
      setConfirmando(false);
      setProva(await r.json());
    } finally {
      setCarregando(false);
    }
  };

  const aoTerminar = useCallback((dados) => {
    setProva(null);
    setResultado(dados);
    if (dados?.status === 'aprovada') confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#2e7bff', '#00e5ff', '#34d399'] });
    carregar();
  }, [carregar]);

  if (!situacao) return null;
  const { regras, aprovacao, em_andamento: aberta, ultima, proxima_tentativa_em: proxima } = situacao;

  return (
    <div style={{ maxWidth: '920px', width: '100%', margin: '0 auto 20px' }}>
      <div style={{ background: 'rgb(var(--surface-rgb) / 0.9)', border: `1px solid ${aprovacao ? 'rgba(52,211,153,0.45)' : 'rgb(var(--accent-rgb) / 0.2)'}`, borderRadius: '20px', padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '1px' }}>Prova de fogo</div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--txt-1)', display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0 6px' }}>
              <IconGraduationCap /> Simulado de Certificação {situacao.itinerario && <span style={{ fontSize: '13px', color: 'var(--txt-3)', fontWeight: 600 }}>· {situacao.itinerario}</span>}
            </div>

            {aprovacao ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ok)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <IconCheckCircle /> Aprovado com {aprovacao.percentual}% em {dataIsoParaBr(aprovacao.concluida_em)}. A certificação está no seu perfil e a escola já vê.
              </p>
            ) : aberta ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--aviso)' }}>Você tem um simulado em andamento ({aberta.respondidas} de {aberta.questoes.length} respondidas). O relógio continua correndo.</p>
            ) : !situacao.itinerario ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--txt-4)' }}>A escola ainda não definiu o seu curso. Fale com a coordenação.</p>
            ) : proxima ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--txt-3)', lineHeight: 1.6 }}>
                <IconLock style={{ verticalAlign: '-2px' }} /> Última tentativa: {ultima?.percentual}% (precisava de {regras.nota_minima}%). Nova tentativa liberada em <strong>{dataHoraIsoParaBr(proxima)}</strong>.
                {' '}<IconBook style={{ verticalAlign: '-2px' }} /> Até lá, treine nos quizzes diários aqui embaixo.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--txt-3)', lineHeight: 1.6 }}>
                {regras.total_questoes} questões do banco da escola, {regras.duracao_minutos} minutos, aprovação com {regras.nota_minima}%. Tentativa única: se não passar, dá pra tentar de novo depois de {regras.dias_entre_tentativas} dias.
              </p>
            )}
          </div>

          {!aprovacao && situacao.itinerario && (
            aberta ? (
              <button type="button" className="sim-cert-btn" onClick={() => setProva(aberta)}>Continuar simulado →</button>
            ) : situacao.pode_comecar && !confirmando ? (
              <button type="button" className="sim-cert-btn" onClick={() => setConfirmando(true)}>Fazer o simulado</button>
            ) : null
          )}
        </div>

        {confirmando && (
          <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', fontSize: '13px', color: 'var(--txt-2)', lineHeight: 1.6 }}>
            <strong>Antes de começar:</strong> é uma tentativa só. Ao clicar em começar, a prova conta mesmo que você feche a página.
            Reserve {regras.duracao_minutos} minutos, fique nesta tela (sair dela fica registrado) e não dá pra voltar nas questões.
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="sim-cert-btn" onClick={comecar} disabled={carregando}>{carregando ? 'Preparando...' : 'Começar agora'}</button>
              <button type="button" className="sim-cert-btn secundario" onClick={() => setConfirmando(false)}>Agora não</button>
            </div>
          </div>
        )}

        {resultado && (
          <div style={{ marginTop: '14px', padding: '14px', borderRadius: '14px', background: resultado.status === 'aprovada' ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid ${resultado.status === 'aprovada' ? 'rgba(52,211,153,0.35)' : 'rgba(239,68,68,0.25)'}`, fontSize: '14px', color: 'var(--txt-2)', lineHeight: 1.6 }}>
            <div style={{ fontSize: '26px', fontWeight: 800, color: resultado.status === 'aprovada' ? 'var(--ok)' : 'var(--erro-suave)' }}>{resultado.percentual}%</div>
            {resultado.acertos} de {resultado.total} questões.{' '}
            {resultado.status === 'aprovada'
              ? 'Aprovado! A certificação foi registrada no seu perfil e a coordenação já vê no painel.'
              : `Dessa vez não deu (precisava de ${resultado.nota_minima}%). Treine nos quizzes diários: a próxima tentativa abre em ${resultado.dias_entre_tentativas} dias.`}
          </div>
        )}
        {erro && <div role="alert" style={{ marginTop: '12px', color: 'var(--erro-suave)', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}><IconWarning /> {erro}</div>}
      </div>

      <style>{`
        .sim-cert-btn { background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong)); border: none; border-radius: 12px; color: white; font-weight: 800; font-size: 14px; padding: 11px 18px; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .sim-cert-btn.secundario { background: rgb(var(--tinta-rgb) / 0.08); color: var(--txt-2); border: 1px solid rgb(var(--tinta-rgb) / 0.15); }
        .sim-cert-btn:disabled { opacity: 0.6; cursor: wait; }
      `}</style>

      {/* No body: a aba animada (transform) prenderia o position: fixed dentro dela */}
      {createPortal(<AnimatePresence>{prova && <Prova key={prova.id} prova={prova} aoTerminar={aoTerminar} />}</AnimatePresence>, document.body)}
    </div>
  );
};

export default SimuladoCertificacao;
