from datetime import date, datetime, timezone, timedelta
from typing import Optional

# Fuso da escola. O "dia" do aluno (ofensiva, quiz do dia, liga semanal,
# data de contratação) é o de Três Lagoas/MS, não o do servidor: na Azure o
# servidor roda em UTC, e com date.today() o dia viraria às 20h locais.
#
# O banco grava tudo em UTC (ver database.py) e o Python também (agora_utc);
# só na hora de saber "que dia é" a conversão pra cá acontece.
try:
    from zoneinfo import ZoneInfo
    FUSO_ESCOLA = ZoneInfo("America/Campo_Grande")
except Exception:  # Windows sem o pacote tzdata
    # Campo Grande está em UTC-4 o ano todo desde que o horário de verão acabou (2019)
    FUSO_ESCOLA = timezone(timedelta(hours=-4), "America/Campo_Grande")


def agora_utc() -> datetime:
    """Datetime ingênuo em UTC -- o formato das colunas DateTime do banco."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hoje() -> date:
    """Data de hoje no fuso da escola."""
    return datetime.now(FUSO_ESCOLA).date()


def data_local(momento_utc: Optional[datetime]) -> Optional[date]:
    """Dia (no fuso da escola) de um datetime ingênuo em UTC vindo do banco."""
    if momento_utc is None:
        return None
    return momento_utc.replace(tzinfo=timezone.utc).astimezone(FUSO_ESCOLA).date()


def inicio_do_dia_utc() -> datetime:
    """Meia-noite de hoje em Três Lagoas, como datetime ingênuo em UTC -- pra
    comparar com colunas do banco ("quantas atividades o aluno fez hoje")."""
    meia_noite_local = datetime.combine(hoje(), datetime.min.time(), tzinfo=FUSO_ESCOLA)
    return meia_noite_local.astimezone(timezone.utc).replace(tzinfo=None)
