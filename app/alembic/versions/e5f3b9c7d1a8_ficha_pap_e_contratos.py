"""ficha do PAP e contratos de aprendizagem

Colunas da planilha de controle do PAP: dados escolares no aluno e uma
tabela de contratos (com histórico). Quem já estava marcado como contratado
ganha um contrato "Ativo" com a empresa e a data que já tinha.

Revision ID: e5f3b9c7d1a8
Revises: d2e8f1a4b6c3
Create Date: 2026-10-31 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f3b9c7d1a8'
down_revision: Union[str, Sequence[str], None] = 'd2e8f1a4b6c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUNAS_ALUNO = [
    ('numero_cadastro_sed', sa.String(length=30)),
    ('sexo', sa.String(length=10)),
    ('perfil_desenvolvimento', sa.String(length=10)),
    ('ano_escolar_inicial', sa.String(length=12)),
    ('ano_escolar_atual', sa.String(length=12)),
    ('turno_escolar', sa.String(length=12)),
    ('formacao_mundo_trabalho_em', sa.Date()),
    ('status_estudante', sa.String(length=20)),
    ('endereco', sa.String(length=255)),
    ('documentos', sa.String(length=255)),
    ('cadastro_atualizado_em', sa.Date()),
]


def upgrade() -> None:
    """Upgrade schema."""
    for nome, tipo in COLUNAS_ALUNO:
        op.add_column('estudantes', sa.Column(nome, tipo, nullable=True))

    op.create_table(
        'contratos_aprendizagem',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('empresa', sa.String(length=100), nullable=False),
        sa.Column('cnpj', sa.String(length=14), nullable=True),
        sa.Column('local_atuacao', sa.String(length=150), nullable=True),
        sa.Column('turno_trabalho', sa.String(length=12), nullable=True),
        sa.Column('tipo_contratacao', sa.String(length=12), nullable=True),
        sa.Column('data_inicial', sa.Date(), nullable=False),
        sa.Column('data_final', sa.Date(), nullable=True),
        sa.Column('aditivo', sa.String(length=3), nullable=True),
        sa.Column('aditivo_inicio', sa.Date(), nullable=True),
        sa.Column('aditivo_fim', sa.Date(), nullable=True),
        sa.Column('horas_teoria', sa.Integer(), nullable=True),
        sa.Column('horas_pratica', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=12), nullable=False),
        sa.Column('motivo', sa.String(length=60), nullable=True),
        sa.Column('efetivado', sa.String(length=15), nullable=True),
        sa.Column('observacao', sa.Text(), nullable=True),
        sa.Column('criado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_contratos_aprendizagem_id'), 'contratos_aprendizagem', ['id'], unique=False)
    op.create_index(op.f('ix_contratos_aprendizagem_estudante_id'), 'contratos_aprendizagem', ['estudante_id'], unique=False)

    # Contratados de antes ganham o contrato com o que já se sabia
    op.execute("""
        INSERT INTO contratos_aprendizagem (estudante_id, empresa, data_inicial, status)
        SELECT id, empresa_contratante, COALESCE(contratado_em, CURRENT_DATE), 'Ativo'
        FROM estudantes WHERE status_contratacao = 'contratado' AND empresa_contratante IS NOT NULL
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_contratos_aprendizagem_estudante_id'), table_name='contratos_aprendizagem')
    op.drop_index(op.f('ix_contratos_aprendizagem_id'), table_name='contratos_aprendizagem')
    op.drop_table('contratos_aprendizagem')
    for nome, _ in reversed(COLUNAS_ALUNO):
        op.drop_column('estudantes', nome)
