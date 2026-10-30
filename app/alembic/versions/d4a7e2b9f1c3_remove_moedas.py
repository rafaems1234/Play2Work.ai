"""remove_moedas

Revision ID: d4a7e2b9f1c3
Revises: c8e1a4f7d2b6
Create Date: 2026-10-29 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4a7e2b9f1c3'
down_revision: Union[str, Sequence[str], None] = 'c8e1a4f7d2b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Sem moedas nem loja de vidas: as vidas só voltam com o tempo, combo e bônus
    op.drop_column('estudantes', 'moedas')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('estudantes', sa.Column('moedas', sa.Integer(), nullable=True))
