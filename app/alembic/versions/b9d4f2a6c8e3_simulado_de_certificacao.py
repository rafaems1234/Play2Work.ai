"""simulado de certificacao

Revision ID: b9d4f2a6c8e3
Revises: a7c3e1f9d2b4
Create Date: 2026-10-31 00:00:00.000000

Tentativas do Simulado de Certificação (20 questões do banco, tentativa única
por ciclo). A aprovada é a certificação do aluno no curso; as reprovadas ficam
no histórico. Regras em certificacao.py.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9d4f2a6c8e3'
down_revision: Union[str, Sequence[str], None] = 'a7c3e1f9d2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'tentativas_certificacao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('itinerario', sa.String(length=60), nullable=False),
        sa.Column('status', sa.String(length=15), nullable=False, server_default='em_andamento'),
        sa.Column('iniciada_em', sa.DateTime(), nullable=False),
        sa.Column('expira_em', sa.DateTime(), nullable=False),
        sa.Column('concluida_em', sa.DateTime(), nullable=True),
        sa.Column('gabarito', sa.JSON(), nullable=False),
        sa.Column('respostas', sa.JSON(), nullable=False),
        sa.Column('acertos', sa.Integer(), nullable=True),
        sa.Column('total', sa.Integer(), nullable=True),
        sa.Column('percentual', sa.Integer(), nullable=True),
        sa.Column('saidas_de_tela', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tentativas_certificacao_id'), 'tentativas_certificacao', ['id'], unique=False)
    op.create_index(op.f('ix_tentativas_certificacao_estudante_id'), 'tentativas_certificacao', ['estudante_id'], unique=False)
    op.create_index(op.f('ix_tentativas_certificacao_status'), 'tentativas_certificacao', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_tentativas_certificacao_status'), table_name='tentativas_certificacao')
    op.drop_index(op.f('ix_tentativas_certificacao_estudante_id'), table_name='tentativas_certificacao')
    op.drop_index(op.f('ix_tentativas_certificacao_id'), table_name='tentativas_certificacao')
    op.drop_table('tentativas_certificacao')
