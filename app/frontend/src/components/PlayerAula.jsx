import React, { useCallback, useEffect, useRef, useState } from 'react';
import { urlDeArquivo } from '../api';

// Players da trilha EAD. Regra da integração: "como ao vivo" -- o aluno pode
// voltar pra rever, mas não avança além do ponto mais longe que já assistiu
// sem pular, e não acelera. Não tem barra de arrastar nem atalho de teclado;
// só play/pausa e "voltar 10 s".
//
// A trava daqui é a experiência do aluno. A garantia de verdade está no
// servidor (aulas.py): ele só credita o trecho realmente reproduzido, em 1x,
// dentro do tempo real -- então mexer no navegador não adianta.

const INTERVALO_ENVIO_MS = 10000;
const TOLERANCIA_SALTO_S = 3;

export const formatarTempo = (segundos) => {
  const s = Math.max(0, Math.floor(segundos || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const resto = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${resto}` : `${m}:${resto}`;
};

// Núcleo comum: acompanha a posição, impede o avanço e manda os trechos pro servidor
const useSemAvanco = ({ obterTempo, irPara, tocando, limiteInicial, aoTrecho }) => {
  const maiorRef = useRef(limiteInicial || 0);
  const ultimoEnviadoRef = useRef(null);
  const [posicao, setPosicao] = useState(0);
  const [limite, setLimite] = useState(limiteInicial || 0);

  useEffect(() => {
    maiorRef.current = Math.max(maiorRef.current, limiteInicial || 0);
    setLimite(maiorRef.current);
  }, [limiteInicial]);

  const enviarPendente = useCallback(() => {
    const agora = obterTempo();
    const desde = ultimoEnviadoRef.current;
    if (desde != null && agora > desde + 1) aoTrecho?.(desde, agora);
    ultimoEnviadoRef.current = agora;
  }, [obterTempo, aoTrecho]);

  // Uma vez por segundo: atualiza a tela e desfaz qualquer salto pra frente
  useEffect(() => {
    const id = setInterval(() => {
      const t = obterTempo();
      if (t > maiorRef.current + TOLERANCIA_SALTO_S) {
        irPara(maiorRef.current);
        setPosicao(maiorRef.current);
        return;
      }
      if (tocando) {
        maiorRef.current = Math.max(maiorRef.current, t);
        setLimite(maiorRef.current);
        if (ultimoEnviadoRef.current == null || t < ultimoEnviadoRef.current - 1) ultimoEnviadoRef.current = t; // começou ou voltou
      }
      setPosicao(t);
    }, 1000);
    return () => clearInterval(id);
  }, [obterTempo, irPara, tocando]);

  // A cada 10 s tocando, manda o trecho reproduzido; ao pausar, manda o que faltou
  useEffect(() => {
    if (!tocando) {
      enviarPendente();
      return undefined;
    }
    const id = setInterval(enviarPendente, INTERVALO_ENVIO_MS);
    return () => clearInterval(id);
  }, [tocando, enviarPendente]);

  const voltar10 = () => {
    const alvo = Math.max(0, obterTempo() - 10);
    enviarPendente();
    irPara(alvo);
    ultimoEnviadoRef.current = alvo;
    setPosicao(alvo);
  };

  return { posicao, limite, voltar10 };
};

const Controles = ({ tocando, aoAlternar, aoVoltar, posicao, limite, duracao, desabilitado }) => (
  <div className="player-controles">
    <button type="button" className="player-btn" onClick={aoAlternar} disabled={desabilitado} aria-label={tocando ? 'Pausar' : 'Reproduzir'}>
      {tocando ? '❚❚' : '▶'}
    </button>
    <button type="button" className="player-btn secundario" onClick={aoVoltar} disabled={desabilitado || posicao < 1} aria-label="Voltar 10 segundos">
      ↺ 10 s
    </button>
    <div className="player-trilho" aria-hidden="true">
      <div className="player-trilho-assistido" style={{ width: `${Math.min(100, (limite / duracao) * 100)}%` }} />
      <div className="player-trilho-atual" style={{ width: `${Math.min(100, (posicao / duracao) * 100)}%` }} />
    </div>
    <span className="player-tempo">{formatarTempo(posicao)} / {formatarTempo(duracao)}</span>
  </div>
);

export const ESTILOS_PLAYER = `
  .player-caixa { border-radius: 16px; overflow: hidden; background: #000; border: 1px solid rgb(var(--accent-rgb) / 0.2); }
  .player-video { position: relative; aspect-ratio: 16 / 9; background: #000; }
  .player-video iframe, .player-video > div { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .player-controles { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgb(var(--tinta-rgb) / 0.04); }
  .player-btn { min-width: 40px; height: 36px; padding: 0 12px; border-radius: 10px; border: none; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit;
    background: linear-gradient(135deg, var(--accent-strong), var(--accent-2-strong)); color: #fff; }
  .player-btn.secundario { background: rgb(var(--tinta-rgb) / 0.08); color: var(--txt-1b); }
  .player-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .player-trilho { position: relative; flex: 1; height: 6px; border-radius: 3px; background: rgb(var(--tinta-rgb) / 0.1); overflow: hidden; }
  .player-trilho-assistido { position: absolute; inset: 0 auto 0 0; background: rgb(var(--accent-rgb) / 0.35); }
  .player-trilho-atual { position: absolute; inset: 0 auto 0 0; background: var(--accent); }
  .player-tempo { font-size: 12px; color: var(--txt-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .player-aviso { font-size: 12px; color: var(--txt-4); padding: 8px 12px 10px; background: rgb(var(--tinta-rgb) / 0.02); }
  .player-demo { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    background: radial-gradient(circle at 30% 30%, rgb(var(--accent-rgb) / 0.35), #05060c 70%); color: var(--txt-1b); text-align: center; padding: 20px; }
`;

// ---------------------------------------------------------------- YouTube
let carregandoApiYouTube = null;
const carregarApiYouTube = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!carregandoApiYouTube) {
    carregandoApiYouTube = new Promise((resolve) => {
      const anterior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { anterior?.(); resolve(window.YT); };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    });
  }
  return carregandoApiYouTube;
};

export const PlayerYouTube = ({ videoId, duracao, limiteInicial, aoTrecho }) => {
  const caixaRef = useRef(null);
  const playerRef = useRef(null);
  const [tocando, setTocando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let ativo = true;
    carregarApiYouTube().then((YT) => {
      if (!ativo || !caixaRef.current) return;
      playerRef.current = new YT.Player(caixaRef.current, {
        host: 'https://www.youtube-nocookie.com', // sem cookie de rastreamento até o play
        videoId,
        playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: (e) => { if (limiteInicial) e.target.seekTo(limiteInicial, true); e.target.pauseVideo(); setPronto(true); },
          onStateChange: (e) => setTocando(e.data === YT.PlayerState.PLAYING),
          onPlaybackRateChange: (e) => { if (e.data !== 1) e.target.setPlaybackRate(1); },
        },
      });
    });
    return () => { ativo = false; playerRef.current?.destroy?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const obterTempo = useCallback(() => playerRef.current?.getCurrentTime?.() || 0, []);
  const irPara = useCallback((t) => playerRef.current?.seekTo?.(t, true), []);
  const { posicao, limite, voltar10 } = useSemAvanco({ obterTempo, irPara, tocando, limiteInicial, aoTrecho });

  return (
    <div className="player-caixa">
      <div className="player-video"><div ref={caixaRef} /></div>
      <Controles
        tocando={tocando}
        aoAlternar={() => (tocando ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo())}
        aoVoltar={voltar10}
        posicao={posicao}
        limite={limite}
        duracao={duracao}
        desabilitado={!pronto}
      />
      <div className="player-aviso">Você pode voltar pra rever qualquer parte. Avançar, só até onde já assistiu.</div>
    </div>
  );
};

// ---------------------------------------------------------------- Simulado (modo demonstração)
export const PlayerDemo = ({ titulo, duracao, limiteInicial, aoTrecho }) => {
  const tempoRef = useRef(limiteInicial || 0);
  const [tocando, setTocando] = useState(false);

  useEffect(() => {
    if (!tocando) return undefined;
    const id = setInterval(() => {
      tempoRef.current = Math.min(duracao, tempoRef.current + 0.25);
      if (tempoRef.current >= duracao) setTocando(false);
    }, 250);
    return () => clearInterval(id);
  }, [tocando, duracao]);

  const obterTempo = useCallback(() => tempoRef.current, []);
  const irPara = useCallback((t) => { tempoRef.current = t; }, []);
  const { posicao, limite, voltar10 } = useSemAvanco({ obterTempo, irPara, tocando, limiteInicial, aoTrecho });

  return (
    <div className="player-caixa">
      <div className="player-video">
        <div className="player-demo">
          <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--aviso)', fontWeight: 800 }}>Vídeo simulado · modo demonstração</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{titulo}</div>
          <div style={{ fontSize: '13px', color: 'var(--txt-3)' }}>Aqui entra o vídeo que o professor gravou (YouTube não listado).</div>
          <div style={{ fontSize: '34px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatarTempo(posicao)}</div>
        </div>
      </div>
      <Controles tocando={tocando} aoAlternar={() => setTocando((t) => !t && tempoRef.current < duracao)} aoVoltar={voltar10} posicao={posicao} limite={limite} duracao={duracao} />
      <div className="player-aviso">Você pode voltar pra rever qualquer parte. Avançar, só até onde já assistiu.</div>
    </div>
  );
};

// ---------------------------------------------------------------- Aula só de texto/áudio: tempo de estudo
export const TempoDeEstudo = ({ duracao, limiteInicial, aoTrecho }) => {
  const tempoRef = useRef(limiteInicial || 0);
  const [estudando, setEstudando] = useState(false);
  const [visivel, setVisivel] = useState(() => document.visibilityState === 'visible');

  useEffect(() => {
    const mudou = () => setVisivel(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', mudou);
    return () => document.removeEventListener('visibilitychange', mudou);
  }, []);

  const contando = estudando && visivel && tempoRef.current < duracao;
  useEffect(() => {
    if (!contando) return undefined;
    const id = setInterval(() => { tempoRef.current = Math.min(duracao, tempoRef.current + 1); }, 1000);
    return () => clearInterval(id);
  }, [contando, duracao]);

  const obterTempo = useCallback(() => tempoRef.current, []);
  const irPara = useCallback(() => {}, []);
  const { posicao } = useSemAvanco({ obterTempo, irPara, tocando: contando, limiteInicial, aoTrecho });

  return (
    <div className="player-caixa" style={{ background: 'rgb(var(--tinta-rgb) / 0.03)' }}>
      <div className="player-controles">
        <button type="button" className="player-btn" onClick={() => setEstudando((e) => !e)} disabled={posicao >= duracao}>
          {estudando ? 'Pausar estudo' : posicao > 0 ? 'Continuar estudo' : 'Começar estudo'}
        </button>
        <div className="player-trilho"><div className="player-trilho-atual" style={{ width: `${Math.min(100, (posicao / duracao) * 100)}%` }} /></div>
        <span className="player-tempo">{formatarTempo(posicao)} / {formatarTempo(duracao)}</span>
      </div>
      <div className="player-aviso">
        Leia o texto e o material de apoio abaixo. O tempo de estudo só conta com esta página aberta na tela{estudando && !visivel ? ' (pausado: a página saiu da tela)' : ''}.
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Áudio de apoio
export const PlayerAudio = ({ caminho, nome }) => {
  const audioRef = useRef(null);
  const [url, setUrl] = useState(null);
  const [tocando, setTocando] = useState(false);
  const [duracao, setDuracao] = useState(0);

  useEffect(() => {
    let ativo = true;
    let criada = null;
    urlDeArquivo(caminho).then((u) => { if (ativo) { criada = u; setUrl(u); } });
    return () => { ativo = false; if (criada) URL.revokeObjectURL(criada); };
  }, [caminho]);

  const obterTempo = useCallback(() => audioRef.current?.currentTime || 0, []);
  const irPara = useCallback((t) => { if (audioRef.current) audioRef.current.currentTime = t; }, []);
  const { posicao, limite, voltar10 } = useSemAvanco({ obterTempo, irPara, tocando, limiteInicial: 0 });

  return (
    <div className="player-caixa" style={{ background: 'rgb(var(--tinta-rgb) / 0.03)' }}>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration || 0)}
          onPlay={() => setTocando(true)}
          onPause={() => setTocando(false)}
          onRateChange={(e) => { if (e.currentTarget.playbackRate !== 1) e.currentTarget.playbackRate = 1; }}
        />
      )}
      <div style={{ padding: '10px 12px 0', fontSize: '13px', fontWeight: 700, color: 'var(--txt-1b)' }}>🎧 {nome}</div>
      <Controles
        tocando={tocando}
        aoAlternar={() => (tocando ? audioRef.current?.pause() : audioRef.current?.play())}
        aoVoltar={voltar10}
        posicao={posicao}
        limite={limite}
        duracao={duracao || 1}
        desabilitado={!url}
      />
    </div>
  );
};
