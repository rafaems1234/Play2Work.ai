// Sons curtos de feedback (acerto/erro/level-up/liga), gerados por síntese via
// Web Audio API -- sem precisar de arquivos de áudio externos.

const CHAVE_SOM_ATIVADO = 'play2work_som_ativado';

let audioCtx = null;

const obterContexto = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClasse = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClasse) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClasse();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const somEstaAtivado = () => {
  try {
    return localStorage.getItem(CHAVE_SOM_ATIVADO) !== 'desativado';
  } catch {
    return true;
  }
};

export const definirSomAtivado = (ativado) => {
  try {
    localStorage.setItem(CHAVE_SOM_ATIVADO, ativado ? 'ativado' : 'desativado');
  } catch {
    // localStorage indisponível (modo privado etc.) -- só não persiste a preferência
  }
};

const tocarNota = (ctx, { frequencia, inicio, duracao, tipo = 'sine', volume = 0.2 }) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(frequencia, ctx.currentTime + inicio);
  gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + inicio + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracao);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + inicio);
  osc.stop(ctx.currentTime + inicio + duracao + 0.02);
};

const tocarSequencia = (notas) => {
  if (!somEstaAtivado()) return;
  const ctx = obterContexto();
  if (!ctx) return;
  try {
    notas.forEach((nota) => tocarNota(ctx, nota));
  } catch (err) {
    console.error(err);
  }
};

export const tocarSomAcerto = () => tocarSequencia([
  { frequencia: 880, inicio: 0, duracao: 0.12, tipo: 'sine', volume: 0.16 },
  { frequencia: 1318.5, inicio: 0.09, duracao: 0.16, tipo: 'sine', volume: 0.16 },
]);

export const tocarSomErro = () => tocarSequencia([
  { frequencia: 220, inicio: 0, duracao: 0.18, tipo: 'sawtooth', volume: 0.1 },
  { frequencia: 164.8, inicio: 0.1, duracao: 0.22, tipo: 'sawtooth', volume: 0.09 },
]);

// Combo: a nota sobe meio tom a cada acerto seguido (até um teto), igual a
// sensação de "esquentando" do Duolingo.
export const tocarSomCombo = (combo) => {
  const base = 880 * 2 ** (Math.min(combo, 10) / 12);
  tocarSequencia([
    { frequencia: base, inicio: 0, duracao: 0.1, tipo: 'sine', volume: 0.15 },
    { frequencia: base * 1.5, inicio: 0.08, duracao: 0.16, tipo: 'sine', volume: 0.15 },
  ]);
};

export const tocarSomVida = () => tocarSequencia([
  { frequencia: 783.99, inicio: 0, duracao: 0.1, tipo: 'triangle', volume: 0.16 },
  { frequencia: 1046.5, inicio: 0.08, duracao: 0.1, tipo: 'triangle', volume: 0.16 },
  { frequencia: 1567.98, inicio: 0.16, duracao: 0.25, tipo: 'triangle', volume: 0.18 },
]);

export const tocarSomFimQuiz = (precisao) => (precisao >= 70
  ? tocarSequencia([
    { frequencia: 523.25, inicio: 0, duracao: 0.1, tipo: 'triangle', volume: 0.16 },
    { frequencia: 783.99, inicio: 0.1, duracao: 0.1, tipo: 'triangle', volume: 0.16 },
    { frequencia: 1046.5, inicio: 0.2, duracao: 0.1, tipo: 'triangle', volume: 0.18 },
    { frequencia: 1318.5, inicio: 0.3, duracao: 0.35, tipo: 'triangle', volume: 0.2 },
  ])
  : tocarSequencia([
    { frequencia: 440, inicio: 0, duracao: 0.14, tipo: 'triangle', volume: 0.14 },
    { frequencia: 523.25, inicio: 0.12, duracao: 0.28, tipo: 'triangle', volume: 0.14 },
  ]));

export const tocarSomLevelUp = () => tocarSequencia([
  { frequencia: 523.25, inicio: 0, duracao: 0.12, tipo: 'triangle', volume: 0.18 },
  { frequencia: 659.25, inicio: 0.1, duracao: 0.12, tipo: 'triangle', volume: 0.18 },
  { frequencia: 783.99, inicio: 0.2, duracao: 0.12, tipo: 'triangle', volume: 0.18 },
  { frequencia: 1046.5, inicio: 0.3, duracao: 0.32, tipo: 'triangle', volume: 0.2 },
]);

export const tocarSomLiga = (subiu) => (subiu
  ? tocarSequencia([
    { frequencia: 659.25, inicio: 0, duracao: 0.15, tipo: 'triangle', volume: 0.18 },
    { frequencia: 987.77, inicio: 0.12, duracao: 0.28, tipo: 'triangle', volume: 0.2 },
  ])
  : tocarSequencia([
    { frequencia: 392, inicio: 0, duracao: 0.2, tipo: 'sine', volume: 0.14 },
    { frequencia: 293.66, inicio: 0.16, duracao: 0.26, tipo: 'sine', volume: 0.12 },
  ]));

// Mensagem nova no chat: dois toques curtos e suaves
export const tocarSomMensagem = () => tocarSequencia([
  { frequencia: 880, inicio: 0, duracao: 0.08, volume: 0.12 },
  { frequencia: 1175, inicio: 0.1, duracao: 0.12, volume: 0.12 },
]);
