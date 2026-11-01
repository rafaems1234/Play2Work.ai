"""
Acesso do aluno: usuário + senha, com primeiro acesso por CPF + código da escola.

Fluxo:
1. A escola cadastra o aluno; o sistema gera o usuário ("rafael.sozza").
2. No painel, a coordenação gera um CÓDIGO DE ACESSO de 6 dígitos (de um aluno
   ou da turma inteira) e entrega em mãos.
3. No primeiro acesso o aluno digita CPF + código, vê o usuário dele e cria a
   senha. O código morre ali. A partir daí, CPF não abre mais nada: o login é
   usuário + senha.
4. Esqueceu a senha? O aluno pede uma nova na tela de login. O pedido vai pra
   coordenação, que aprova ou recusa. Aprovar gera um código novo, entregue em
   mãos -- e só com ele (de novo CPF + código) o aluno cria a senha nova.

Por que o código e não só o CPF: CPF não é segredo (colega, matrícula,
boleto). Com CPF sozinho, quem soubesse o do colega criaria a senha dele antes
dele, ou pediria um reset no lugar dele. O código entregue pela escola é o que
prova que é o próprio aluno -- a aprovação do pedido sozinha não libera nada.
"""
import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import hash_senha, verificar_senha, normalizar_cpf
from models import Estudante, PedidoNovaSenha
from nomes import escolher_usuario

CODIGO_DIGITOS = 6
CODIGO_VALIDADE_DIAS = 7          # dá tempo de entregar pra turma inteira e o aluno usar
CODIGO_TENTATIVAS_MAX = 5         # erros com o mesmo código: no 5º o código é anulado
LOGIN_FALHAS_MAX = 5              # senhas erradas seguidas antes de travar a conta
LOGIN_BLOQUEIO_MINUTOS = 10
SENHA_TAMANHO_MINIMO = 8
SENHA_TAMANHO_MAXIMO = 72         # limite do bcrypt

STATUS_PEDIDO = {"pendente": "Aguardando aprovação", "aprovado": "Aprovado (código entregue)", "recusado": "Recusado", "concluido": "Senha nova criada"}

# Mesma resposta pra CPF que não existe, aluno sem código, código errado ou
# vencido: não dá pra descobrir pela tela se um CPF é aluno da escola.
ERRO_CODIGO = "CPF ou código incorretos, ou o código venceu. Confira com a coordenação da escola."
ERRO_LOGIN = "Usuário ou senha incorretos."
ERRO_BLOQUEIO = f"Muitas tentativas erradas. Espere {LOGIN_BLOQUEIO_MINUTOS} minutos ou peça ajuda à coordenação."


class AcessoNegado(Exception):
    """Erro com mensagem pronta pra mostrar ao aluno."""

    def __init__(self, mensagem: str, status_code: int = 401):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status_code = status_code


# ---------------------------------------------------------------- usuário

def normalizar_usuario(usuario: str) -> str:
    return (usuario or "").strip().lower()


def gerar_usuario(db: Session, nome_completo: str) -> str:
    """Usuário livre pra esse nome, conferindo os já usados com o mesmo começo."""
    rascunho = escolher_usuario(nome_completo, set())
    prefixo = rascunho.split(".")[0]
    ocupados = {u for (u,) in db.query(Estudante.usuario).filter(Estudante.usuario.like(f"{prefixo}%")).all() if u}
    return escolher_usuario(nome_completo, ocupados)


# ---------------------------------------------------------------- código de acesso

def gerar_codigo() -> str:
    return f"{secrets.randbelow(10 ** CODIGO_DIGITOS):0{CODIGO_DIGITOS}d}"


def emitir_codigo(estudante: Estudante, agora: datetime) -> tuple[str, datetime]:
    """
    Gera um código novo pro aluno (o anterior deixa de valer) e devolve o
    código em texto -- a única vez que ele existe fora do hash. Não faz commit.
    """
    codigo = gerar_codigo()
    expira = agora + timedelta(days=CODIGO_VALIDADE_DIAS)
    estudante.codigo_acesso_hash = hash_senha(codigo)
    estudante.codigo_acesso_expira_em = expira
    estudante.codigo_acesso_tentativas = 0
    return codigo, expira


def codigo_valido(estudante: Estudante, agora: datetime) -> bool:
    return bool(
        estudante.codigo_acesso_hash
        and estudante.codigo_acesso_expira_em
        and estudante.codigo_acesso_expira_em > agora
        and (estudante.codigo_acesso_tentativas or 0) < CODIGO_TENTATIVAS_MAX
    )


def status_acesso(estudante: Estudante, agora: datetime) -> str:
    """'ativo' (já tem senha), 'codigo_gerado' (tem código pra usar) ou 'sem_acesso'."""
    if codigo_valido(estudante, agora):
        return "codigo_gerado"
    return "ativo" if estudante.senha_hash else "sem_acesso"


def conferir_codigo(db: Session, cpf_digitado: str, codigo: str, agora: datetime) -> Estudante:
    """
    Confere CPF + código. Cada erro conta no código daquele aluno e, no
    limite, anula o código (a escola gera outro). Faz commit da tentativa
    errada pra ela contar mesmo se a requisição parar ali.
    """
    cpf = normalizar_cpf(cpf_digitado or "")
    codigo = "".join(ch for ch in (codigo or "") if ch.isdigit())
    estudante = db.query(Estudante).filter(Estudante.cpf == cpf).first() if len(cpf) == 11 else None
    if not estudante or not codigo_valido(estudante, agora):
        raise AcessoNegado(ERRO_CODIGO)
    if len(codigo) != CODIGO_DIGITOS or not verificar_senha(codigo, estudante.codigo_acesso_hash):
        estudante.codigo_acesso_tentativas = (estudante.codigo_acesso_tentativas or 0) + 1
        db.commit()
        raise AcessoNegado(ERRO_CODIGO)
    return estudante


# ---------------------------------------------------------------- senha

def validar_nova_senha(senha: str, estudante: Estudante) -> None:
    """Regras simples, pensadas pra adolescente no celular -- e sem senha óbvia."""
    if len(senha) < SENHA_TAMANHO_MINIMO:
        raise AcessoNegado(f"A senha precisa ter pelo menos {SENHA_TAMANHO_MINIMO} caracteres.", 422)
    if len(senha.encode("utf-8")) > SENHA_TAMANHO_MAXIMO:
        raise AcessoNegado("Essa senha é longa demais. Use até 72 caracteres.", 422)
    if not any(ch.isalpha() for ch in senha) or not any(ch.isdigit() for ch in senha):
        raise AcessoNegado("Misture letras e números na senha.", 422)
    so_digitos = "".join(ch for ch in senha if ch.isdigit())
    if estudante.cpf and (estudante.cpf in so_digitos or (len(so_digitos) >= 6 and so_digitos in estudante.cpf)):
        raise AcessoNegado("A senha não pode ser o seu CPF nem um pedaço dele.", 422)
    if estudante.usuario and estudante.usuario.replace(".", "") in senha.lower().replace(".", ""):
        raise AcessoNegado("A senha não pode conter o seu usuário.", 422)


def definir_senha(db: Session, estudante: Estudante, nova_senha: str, agora: datetime) -> None:
    """
    Grava a senha nova (primeiro acesso, troca com a senha atual ou código
    de um pedido aprovado). Anula o código, destrava a conta, derruba as
    sessões abertas e fecha o pedido aprovado, se houver. Não faz commit.
    """
    validar_nova_senha(nova_senha, estudante)
    estudante.senha_hash = hash_senha(nova_senha)
    estudante.senha_definida_em = agora
    estudante.codigo_acesso_hash = None
    estudante.codigo_acesso_expira_em = None
    estudante.codigo_acesso_tentativas = 0
    estudante.login_falhas = 0
    estudante.login_bloqueado_ate = None
    estudante.sessao_versao = (estudante.sessao_versao or 0) + 1
    for pedido in db.query(PedidoNovaSenha).filter(
        PedidoNovaSenha.estudante_id == estudante.id, PedidoNovaSenha.status == "aprovado",
    ).all():
        pedido.status = "concluido"
        pedido.concluido_em = agora


def autenticar(db: Session, usuario_digitado: str, senha: str, agora: datetime) -> Estudante:
    """
    Login por usuário + senha, com trava por conta: no laboratório da escola
    todo mundo sai pelo mesmo IP, então o limite por IP precisa ser folgado
    -- quem segura o chute na senha de um colega é a trava da conta dele.
    """
    usuario = normalizar_usuario(usuario_digitado)
    estudante = db.query(Estudante).filter(Estudante.usuario == usuario).first() if usuario else None
    if not estudante or not estudante.senha_hash:
        raise AcessoNegado(ERRO_LOGIN)
    if estudante.login_bloqueado_ate and estudante.login_bloqueado_ate > agora:
        raise AcessoNegado(ERRO_BLOQUEIO, 429)
    if not verificar_senha(senha or "", estudante.senha_hash):
        estudante.login_falhas = (estudante.login_falhas or 0) + 1
        if estudante.login_falhas >= LOGIN_FALHAS_MAX:
            estudante.login_falhas = 0
            estudante.login_bloqueado_ate = agora + timedelta(minutes=LOGIN_BLOQUEIO_MINUTOS)
        db.commit()
        raise AcessoNegado(ERRO_LOGIN)
    estudante.login_falhas = 0
    estudante.login_bloqueado_ate = None
    return estudante


# ---------------------------------------------------------------- pedido de senha nova

def buscar_por_usuario_ou_cpf(db: Session, identificador: str) -> Optional[Estudante]:
    """Usuário tem letra; CPF é só número (com ou sem pontuação)."""
    texto = (identificador or "").strip()
    if any(ch.isalpha() for ch in texto):
        return db.query(Estudante).filter(Estudante.usuario == normalizar_usuario(texto)).first()
    cpf = normalizar_cpf(texto)
    return db.query(Estudante).filter(Estudante.cpf == cpf).first() if len(cpf) == 11 else None


def registrar_pedido(db: Session, identificador: str) -> None:
    """
    Cria o pedido de senha nova (um pendente por aluno; repetir não duplica).
    Não diz se o usuário/CPF existe: a resposta da rota é sempre a mesma.
    """
    estudante = buscar_por_usuario_ou_cpf(db, identificador)
    if not estudante:
        return
    ja_pendente = db.query(PedidoNovaSenha).filter(
        PedidoNovaSenha.estudante_id == estudante.id, PedidoNovaSenha.status == "pendente",
    ).first()
    if ja_pendente:
        return
    db.add(PedidoNovaSenha(estudante_id=estudante.id, status="pendente"))
    db.commit()


def contar_pedidos_pendentes(db: Session) -> int:
    return db.query(func.count(PedidoNovaSenha.id)).filter(PedidoNovaSenha.status == "pendente").scalar() or 0
