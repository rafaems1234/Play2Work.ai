"""foto do currículo separada da foto de identificação

A foto de identificação (fotos_estudantes) é pra escola reconhecer o aluno
no painel. A do currículo passa a ser outra, opcional, que o aluno envia na
tela do currículo. Quem já tinha marcado "foto no currículo" continua com a
mesma foto: ela é copiada pra tabela nova.

Revision ID: b7c3e9f1a2d5
Revises: f2b6d8a3c1e4
Create Date: 2026-10-30 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c3e9f1a2d5'
down_revision: Union[str, Sequence[str], None] = 'f2b6d8a3c1e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'fotos_curriculo',
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('conteudo', sa.LargeBinary(), nullable=False),
        sa.Column('tipo_mime', sa.String(length=20), nullable=False),
        sa.Column('atualizada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('estudante_id'),
    )
    op.add_column('estudantes', sa.Column('foto_curriculo_atualizada_em', sa.DateTime(), nullable=True))
    op.execute("""
        INSERT INTO fotos_curriculo (estudante_id, conteudo, tipo_mime, atualizada_em)
        SELECT f.estudante_id, f.conteudo, f.tipo_mime, now()
        FROM fotos_estudantes f JOIN estudantes e ON e.id = f.estudante_id
        WHERE e.foto_no_curriculo
    """)
    op.execute("""
        UPDATE estudantes SET foto_curriculo_atualizada_em = now()
        WHERE id IN (SELECT estudante_id FROM fotos_curriculo)
    """)


def downgrade() -> None:
    """Downgrade schema. As fotos do currículo enviadas à parte são descartadas."""
    op.drop_column('estudantes', 'foto_curriculo_atualizada_em')
    op.drop_table('fotos_curriculo')
