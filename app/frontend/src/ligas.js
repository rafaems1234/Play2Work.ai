// As 10 ligas semanais, da mais baixa pra mais alta. Mesma ordem de LIGAS
// em app/services.py -- o backend sobe/desce o estudante pela posição aqui.
export const LIGAS = [
  { nome: 'Bronze', cor: '#e09a5b', corEscura: '#8a4b1c' },
  { nome: 'Prata', cor: '#e5e9f0', corEscura: '#7d8799' },
  { nome: 'Ouro', cor: '#fcd34d', corEscura: '#b7791f' },
  { nome: 'Safira', cor: '#60a5fa', corEscura: '#1e3a8a' },
  { nome: 'Rubi', cor: '#fb7185', corEscura: '#9f1239' },
  { nome: 'Esmeralda', cor: '#34d399', corEscura: '#065f46' },
  { nome: 'Ametista', cor: '#c084fc', corEscura: '#581c87' },
  { nome: 'Pérola', cor: '#fdf6ec', corEscura: '#b6a58a' },
  { nome: 'Obsidiana', cor: '#a5a3c9', corEscura: '#1e1b33' },
  { nome: 'Diamante', cor: '#a5f3fc', corEscura: '#0e7490' },
];

export const buscarLiga = (nome) => LIGAS.find((l) => l.nome === nome) || LIGAS[0];
