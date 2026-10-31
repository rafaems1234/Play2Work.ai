"""certificado retirado na escola

O certificado de conclusão deixa de ser um PDF enviado pela escola e
liberado no app: o aluno busca o documento presencialmente e a coordenação
registra a retirada. Sai a tabela 'certificados' (com os PDFs), entra
'retiradas_certificado'.

Revision ID: f2b6d8a3c1e4
Revises: a1d9c4e7b3f5
Create Date: 2026-10-30 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2b6d8a3c1e4'
down_revision: Union[str, Sequence[str], None] = 'a1d9c4e7b3f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    for coluna in ['modulo_id', 'estudante_id', 'id']:
        op.drop_index(op.f(f'ix_certificados_{coluna}'), table_name='certificados')
    op.drop_table('certificados')

    op.create_table(
        'retiradas_certificado',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('modulo_id', sa.Integer(), nullable=False),
        sa.Column('retirado_em', sa.Date(), nullable=False),
        sa.Column('observacao', sa.String(length=200), nullable=True),
        sa.Column('registrado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['modulo_id'], ['modulos_trilha.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('estudante_id', 'modulo_id', name='uq_retirada_estudante_modulo'),
    )
    op.create_index(op.f('ix_retiradas_certificado_id'), 'retiradas_certificado', ['id'], unique=False)
    op.create_index(op.f('ix_retiradas_certificado_estudante_id'), 'retiradas_certificado', ['estudante_id'], unique=False)
    op.create_index(op.f('ix_retiradas_certificado_modulo_id'), 'retiradas_certificado', ['modulo_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema. Os PDFs apagados no upgrade não voltam."""
    for coluna in ['modulo_id', 'estudante_id', 'id']:
        op.drop_index(op.f(f'ix_retiradas_certificado_{coluna}'), table_name='retiradas_certificado')
    op.drop_table('retiradas_certificado')

    op.create_table(
        'certificados',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('modulo_id', sa.Integer(), nullable=True),
        sa.Column('titulo', sa.String(length=150), nullable=False),
        sa.Column('emitido_em', sa.Date(), nullable=True),
        sa.Column('nome_arquivo', sa.String(length=150), nullable=False),
        sa.Column('tamanho_bytes', sa.Integer(), nullable=False),
        sa.Column('conteudo', sa.LargeBinary(), nullable=False),
        sa.Column('enviado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['modulo_id'], ['modulos_trilha.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_certificados_id'), 'certificados', ['id'], unique=False)
    op.create_index(op.f('ix_certificados_estudante_id'), 'certificados', ['estudante_id'], unique=False)
    op.create_index(op.f('ix_certificados_modulo_id'), 'certificados', ['modulo_id'], unique=False)
