"""mapa_de_competencias

Revision ID: b3d5f1a8c2e9
Revises: e7a2c9d41b6f
Create Date: 2026-10-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d5f1a8c2e9'
down_revision: Union[str, Sequence[str], None] = 'e7a2c9d41b6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'evidencias_competencia',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('competencia', sa.String(length=40), nullable=False),
        sa.Column('pontos', sa.Integer(), nullable=False),
        sa.Column('origem', sa.String(length=20), nullable=False),
        sa.Column('origem_id', sa.Integer(), nullable=True),
        sa.Column('criada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_evidencias_competencia_id'), 'evidencias_competencia', ['id'], unique=False)
    op.create_index(op.f('ix_evidencias_competencia_estudante_id'), 'evidencias_competencia', ['estudante_id'], unique=False)

    op.create_table(
        'mapa_competencias',
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('competencia', sa.String(length=40), nullable=False),
        sa.Column('pontuacao', sa.Float(), nullable=False),
        sa.Column('total_evidencias', sa.Integer(), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('estudante_id', 'competencia'),
    )

    op.create_table(
        'respostas_situacoes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('situacao_id', sa.String(length=40), nullable=False),
        sa.Column('opcao_index', sa.Integer(), nullable=False),
        sa.Column('criada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_respostas_situacoes_id'), 'respostas_situacoes', ['id'], unique=False)
    op.create_index(op.f('ix_respostas_situacoes_estudante_id'), 'respostas_situacoes', ['estudante_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_respostas_situacoes_estudante_id'), table_name='respostas_situacoes')
    op.drop_index(op.f('ix_respostas_situacoes_id'), table_name='respostas_situacoes')
    op.drop_table('respostas_situacoes')
    op.drop_table('mapa_competencias')
    op.drop_index(op.f('ix_evidencias_competencia_estudante_id'), table_name='evidencias_competencia')
    op.drop_index(op.f('ix_evidencias_competencia_id'), table_name='evidencias_competencia')
    op.drop_table('evidencias_competencia')
