"""foto_status_contratacao_e_historico

Revision ID: e7a2c9d41b6f
Revises: c4e8a1b2d3f5
Create Date: 2026-10-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a2c9d41b6f'
down_revision: Union[str, Sequence[str], None] = 'c4e8a1b2d3f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Contato do aluno e do responsável
    op.add_column('estudantes', sa.Column('telefone', sa.String(length=11), nullable=True))
    op.add_column('estudantes', sa.Column('responsavel_nome', sa.String(length=100), nullable=True))
    op.add_column('estudantes', sa.Column('responsavel_telefone', sa.String(length=11), nullable=True))

    # Empregabilidade e primeiro acesso -- todo aluno que já existe entra como 'disponivel'
    op.add_column('estudantes', sa.Column('status_contratacao', sa.String(length=20), server_default='disponivel', nullable=False))
    op.create_index(op.f('ix_estudantes_status_contratacao'), 'estudantes', ['status_contratacao'], unique=False)
    op.add_column('estudantes', sa.Column('empresa_contratante', sa.String(length=100), nullable=True))
    op.add_column('estudantes', sa.Column('contratado_em', sa.Date(), nullable=True))
    op.add_column('estudantes', sa.Column('ja_trabalhou', sa.Boolean(), nullable=True))
    op.add_column('estudantes', sa.Column('experiencia_previa', sa.Text(), nullable=True))
    op.add_column('estudantes', sa.Column('foto_atualizada_em', sa.DateTime(), nullable=True))
    op.add_column('estudantes', sa.Column('foto_no_curriculo', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('estudantes', sa.Column('onboarding_concluido_em', sa.DateTime(), nullable=True))

    op.create_table(
        'fotos_estudantes',
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('conteudo', sa.LargeBinary(), nullable=False),
        sa.Column('tipo_mime', sa.String(length=20), nullable=False),
        sa.Column('enviada_por', sa.String(length=10), nullable=False),
        sa.Column('atualizada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('estudante_id'),
    )

    op.create_table(
        'observacoes_estudantes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('texto', sa.Text(), nullable=False),
        sa.Column('autor', sa.String(length=60), nullable=False),
        sa.Column('criada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_observacoes_estudantes_id'), 'observacoes_estudantes', ['id'], unique=False)
    op.create_index(op.f('ix_observacoes_estudantes_estudante_id'), 'observacoes_estudantes', ['estudante_id'], unique=False)

    op.create_table(
        'mudancas_status_contratacao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('empresa', sa.String(length=100), nullable=True),
        sa.Column('registrada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_mudancas_status_contratacao_id'), 'mudancas_status_contratacao', ['id'], unique=False)
    op.create_index(op.f('ix_mudancas_status_contratacao_estudante_id'), 'mudancas_status_contratacao', ['estudante_id'], unique=False)

    # Histórico: nota de cada resposta no simulador, retorno da empresa na candidatura e o texto original do currículo
    op.add_column('historico_entrevistas', sa.Column('xp_concedido', sa.Integer(), nullable=True))
    op.add_column('candidaturas', sa.Column('resposta_empresa', sa.Text(), nullable=True))
    op.add_column('candidaturas', sa.Column('atualizada_em', sa.DateTime(), nullable=True))
    op.add_column('curriculos', sa.Column('texto_original', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('curriculos', 'texto_original')
    op.drop_column('candidaturas', 'atualizada_em')
    op.drop_column('candidaturas', 'resposta_empresa')
    op.drop_column('historico_entrevistas', 'xp_concedido')

    op.drop_index(op.f('ix_mudancas_status_contratacao_estudante_id'), table_name='mudancas_status_contratacao')
    op.drop_index(op.f('ix_mudancas_status_contratacao_id'), table_name='mudancas_status_contratacao')
    op.drop_table('mudancas_status_contratacao')
    op.drop_index(op.f('ix_observacoes_estudantes_estudante_id'), table_name='observacoes_estudantes')
    op.drop_index(op.f('ix_observacoes_estudantes_id'), table_name='observacoes_estudantes')
    op.drop_table('observacoes_estudantes')
    op.drop_table('fotos_estudantes')

    op.drop_column('estudantes', 'onboarding_concluido_em')
    op.drop_column('estudantes', 'foto_no_curriculo')
    op.drop_column('estudantes', 'foto_atualizada_em')
    op.drop_column('estudantes', 'experiencia_previa')
    op.drop_column('estudantes', 'ja_trabalhou')
    op.drop_column('estudantes', 'contratado_em')
    op.drop_column('estudantes', 'empresa_contratante')
    op.drop_index(op.f('ix_estudantes_status_contratacao'), table_name='estudantes')
    op.drop_column('estudantes', 'status_contratacao')
    op.drop_column('estudantes', 'responsavel_telefone')
    op.drop_column('estudantes', 'responsavel_nome')
    op.drop_column('estudantes', 'telefone')
