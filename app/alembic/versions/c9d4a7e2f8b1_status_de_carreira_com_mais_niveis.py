"""status de carreira com mais níveis e "Contratado" só pela escola

Recalcula o selo de status (estudantes.categoria_status) de todo mundo com os
8 níveis novos de data/status_carreira.json. O antigo último nível,
"🚀 CONTRATADO!", saía só por XP; agora "💼 Contratado" vem apenas de quem a
escola marcou como contratado no painel.

Revision ID: c9d4a7e2f8b1
Revises: b7c3e9f1a2d5
Create Date: 2026-10-30 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c9d4a7e2f8b1'
down_revision: Union[str, Sequence[str], None] = 'b7c3e9f1a2d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Fixos aqui (e não lidos do JSON) pra migração sempre fazer a mesma coisa
NIVEIS = [
    (1900, '🚀 Pronto pra Contratação'),
    (1400, '⭐ Talento em Ascensão'),
    (1000, '🎯 Destaque na Entrevista'),
    (700, '👔 Pronto para a Dinâmica'),
    (450, '📋 Currículo em Forma'),
    (250, '⚔️ Sobrevivente do RH'),
    (100, '🧭 Explorador de Carreiras'),
]
NIVEIS_ANTIGOS = [(800, '🚀 CONTRATADO!'), (400, '👔 Pronto para a Dinâmica'), (150, '⚔️ Sobrevivente do RH')]


def _recalcular(niveis, contratado=None) -> None:
    casos = " ".join(f"WHEN COALESCE(xp_total, 0) >= {xp} THEN '{nome}'" for xp, nome in niveis)
    if contratado:
        casos = f"WHEN status_contratacao = 'contratado' THEN '{contratado}' " + casos
    op.execute(f"UPDATE estudantes SET categoria_status = CASE {casos} ELSE '🌌 Na Jornada' END")


def upgrade() -> None:
    """Upgrade schema."""
    _recalcular(NIVEIS, contratado='💼 Contratado')


def downgrade() -> None:
    """Downgrade schema."""
    _recalcular(NIVEIS_ANTIGOS)
