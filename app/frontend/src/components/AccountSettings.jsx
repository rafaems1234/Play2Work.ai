import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IconWarning, IconLinkedIn, IconClose, IconSparkle } from './icons';
import { apiFetch } from '../api';
import AuroraBackground from './AuroraBackground';

const AccountSettings = ({ estudante, forcado = false, aoFechar, aoAtualizarLinkedin }) => {
  const [linkedin, setLinkedin] = useState(estudante?.linkedin || '');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [erroPerfil, setErroPerfil] = useState(null);
  const [erroSenha, setErroSenha] = useState(null);
  const [sucessoPerfil, setSucessoPerfil] = useState(false);
  const [sucessoSenha, setSucessoSenha] = useState(false);

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

  const salvarSenha = async (e) => {
    e.preventDefault();
    try {
      setTrocandoSenha(true);
      setErroSenha(null);
      const response = await apiFetch('/api/auth/trocar-senha', {
        method: 'POST',
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha }),
      });
      const dados = await response.json();
      if (!response.ok) throw new Error(dados.detail || 'Não foi possível trocar a senha.');

      setSucessoSenha(true);
      if (forcado) {
        setTimeout(() => aoFechar(true), 900);
      } else {
        setSenhaAtual('');
        setNovaSenha('');
        setTimeout(() => setSucessoSenha(false), 2000);
      }
    } catch (err) {
      setErroSenha(err.message);
    } finally {
      setTrocandoSenha(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,5,12,0.75)', backdropFilter: 'blur(6px)', padding: '20px' }}>
      {forcado && <AuroraBackground />}
      <style>{`
        .account-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(167,139,250,0.2);
          border-radius: 12px;
          padding: 12px 16px;
          color: #e2e8f0;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
          box-sizing: border-box;
        }
        .account-input:focus { border-color: rgba(167,139,250,0.5); }
        .account-input::placeholder { color: #475569; }

        .account-save-btn {
          padding: 11px 18px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #7c3aed 0%, #0e7490 100%);
          color: white;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }
        .account-save-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(124,58,237,0.3); }
        .account-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(12,12,22,0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(167,139,250,0.2)',
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
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
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
            <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(167,139,250,0.1)' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Nome de login</div>
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
                  {salvandoPerfil ? '...' : sucessoPerfil ? '✓' : 'Salvar'}
                </button>
              </div>
              {erroPerfil && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>{erroPerfil}</div>}
            </form>
          </>
        )}

        <form onSubmit={salvarSenha}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {forcado ? 'Nova senha' : 'Trocar senha'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="password"
              placeholder="Senha atual"
              className="account-input"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              className="account-input"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              minLength={6}
              required
            />
            {erroSenha && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconWarning /> {erroSenha}
              </div>
            )}
            <button type="submit" disabled={trocandoSenha} className="account-save-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {trocandoSenha ? 'Salvando...' : sucessoSenha ? '✓ Senha atualizada' : (<><IconSparkle /> {forcado ? 'Confirmar e continuar' : 'Atualizar senha'}</>)}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AccountSettings;
