"""verificação em duas etapas das contas da gestão

Revision ID: c5e7a9b1d3f6
Revises: b4d6f8a0c2e4
Create Date: 2026-11-01 00:00:00.000000

Segredo TOTP, quando foi ativada e o último código usado (anti-reuso).
As contas que já existem ficam sem: no próximo login, o painel pede pra ativar.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5e7a9b1d3f6'
down_revision: Union[str, Sequence[str], None] = 'b4d6f8a0c2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('usuarios_gestao', sa.Column('totp_segredo', sa.String(length=64), nullable=True))
    op.add_column('usuarios_gestao', sa.Column('totp_ativado_em', sa.DateTime(), nullable=True))
    op.add_column('usuarios_gestao', sa.Column('totp_ultimo_passo', sa.BigInteger(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('usuarios_gestao', 'totp_ultimo_passo')
    op.drop_column('usuarios_gestao', 'totp_ativado_em')
    op.drop_column('usuarios_gestao', 'totp_segredo')
