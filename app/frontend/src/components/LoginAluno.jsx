import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';
import TechBackground from './TechBackground';
import { IconWarning, IconEye, IconEyeSlash, IconMask } from './icons';
import { apiFetch, salvarToken, DEMO_MODE } from '../api';
import { mascararCpf, somenteDigitos } from '../utils/formatos';

// Login do aluno: um campo só, "Senha", e a senha é o CPF que a escola
// cadastrou. Nada pra esquecer nem resetar.

const LoginAluno = ({ aoEntrar, aoVoltar, aoAbrirAdmin }) => {
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    if (somenteDigitos(senha).length !== 11) {
      setErro('A senha é o seu CPF: digite os 11 números.');
      return;
    }
    try {
      setEnviando(true);
      setErro(null);
      const resposta = await apiFetch('/api/auth/entrar', {
        method: 'POST',
        body: JSON.stringify({ cpf: somenteDigitos(senha) }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(resposta.status === 429 ? 'Muitas tentativas. Espere um minuto e tente de novo.' : dados.detail);
        return;
      }
      salvarToken('aluno', dados.token);
      aoEntrar(dados.estudante);
    } catch (err) {
      console.error(err);
      setErro('Não foi possível conectar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative' }}>
      <style>{`
        .login-campo {
          width: 100%;
          padding: 14px 52px 14px 16px;
          border-radius: 14px;
          border: 1px solid rgb(var(--accent-rgb) / 0.2);
          background: rgb(var(--tinta-rgb) / 0.04);
          color: var(--txt-1);
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 1.5px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-campo:focus {
          border-color: rgb(var(--accent-rgb) / 0.6);
          box-shadow: 0 0 0 4px rgb(var(--accent-rgb) / 0.12);
        }
        .login-link {
          background: none;
          border: none;
          color: var(--txt-4);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          padding: 4px;
        }
        .login-link:hover { color: var(--accent-soft); }
      `}</style>
      <TechBackground />

      <motion.form
        onSubmit={entrar}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '380px', background: 'rgb(var(--surface-rgb) / 0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgb(var(--accent-rgb) / 0.15)', borderRadius: '24px', padding: '32px 26px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
          <Logo size={34} />
          <span style={{ fontSize: '22px', fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontWeight: '800', color: 'var(--txt-1)' }}>
            Play2Work<span className="gradient-text-live">.ai</span>
          </span>
        </div>

        <label htmlFor="login-senha" style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--txt-2)', marginBottom: '8px' }}>Senha</label>
        <div style={{ position: 'relative' }}>
          <input
            id="login-senha"
            className="login-campo"
            type={mostrar ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="Seu CPF"
            value={senha}
            onChange={(e) => setSenha(mascararCpf(e.target.value))}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setMostrar((m) => !m)}
            aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--txt-4)', cursor: 'pointer', fontSize: '18px', padding: '6px', display: 'flex' }}
          >
            {mostrar ? <IconEyeSlash /> : <IconEye />}
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--txt-4)', marginTop: '8px' }}>A senha é o seu CPF (só os números).</p>

        {erro && (
          <div role="alert" style={{ marginTop: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '12px', color: 'var(--erro-suave)', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <IconWarning style={{ flexShrink: 0, marginTop: '2px' }} /> {erro}
          </div>
        )}

        <button type="submit" disabled={enviando} style={{ marginTop: '20px', width: '100%', padding: '15px', border: 'none', borderRadius: '14px', background: 'linear-gradient(135deg, var(--accent-strong) 0%, var(--accent-2-strong) 100%)', color: 'white', fontWeight: '800', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', opacity: enviando ? 0.6 : 1 }}>
          {enviando ? 'Entrando...' : 'Entrar →'}
        </button>

        {DEMO_MODE && (
          <div style={{ marginTop: '18px', fontSize: '12px', color: 'var(--aviso)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', padding: '10px 12px', lineHeight: 1.6 }}>
            <IconMask style={{ verticalAlign: '-2px' }} /> Demonstração: senha <strong>529.982.247-25</strong>{' '}
            <button type="button" className="login-link" style={{ color: 'var(--aviso)', textDecoration: 'underline', padding: 0 }} onClick={() => setSenha('529.982.247-25')}>
              preencher
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px' }}>
          <button type="button" className="login-link" onClick={aoVoltar}>← Voltar</button>
          <button type="button" className="login-link" onClick={aoAbrirAdmin}>Sou da escola</button>
        </div>
      </motion.form>
    </div>
  );
};

export default LoginAluno;
