import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconWarning, IconSparkle, IconLinkedIn } from './icons';
import { API_BASE_URL, setToken } from '../api';
import AuroraBackground from './AuroraBackground';

const Auth = ({ aoAutenticar }) => {
  const [modo, setModo] = useState('login'); // 'login' | 'registro' | 'reset' | 'reset-resposta'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [senha, setSenha] = useState('');
  const [perguntaSeguranca, setPerguntaSeguranca] = useState('');
  const [respostaSeguranca, setRespostaSeguranca] = useState('');
  const [perguntaSegurancaExibida, setPerguntaSegurancaExibida] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [senhaTemporaria, setSenhaTemporaria] = useState(null);

  const submeter = async (e) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      // Passo 1 do reset: descobre a pergunta de segurança cadastrada pra
      // esse e-mail. Só com o e-mail (que não é segredo) não dá pra resetar
      // a senha de ninguém -- é por isso que esse passo existe.
      if (modo === 'reset') {
        const response = await fetch(`${API_BASE_URL}/api/auth/pergunta-seguranca`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const dados = await response.json();
        if (!response.ok) throw new Error(dados.detail || 'Não foi possível encontrar essa conta.');
        setPerguntaSegurancaExibida(dados.pergunta);
        setModo('reset-resposta');
        return;
      }

      // Passo 2 do reset: confirma a resposta e só então libera a senha temporária.
      if (modo === 'reset-resposta') {
        const response = await fetch(`${API_BASE_URL}/api/auth/resetar-senha`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, resposta_seguranca: respostaSeguranca }),
        });
        const dados = await response.json();
        if (!response.ok) throw new Error(dados.detail || 'Não foi possível gerar a senha temporária.');
        if (!dados.senha_temporaria) throw new Error('Não foi possível confirmar a resposta de segurança.');
        setSenhaTemporaria({ nome: dados.nome_login, senha: dados.senha_temporaria });
        return;
      }

      const rota = modo === 'login' ? '/api/auth/login' : '/api/auth/registrar';
      const corpo = modo === 'login'
        ? { nome, senha }
        : { nome, email, linkedin: linkedin || null, senha, pergunta_seguranca: perguntaSeguranca, resposta_seguranca: respostaSeguranca };

      const response = await fetch(`${API_BASE_URL}${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      const dados = await response.json();
      if (!response.ok) {
        throw new Error(dados.detail || 'Não foi possível continuar. Tente de novo.');
      }

      setToken(dados.token);
      aoAutenticar(dados.estudante, Boolean(dados.deve_trocar_senha));
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const trocarModo = (novoModo) => {
    setModo(novoModo);
    setErro(null);
    setSenhaTemporaria(null);
    setPerguntaSegurancaExibida('');
    setRespostaSeguranca('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080812', padding: '24px', position: 'relative' }}>
      <AuroraBackground />
      <style>{`
        .auth-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(167,139,250,0.2);
          border-radius: 12px;
          padding: 13px 16px;
          color: #e2e8f0;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
          box-sizing: border-box;
        }
        .auth-input:focus { border-color: rgba(167,139,250,0.5); }
        .auth-input::placeholder { color: #475569; }

        .auth-submit-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #7c3aed 0%, #0e7490 100%);
          color: white;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .auth-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(124,58,237,0.35);
        }
        .auth-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .auth-toggle-btn {
          background: none;
          border: none;
          color: #a78bfa;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
          padding: 0;
        }

        .auth-link-btn {
          background: none;
          border: none;
          color: #64748b;
          font-size: 12px;
          cursor: pointer;
          font-family: inherit;
          padding: 0;
          text-align: right;
        }
        .auth-link-btn:hover { color: #a78bfa; }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(255,255,255,0.045)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(167,139,250,0.15)',
          borderRadius: '24px',
          padding: '36px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
          <img src="/logo-icon.png" alt="Play2Work.AI" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
          <span style={{ fontSize: '20px', fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontWeight: '800', color: '#f1f5f9' }}>
            Play2Work<span className="gradient-text-live">.ai</span>
          </span>
        </div>

        {senhaTemporaria ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#f1f5f9', marginBottom: '10px' }}>Sua senha temporária</h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '18px', lineHeight: 1.6 }}>
              Anote agora — ela só aparece uma vez. Entre com ela e depois defina uma senha definitiva.
            </p>
            <div style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Login: {senhaTemporaria.nome}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#c4b5fd', fontFamily: 'monospace', letterSpacing: '2px' }}>{senhaTemporaria.senha}</div>
            </div>
            <button onClick={() => trocarModo('login')} className="auth-submit-btn">Ir para o login</button>
          </motion.div>
        ) : (
          <>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9', marginBottom: '6px' }}>
              {modo === 'login' && 'Bem-vindo de volta'}
              {modo === 'registro' && 'Crie sua conta'}
              {modo === 'reset' && 'Recuperar senha'}
              {modo === 'reset-resposta' && 'Confirme sua identidade'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
              {modo === 'login' && 'Entre com seu nome e sobrenome pra continuar sua jornada.'}
              {modo === 'registro' && 'Leva menos de um minuto — seu progresso fica salvo de verdade.'}
              {modo === 'reset' && 'Informe o e-mail do cadastro pra localizar sua pergunta de segurança.'}
              {modo === 'reset-resposta' && 'Responda a pergunta que você cadastrou pra confirmar que a conta é sua.'}
            </p>

            <form onSubmit={submeter} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <AnimatePresence mode="wait">
                {modo === 'login' || modo === 'registro' ? (
                  <motion.div key="nome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <input
                      type="text"
                      placeholder="Nome e sobrenome"
                      className="auth-input"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                    />
                  </motion.div>
                ) : modo === 'reset' ? (
                  <motion.div key="email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <input
                      type="email"
                      placeholder="Seu e-mail de cadastro"
                      className="auth-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </motion.div>
                ) : (
                  <motion.div key="pergunta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '12px', padding: '13px 16px', fontSize: '13px', color: '#c4b5fd', fontWeight: '600', marginBottom: '12px' }}>
                      {perguntaSegurancaExibida}
                    </div>
                    <input
                      type="text"
                      placeholder="Sua resposta"
                      className="auth-input"
                      value={respostaSeguranca}
                      onChange={(e) => setRespostaSeguranca(e.target.value)}
                      required
                      autoFocus
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {modo === 'registro' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px' }}
                  >
                    <input
                      type="email"
                      placeholder="Seu e-mail"
                      className="auth-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>
                        <IconLinkedIn />
                      </span>
                      <input
                        type="url"
                        placeholder="linkedin.com/in/seu-perfil (opcional)"
                        className="auth-input"
                        style={{ paddingLeft: '40px' }}
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {(modo === 'login' || modo === 'registro') && (
                <input
                  type="password"
                  placeholder="Sua senha"
                  className="auth-input"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  minLength={6}
                  required
                />
              )}

              <AnimatePresence>
                {modo === 'registro' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px' }}
                  >
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Pergunta de segurança — usada só pra confirmar que é você caso precise resetar a senha.
                    </div>
                    <input
                      type="text"
                      placeholder="Crie uma pergunta (ex: qual seu sobrenome?)"
                      className="auth-input"
                      value={perguntaSeguranca}
                      onChange={(e) => setPerguntaSeguranca(e.target.value)}
                      minLength={4}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Resposta"
                      className="auth-input"
                      value={respostaSeguranca}
                      onChange={(e) => setRespostaSeguranca(e.target.value)}
                      minLength={2}
                      required
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {modo === 'login' && (
                <button type="button" onClick={() => trocarModo('reset')} className="auth-link-btn">
                  Esqueci minha senha
                </button>
              )}

              {erro && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconWarning /> {erro}
                </div>
              )}

              <button type="submit" disabled={carregando} className="auth-submit-btn">
                {carregando ? 'Enviando...' : (
                  <>
                    {modo === 'login' && 'Entrar'}
                    {modo === 'registro' && (<><IconSparkle /> Criar conta</>)}
                    {modo === 'reset' && 'Continuar'}
                    {modo === 'reset-resposta' && 'Confirmar e gerar senha temporária'}
                  </>
                )}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#64748b' }}>
              {modo === 'reset' || modo === 'reset-resposta' ? (
                <button onClick={() => trocarModo('login')} className="auth-toggle-btn">← Voltar pro login</button>
              ) : (
                <>
                  {modo === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
                  <button onClick={() => trocarModo(modo === 'login' ? 'registro' : 'login')} className="auth-toggle-btn">
                    {modo === 'login' ? 'Criar agora' : 'Entrar'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Auth;
