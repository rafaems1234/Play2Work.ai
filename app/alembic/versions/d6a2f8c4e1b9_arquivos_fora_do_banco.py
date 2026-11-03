"""fotos e materiais fora do banco (armazenamento externo)

Revision ID: d6a2f8c4e1b9
Revises: c5e7a9b1d3f6
Create Date: 2026-11-03 00:00:00.000000

O binário passa a ficar no armazenamento (disco dedicado ou Azure Blob, ver
armazenamento.py) e o banco guarda só a chave em 'arquivo_chave'. A coluna
'conteudo' fica opcional: as linhas antigas continuam funcionando até rodar
`python arquivos.py migrar`, que move o conteúdo e zera a coluna.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6a2f8c4e1b9'
down_revision: Union[str, Sequence[str], None] = 'c5e7a9b1d3f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABELAS = ('fotos_estudantes', 'fotos_curriculo', 'materiais_aula')


def upgrade() -> None:
    """Upgrade schema."""
    for tabela in TABELAS:
        op.add_column(tabela, sa.Column('arquivo_chave', sa.String(length=120), nullable=True))
        op.alter_column(tabela, 'conteudo', existing_type=sa.LargeBinary(), nullable=True)


def downgrade() -> None:
    """Downgrade schema. Só funciona antes de migrar os arquivos (com 'conteudo' preenchido)."""
    for tabela in TABELAS:
        op.alter_column(tabela, 'conteudo', existing_type=sa.LargeBinary(), nullable=False)
        op.drop_column(tabela, 'arquivo_chave')
