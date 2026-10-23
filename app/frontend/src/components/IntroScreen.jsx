import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';
import TechBackground from './TechBackground';
import { useCountUp } from '../hooks/useCountUp';
import { IconBriefcase, IconRobot, IconQuiz, IconGraduationCap, IconSparkle, IconTrophy } from './icons';

// Tela de abertura (landing) — primeira coisa que aparece ao abrir o app.
// Feita pra apresentação: impacto visual logo de cara e um resumo da proposta
// antes de entrar na plataforma.

const LINHAS_TITULO = [
  { texto: 'Jogue.', destaque: false },
  { texto: 'Aprenda.', destaque: false },
  { texto: 'Seja contratado.', destaque: true },
];

const LINHAS_TERMINAL = [
  { prefixo: '>', texto: 'carregando perfil: estudante · ensino médio', cor: '#94a3b8' },
  { prefixo: '>', texto: 'itinerário: Tecnologia e Ciência de Dados', cor: '#94a3b8' },
  { prefixo: '>', texto: 'cruzando 5 habilidades com 6 vagas...', cor: '#94a3b8' },
  { prefixo: '✓', texto: 'match 100% · Jovem Aprendiz — Ciência de Dados', cor: 'var(--accent-2)' },
  { prefixo: '✓', texto: 'quiz do dia gerado pela IA · 10 perguntas', cor: 'var(--accent-2)' },
  { prefixo: '★', texto: 'nível 3 · 270 XP · ofensiva de 6 dias · Liga Prata', cor: 'var(--accent)' },
];

const NUMEROS = [
  { valor: 4, sufixo: '', rotulo: 'itinerários formativos' },
  { valor: 10, sufixo: '', rotulo: 'perguntas por dia, geradas por IA' },
  { valor: 6, sufixo: '', rotulo: 'passos até a primeira vaga' },
  { valor: 100, sufixo: '%', rotulo: 'gamificado, do quiz à vaga' },
];

const MODULOS = [
  { Icon: IconGraduationCap, titulo: 'Escolha seu itinerário', texto: 'Ciência de Dados, Robótica, Jurídico ou Natureza e Matemática: o curso que você já faz na escola vira o ponto de partida.' },
  { Icon: IconQuiz, titulo: 'Treine todo dia', texto: 'Quiz diário sobre a sua área, com vidas, dicas, combos e ofensiva. Cinco minutos por dia que viram hábito.' },
  { Icon: IconRobot, titulo: 'Simule a entrevista', texto: 'Um recrutador com IA faz as perguntas que caem de verdade, avalia cada resposta e mostra onde melhorar.' },
  { Icon: IconSparkle, titulo: 'Currículo pronto', texto: 'Conte do seu jeito o que já fez na escola, em cursos e projetos. A IA formata e você baixa o PDF na hora.' },
  { Icon: IconBriefcase, titulo: 'Match com a vaga', texto: 'O mural cruza seu perfil e seu itinerário com vagas de Jovem Aprendiz da sua área e mostra o % de aderência.' },
  { Icon: IconTrophy, titulo: 'Suba de liga', texto: '10 ligas, do Bronze ao Diamante, disputadas em grupos de 30. Toda semana os 10 primeiros sobem e os 10 últimos caem.' },
];

const Numero = ({ valor, sufixo, rotulo, atraso }) => {
  const [alvo, setAlvo] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAlvo(valor), atraso);
    return () => clearTimeout(id);
  }, [valor, atraso]);
  const exibido = useCountUp(alvo, { duration: 1.4 });
  return (
    <div className="intro-numero">
      <div className="intro-numero-valor">{exibido}{sufixo}</div>
      <div className="intro-numero-rotulo">{rotulo}</div>
    </div>
  );
};

const Terminal = () => {
  const [visiveis, setVisiveis] = useState(0);
  useEffect(() => {
    if (visiveis >= LINHAS_TERMINAL.length) return undefined;
    const id = setTimeout(() => setVisiveis((v) => v + 1), visiveis === 0 ? 900 : 650);
    return () => clearTimeout(id);
  }, [visiveis]);

  return (
    <div className="intro-terminal">
      <div className="intro-terminal-barra">
        <span style={{ background: '#ff5f57' }} />
        <span style={{ background: '#febc2e' }} />
        <span style={{ background: '#28c840' }} />
        <div className="intro-terminal-titulo">play2work · motor de IA</div>
      </div>
      <div className="intro-terminal-corpo">
        {LINHAS_TERMINAL.slice(0, visiveis).map((linha) => (
          <motion.div
            key={linha.texto}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            style={{ color: linha.cor }}
          >
            <span style={{ color: 'var(--accent)', marginRight: '10px' }}>{linha.prefixo}</span>
            {linha.texto}
          </motion.div>
        ))}
        <span className="intro-cursor">█</span>
      </div>
    </div>
  );
};

const IntroScreen = ({ aoEntrar }) => {
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === 'Enter') aoEntrar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoEntrar]);

  return (
    <div className="intro-raiz">
      <style>{`
        .intro-raiz {
          position: relative;
          min-height: 100vh;
          color: #cbd5e1;
          font-family: var(--sans);
          overflow-x: hidden;
        }
        .intro-conteudo { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 0 32px; }

        .intro-topo {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 24px 0; border-bottom: 1px solid var(--border);
        }
        .intro-marca { display: flex; align-items: center; gap: 12px; font-family: var(--heading); font-weight: 800; font-size: 20px; color: #fff; }
        .intro-topo-tag { font-family: var(--mono); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #64748b; }

        .intro-hero {
          display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
          gap: 56px; align-items: center; padding: 56px 0 56px;
        }
        .intro-titulo {
          font-family: var(--heading); font-weight: 800; text-transform: uppercase;
          font-size: clamp(40px, 6.4vw, 92px); line-height: 0.92; letter-spacing: -0.04em;
          color: #fff; margin: 22px 0 28px;
        }
        .intro-titulo-linha { display: block; overflow: hidden; padding-bottom: 0.04em; }
        .intro-titulo-linha > span { display: inline-block; }
        .intro-destaque {
          background: linear-gradient(90deg, var(--accent), var(--accent-soft) 45%, var(--accent-2));
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .intro-sub { font-size: 18px; line-height: 1.6; color: #94a3b8; max-width: 560px; }
        .intro-sub strong { color: #fff; font-weight: 700; }

        .intro-acoes { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 36px; align-items: center; }
        .intro-btn {
          position: relative; display: inline-flex; align-items: center; gap: 12px;
          font-family: var(--mono); font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
          padding: 18px 28px; border: none; cursor: pointer; color: #000; background: var(--accent);
          clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .intro-btn:hover { background: #fff; transform: translateY(-2px); }
        .intro-btn-seta { transition: transform 0.2s ease; }
        .intro-btn:hover .intro-btn-seta { transform: translateX(4px); }
        .intro-btn-sec {
          font-family: var(--mono); font-size: 13px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
          color: #e2e8f0; background: transparent; border: 1px solid rgba(255,255,255,0.18); padding: 17px 24px; cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .intro-btn-sec:hover { border-color: var(--accent); color: var(--accent); }
        .intro-dica-tecla { font-family: var(--mono); font-size: 11px; color: #475569; letter-spacing: 1px; }
        .intro-dica-tecla kbd { border: 1px solid #334155; border-radius: 4px; padding: 2px 6px; color: #94a3b8; font-family: inherit; }

        .intro-terminal {
          background: rgb(var(--surface-rgb) / 0.82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; overflow: hidden;
          box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgb(var(--accent-rgb) / 0.08), 0 0 60px rgb(var(--accent-rgb) / 0.12);
        }
        .intro-terminal-barra { display: flex; align-items: center; gap: 7px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .intro-terminal-barra > span { width: 11px; height: 11px; border-radius: 50%; }
        .intro-terminal-titulo { margin-left: 10px; font-family: var(--mono); font-size: 11px; color: #64748b; letter-spacing: 1px; }
        .intro-terminal-corpo { padding: 22px 20px 26px; font-family: var(--mono); font-size: 13px; line-height: 2; min-height: 236px; }
        .intro-cursor { color: var(--accent); animation: introPisca 1s steps(1) infinite; }
        @keyframes introPisca { 50% { opacity: 0; } }

        .intro-numeros {
          display: grid; grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
        }
        .intro-numero { padding: 30px 24px; border-right: 1px solid var(--border); }
        .intro-numero:last-child { border-right: none; }
        .intro-numero-valor { font-family: var(--heading); font-weight: 800; font-size: 54px; line-height: 1; color: #fff; letter-spacing: -0.03em; }
        .intro-numero-rotulo { margin-top: 10px; font-family: var(--mono); font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #64748b; }

        .intro-secao { padding: 88px 0 40px; }
        .intro-secao-titulo {
          font-family: var(--heading); font-weight: 800; text-transform: uppercase; color: #fff;
          font-size: clamp(32px, 4.6vw, 60px); line-height: 0.98; letter-spacing: -0.03em; margin: 16px 0 48px; max-width: 900px;
        }
        .intro-modulos { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--border); border-left: 1px solid var(--border); }
        .intro-modulo {
          position: relative; padding: 32px 28px 36px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);
          background: rgba(255,255,255,0.0); transition: background 0.25s ease;
        }
        .intro-modulo::before {
          content: ''; position: absolute; left: 0; top: 0; height: 2px; width: 0; background: var(--accent); transition: width 0.35s ease;
        }
        .intro-modulo:hover { background: rgba(255,255,255,0.025); }
        .intro-modulo:hover::before { width: 100%; }
        .intro-modulo-num { font-family: var(--mono); font-size: 12px; color: #475569; letter-spacing: 1px; }
        .intro-modulo-icone { font-size: 26px; color: var(--accent); margin: 28px 0 18px; transition: transform 0.25s ease; }
        .intro-modulo:hover .intro-modulo-icone { transform: translateY(-3px); }
        .intro-modulo h3 { font-family: var(--heading); font-size: 22px; font-weight: 700; color: #fff; margin: 0 0 10px; text-transform: uppercase; letter-spacing: -0.01em; }
        .intro-modulo p { font-size: 15px; line-height: 1.6; color: #8b95a7; }

        .intro-cta-final {
          margin: 64px 0 0; padding: 56px 0 72px; border-top: 1px solid var(--border);
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 28px;
        }
        .intro-cta-final h2 { font-size: clamp(28px, 3.6vw, 46px); text-transform: uppercase; letter-spacing: -0.03em; line-height: 1; margin: 0; }
        .intro-rodape { padding: 20px 0 32px; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; font-family: var(--mono); font-size: 11px; letter-spacing: 1px; color: #475569; text-transform: uppercase; }

        @media (max-width: 960px) {
          .intro-hero { grid-template-columns: 1fr; gap: 40px; padding: 48px 0; }
          .intro-modulos { grid-template-columns: repeat(2, 1fr); }
          .intro-numeros { grid-template-columns: repeat(2, 1fr); }
          .intro-numero:nth-child(2) { border-right: none; }
          .intro-numero:nth-child(-n+2) { border-bottom: 1px solid var(--border); }
          .intro-topo-tag { display: none; }
        }
        @media (max-width: 600px) {
          .intro-conteudo { padding: 0 16px; }
          .intro-modulos { grid-template-columns: 1fr; }
          .intro-numero { padding: 22px 16px; }
          .intro-numero-valor { font-size: 40px; }
          .intro-sub { font-size: 16px; }
          .intro-dica-tecla { display: none; }
        }
      `}</style>

      <TechBackground />

      <div className="intro-conteudo">
        <header className="intro-topo">
          <div className="intro-marca">
            <Logo size={36} />
            <span>Play2Work<span className="gradient-text-live">.ai</span></span>
          </div>
          <div className="intro-topo-tag">// Ensino Médio · Jovem Aprendiz</div>
        </header>

        <section className="intro-hero">
          <div>
            <motion.div
              className="tech-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              // O jogo da primeira vaga
            </motion.div>

            <h1 className="intro-titulo">
              {LINHAS_TITULO.map((linha, i) => (
                <span className="intro-titulo-linha" key={linha.texto}>
                  <motion.span
                    className={linha.destaque ? 'intro-destaque' : undefined}
                    initial={{ y: '105%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: 0.15 + i * 0.14, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {linha.texto}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              className="intro-sub"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              O Play2Work conecta o <strong>itinerário que você faz na escola</strong> às empresas que
              contratam <strong>Jovem Aprendiz</strong> na sua área. E pega na sua mão no caminho:
              treino diário, entrevista simulada com IA e currículo pronto em PDF.
              Feito pra quem vai ter a <strong>primeira experiência</strong>.
            </motion.p>

            <motion.div
              className="intro-acoes"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.85 }}
            >
              <button className="intro-btn" onClick={aoEntrar}>
                Começar a jornada <span className="intro-btn-seta">→</span>
              </button>
              <button
                className="intro-btn-sec"
                onClick={() => document.getElementById('intro-modulos')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Como funciona
              </button>
              <span className="intro-dica-tecla">ou aperte <kbd>Enter</kbd></span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <Terminal />
          </motion.div>
        </section>

        <motion.section
          className="intro-numeros"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
        >
          {NUMEROS.map((n, i) => (
            <Numero key={n.rotulo} {...n} atraso={1100 + i * 120} />
          ))}
        </motion.section>

        <section className="intro-secao" id="intro-modulos">
          <div className="tech-label">// Como funciona</div>
          <h2 className="intro-secao-titulo">
            Do itinerário da escola <span className="intro-destaque">à primeira vaga.</span>
          </h2>
          <div className="intro-modulos">
            {MODULOS.map(({ Icon, titulo, texto }, i) => (
              <motion.div
                className="intro-modulo"
                key={titulo}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              >
                <div className="intro-modulo-num">0{i + 1}</div>
                <div className="intro-modulo-icone"><Icon /></div>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </motion.div>
            ))}
          </div>

          <div className="intro-cta-final">
            <h2>
              Bora treinar <span className="intro-destaque">hoje?</span>
            </h2>
            <button className="intro-btn" onClick={aoEntrar}>
              Entrar na plataforma <span className="intro-btn-seta">→</span>
            </button>
          </div>
        </section>

        <footer className="intro-rodape">
          <span>Play2Work.ai © 2026</span>
          <span>Do itinerário à primeira vaga</span>
        </footer>
      </div>
    </div>
  );
};

export default IntroScreen;
