import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';
import TechBackground from './TechBackground';
import { IconWarning, IconEye, IconEyeSlash, IconMask, IconCheckCircle } from './icons';
import { apiFetch, salvarToken, DEMO_MODE } from '../api';
import { mascararCpf, somenteDigitos } from '../utils/formatos';

// Entrada do aluno (regras em acesso.py no backend):
// - Entrar: usuário + senha.
// - Tenho um código: primeiro acesso, ou senha nova depois que a coordenação
//   aprovou o pedido. CPF + código de 6 dígitos entregue pela escola -> mostra
//   o usuário -> o aluno cria a senha e já entra.
// - Esqueci minha senha: manda um pedido pra coordenação aprovar.

const SENHA_MINIMA = 8;

export const CampoSenha = ({ id, valor, aoMudar, placeholder, autoComplete, className = 'login-campo', autoFocus = false }) => {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        className={className}
        type={mostrar ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        autoFocus={autoFocus}
        maxLength={72}
        style={{ paddingRight: '48px' }}
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
  );
};

// Mesmas regras de acesso.validar_nova_senha, pra avisar antes de enviar
const problemaDaSenha = (senha, confirmar) => {
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (!/[a-zA-ZÀ-ÿ]/.test(senha) || !/\d/.test(senha)) return 'Misture letras e números na senha.';
  if (senha !== confirmar) return 'A confirmação não é igual à senha.';
  return null;
};

const mensagemDeErro = async (resposta, padrao) => {
  if (resposta.status === 429) {
    const dados = await resposta.json().catch(() => ({}));
    return typeof dados.detail === 'string' && dados.detail.includes('tentativas') ? dados.detail : 'Muitas tentativas. Espere um minuto e tente de novo.';
  }
  const dados = await resposta.json().catch(() => ({}));
  if (typeof dados.detail === 'string') return dados.detail;
  return padrao;
};

const Rotulo = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--txt-2)', margin: '14px 0 8px' }}>{children}</label>
);

const Dica = ({ children }) => <p style={{ fontSize: '12px', color: 'var(--txt-4)', marginTop: '8px', lineHeight: 1.5 }}>{children}</p>;

const LoginAluno = ({ aoEntrar, aoVoltar, aoAbrirAdmin }) => {
  // 'entrar' | 'codigo' | 'criar-senha' | 'esqueci' | 'pedido-enviado'
  const [modo, setModo] = useState('entrar');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [cpf, setCpf] = useState('');
  const [codigo, setCodigo] = useState('');
  const [conferido, setConferido] = useState(null); // { usuario, primeiro_nome, ja_tinha_senha }
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [aviso, setAviso] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const irPara = (novo) => {
    setModo(novo);
    setErro(null);
    setAviso(null);
    if (novo === 'codigo') { setConferido(null); setNovaSenha(''); setConfirmar(''); }
  };

  const enviar = async (fazer) => {
    try {
      setEnviando(true);
      setErro(null);
      await fazer();
    } catch (err) {
      console.error(err);
      setErro('Não foi possível conectar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const entrar = (e) => {
    e.preventDefault();
    if (!usuario.trim() || !senha) {
      setErro('Preencha o usuário e a senha.');
      return;
    }
    enviar(async () => {
      const resposta = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario: usuario.trim(), senha }) });
      if (!resposta.ok) {
        setErro(await mensagemDeErro(resposta, 'Usuário ou senha incorretos.'));
        return;
      }
      const dados = await resposta.json();
      salvarToken('aluno', dados.token);
      aoEntrar(dados.estudante);
    });
  };

  const conferirCodigo = (e) => {
    e.preventDefault();
    if (somenteDigitos(cpf).length !== 11 || somenteDigitos(codigo).length !== 6) {
      setErro('Digite os 11 números do CPF e os 6 do código.');
      return;
    }
    enviar(async () => {
      const resposta = await apiFetch('/api/auth/primeiro-acesso/conferir', {
        method: 'POST',
        body: JSON.stringify({ cpf: somenteDigitos(cpf), codigo: somenteDigitos(codigo) }),
      });
      if (!resposta.ok) {
        setErro(await mensagemDeErro(resposta, 'CPF ou código incorretos.'));
        return;
      }
      setConferido(await resposta.json());
      setModo('criar-senha');
    });
  };

  const criarSenha = (e) => {
    e.preventDefault();
    const problema = problemaDaSenha(novaSenha, confirmar);
    if (problema) {
      setErro(problema);
      return;
    }
    enviar(async () => {
      const resposta = await apiFetch('/api/auth/primeiro-acesso', {
        method: 'POST',
        body: JSON.stringify({ cpf: somenteDigitos(cpf), codigo: somenteDigitos(codigo), nova_senha: novaSenha }),
      });
      if (!resposta.ok) {
        // Código venceu/esgotou no meio do caminho: volta pro passo do código
        if (resposta.status === 401) {
          irPara('codigo');
          setErro(await mensagemDeErro(resposta, 'O código não vale mais. Peça outro à coordenação.'));
          return;
        }
        setErro(await mensagemDeErro(resposta, 'Não foi possível criar a senha.'));
        return;
      }
      const dados = await resposta.json();
      salvarToken('aluno', dados.token);
      aoEntrar(dados.estudante);
    });
  };

  const pedirSenhaNova = (e) => {
    e.preventDefault();
    if (identificador.trim().length < 3) {
      setErro('Digite o seu usuário ou o seu CPF.');
      return;
    }
    enviar(async () => {
      const resposta = await apiFetch('/api/auth/esqueci-senha', { method: 'POST', body: JSON.stringify({ identificador: identificador.trim() }) });
      if (!resposta.ok) {
        setErro(await mensagemDeErro(resposta, 'Não foi possível enviar o pedido.'));
        return;
      }
      setAviso((await resposta.json()).mensagem);
      setModo('pedido-enviado');
    });
  };

  const titulo = {
    entrar: null,
    codigo: 'Tenho um código',
    'criar-senha': conferido?.ja_tinha_senha ? 'Crie a sua senha nova' : 'Crie a sua senha',
    esqueci: 'Esqueci minha senha',
    'pedido-enviado': 'Pedido enviado',
  }[modo];

  const aoEnviar = { entrar, codigo: conferirCodigo, 'criar-senha': criarSenha, esqueci: pedirSenhaNova, 'pedido-enviado': (e) => { e.preventDefault(); irPara('codigo'); } }[modo];
  const textoBotao = {
    entrar: enviando ? 'Entrando...' : 'Entrar →',
    codigo: enviando ? 'Conferindo...' : 'Continuar →',
    'criar-senha': enviando ? 'Salvando...' : 'Criar senha e entrar →',
    esqueci: enviando ? 'Enviando...' : 'Pedir senha nova',
    'pedido-enviado': 'Já tenho o código →',
  }[modo];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative' }}>
      <style>{`
        .login-campo {
          width: 100%;
          padding: 13px 16px;
          border-radius: 14px;
          border: 1px solid rgb(var(--accent-rgb) / 0.2);
          background: rgb(var(--tinta-rgb) / 0.04);
          color: var(--txt-1);
          font-size: 16px;
          font-weight: 600;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-campo:focus {
          border-color: rgb(var(--accent-rgb) / 0.6);
          box-shadow: 0 0 0 4px rgb(var(--accent-rgb) / 0.12);
        }
        .login-campo.codigo { font-size: 22px; letter-spacing: 6px; text-align: center; font-family: var(--mono); }
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
        .login-link.destaque { color: var(--accent-soft); }
      `}</style>
      <TechBackground />

      <motion.form
        key={modo}
        onSubmit={aoEnviar}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '380px', background: 'rgb(var(--surface-rgb) / 0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgb(var(--accent-rgb) / 0.15)', borderRadius: '24px', padding: '32px 26px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: titulo ? '12px' : '10px' }}>
          <Logo size={34} />
          <span style={{ fontSize: '22px', fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontWeight: '800', color: 'var(--txt-1)' }}>
            Play2Work<span className="gradient-text-live">.ai</span>
          </span>
        </div>
        {titulo && <h1 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--txt-1)', textAlign: 'center', margin: '0 0 6px' }}>{titulo}</h1>}

        {modo === 'entrar' && (
          <>
            <Rotulo htmlFor="login-usuario">Usuário</Rotulo>
            <input id="login-usuario" className="login-campo" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="ex: maria.silva" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus maxLength={60} />
            <Rotulo htmlFor="login-senha">Senha</Rotulo>
            <CampoSenha id="login-senha" valor={senha} aoMudar={setSenha} autoComplete="current-password" placeholder="Sua senha" />
            <div style={{ textAlign: 'right', marginTop: '6px' }}>
              <button type="button" className="login-link" onClick={() => irPara('esqueci')}>Esqueci minha senha</button>
            </div>
          </>
        )}

        {modo === 'codigo' && (
          <>
            <Dica>Primeiro acesso ou senha nova aprovada: use o código de 6 números que a coordenação te entregou.</Dica>
            <Rotulo htmlFor="codigo-cpf">CPF</Rotulo>
            <input id="codigo-cpf" className="login-campo" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(mascararCpf(e.target.value))} autoFocus />
            <Rotulo htmlFor="codigo-codigo">Código da escola</Rotulo>
            <input id="codigo-codigo" className="login-campo codigo" inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" value={codigo} onChange={(e) => setCodigo(somenteDigitos(e.target.value).slice(0, 6))} />
            <Dica>Depois de 5 tentativas erradas o código deixa de valer e é preciso pedir outro.</Dica>
          </>
        )}

        {modo === 'criar-senha' && conferido && (
          <>
            <div style={{ marginTop: '10px', background: 'rgb(var(--accent-rgb) / 0.08)', border: '1px solid rgb(var(--accent-rgb) / 0.25)', borderRadius: '14px', padding: '12px 14px', fontSize: '13px', color: 'var(--txt-2)', lineHeight: 1.6 }}>
              Oi, {conferido.primeiro_nome}! Seu usuário é<br />
              <strong style={{ fontSize: '18px', color: 'var(--accent-soft)', fontFamily: 'var(--mono)' }}>{conferido.usuario}</strong><br />
              Anote: é com ele e a senha que você vai entrar daqui pra frente.
            </div>
            <Rotulo htmlFor="nova-senha">{conferido.ja_tinha_senha ? 'Senha nova' : 'Senha'}</Rotulo>
            <CampoSenha id="nova-senha" valor={novaSenha} aoMudar={setNovaSenha} autoComplete="new-password" placeholder="8 ou mais, com letras e números" autoFocus />
            <Rotulo htmlFor="confirmar-senha">Repita a senha</Rotulo>
            <CampoSenha id="confirmar-senha" valor={confirmar} aoMudar={setConfirmar} autoComplete="new-password" placeholder="A mesma senha de novo" />
            <Dica>Não use o seu CPF, a data de nascimento nem o seu usuário. Não conte a senha pra ninguém.</Dica>
          </>
        )}

        {modo === 'esqueci' && (
          <>
            <Dica>A coordenação recebe o seu pedido. Depois de aprovar, a escola te entrega um código, e com ele você cria uma senha nova.</Dica>
            <Rotulo htmlFor="esqueci-id">Usuário ou CPF</Rotulo>
            <input id="esqueci-id" className="login-campo" autoCapitalize="none" spellCheck={false} placeholder="maria.silva ou 000.000.000-00" value={identificador} onChange={(e) => setIdentificador(e.target.value)} autoFocus maxLength={60} />
          </>
        )}

        {modo === 'pedido-enviado' && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '14px', padding: '12px 14px', fontSize: '13px', color: 'var(--txt-2)', lineHeight: 1.6 }}>
            <IconCheckCircle style={{ color: 'var(--ok)', flexShrink: 0, marginTop: '3px' }} /> {aviso}
          </div>
        )}

        {erro && (
          <div role="alert" style={{ marginTop: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '12px', color: 'var(--erro-suave)', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <IconWarning style={{ flexShrink: 0, marginTop: '2px' }} /> {erro}
          </div>
        )}

        <button type="submit" disabled={enviando} style={{ marginTop: '20px', width: '100%', padding: '15px', border: 'none', borderRadius: '14px', background: 'linear-gradient(135deg, var(--accent-strong) 0%, var(--accent-2-strong) 100%)', color: 'white', fontWeight: '800', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', opacity: enviando ? 0.6 : 1 }}>
          {textoBotao}
        </button>

        {modo === 'entrar' && (
          <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '13px', color: 'var(--txt-4)' }}>
            Primeiro acesso?{' '}
            <button type="button" className="login-link destaque" onClick={() => irPara('codigo')}>Tenho um código da escola</button>
          </div>
        )}

        {DEMO_MODE && (modo === 'entrar' || modo === 'codigo') && (
          <div style={{ marginTop: '18px', fontSize: '12px', color: 'var(--aviso)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', padding: '10px 12px', lineHeight: 1.6 }}>
            <IconMask style={{ verticalAlign: '-2px' }} /> Demonstração:{' '}
            {modo === 'entrar' ? (
              <>usuário <strong>rafael.sozza</strong>, senha <strong>play2work123</strong>{' '}
                <button type="button" className="login-link" style={{ color: 'var(--aviso)', textDecoration: 'underline', padding: 0 }} onClick={() => { setUsuario('rafael.sozza'); setSenha('play2work123'); }}>preencher</button>
              </>
            ) : (
              <>primeiro acesso da Bianca: CPF <strong>222.572.222-61</strong>, código <strong>246810</strong>{' '}
                <button type="button" className="login-link" style={{ color: 'var(--aviso)', textDecoration: 'underline', padding: 0 }} onClick={() => { setCpf('222.572.222-61'); setCodigo('246810'); }}>preencher</button>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px' }}>
          {modo === 'entrar'
            ? <button type="button" className="login-link" onClick={aoVoltar}>← Voltar</button>
            : <button type="button" className="login-link" onClick={() => irPara('entrar')}>← Entrar com usuário e senha</button>}
          {modo === 'entrar' && <button type="button" className="login-link" onClick={aoAbrirAdmin}>Sou da escola</button>}
        </div>
      </motion.form>
    </div>
  );
};

export default LoginAluno;
