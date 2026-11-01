"""multi-escola: tabela de escolas e escola_id em todas as tabelas da escola

Revision ID: e6a1c3f5b7d9
Revises: d4f8b2c6e9a1
Create Date: 2026-10-31 00:00:00.000000

Cria 'escolas' com a "Escola piloto" (id 1) e põe todos os dados que já
existem nela. As tabelas da escola ganham escola_id (NOT NULL, com índice e
chave estrangeira); a auditoria ganha escola_id opcional (login errado de
usuário inexistente não tem escola). Nome de turma, e-mail e nome de exibição
do aluno passam a ser únicos por escola; CPF e usuários de login continuam
únicos no sistema todo. O isolamento nas consultas fica em tenancy.py.

Ficam sem escola_id as tabelas acessadas sempre pelo registro "pai" já
filtrado: fotos_estudantes, fotos_curriculo, mapa_competencias e
leituras_canais.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6a1c3f5b7d9'
down_revision: Union[str, Sequence[str], None] = 'd4f8b2c6e9a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABELAS = [
    'turmas', 'estudantes', 'usuarios_gestao', 'pedidos_nova_senha', 'observacoes_estudantes', 'mudancas_status_contratacao',
    'vagas', 'historico_entrevistas', 'tentativas_certificacao', 'rodadas_entrevista', 'sessoes_entrevista', 'atividades_diarias',
    'candidaturas', 'quiz_sessoes', 'curriculos', 'evidencias_competencia', 'respostas_situacoes', 'modulos_trilha', 'aulas',
    'perguntas_fixacao', 'materiais_aula', 'progresso_aulas', 'log_frequencia', 'contratos_aprendizagem', 'retiradas_certificado',
    'canais', 'mensagens',
]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'escolas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('slug', sa.String(length=60), nullable=False),
        sa.Column('ativa', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('criada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_escolas_id'), 'escolas', ['id'], unique=False)
    op.create_index(op.f('ix_escolas_slug'), 'escolas', ['slug'], unique=True)
    op.execute("INSERT INTO escolas (id, nome, slug) VALUES (1, 'Escola piloto', 'piloto')")
    op.execute("SELECT setval(pg_get_serial_sequence('escolas', 'id'), 1)")

    for tabela in TABELAS:
        op.add_column(tabela, sa.Column('escola_id', sa.Integer(), nullable=True))
        op.execute(f"UPDATE {tabela} SET escola_id = 1")
        op.alter_column(tabela, 'escola_id', nullable=False)
        op.create_index(op.f(f'ix_{tabela}_escola_id'), tabela, ['escola_id'], unique=False)
        op.create_foreign_key(f'fk_{tabela}_escola_id', tabela, 'escolas', ['escola_id'], ['id'], ondelete='CASCADE')

    op.add_column('auditoria', sa.Column('escola_id', sa.Integer(), nullable=True))
    op.execute("UPDATE auditoria SET escola_id = 1")
    op.create_index(op.f('ix_auditoria_escola_id'), 'auditoria', ['escola_id'], unique=False)
    op.create_foreign_key('fk_auditoria_escola_id', 'auditoria', 'escolas', ['escola_id'], ['id'], ondelete='CASCADE')

    # Únicos que passam a valer por escola
    op.drop_constraint('turmas_nome_key', 'turmas', type_='unique')
    op.create_unique_constraint('uq_turma_escola_nome', 'turmas', ['escola_id', 'nome'])
    op.drop_constraint('uq_estudantes_nome_exibicao', 'estudantes', type_='unique')
    op.create_unique_constraint('uq_estudante_escola_nome_exibicao', 'estudantes', ['escola_id', 'nome_exibicao'])
    op.drop_index('ix_estudantes_email', table_name='estudantes')
    op.create_index('ix_estudantes_email', 'estudantes', ['email'], unique=False)
    op.create_unique_constraint('uq_estudante_escola_email', 'estudantes', ['escola_id', 'email'])


def downgrade() -> None:
    """Downgrade schema. Só funciona com uma escola só (os únicos voltam a valer no sistema todo)."""
    op.drop_constraint('uq_estudante_escola_email', 'estudantes', type_='unique')
    op.drop_index('ix_estudantes_email', table_name='estudantes')
    op.create_index('ix_estudantes_email', 'estudantes', ['email'], unique=True)
    op.drop_constraint('uq_estudante_escola_nome_exibicao', 'estudantes', type_='unique')
    op.create_unique_constraint('uq_estudantes_nome_exibicao', 'estudantes', ['nome_exibicao'])
    op.drop_constraint('uq_turma_escola_nome', 'turmas', type_='unique')
    op.create_unique_constraint('turmas_nome_key', 'turmas', ['nome'])

    op.drop_constraint('fk_auditoria_escola_id', 'auditoria', type_='foreignkey')
    op.drop_index(op.f('ix_auditoria_escola_id'), table_name='auditoria')
    op.drop_column('auditoria', 'escola_id')
    for tabela in reversed(TABELAS):
        op.drop_constraint(f'fk_{tabela}_escola_id', tabela, type_='foreignkey')
        op.drop_index(op.f(f'ix_{tabela}_escola_id'), table_name=tabela)
        op.drop_column(tabela, 'escola_id')

    op.drop_index(op.f('ix_escolas_slug'), table_name='escolas')
    op.drop_index(op.f('ix_escolas_id'), table_name='escolas')
    op.drop_table('escolas')
