"""entrevista continua com laudo final

Revision ID: a7c3e1f9d2b4
Revises: f8b2d6e4a9c1
Create Date: 2026-10-31 00:00:00.000000

O simulador deixa de dar nota por resposta: vira uma conversa contínua (5 a 7
respostas) com um laudo de desempenho no final. Cada entrevista é uma linha
de 'sessoes_entrevista', com o laudo; as mensagens apontam pra sessão. As
mensagens antigas (nota por resposta) ficam como estão, com sessao_id nulo.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c3e1f9d2b4'
down_revision: Union[str, Sequence[str], None] = 'f8b2d6e4a9c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'sessoes_entrevista',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='em_andamento'),
        sa.Column('respostas', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('iniciada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('encerrada_em', sa.DateTime(), nullable=True),
        sa.Column('laudo_em', sa.DateTime(), nullable=True),
        sa.Column('nota_geral', sa.Integer(), nullable=True),
        sa.Column('notas', sa.JSON(), nullable=True),
        sa.Column('pontos_fortes', sa.JSON(), nullable=True),
        sa.Column('pontos_melhoria', sa.JSON(), nullable=True),
        sa.Column('parecer_recrutador', sa.Text(), nullable=True),
        sa.Column('xp_concedido', sa.Integer(), nullable=True),
        sa.Column('laudo_por_ia', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_sessoes_entrevista_id'), 'sessoes_entrevista', ['id'], unique=False)
    op.create_index(op.f('ix_sessoes_entrevista_estudante_id'), 'sessoes_entrevista', ['estudante_id'], unique=False)
    op.create_index(op.f('ix_sessoes_entrevista_status'), 'sessoes_entrevista', ['status'], unique=False)

    op.add_column('historico_entrevistas', sa.Column('sessao_id', sa.Integer(), nullable=True))
    op.add_column('historico_entrevistas', sa.Column('categoria', sa.String(length=20), nullable=True))
    op.create_index(op.f('ix_historico_entrevistas_sessao_id'), 'historico_entrevistas', ['sessao_id'], unique=False)
    op.create_foreign_key('fk_historico_entrevistas_sessao_id', 'historico_entrevistas', 'sessoes_entrevista', ['sessao_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_historico_entrevistas_sessao_id', 'historico_entrevistas', type_='foreignkey')
    op.drop_index(op.f('ix_historico_entrevistas_sessao_id'), table_name='historico_entrevistas')
    op.drop_column('historico_entrevistas', 'categoria')
    op.drop_column('historico_entrevistas', 'sessao_id')

    op.drop_index(op.f('ix_sessoes_entrevista_status'), table_name='sessoes_entrevista')
    op.drop_index(op.f('ix_sessoes_entrevista_estudante_id'), table_name='sessoes_entrevista')
    op.drop_index(op.f('ix_sessoes_entrevista_id'), table_name='sessoes_entrevista')
    op.drop_table('sessoes_entrevista')
