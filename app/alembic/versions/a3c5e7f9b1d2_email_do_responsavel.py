"""e-mail do responsável

Revision ID: a3c5e7f9b1d2
Revises: f2b8d4a6c1e3
Create Date: 2026-11-01 00:00:00.000000

A escola passa a guardar o e-mail do responsável, clicável na ficha do aluno.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c5e7f9b1d2'
down_revision: Union[str, Sequence[str], None] = 'f2b8d4a6c1e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('estudantes', sa.Column('responsavel_email', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('estudantes', 'responsavel_email')
