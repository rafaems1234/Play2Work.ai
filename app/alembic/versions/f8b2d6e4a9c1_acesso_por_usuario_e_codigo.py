"""acesso por usuario + senha, codigo da escola e pedidos de senha nova

Revision ID: f8b2d6e4a9c1
Revises: e5f3b9c7d1a8
Create Date: 2026-10-31 00:00:00.000000

O login só com CPF sai. O aluno entra com usuário + senha; o primeiro acesso
(e cada senha nova aprovada pela escola) é feito com CPF + código de acesso.
Saem também as colunas do reset antigo por pergunta de segurança, que
trocava a senha sem passar pela escola.

Alunos que já existem ganham um usuário. Quem já tinha senha (contas antigas
de nome + senha) continua entrando com ela; quem só entrava pelo CPF precisa
de um código, gerado no painel (aba Acessos).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from nomes import escolher_usuario


# revision identifiers, used by Alembic.
revision: str = 'f8b2d6e4a9c1'
down_revision: Union[str, Sequence[str], None] = 'e5f3b9c7d1a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('estudantes', sa.Column('usuario', sa.String(length=40), nullable=True))
    conexao = op.get_bind()
    ocupados: set[str] = set()
    for estudante_id, nome in conexao.execute(sa.text("SELECT id, nome FROM estudantes ORDER BY id")).all():
        usuario = escolher_usuario(nome or "", ocupados)
        ocupados.add(usuario)
        conexao.execute(sa.text("UPDATE estudantes SET usuario = :u WHERE id = :i"), {"u": usuario, "i": estudante_id})
    op.create_index(op.f('ix_estudantes_usuario'), 'estudantes', ['usuario'], unique=True)

    op.add_column('estudantes', sa.Column('senha_definida_em', sa.DateTime(), nullable=True))
    op.add_column('estudantes', sa.Column('codigo_acesso_hash', sa.String(length=255), nullable=True))
    op.add_column('estudantes', sa.Column('codigo_acesso_expira_em', sa.DateTime(), nullable=True))
    op.add_column('estudantes', sa.Column('codigo_acesso_tentativas', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('estudantes', sa.Column('login_falhas', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('estudantes', sa.Column('login_bloqueado_ate', sa.DateTime(), nullable=True))
    op.add_column('estudantes', sa.Column('sessao_versao', sa.Integer(), nullable=False, server_default='0'))

    op.drop_column('estudantes', 'precisa_trocar_senha')
    op.drop_column('estudantes', 'pergunta_seguranca')
    op.drop_column('estudantes', 'resposta_seguranca_hash')

    op.create_table(
        'pedidos_nova_senha',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=12), nullable=False, server_default='pendente'),
        sa.Column('criado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('decidido_em', sa.DateTime(), nullable=True),
        sa.Column('motivo_recusa', sa.String(length=200), nullable=True),
        sa.Column('concluido_em', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_pedidos_nova_senha_id'), 'pedidos_nova_senha', ['id'], unique=False)
    op.create_index(op.f('ix_pedidos_nova_senha_estudante_id'), 'pedidos_nova_senha', ['estudante_id'], unique=False)
    op.create_index(op.f('ix_pedidos_nova_senha_status'), 'pedidos_nova_senha', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_pedidos_nova_senha_status'), table_name='pedidos_nova_senha')
    op.drop_index(op.f('ix_pedidos_nova_senha_estudante_id'), table_name='pedidos_nova_senha')
    op.drop_index(op.f('ix_pedidos_nova_senha_id'), table_name='pedidos_nova_senha')
    op.drop_table('pedidos_nova_senha')

    op.add_column('estudantes', sa.Column('resposta_seguranca_hash', sa.String(length=255), nullable=True))
    op.add_column('estudantes', sa.Column('pergunta_seguranca', sa.String(length=200), nullable=True))
    op.add_column('estudantes', sa.Column('precisa_trocar_senha', sa.Boolean(), nullable=True))

    op.drop_column('estudantes', 'sessao_versao')
    op.drop_column('estudantes', 'login_bloqueado_ate')
    op.drop_column('estudantes', 'login_falhas')
    op.drop_column('estudantes', 'codigo_acesso_tentativas')
    op.drop_column('estudantes', 'codigo_acesso_expira_em')
    op.drop_column('estudantes', 'codigo_acesso_hash')
    op.drop_column('estudantes', 'senha_definida_em')
    op.drop_index(op.f('ix_estudantes_usuario'), table_name='estudantes')
    op.drop_column('estudantes', 'usuario')
