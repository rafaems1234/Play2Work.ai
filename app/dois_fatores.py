"""
Verificação em duas etapas (TOTP, RFC 6238) das contas da gestão.

O código de 6 dígitos vem de um app autenticador no celular (Google
Authenticator, Microsoft Authenticator, Authy...), que lê o QR Code uma vez.
Nada de SMS: chip clonado é golpe comum, e o laboratório não depende de sinal.

- Aceita o código do passo atual de 30 s e o vizinho (relógio do celular um
  pouco adiantado/atrasado).
- Um código usado não vale de novo (totp_ultimo_passo): quem espiar a tela
  não reaproveita o mesmo código.
- Erros contam junto com os de senha (login_falhas): 5 travam a conta.

Obrigatória pra todas as contas da gestão (todas veem dado de aluno menor);
dá pra desligar a obrigação com GESTAO_2FA_OBRIGATORIA=false no .env (só pra
desenvolvimento). Celular perdido: um Administrador zera a da pessoa no
painel; se for o único Administrador, `python resetar_2fa.py usuario`.
"""
import hmac
import os
import time
from typing import Optional

import pyotp
import segno

EMISSOR = "First2Work"
JANELA = 1  # passos de 30 s aceitos pra trás e pra frente


def obrigatoria() -> bool:
    return (os.environ.get("GESTAO_2FA_OBRIGATORIA") or "true").strip().lower() not in ("false", "0", "nao", "não")


def novo_segredo() -> str:
    return pyotp.random_base32()


def uri(segredo: str, usuario: str) -> str:
    return pyotp.TOTP(segredo).provisioning_uri(name=usuario, issuer_name=EMISSOR)


def qr_svg(conteudo: str) -> str:
    """QR Code em SVG (data URI), pra tela de ativação mostrar sem biblioteca no front."""
    return segno.make(conteudo, error="m").svg_data_uri(scale=5, border=2)


def verificar(segredo: Optional[str], codigo: str, ultimo_passo: Optional[int], agora: Optional[float] = None) -> Optional[int]:
    """
    Devolve o passo (contador de 30 s) do código, se ele for válido e ainda não
    tiver sido usado; senão None. Quem chamou grava o passo como o último usado.
    """
    codigo = "".join(c for c in (codigo or "") if c.isdigit())
    if not segredo or len(codigo) != 6:
        return None
    totp = pyotp.TOTP(segredo)
    passo_atual = int((time.time() if agora is None else agora) // totp.interval)
    for passo in range(passo_atual - JANELA, passo_atual + JANELA + 1):
        if ultimo_passo is not None and passo <= ultimo_passo:
            continue
        if hmac.compare_digest(totp.at(passo * totp.interval), codigo):
            return passo
    return None
