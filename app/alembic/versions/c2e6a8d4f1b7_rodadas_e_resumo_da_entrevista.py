"""rodadas de entrevista e resumo curto do laudo

Revision ID: c2e6a8d4f1b7
Revises: b9d4f2a6c8e3
Create Date: 2026-10-31 00:00:00.000000

Rodadas de 5 entrevistas (média >= 80 = meta atingida, confirmada pela
coordenação) e a frase-resumo de cada laudo pro feed compacto da escola.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2e6a8d4f1b7'
down_revision: Union[str, Sequence[str], None] = 'b9d4f2a6c8e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'rodadas_entrevista',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('numero', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=15), nullable=False, server_default='em_andamento'),
        sa.Column('media', sa.Integer(), nullable=True),
        sa.Column('iniciada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('concluida_em', sa.DateTime(), nullable=True),
        sa.Column('confirmada_em', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('estudante_id', 'numero', name='uq_rodada_estudante_numero'),
    )
    op.create_index(op.f('ix_rodadas_entrevista_id'), 'rodadas_entrevista', ['id'], unique=False)
    op.create_index(op.f('ix_rodadas_entrevista_estudante_id'), 'rodadas_entrevista', ['estudante_id'], unique=False)

    op.add_column('sessoes_entrevista', sa.Column('resumo', sa.String(length=160), nullable=True))
    op.add_column('sessoes_entrevista', sa.Column('rodada_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_sessoes_entrevista_rodada_id'), 'sessoes_entrevista', ['rodada_id'], unique=False)
    op.create_foreign_key('fk_sessoes_entrevista_rodada_id', 'sessoes_entrevista', 'rodadas_entrevista', ['rodada_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_sessoes_entrevista_rodada_id', 'sessoes_entrevista', type_='foreignkey')
    op.drop_index(op.f('ix_sessoes_entrevista_rodada_id'), table_name='sessoes_entrevista')
    op.drop_column('sessoes_entrevista', 'rodada_id')
    op.drop_column('sessoes_entrevista', 'resumo')

    op.drop_index(op.f('ix_rodadas_entrevista_estudante_id'), table_name='rodadas_entrevista')
    op.drop_index(op.f('ix_rodadas_entrevista_id'), table_name='rodadas_entrevista')
    op.drop_table('rodadas_entrevista')
