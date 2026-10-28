import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IconLinkedIn, IconClose, IconCheck } from './icons';
import { apiFetch } from '../api';
import TechBackground from './TechBackground';

const AccountSettings = ({ estudante, forcado = false, aoFechar, aoAtualizarLinkedin, aoSair }) => {
  const [linkedin, setLinkedin] = useState(estudante?.linkedin || '');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState(null);
  const [sucessoPerfil, setSucessoPerfil] = useState(false);

  const salvarPerfil = async (e) => {
    e.preventDefault();
    try {
      setSalvandoPerfil(true);
      setErroPerfil(null);
      const response = await apiFetch('/api/auth/conta', {
        method: 'PUT',
        body: JSON.stringify({ linkedin: linkedin || null }),
      });
      if (!response.ok) throw new Error('Não foi possível salvar.');
      const dados = await response.json();
      if (aoAtualizarLinkedin) aoAtualizarLinkedin(dados.linkedin);
      setSucessoPerfil(true);
      setTimeout(() => setSucessoPerfil(false), 2000);
    } catch (err) {
      setErroPerfil(err.message);
    } finally {
      setSalvandoPerfil(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(var(--surface-rgb) / 0.75)', backdropFilter: 'blur(6px)', padding: '20px' }}>
      {forcado && <TechBackground />}
      <style>{`
        .account-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgb(var(--accent-rgb) / 0.2);
          border-radius: 12px;
          padding: 12px 16px;
          color: #e2e8f0;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
          box-sizing: border-box;
        }
        .account-input:focus { border-color: rgb(var(--accent-rgb) / 0.5); }
        .account-input::placeholder { color: #475569; }

        .account-save-btn {
          padding: 11px 18px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--accent-strong) 0%, var(--accent-2-strong) 100%);
          color: white;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }
        .account-save-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgb(var(--accent-strong-rgb) / 0.3); }
        .account-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgb(var(--surface-rgb) / 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgb(var(--accent-rgb) / 0.2)',
          borderRadius: '24px',
          padding: '32px',
          position: 'relative',
          zIndex: 1,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
              {forcado ? 'Última etapa' : 'Sobre a conta'}
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#f1f5f9' }}>
              {forcado ? 'Defina sua nova senha' : 'Minha conta'}
            </h2>
          </div>
          {!forcado && (
            <button onClick={() => aoFechar(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconClose />
            </button>
          )}
        </div>

        {forcado && (
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px', lineHeight: 1.6 }}>
            Você entrou com a senha temporária. Defina uma senha definitiva pra continuar.
          </p>
        )}

        {!forcado && (
          <>
            <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgb(var(--accent-rgb) / 0.1)' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Nome</div>
              <div style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: '600', marginBottom: '10px' }}>{estudante?.nome}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>E-mail</div>
              <div style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: '600' }}>{estudante?.email}</div>
            </div>

            <form onSubmit={salvarPerfil} style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LinkedIn</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>
                    <IconLinkedIn />
                  </span>
                  <input
                    type="url"
                    placeholder="linkedin.com/in/seu-perfil"
                    className="account-input"
                    style={{ paddingLeft: '38px' }}
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                  />
                </div>
                <button type="submit" disabled={salvandoPerfil} className="account-save-btn">
                  {salvandoPerfil ? '...' : sucessoPerfil ? <IconCheck /> : 'Salvar'}
                </button>
              </div>
              {erroPerfil && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>{erroPerfil}</div>}
            </form>
          </>
        )}

        <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6, marginBottom: '14px' }}>
          Sua senha é o seu CPF. Nome, e-mail, turma e itinerário são cadastrados pela escola — se algo estiver errado, fale com a coordenação.
        </p>
        <button
          type="button"
          onClick={aoSair}
          style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Sair da conta
        </button>
      </motion.div>
    </div>
  );
};

export default AccountSettings;
