"""add_semana_referencia_to_estudantes

Adiciona a coluna `estudantes.semana_referencia` (Date, nullable), usada
para saber a partir de quando o `xp_semanal` do estudante está sendo
contabilizado. Essa coluna já existia em models.py mas nunca tinha sido
propagada para bancos criados antes dela ser adicionada ao modelo — o que
derrubava /api/jobs/match e /api/ranking com 500.

Revision ID: 6aa7c8effe06
Revises: a93dc2fed850
Create Date: 2026-08-20 01:07:50.828206

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6aa7c8effe06'
down_revision: Union[str, Sequence[str], None] = 'a93dc2fed850'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('estudantes', sa.Column('semana_referencia', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('estudantes', 'semana_referencia')
