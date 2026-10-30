import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IconSparkle, IconCheck } from './icons';
import { apiFetch } from '../api';
import { Avatar, SeletorFoto } from './FotoPerfil';
import TechBackground from './TechBackground';

// Primeiro acesso do aluno, em 3 passos: foto (opcional -- quem não tiver uma
// na hora pula, e o app fica lembrando), experiência de trabalho e currículo.
// Aparece uma vez só: no fim (ou ao pular), marca o onboarding como concluído.

const PASSOS = ['Foto', 'Experiência', 'Currículo'];

const AccentBtn = ({ children, ...props }) => (
  <button type="button" className="pa-btn" {...props}>{children}</button>
);

const PrimeiroAcesso = ({ nome, fotoVersao, aoMudarFoto, aoConcluir }) => {
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [jaTrabalhou, setJaTrabalhou] = useState(null);
  const [experiencia, setExperiencia] = useState('');

  const primeiroNome = (nome || '').trim().split(/\s+/)[0] || '';

  const enviarFoto = async (dataUrl) => {
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await apiFetch('/api/estudante/me/foto', { method: 'PUT', body: JSON.stringify({ imagem_base64: dataUrl }) });
      if (!resposta.ok) throw new Error((await resposta.json().catch(() => ({}))).detail || 'Não foi possível enviar a foto.');
      aoMudarFoto((await resposta.json()).foto_atualizada_em);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const salvarExperiencia = async () => {
    setErro(null);
    if (jaTrabalhou !== null) {
      setEnviando(true);
      const resposta = await apiFetch('/api/estudante/me/experiencia', {
        method: 'PUT',
        body: JSON.stringify({ ja_trabalhou: jaTrabalhou, experiencia_previa: jaTrabalhou ? experiencia : null }),
      });
      setEnviando(false);
      if (!resposta.ok) { setErro('Não foi possível salvar. Tente de novo.'); return; }
    }
    setPasso(2);
  };

  const concluir = async (irParaCurriculo) => {
    await apiFetch('/api/estudante/me/onboarding/concluir', { method: 'POST' }).catch(() => null);
    aoConcluir(irParaCurriculo);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '20px' }}>
      <TechBackground />
      <style>{`
        .pa-btn {
          padding: 12px 18px; border: none; border-radius: 12px;
          background: linear-gradient(135deg, var(--accent-strong) 0%, var(--accent-2-strong) 100%);
          color: white; font-weight: 700; font-size: 14px; cursor: pointer; font-family: inherit;
        }
        .pa-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pa-link { background: none; border: none; color: #64748b; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; padding: 8px; }
        .pa-link:hover { color: #cbd5e1; }
        .pa-opcao {
          flex: 1; padding: 14px; border-radius: 12px; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 700;
          background: rgba(255,255,255,0.04); border: 1px solid rgb(var(--accent-rgb) / 0.2); color: #cbd5e1;
        }
        .pa-opcao.ativa { border-color: var(--accent); background: rgb(var(--accent-rgb) / 0.14); color: #f1f5f9; }
        .pa-texto {
          width: 100%; box-sizing: border-box; min-height: 96px; resize: vertical; margin-top: 12px;
          background: rgba(0,0,0,0.3); border: 1px solid rgb(var(--accent-rgb) / 0.2); border-radius: 12px;
          padding: 12px 14px; color: #e2e8f0; font-size: 14px; font-family: inherit; outline: none;
        }
        .pa-texto:focus { border-color: rgb(var(--accent-rgb) / 0.5); }
      `}</style>

      <motion.div
        key={passo}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1,
          background: 'rgb(var(--surface-rgb) / 0.96)', border: '1px solid rgb(var(--accent-rgb) / 0.2)',
          borderRadius: '24px', padding: '30px 26px', maxHeight: '92vh', overflowY: 'auto',
        }}
        role="dialog"
        aria-label="Primeiro acesso"
      >
        <div style={{ display: 'flex', gap: '6px', marginBottom: '22px' }} aria-label={`Passo ${passo + 1} de ${PASSOS.length}`}>
          {PASSOS.map((p, i) => (
            <div key={p} style={{ flex: 1 }}>
              <div style={{ height: '4px', borderRadius: '99px', background: i <= passo ? 'var(--accent)' : 'rgba(255,255,255,0.08)' }} />
              <div style={{ fontSize: '11px', marginTop: '6px', color: i === passo ? 'var(--accent-soft)' : '#475569', fontWeight: 700 }}>{p}</div>
            </div>
          ))}
        </div>

        {passo === 0 && (
          <>
            <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#f1f5f9', marginBottom: '8px' }}>
              Bem-vindo{primeiroNome ? `, ${primeiroNome}` : ''}! Vamos montar seu perfil
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, marginBottom: '22px' }}>
              Uma foto ajuda a coordenação a te reconhecer na hora de te indicar pra uma vaga. Só a escola vê, ela não aparece no ranking.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '22px' }}>
              <Avatar caminho="/api/estudante/me/foto" versao={fotoVersao} nome={nome} tamanho={84} />
              <SeletorFoto className="pa-btn" rotulo={enviando ? 'Enviando...' : fotoVersao ? 'Trocar foto' : 'Escolher foto'} disabled={enviando} aoEscolher={enviarFoto} aoErro={setErro} />
            </div>
            {erro && <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{erro}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {fotoVersao ? <span /> : (
                <button type="button" className="pa-link" onClick={() => { setErro(null); setPasso(1); }}>Pular por agora</button>
              )}
              <AccentBtn onClick={() => { setErro(null); setPasso(1); }}>Continuar →</AccentBtn>
            </div>
            {!fotoVersao && <p style={{ fontSize: '12px', color: '#475569', marginTop: '10px' }}>Dá pra adicionar depois em "Minha conta".</p>}
          </>
        )}

        {passo === 1 && (
          <>
            <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#f1f5f9', marginBottom: '8px' }}>Você já trabalhou?</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, marginBottom: '18px' }}>
              Vale bico, ajudar no negócio da família, estágio ou Jovem Aprendiz. Não ter trabalhado também é normal: a plataforma existe pra isso.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className={`pa-opcao ${jaTrabalhou === true ? 'ativa' : ''}`} onClick={() => setJaTrabalhou(true)} aria-pressed={jaTrabalhou === true}>Sim, já trabalhei</button>
              <button type="button" className={`pa-opcao ${jaTrabalhou === false ? 'ativa' : ''}`} onClick={() => setJaTrabalhou(false)} aria-pressed={jaTrabalhou === false}>Ainda não</button>
            </div>
            {jaTrabalhou && (
              <textarea
                className="pa-texto"
                placeholder="Ex: Ajudei na loja do meu tio por 6 meses, atendendo clientes e organizando o estoque."
                value={experiencia}
                onChange={(e) => setExperiencia(e.target.value)}
                maxLength={2000}
                aria-label="Conte onde e o que você fez"
              />
            )}
            {erro && <div style={{ color: '#f87171', fontSize: '13px', marginTop: '12px' }}>{erro}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '22px' }}>
              <button type="button" className="pa-link" onClick={() => setPasso(0)}>← Voltar</button>
              <AccentBtn onClick={salvarExperiencia} disabled={enviando}>{enviando ? 'Salvando...' : 'Continuar →'}</AccentBtn>
            </div>
          </>
        )}

        {passo === 2 && (
          <>
            <IconSparkle style={{ fontSize: '28px', color: 'var(--accent)', marginBottom: '10px' }} />
            <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#f1f5f9', marginBottom: '8px' }}>Agora, seu currículo</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, marginBottom: '14px' }}>
              Conte do seu jeito o que você sabe fazer e a IA monta um currículo profissional.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.9 }}>
              <li><IconCheck style={{ color: '#34d399', verticalAlign: '-2px' }} /> A coordenação recebe automaticamente</li>
              <li><IconCheck style={{ color: '#34d399', verticalAlign: '-2px' }} /> Sempre que você gerar de novo, a escola vê a versão nova</li>
              <li><IconCheck style={{ color: '#34d399', verticalAlign: '-2px' }} /> Dá pra baixar em PDF</li>
            </ul>
            <AccentBtn onClick={() => concluir(true)} style={{ width: '100%' }}>Montar meu currículo</AccentBtn>
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button type="button" className="pa-link" onClick={() => concluir(false)}>Fazer depois</button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default PrimeiroAcesso;
