"""versao do cadastro do aluno (conflito de edição)

Revision ID: f2b8d4a6c1e3
Revises: e6a1c3f5b7d9
Create Date: 2026-10-31 00:00:00.000000

Cada alteração do cadastro do aluno soma 1 em versao_cadastro e guarda quem
alterou e quando. Quem salvar a ficha com uma versão velha (outra pessoa
salvou no meio-tempo) recebe 409 em vez de sobrescrever.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2b8d4a6c1e3'
down_revision: Union[str, Sequence[str], None] = 'e6a1c3f5b7d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('estudantes', sa.Column('versao_cadastro', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('estudantes', sa.Column('cadastro_alterado_por', sa.String(length=100), nullable=True))
    op.add_column('estudantes', sa.Column('cadastro_alterado_em', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('estudantes', 'cadastro_alterado_em')
    op.drop_column('estudantes', 'cadastro_alterado_por')
    op.drop_column('estudantes', 'versao_cadastro')
