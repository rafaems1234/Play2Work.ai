import React, { useCallback, useEffect, useState } from 'react';
import { IconWarning, IconLock, IconUser } from './icons';
import { apiFetch, lerErro } from '../api';
import { dataHoraIsoParaBr } from '../utils/formatos';

// Aba Equipe (só o perfil Administrador): o "admin do admin" cria as contas
// da gestão, escolhe o perfil de cada uma, desativa e gera senha temporária.
// Regras no servidor: gestao_routes.py e auth.PERFIS_GESTAO.

export const DESCRICAO_PERFIS = {
  administrador: 'Tudo: altera, vê a auditoria e cria/gerencia as contas da equipe.',
  auditor: 'Vê o painel inteiro e a auditoria (quem fez o quê), mas não altera nada.',
  alterar: 'Vê e altera o dia a dia (alunos, turmas, vagas, trilha, chat). Não vê a auditoria.',
  visualizar: 'Só vê. Não altera nada nem vê a auditoria.',
};
const PERFIS = ['administrador', 'auditor', 'alterar', 'visualizar'];
const ROTULO = { administrador: 'Administrador', auditor: 'Auditor', alterar: 'Alterar', visualizar: 'Visualizar' };
const COR = { administrador: 'azul', auditor: 'amarelo', alterar: 'verde', visualizar: '' };

const SenhaGerada = ({ dados, aoFechar }) => (
  <div className="adm-card" style={{ borderColor: 'rgb(var(--accent-rgb) / 0.5)', marginBottom: '14px' }}>
    <div style={{ fontWeight: 800, color: 'var(--adm-forte)', marginBottom: '6px' }}><IconLock style={{ verticalAlign: '-2px' }} /> Senha temporária de {dados.nome}</div>
    <div style={{ fontSize: '13px', color: 'var(--adm-texto)' }}>
      Usuário <strong className="mono">{dados.usuario}</strong> · senha <strong className="mono" style={{ fontSize: '16px', letterSpacing: '1px' }}>{dados.senha}</strong>
    </div>
    <div className="adm-aviso" style={{ marginTop: '8px' }}>
      <IconWarning /> Entregue pessoalmente. A senha não aparece de novo, e no primeiro acesso a pessoa é obrigada a trocar.
    </div>
    <button type="button" className="adm-btn secundario pequeno" style={{ marginTop: '8px' }} onClick={aoFechar}>Já entreguei</button>
  </div>
);

const AbaEquipe = ({ gestor }) => {
  const [contas, setContas] = useState([]);
  const [novo, setNovo] = useState({ nome: '', usuario: '', papel: 'visualizar' });
  const [erro, setErro] = useState(null);
  const [senha, setSenha] = useState(null);

  const carregar = useCallback(async () => {
    const r = await apiFetch('/api/admin/gestao/usuarios');
    if (r.ok) setContas(await r.json());
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const chamar = async (caminho, metodo, corpo) => {
    setErro(null);
    const r = await apiFetch(caminho, { method: metodo, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });
    if (!r.ok) { setErro(await lerErro(r, 'Não foi possível salvar.')); return null; }
    const dados = await r.json();
    await carregar();
    return dados;
  };

  const criar = async (e) => {
    e.preventDefault();
    const dados = await chamar('/api/admin/gestao/usuarios', 'POST', novo);
    if (dados) {
      setSenha({ nome: dados.nome, usuario: dados.usuario, senha: dados.senha_temporaria });
      setNovo({ nome: '', usuario: '', papel: 'visualizar' });
    }
  };

  const resetar = async (c) => {
    const dados = await chamar(`/api/admin/gestao/usuarios/${c.id}/resetar-senha`, 'POST');
    if (dados) setSenha({ nome: c.nome, usuario: c.usuario, senha: dados.senha_temporaria });
  };

  return (
    <div>
      {gestor?.instalacao && (
        <div className="adm-aviso" style={{ marginBottom: '14px' }}>
          <IconWarning /> Você entrou com a senha de instalação. Crie agora a conta de um <strong>Administrador</strong>: a partir daí, a senha de instalação para de funcionar e cada pessoa entra com a própria conta.
        </div>
      )}
      {senha && <SenhaGerada dados={senha} aoFechar={() => setSenha(null)} />}
      {erro && <div className="adm-erro" style={{ marginTop: 0, marginBottom: '12px' }}><IconWarning /> {erro}</div>}

      <div className="adm-subtitulo" style={{ marginTop: 0 }}>Nova conta da gestão</div>
      <form onSubmit={criar} className="adm-card" style={{ marginBottom: '18px' }}>
        <div className="adm-filtros" style={{ marginBottom: '10px' }}>
          <input className="adm-input" placeholder="Nome completo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required minLength={3} style={{ flex: '2 1 220px' }} />
          <input className="adm-input" placeholder="usuário (ex: maria.souza)" value={novo.usuario} onChange={(e) => setNovo({ ...novo, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} required minLength={3} style={{ flex: '1 1 160px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }} role="radiogroup" aria-label="Perfil de acesso">
          {PERFIS.map((p) => (
            <label key={p} className="adm-card" style={{ cursor: 'pointer', padding: '10px 12px', borderColor: novo.papel === p ? 'rgb(var(--accent-rgb) / 0.6)' : undefined, background: novo.papel === p ? 'rgb(var(--accent-rgb) / 0.08)' : undefined }}>
              <input type="radio" name="perfil" value={p} checked={novo.papel === p} onChange={() => setNovo({ ...novo, papel: p })} style={{ marginRight: '6px' }} />
              <strong>{ROTULO[p]}</strong>
              <div style={{ fontSize: '12px', color: 'var(--adm-suave)', marginTop: '4px', lineHeight: 1.4 }}>{DESCRICAO_PERFIS[p]}</div>
            </label>
          ))}
        </div>
        <button type="submit" className="adm-btn" style={{ marginTop: '12px' }}>+ Criar conta</button>
      </form>

      <div className="adm-subtitulo">Contas ({contas.length})</div>
      <div className="adm-tabela-wrap">
        <table className="adm-tabela">
          <thead><tr><th>Pessoa</th><th>Perfil</th><th>Situação</th><th>Último acesso</th><th /></tr></thead>
          <tbody>
            {contas.map((c) => (
              <tr key={c.id} style={{ cursor: 'default', opacity: c.ativo ? 1 : 0.55 }}>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--adm-texto-forte)' }}><IconUser style={{ verticalAlign: '-2px' }} /> {c.nome}{c.id === gestor?.id && <span className="adm-chip pequeno" style={{ marginLeft: '6px' }}>você</span>}</div>
                  <div className="mono" style={{ fontSize: '11px', color: 'var(--adm-suave)' }}>{c.usuario}</div>
                </td>
                <td>
                  <select className="adm-input" value={c.papel} onChange={(e) => chamar(`/api/admin/gestao/usuarios/${c.id}`, 'PUT', { papel: e.target.value })} aria-label={`Perfil de ${c.nome}`} style={{ padding: '6px 8px' }}>
                    {PERFIS.map((p) => <option key={p} value={p}>{ROTULO[p]}</option>)}
                  </select>
                </td>
                <td>
                  <span className={`adm-chip pequeno ${c.ativo ? COR[c.papel] : ''}`}>{c.ativo ? 'Ativa' : 'Desativada'}</span>
                  {c.deve_trocar_senha && c.ativo && <div style={{ fontSize: '11px', color: '#c98a04' }}>aguardando trocar a senha temporária</div>}
                  {c.dois_fatores_ativo !== undefined && c.ativo && (
                    <div style={{ fontSize: '11px', color: c.dois_fatores_ativo ? '#059669' : '#c98a04' }}>
                      {c.dois_fatores_ativo ? 'verificação em duas etapas ativa' : 'falta ativar a verificação em duas etapas'}
                    </div>
                  )}
                </td>
                <td className="mono">{c.ultimo_acesso_em ? dataHoraIsoParaBr(c.ultimo_acesso_em) : <span className="adm-vazio">nunca</span>}</td>
                <td className="num">
                  <span style={{ display: 'inline-flex', gap: '6px' }}>
                    <button type="button" className="adm-btn secundario pequeno" onClick={() => resetar(c)}>Senha temporária</button>
                    {c.dois_fatores_ativo && c.id !== gestor?.id && (
                      <button type="button" className="adm-btn secundario pequeno" title="Celular perdido ou trocado: a pessoa ativa de novo no próximo login" onClick={() => chamar(`/api/admin/gestao/usuarios/${c.id}/resetar-2fa`, 'POST')}>Zerar verificação</button>
                    )}
                    {c.id !== gestor?.id && (
                      <button type="button" className="adm-btn secundario pequeno" onClick={() => chamar(`/api/admin/gestao/usuarios/${c.id}`, 'PUT', { ativo: !c.ativo })}>{c.ativo ? 'Desativar' : 'Reativar'}</button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {contas.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--adm-suave)', padding: '24px' }}>Nenhuma conta ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--adm-suave)', marginTop: '10px', lineHeight: 1.5 }}>
        Mudar o perfil ou desativar derruba na hora as sessões abertas daquela pessoa. Sempre precisa existir pelo menos um Administrador ativo. Contas não são apagadas, só desativadas: o histórico da auditoria continua apontando para elas.
      </p>
    </div>
  );
};

export default AbaEquipe;
