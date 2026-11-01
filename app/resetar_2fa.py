"""
Zera a verificação em duas etapas de uma conta da gestão, pelo servidor.

Pra quando o ÚNICO Administrador perdeu o celular (os outros casos se resolvem
no painel: Equipe -> "Zerar verificação"). A pessoa ativa de novo no próximo
login. Fica registrado na auditoria como feito pelo servidor.

    python resetar_2fa.py usuario.da.conta
"""
import sys

from database import SessionLocal
from fuso import agora_utc
from models import RegistroAuditoria, UsuarioGestao
from tenancy import todas_as_escolas


def resetar(usuario: str) -> None:
    db = SessionLocal()
    try:
        conta = todas_as_escolas(db.query(UsuarioGestao).filter(UsuarioGestao.usuario == usuario.strip().lower())).first()
        if not conta:
            sys.exit(f"Conta '{usuario}' não encontrada.")
        conta.totp_segredo = None
        conta.totp_ativado_em = None
        conta.totp_ultimo_passo = None
        conta.sessao_versao = (conta.sessao_versao or 0) + 1
        db.add(RegistroAuditoria(
            escola_id=conta.escola_id, usuario_gestao_id=None, usuario_nome="(servidor: resetar_2fa.py)", papel=None,
            acao="alterou", entidade="usuario_gestao", entidade_id=str(conta.id), metodo="CLI", caminho="resetar_2fa.py",
            status_http=200, descricao=f"Zerou a verificação em duas etapas de {conta.nome} ({conta.usuario})", criado_em=agora_utc(),
        ))
        db.commit()
        print(f"Verificação em duas etapas de {conta.nome} zerada. No próximo login, a pessoa ativa de novo.")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    resetar(sys.argv[1])
