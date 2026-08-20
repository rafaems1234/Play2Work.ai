"""baseline_schema

Marco zero do controle de versão do schema. As tabelas (estudantes, vagas,
historico_entrevistas, curriculos) já existiam neste ponto, criadas
manualmente via `models.Base.metadata.create_all()` em seed.py. A partir
daqui, mudanças de schema devem virar uma nova revisão do Alembic em vez de
depender do create_all (que não faz ALTER em tabelas já existentes — foi
exatamente isso que causou a coluna `semana_referencia` faltando em produção).

Revision ID: a93dc2fed850
Revises:
Create Date: 2026-08-20 01:07:15.505136

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a93dc2fed850'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
