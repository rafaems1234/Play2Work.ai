"""add_liga_to_estudantes

Revision ID: 9b1f2d4c7a3e
Revises: 80ab636f391b
Create Date: 2026-08-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b1f2d4c7a3e'
down_revision: Union[str, Sequence[str], None] = '80ab636f391b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('estudantes', sa.Column('liga', sa.String(length=20), nullable=True, server_default='Bronze'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('estudantes', 'liga')
