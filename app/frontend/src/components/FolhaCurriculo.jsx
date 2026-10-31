import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dataIsoParaBr, mascararTelefone } from '../utils/formatos';

// Folha A4 do currículo -- a mesma no app do aluno e na ficha do painel da
// escola, pra coordenação ver (e baixar) exatamente o que o aluno vê.

export const listar = (itens) => (Array.isArray(itens) ? itens.filter(Boolean) : []);

export const ESTILOS_FOLHA = `
  .cv-folha {
    background: #fff;
    color: #1e293b;
    border-radius: 6px;
    padding: 44px 48px;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 13.5px;
    line-height: 1.55;
    box-shadow: 0 24px 60px rgba(0,0,0,0.45);
    border-top: 6px solid var(--accent);
  }
  .cv-folha h1 {
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 30px; font-weight: 800; letter-spacing: -0.5px;
    color: #0f172a; margin: 0 0 6px;
  }
  .cv-contato { display: flex; flex-wrap: wrap; gap: 4px 18px; color: #475569; font-size: 12.5px; }
  .cv-cabecalho { padding-bottom: 18px; border-bottom: 1px solid #e2e8f0; margin-bottom: 18px; display: flex; gap: 20px; align-items: center; }
  .cv-foto { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cv-folha section { margin-bottom: 18px; break-inside: avoid; }
  .cv-folha h2 {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 11px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase;
    color: var(--accent-strong); margin: 0 0 6px;
  }
  .cv-folha p { margin: 0; color: #334155; }
  .cv-folha strong { color: #0f172a; }
  .cv-folha ul { margin: 0; padding-left: 18px; color: #334155; }
  .cv-folha li { margin-bottom: 3px; }
  .cv-colunas { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 600px) {
    .cv-folha { padding: 28px 22px; }
    .cv-colunas { grid-template-columns: 1fr; gap: 0; }
  }
`;

// Linhas do cabeçalho com o cadastro da escola (dados_do_sistema em curriculo.py) --
// a folha, o texto copiado e o PDF usam a mesma montagem
export const linhasDoCabecalho = (perfil) => ({
  pessoais: [
    perfil.idade != null && `${perfil.idade} anos`,
    perfil.data_nascimento && `Nascimento: ${dataIsoParaBr(perfil.data_nascimento)}`,
  ].filter(Boolean),
  contato: [
    perfil.email,
    perfil.telefone && mascararTelefone(perfil.telefone),
    perfil.linkedin && perfil.linkedin.replace(/^https?:\/\//, ''),
  ].filter(Boolean),
  formacao: `Ensino Médio${perfil.turma ? ` (${perfil.turma})` : ''}`,
});

// Modelo fixo: o cabeçalho e a formação vêm de 'perfil' (o cadastro que a
// escola fez); a IA só escreve objetivo, experiências e competências ('cv').
// foto: object URL da foto do aluno, só quando ele escolheu pôr a foto no currículo
export const FolhaCurriculo = ({ cv, perfil, foto = null }) => {
  const experiencias = listar(cv.experiencias);
  const { pessoais, contato, formacao } = linhasDoCabecalho(perfil);
  return (
    <div className="cv-folha permitir-copia">
      <header className="cv-cabecalho">
        {foto && <img className="cv-foto" src={foto} alt="" />}
        <div>
          <h1>{perfil.nome}</h1>
          {pessoais.length > 0 && <div className="cv-contato">{pessoais.map((l) => <span key={l}>{l}</span>)}</div>}
          {contato.length > 0 && <div className="cv-contato">{contato.map((l) => <span key={l}>{l}</span>)}</div>}
        </div>
      </header>

      <section>
        <h2>Objetivo</h2>
        <p>{cv.objetivo_profissional || cv.objetivo_professional}</p>
      </section>

      <section>
        <h2>Formação</h2>
        <p>
          <strong>{formacao}</strong>
          {perfil.itinerario && <> — Itinerário formativo em {perfil.itinerario}</>}
        </p>
      </section>

      {experiencias.length > 0 && (
        <section>
          <h2>Experiências e projetos</h2>
          <ul>
            {experiencias.map((exp) => <li key={exp}>{exp}</li>)}
          </ul>
        </section>
      )}

      <section className="cv-colunas">
        <div>
          <h2>Competências técnicas</h2>
          <ul>{listar(cv.hard_skills).map((h) => <li key={h}>{h}</li>)}</ul>
        </div>
        <div>
          <h2>Competências comportamentais</h2>
          <ul>{listar(cv.soft_skills).map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </section>

      {listar(cv.sugestao_areas_atuacao).length > 0 && (
        <section>
          <h2>Áreas de interesse</h2>
          <p>{listar(cv.sugestao_areas_atuacao).join(' · ')}</p>
        </section>
      )}
    </div>
  );
};

// PDF sem biblioteca: enquanto <Imprimir> está montado, o conteúdo dele vai
// numa cópia direto no <body> (#area-impressao), que é a única coisa que
// aparece no "Salvar como PDF". Só existe durante a impressão -- assim a ficha
// do aluno e o relatório do painel nunca saem juntos no mesmo PDF.
export const Imprimir = ({ nomeDoArquivo, paisagem = false, aoTerminar, children }) => {
  useEffect(() => {
    // O título da página vira o nome sugerido do arquivo
    const tituloOriginal = document.title;
    document.title = nomeDoArquivo;
    const terminar = () => {
      document.title = tituloOriginal;
      aoTerminar();
    };
    window.addEventListener('afterprint', terminar, { once: true });
    const quadro = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('afterprint', terminar);
      document.title = tituloOriginal;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div id="area-impressao">
      <style>{`
        #area-impressao { display: none; }
        @media print {
          @page { size: A4 ${paisagem ? 'landscape' : 'portrait'}; margin: 14mm; }
          :root, html, body { background: #fff !important; color-scheme: light; }
          body > *:not(#area-impressao) { display: none !important; }
          #area-impressao { display: block; }
          #area-impressao .cv-folha {
            box-shadow: none; border-radius: 0; padding: 0; border-top: none;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
        }
      `}</style>
      {children}
    </div>,
    document.body,
  );
};
