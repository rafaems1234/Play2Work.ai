"""
Consumo e teto de gasto da IA (Gemini), somados no próprio backend.

O alerta de orçamento do Google avisa, mas não corta: quem para de chamar a
IA quando o mês estoura é este módulo. Cada chamada soma os tokens que a API
informa (usage_metadata) na tabela 'uso_ia', por mês e modelo, e o custo é
estimado pelos preços do .env:

  GEMINI_TETO_MENSAL_USD                   teto do mês, somando todas as escolas
  GEMINI_PRECO_ENTRADA_USD_POR_MILHAO      preço de 1 milhão de tokens de entrada
  GEMINI_PRECO_SAIDA_USD_POR_MILHAO        preço de 1 milhão de tokens de saída

Sem teto definido, não há corte (desenvolvimento). Com teto mas sem os dois
preços, a IA fica DESLIGADA: sem preço não dá pra saber quanto já se gastou,
e o erro tem de aparecer antes da conta, não depois. Os preços mudam: confira
na página de preços do Gemini antes de preencher.

Batido o teto, entrevista e currículo caem nas regras de reserva (que já
existiam pra quando a IA cai) até virar o mês.

Ver o consumo do mês:  python uso_ia.py
"""
import logging
import os

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert

from fuso import agora_utc, mes_atual

logger = logging.getLogger(__name__)

_avisou_sem_preco = False


class TetoIaAtingido(Exception):
    """O gasto do mês chegou ao teto: a chamada nem sai."""


def _numero_env(nome: str):
    valor = (os.environ.get(nome) or "").strip().replace(",", ".")
    if not valor:
        return None
    try:
        return float(valor)
    except ValueError:
        logger.error("%s não é um número: %r", nome, valor)
        return None


def precos() -> tuple:
    return _numero_env("GEMINI_PRECO_ENTRADA_USD_POR_MILHAO"), _numero_env("GEMINI_PRECO_SAIDA_USD_POR_MILHAO")


def custo_estimado(tokens_entrada: int, tokens_saida: int) -> float:
    entrada, saida = precos()
    return (tokens_entrada / 1_000_000) * (entrada or 0) + (tokens_saida / 1_000_000) * (saida or 0)


def gasto_do_mes(db) -> float:
    from models import UsoIa
    return float(db.query(func.coalesce(func.sum(UsoIa.custo_usd), 0)).filter(UsoIa.mes == mes_atual()).scalar() or 0)


def teto_atingido() -> bool:
    """True quando a IA não deve ser chamada (teto batido, ou teto sem preço)."""
    global _avisou_sem_preco
    teto = _numero_env("GEMINI_TETO_MENSAL_USD")
    if teto is None:
        return False
    if None in precos():
        if not _avisou_sem_preco:
            logger.error("GEMINI_TETO_MENSAL_USD definido sem os preços por milhão de tokens: IA desligada até preencher o .env.")
            _avisou_sem_preco = True
        return True
    from database import SessionLocal
    db = SessionLocal()
    try:
        return gasto_do_mes(db) >= teto
    finally:
        db.close()


def _tokens(uso) -> tuple[int, int]:
    """(entrada, saída) do usage_metadata. Raciocínio ('thoughts') é cobrado como saída."""
    if uso is None:
        return 0, 0
    entrada = getattr(uso, "prompt_token_count", None) or 0
    saida = (getattr(uso, "candidates_token_count", None) or 0) + (getattr(uso, "thoughts_token_count", None) or 0)
    return int(entrada), int(saida)


def registrar(modelo: str, uso) -> None:
    """
    Soma uma chamada no mês, numa conexão própria e num UPSERT atômico (duas
    chamadas ao mesmo tempo não se atropelam). Falhar aqui não derruba a
    resposta do aluno: só fica no log.
    """
    entrada, saida = _tokens(uso)
    custo = custo_estimado(entrada, saida)
    try:
        from database import SessionLocal
        from models import UsoIa
        db = SessionLocal()
        try:
            comando = insert(UsoIa).values(
                mes=mes_atual(), modelo=modelo, chamadas=1, tokens_entrada=entrada,
                tokens_saida=saida, custo_usd=custo, atualizado_em=agora_utc(),
            )
            db.execute(comando.on_conflict_do_update(
                constraint="uq_uso_ia_mes_modelo",
                set_={
                    "chamadas": UsoIa.chamadas + 1,
                    "tokens_entrada": UsoIa.tokens_entrada + entrada,
                    "tokens_saida": UsoIa.tokens_saida + saida,
                    "custo_usd": UsoIa.custo_usd + custo,
                    "atualizado_em": agora_utc(),
                },
            ))
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.error("Não consegui registrar o uso da IA (%s, %s+%s tokens): %s", modelo, entrada, saida, e)


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    from database import SessionLocal
    from models import UsoIa
    db = SessionLocal()
    try:
        linhas = db.query(UsoIa).filter(UsoIa.mes == mes_atual()).order_by(UsoIa.modelo).all()
        print(f"Uso da IA em {mes_atual():%m/%Y}:")
        for l in linhas:
            print(f"  {l.modelo}: {l.chamadas} chamadas, {l.tokens_entrada} tokens de entrada, {l.tokens_saida} de saída, ~US$ {l.custo_usd:.2f}")
        teto = _numero_env("GEMINI_TETO_MENSAL_USD")
        print(f"Total: ~US$ {gasto_do_mes(db):.2f}" + (f" de US$ {teto:.2f} (teto)" if teto is not None else " (sem teto definido)"))
    finally:
        db.close()
