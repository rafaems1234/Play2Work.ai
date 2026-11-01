import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IconLinkedIn, IconClose, IconCheck } from './icons';
import { apiFetch, lerErro, salvarToken } from '../api';
import { CampoSenha } from './LoginAluno';
import TechBackground from './TechBackground';
import { Avatar, SeletorFoto } from './FotoPerfil';
import useTravarRolagem from '../hooks/useTravarRolagem';

const AccountSettings = ({ estudante, itinerario, fotoVersao = null, aoMudarFoto, forcado = false, aoFechar, aoAtualizarLinkedin, aoSair }) => {
  useTravarRolagem();
  const [erroFoto, setErroFoto] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const enviarFoto = async (dataUrl) => {
    setErroFoto(null);
    setEnviandoFoto(true);
    try {
      const resposta = await apiFetch('/api/estudante/me/foto', { method: 'PUT', body: JSON.stringify({ imagem_base64: dataUrl }) });
      if (!resposta.ok) throw new Error((await resposta.json().catch(() => ({}))).detail || 'Não foi possível enviar a foto.');
      aoMudarFoto?.((await resposta.json()).foto_atualizada_em);
    } catch (err) {
      setErroFoto(err.message);
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFoto = async () => {
    setErroFoto(null);
    const resposta = await apiFetch('/api/estudante/me/foto', { method: 'DELETE' });
    if (resposta.ok) aoMudarFoto?.(null);
    else setErroFoto('Não foi possível remover a foto.');
  };

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

  // Troca de senha sabendo a atual. A resposta traz um token novo: esta
  // sessão continua e as outras (outro computador do laboratório) caem.
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmar: '' });
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState(null);
  const [senhaTrocada, setSenhaTrocada] = useState(false);
  const mudarSenha = (campo) => (valor) => setSenhas((s) => ({ ...s, [campo]: valor }));

  const trocarSenha = async (e) => {
    e.preventDefault();
    setErroSenha(null);
    setSenhaTrocada(false);
    if (senhas.nova !== senhas.confirmar) {
      setErroSenha('A confirmação não é igual à senha nova.');
      return;
    }
    setTrocandoSenha(true);
    try {
      const resposta = await apiFetch('/api/auth/trocar-senha', {
        method: 'POST',
        body: JSON.stringify({ senha_atual: senhas.atual, nova_senha: senhas.nova }),
      });
      if (!resposta.ok) {
        setErroSenha(await lerErro(resposta, 'Não foi possível trocar a senha.'));
        return;
      }
      salvarToken('aluno', (await resposta.json()).token);
      setSenhas({ atual: '', nova: '', confirmar: '' });
      setSenhaTrocada(true);
    } catch {
      setErroSenha('Não foi possível conectar. Tente de novo.');
    } finally {
      setTrocandoSenha(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(var(--surface-rgb) / 0.75)', backdropFilter: 'blur(6px)', padding: '20px' }}>
      {forcado && <TechBackground />}
      <style>{`
        .account-input {
          width: 100%;
          background: rgb(var(--tinta-rgb) / 0.04);
          border: 1px solid rgb(var(--accent-rgb) / 0.2);
          border-radius: 12px;
          padding: 12px 16px;
          color: var(--txt-1b);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
          box-sizing: border-box;
        }
        .account-input:focus { border-color: rgb(var(--accent-rgb) / 0.5); }
        .account-input::placeholder { color: var(--txt-5); }

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

        /* Duas colunas no computador (perfil | LinkedIn e senha) pra não precisar rolar; uma no celular */
        .conta-grade { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 18px; }
        .conta-coluna-dir { padding-left: 28px; border-left: 1px solid rgb(var(--accent-rgb) / 0.1); }
        .conta-titulo { font-size: 12px; font-weight: 700; color: var(--txt-4); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .conta-rotulo { font-size: 12px; color: var(--txt-4); margin-bottom: 2px; }
        .conta-valor { font-size: 14px; color: var(--txt-1b); font-weight: 600; margin-bottom: 10px; overflow-wrap: anywhere; }
        .conta-rodape { display: flex; align-items: center; gap: 16px; margin-top: 22px; padding-top: 18px; border-top: 1px solid rgb(var(--accent-rgb) / 0.1); }
        @media (max-width: 720px) {
          .conta-grade { grid-template-columns: 1fr; gap: 22px; }
          .conta-coluna-dir { padding-left: 0; border-left: none; padding-top: 20px; border-top: 1px solid rgb(var(--accent-rgb) / 0.1); }
          .conta-rodape { flex-direction: column; align-items: stretch; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        style={{
          width: '100%',
          maxWidth: forcado ? '420px' : '780px',
          background: 'rgb(var(--surface-rgb) / 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgb(var(--accent-rgb) / 0.2)',
          borderRadius: '24px',
          padding: '28px 32px',
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
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--txt-1)' }}>
              {forcado ? 'Defina sua nova senha' : 'Minha conta'}
            </h2>
          </div>
          {!forcado && (
            <button onClick={() => aoFechar(false)} style={{ background: 'rgb(var(--tinta-rgb) / 0.06)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--txt-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconClose />
            </button>
          )}
        </div>

        {forcado && (
          <p style={{ color: 'var(--txt-4)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.6 }}>
            Você entrou com a senha temporária. Defina uma senha definitiva pra continuar.
          </p>
        )}

        {!forcado && (
          <div className="conta-grade">
            {/* Esquerda: quem é o aluno (dados vêm da escola) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <Avatar caminho="/api/estudante/me/foto" versao={fotoVersao} nome={estudante?.nome} tamanho={60} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--txt-1)', overflowWrap: 'anywhere' }}>{estudante?.nome}</div>
                  {estudante?.usuario && (
                    <div style={{ fontSize: '13px', color: 'var(--accent-soft)', fontWeight: '700', fontFamily: 'var(--mono)', marginTop: '2px' }} title="Usuário pra entrar">{estudante.usuario}</div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                    <SeletorFoto
                      className="account-save-btn"
                      rotulo={enviandoFoto ? 'Enviando...' : fotoVersao ? 'Trocar foto' : 'Adicionar foto'}
                      disabled={enviandoFoto}
                      aoEscolher={enviarFoto}
                      aoErro={setErroFoto}
                    />
                    {fotoVersao && (
                      <button type="button" onClick={removerFoto} style={{ background: 'none', border: 'none', color: 'var(--txt-4)', fontSize: '12px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                        Remover foto
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--txt-4)', lineHeight: 1.5, margin: '0 0 16px' }}>
                Só a coordenação da escola vê sua foto. Ela não aparece no ranking.
              </p>
              {erroFoto && <div style={{ color: 'var(--erro)', fontSize: '12px', margin: '-8px 0 12px' }}>{erroFoto}</div>}

              <div className="conta-rotulo">E-mail</div>
              <div className="conta-valor">{estudante?.email}</div>
              {/* Definido pela escola no painel -- o aluno só vê */}
              <div className="conta-rotulo">Itinerário formativo</div>
              <div className="conta-valor">{itinerario || 'Ainda não definido pela escola'}</div>
              <p style={{ fontSize: '12px', color: 'var(--txt-4)', lineHeight: 1.5, margin: '4px 0 0' }}>
                Nome, e-mail, turma e itinerário são cadastrados pela escola. Se algo estiver errado, fale com a coordenação.
              </p>
            </div>

            {/* Direita: o que o aluno pode mudar */}
            <div className="conta-coluna-dir">
              <form onSubmit={salvarPerfil} style={{ marginBottom: '22px' }}>
                <div className="conta-titulo">LinkedIn</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--txt-5)' }}>
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
                {erroPerfil && <div style={{ color: 'var(--erro)', fontSize: '12px', marginTop: '8px' }}>{erroPerfil}</div>}
              </form>

              <form onSubmit={trocarSenha}>
                <div className="conta-titulo">Trocar senha</div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <CampoSenha id="conta-senha-atual" className="account-input" placeholder="Senha atual" autoComplete="current-password" valor={senhas.atual} aoMudar={mudarSenha('atual')} />
                  <CampoSenha id="conta-senha-nova" className="account-input" placeholder="Senha nova (8+ letras e números)" autoComplete="new-password" valor={senhas.nova} aoMudar={mudarSenha('nova')} />
                  <CampoSenha id="conta-senha-confirmar" className="account-input" placeholder="Repita a senha nova" autoComplete="new-password" valor={senhas.confirmar} aoMudar={mudarSenha('confirmar')} />
                </div>
                <button type="submit" disabled={trocandoSenha || !senhas.atual || !senhas.nova} className="account-save-btn" style={{ marginTop: '10px', width: '100%' }}>
                  {trocandoSenha ? 'Trocando...' : 'Trocar senha'}
                </button>
                {erroSenha && <div role="alert" style={{ color: 'var(--erro)', fontSize: '12px', marginTop: '8px' }}>{erroSenha}</div>}
                {senhaTrocada && <div style={{ color: 'var(--ok)', fontSize: '12px', marginTop: '8px' }}>Senha trocada. Se você estava logado em outro aparelho, lá vai pedir pra entrar de novo.</div>}
              </form>
            </div>
          </div>
        )}

        <div className={forcado ? undefined : 'conta-rodape'}>
          <p style={{ fontSize: '12px', color: 'var(--txt-4)', lineHeight: 1.6, margin: forcado ? '0 0 14px' : 0, flex: 1 }}>
            Esqueceu a senha? Saia e use "Esqueci minha senha" na tela de entrada.
          </p>
          <button
            type="button"
            onClick={aoSair}
            style={{ width: forcado ? '100%' : 'auto', padding: '11px 22px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--erro-suave)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            Sair da conta
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AccountSettings;
