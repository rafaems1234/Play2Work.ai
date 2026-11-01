"""cotas da entrevista, laudo oficial/provisório e uso da IA

Revision ID: b4d6f8a0c2e4
Revises: a3c5e7f9b1d2
Create Date: 2026-11-01 00:00:00.000000

- sessoes_entrevista ganha laudo_oficial, laudo_motor e laudo_motivo_provisorio.
  Os laudos que já existem eram todos contados na rodada: ficam oficiais, com
  o motor "regras" (reserva) ou "gemini:anterior" (modelo não registrado na época).
- Tabela uso_ia (da plataforma, sem escola): consumo por mês e modelo, pro
  teto de gasto mensal.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4d6f8a0c2e4'
down_revision: Union[str, Sequence[str], None] = 'a3c5e7f9b1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sessoes_entrevista', sa.Column('laudo_oficial', sa.Boolean(), nullable=True))
    op.add_column('sessoes_entrevista', sa.Column('laudo_motor', sa.String(length=80), nullable=True))
    op.add_column('sessoes_entrevista', sa.Column('laudo_motivo_provisorio', sa.String(length=20), nullable=True))
    op.execute("""
        UPDATE sessoes_entrevista
           SET laudo_oficial = true,
               laudo_motor = CASE WHEN laudo_por_ia THEN 'gemini:anterior' ELSE 'regras' END
         WHERE status = 'concluida'
    """)

    op.create_table(
        'uso_ia',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('mes', sa.Date(), nullable=False),
        sa.Column('modelo', sa.String(length=80), nullable=False),
        sa.Column('chamadas', sa.Integer(), server_default='0', nullable=False),
        sa.Column('tokens_entrada', sa.BigInteger(), server_default='0', nullable=False),
        sa.Column('tokens_saida', sa.BigInteger(), server_default='0', nullable=False),
        sa.Column('custo_usd', sa.Float(), server_default='0', nullable=False),
        sa.Column('atualizado_em', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('mes', 'modelo', name='uq_uso_ia_mes_modelo'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('uso_ia')
    op.drop_column('sessoes_entrevista', 'laudo_motivo_provisorio')
    op.drop_column('sessoes_entrevista', 'laudo_motor')
    op.drop_column('sessoes_entrevista', 'laudo_oficial')
