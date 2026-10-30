"""mensagens

Revision ID: a1d9c4e7b3f5
Revises: d4a7e2b9f1c3
Create Date: 2026-10-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1d9c4e7b3f5'
down_revision: Union[str, Sequence[str], None] = 'd4a7e2b9f1c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'canais',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=10), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=True),
        sa.Column('empresa', sa.String(length=100), nullable=True),
        sa.Column('turno', sa.String(length=20), nullable=True),
        sa.Column('arquivado', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('escola_leu_em', sa.DateTime(), nullable=True),
        sa.Column('criado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('estudante_id'),
    )
    op.create_index(op.f('ix_canais_id'), 'canais', ['id'], unique=False)
    op.create_index(op.f('ix_canais_tipo'), 'canais', ['tipo'], unique=False)
    op.create_index(op.f('ix_canais_empresa'), 'canais', ['empresa'], unique=False)

    op.create_table(
        'mensagens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('canal_id', sa.Integer(), nullable=False),
        sa.Column('autor_tipo', sa.String(length=10), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=True),
        sa.Column('texto', sa.Text(), nullable=False),
        sa.Column('enviada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('oculta_em', sa.DateTime(), nullable=True),
        sa.Column('oculta_motivo', sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(['canal_id'], ['canais.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_mensagens_id'), 'mensagens', ['id'], unique=False)
    op.create_index(op.f('ix_mensagens_canal_id'), 'mensagens', ['canal_id'], unique=False)
    op.create_index(op.f('ix_mensagens_estudante_id'), 'mensagens', ['estudante_id'], unique=False)
    op.create_index(op.f('ix_mensagens_enviada_em'), 'mensagens', ['enviada_em'], unique=False)

    op.create_table(
        'leituras_canais',
        sa.Column('canal_id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('lida_em', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['canal_id'], ['canais.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('canal_id', 'estudante_id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('leituras_canais')
    for coluna in ['enviada_em', 'estudante_id', 'canal_id', 'id']:
        op.drop_index(op.f(f'ix_mensagens_{coluna}'), table_name='mensagens')
    op.drop_table('mensagens')
    for coluna in ['empresa', 'tipo', 'id']:
        op.drop_index(op.f(f'ix_canais_{coluna}'), table_name='canais')
    op.drop_table('canais')
