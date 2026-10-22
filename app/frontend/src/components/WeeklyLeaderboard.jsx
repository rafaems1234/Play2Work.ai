import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { IconWarning } from './icons';
import { apiFetch } from '../api';
import { SkeletonStyles, RowSkeleton } from './Skeleton';
import Trofeu from './Trofeu';
import { LIGAS } from '../ligas';


const CORES_POSICAO = { 1: '#fcd34d', 2: '#e5e9f0', 3: '#e09a5b' };

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

// Dias até a virada da liga (segunda-feira 00h, mesmo corte do backend).
const diasParaVirada = () => {
  const diaDaSemana = new Date().getDay(); // 0 = domingo
  return ((8 - diaDaSemana) % 7) || 7;
};

// Cor do avatar estável por nome, pra cada colega ter "a sua" cor.
const corDoAvatar = (nome) => {
  let hash = 0;
  for (const letra of nome) hash = (hash * 31 + letra.charCodeAt(0)) % 360;
  return `hsl(${hash} 55% 42%)`;
};

const FaixaDeZona = ({ tipo, ligaDestino }) => {
  const promocao = tipo === 'promocao';
  const cor = promocao ? '#34d399' : '#f87171';
  return (
    <div className="lb-faixa" style={{ color: cor }}>
      <span className="lb-faixa-linha" style={{ background: cor }} />
      <span className="lb-faixa-texto">
        {promocao ? '▲ Zona de promoção' : '▼ Zona de rebaixamento'}
        {ligaDestino && <span style={{ opacity: 0.7 }}> · {promocao ? 'sobem' : 'caem'} pra Liga {ligaDestino}</span>}
      </span>
      <span className="lb-faixa-linha" style={{ background: cor }} />
    </div>
  );
};

const WeeklyLeaderboard = () => {
  const [ranking, setRanking] = useState([]);
  const [liga, setLiga] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const trofeuAtualRef = useRef(null);

  useEffect(() => {
    const buscarRanking = async () => {
      try {
        setCarregando(true);
        setErro(null);
        const response = await apiFetch('/api/ranking');
        if (!response.ok) throw new Error('Não foi possível carregar o ranking.');
        const dados = await response.json();
        setRanking(Array.isArray(dados?.ranking) ? dados.ranking : []);
        setLiga(dados?.liga || 'Bronze');
      } catch (err) {
        console.error(err);
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    };
    buscarRanking();
  }, []);

  const indiceLiga = Math.max(0, LIGAS.findIndex((l) => l.nome === liga));

  // No celular a fileira de taças rola de lado: centraliza na liga atual
  // rolando só a fileira (scrollIntoView também rolaria a página).
  useEffect(() => {
    const trofeu = trofeuAtualRef.current;
    const fileira = trofeu?.parentElement;
    if (!trofeu || !fileira) return;
    fileira.scrollLeft = trofeu.offsetLeft - fileira.offsetLeft - (fileira.clientWidth - trofeu.clientWidth) / 2;
  }, [liga]);
  const ligaAcima = LIGAS[indiceLiga + 1]?.nome;
  const ligaAbaixo = LIGAS[indiceLiga - 1]?.nome;
  const dias = diasParaVirada();

  const qtdSobem = ranking.filter((r) => r.zona === 'promocao').length;
  const qtdCaem = ranking.filter((r) => r.zona === 'rebaixamento').length;
  const eu = ranking.find((r) => r.voce);
  const ultimoPromovido = [...ranking].reverse().find((r) => r.zona === 'promocao');
  const faltaPraPromocao = eu && eu.zona !== 'promocao' && ultimoPromovido
    ? ultimoPromovido.xp_semanal - eu.xp_semanal + 1
    : null;

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '20px 0', width: '100%' }}>
      <style>{`
        .lb-card {
          background: rgba(255,255,255,0.045);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgb(var(--accent-rgb) / 0.15);
          border-radius: 24px;
          padding: 32px;
        }
        .lb-trofeus {
          display: flex; justify-content: space-between; gap: 2px;
          padding: 22px 4px 16px; margin: 8px 0 18px;
          border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
          overflow-x: auto; scrollbar-width: none;
        }
        .lb-trofeus::-webkit-scrollbar { display: none; }
        .lb-trofeu {
          flex: 0 0 74px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px;
          position: relative; isolation: isolate;
        }
        .lb-trofeu-nome { font-family: var(--mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; white-space: nowrap; }
        .lb-trofeu-atual::before {
          content: ''; position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
          width: 84px; height: 84px; border-radius: 50%;
          background: radial-gradient(circle, rgb(var(--accent-rgb) / 0.3), transparent 70%);
          z-index: -1;
        }
        .lb-voce-tag {
          font-family: var(--mono); font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #000;
          background: var(--accent); padding: 2px 6px; border-radius: 4px;
        }
        .lb-info { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 18px; font-size: 13px; color: #94a3b8; }
        .lb-relogio { font-family: var(--mono); font-size: 12px; color: #e2e8f0; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 6px 10px; border-radius: 8px; }
        .lb-falta { margin-bottom: 18px; padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; background: rgb(var(--accent-rgb) / 0.1); border: 1px solid rgb(var(--accent-rgb) / 0.3); color: var(--accent-soft); }
        .lb-falta.subindo { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.3); color: #6ee7b7; }

        .lb-linha {
          display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 14px;
          border: 1px solid transparent; transition: background 0.2s ease;
        }
        .lb-linha:hover { background: rgba(255,255,255,0.035); }
        .lb-linha.voce { background: rgb(var(--accent-rgb) / 0.12); border-color: rgb(var(--accent-rgb) / 0.45); }
        .lb-pos { width: 28px; text-align: center; font-family: var(--heading); font-size: 18px; font-weight: 800; color: #64748b; flex-shrink: 0; }
        .lb-avatar {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 800; font-size: 15px;
        }
        .lb-nome { color: #e2e8f0; font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .lb-cat { font-size: 12px; color: #64748b; margin-top: 2px; }
        .lb-xp { margin-left: auto; font-family: var(--mono); font-weight: 700; color: #e2e8f0; white-space: nowrap; font-size: 14px; }
        .lb-seta { font-size: 11px; margin-left: 6px; }

        .lb-faixa { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
        .lb-faixa-linha { flex: 1; height: 1px; opacity: 0.45; }
        .lb-faixa-texto { font-family: var(--mono); font-size: 10.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; white-space: nowrap; }

        @media (max-width: 600px) {
          .lb-card { padding: 22px 14px; }
          .lb-linha { gap: 10px; padding: 10px 10px; }
          .lb-faixa-texto span { display: none; }
          .lb-cat { display: none; }
        }
      `}</style>
      <SkeletonStyles />
      <div className="lb-card">
        <header style={{ marginBottom: '6px' }}>
          <div className="tech-label" style={{ color: 'var(--accent-2)', marginBottom: '8px' }}>// Ranking semanal</div>
          <h2 style={{ fontSize: '28px', color: '#f1f5f9', fontWeight: '800', letterSpacing: '-0.4px', margin: 0 }}>
            Liga <span className="gradient-text-live">{liga || '...'}</span>
          </h2>
        </header>

        <div className="lb-trofeus">
          {LIGAS.map((l, i) => {
            const estado = i < indiceLiga ? 'conquistada' : i === indiceLiga ? 'atual' : 'bloqueada';
            return (
              <motion.div
                key={l.nome}
                ref={estado === 'atual' ? trofeuAtualRef : undefined}
                className={`lb-trofeu ${estado === 'atual' ? 'lb-trofeu-atual' : ''}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, scale: estado === 'atual' ? 1.12 : 1 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                title={estado === 'bloqueada' ? `Liga ${l.nome}: ainda bloqueada` : `Liga ${l.nome}`}
              >
                <Trofeu liga={l} bloqueada={estado === 'bloqueada'} tamanho={estado === 'atual' ? 58 : 44} />
                <span className="lb-trofeu-nome" style={{ color: estado === 'bloqueada' ? '#475569' : l.cor }}>{l.nome}</span>
                <span className="lb-voce-tag" style={{ visibility: estado === 'atual' ? 'visible' : 'hidden' }}>VOCÊ</span>
              </motion.div>
            );
          })}
        </div>

        <div className="lb-info">
          <span>
            {ligaAcima ? <>Os <strong style={{ color: '#6ee7b7' }}>{qtdSobem} primeiros</strong> sobem pra Liga {ligaAcima}</> : <>Você está na liga mais alta!</>}
            {ligaAbaixo && qtdCaem > 0 && <>, os <strong style={{ color: '#fca5a5' }}>{qtdCaem} últimos</strong> caem pra Liga {ligaAbaixo}</>}.
          </span>
          <span className="lb-relogio">⏱ Termina em {dias} {dias === 1 ? 'dia' : 'dias'}</span>
        </div>

        {faltaPraPromocao !== null && faltaPraPromocao > 0 && (
          <div className="lb-falta">
            Faltam <strong>{faltaPraPromocao} XP</strong> pra você entrar na zona de promoção. Um quiz resolve!
          </div>
        )}
        {eu?.zona === 'promocao' && ligaAcima && (
          <div className="lb-falta subindo">
            Você está na zona de promoção! Se terminar a semana assim, sobe pra Liga {ligaAcima}.
          </div>
        )}

        {carregando && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        )}

        {erro && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', padding: '20px 24px', textAlign: 'center', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <IconWarning /> {erro}
          </div>
        )}

        {!carregando && !erro && (
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} variants={listVariants} initial="hidden" animate="visible">
            {ranking.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>Ninguém pontuou essa semana ainda.</p>
            ) : (
              ranking.map((user, idx) => {
                const anterior = ranking[idx - 1];
                const fimDaPromocao = anterior?.zona === 'promocao' && user.zona !== 'promocao';
                const inicioDoRebaixamento = user.zona === 'rebaixamento' && anterior?.zona !== 'rebaixamento';
                return (
                  <React.Fragment key={`${user.posicao}-${user.nome}`}>
                    {fimDaPromocao && <FaixaDeZona tipo="promocao" ligaDestino={ligaAcima} />}
                    {inicioDoRebaixamento && <FaixaDeZona tipo="rebaixamento" ligaDestino={ligaAbaixo} />}
                    <motion.div className={`lb-linha ${user.voce ? 'voce' : ''}`} variants={rowVariants}>
                      <span className="lb-pos" style={{ color: CORES_POSICAO[user.posicao] || undefined }}>{user.posicao}</span>
                      <span className="lb-avatar" style={{ background: corDoAvatar(user.nome) }}>
                        {user.nome.charAt(0).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="lb-nome">
                          {user.nome}
                          {user.voce && <span className="lb-voce-tag">VOCÊ</span>}
                        </div>
                        <div className="lb-cat">{user.categoria}</div>
                      </div>
                      <span className="lb-xp">
                        {user.xp_semanal} XP
                        {user.zona === 'promocao' && <span className="lb-seta" style={{ color: '#34d399' }}>▲</span>}
                        {user.zona === 'rebaixamento' && <span className="lb-seta" style={{ color: '#f87171' }}>▼</span>}
                      </span>
                    </motion.div>
                  </React.Fragment>
                );
              })
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default WeeklyLeaderboard;
