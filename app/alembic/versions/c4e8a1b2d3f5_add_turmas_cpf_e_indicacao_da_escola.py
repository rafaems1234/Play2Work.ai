"""add_turmas_cpf_e_indicacao_da_escola

Revision ID: c4e8a1b2d3f5
Revises: 9b1f2d4c7a3e
Create Date: 2026-10-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from nomes import escolher_nome_exibicao


# revision identifiers, used by Alembic.
revision: str = 'c4e8a1b2d3f5'
down_revision: Union[str, Sequence[str], None] = '9b1f2d4c7a3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'turmas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=60), nullable=False),
        sa.Column('turno', sa.String(length=20), nullable=True),
        sa.Column('criada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nome'),
    )
    op.create_index(op.f('ix_turmas_id'), 'turmas', ['id'], unique=False)

    # Nome de exibição único ("Rafael S."), preenchido pros alunos que já existem
    op.add_column('estudantes', sa.Column('nome_exibicao', sa.String(length=60), nullable=True))
    conexao = op.get_bind()
    ocupados: set[str] = set()
    for estudante_id, nome in conexao.execute(sa.text("SELECT id, nome FROM estudantes ORDER BY id")).all():
        nome_exibicao = escolher_nome_exibicao(nome or "", ocupados)
        ocupados.add(nome_exibicao.lower())
        conexao.execute(sa.text("UPDATE estudantes SET nome_exibicao = :n WHERE id = :i"), {"n": nome_exibicao, "i": estudante_id})
    op.create_unique_constraint('uq_estudantes_nome_exibicao', 'estudantes', ['nome_exibicao'])

    op.add_column('estudantes', sa.Column('cpf', sa.String(length=11), nullable=True))
    op.create_index(op.f('ix_estudantes_cpf'), 'estudantes', ['cpf'], unique=True)
    op.add_column('estudantes', sa.Column('data_nascimento', sa.Date(), nullable=True))

    op.add_column('estudantes', sa.Column('turma_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_estudantes_turma_id'), 'estudantes', ['turma_id'], unique=False)
    op.create_foreign_key('fk_estudantes_turma_id', 'estudantes', 'turmas', ['turma_id'], ['id'], ondelete='SET NULL')

    op.add_column('candidaturas', sa.Column('indicada_pela_escola', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('candidaturas', sa.Column('pontuacao_indicacao', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('candidaturas', 'pontuacao_indicacao')
    op.drop_column('candidaturas', 'indicada_pela_escola')

    op.drop_constraint('fk_estudantes_turma_id', 'estudantes', type_='foreignkey')
    op.drop_index(op.f('ix_estudantes_turma_id'), table_name='estudantes')
    op.drop_column('estudantes', 'turma_id')

    op.drop_column('estudantes', 'data_nascimento')
    op.drop_index(op.f('ix_estudantes_cpf'), table_name='estudantes')
    op.drop_column('estudantes', 'cpf')

    op.drop_constraint('uq_estudantes_nome_exibicao', 'estudantes', type_='unique')
    op.drop_column('estudantes', 'nome_exibicao')

    op.drop_index(op.f('ix_turmas_id'), table_name='turmas')
    op.drop_table('turmas')
