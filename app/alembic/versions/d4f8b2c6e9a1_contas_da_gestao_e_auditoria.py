"""contas da gestao (perfis) e auditoria do painel

Revision ID: d4f8b2c6e9a1
Revises: c2e6a8d4f1b7
Create Date: 2026-10-31 00:00:00.000000

Sai a senha única do painel: cada pessoa da gestão tem a sua conta, com um
perfil (administrador, auditor, alterar, visualizar). A ADMIN_SENHA vira a
senha de instalação, que só vale até existir um Administrador. Tudo o que é
incluído, alterado, excluído ou exportado no painel fica na tabela
'auditoria', guardada por 2 anos.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f8b2c6e9a1'
down_revision: Union[str, Sequence[str], None] = 'c2e6a8d4f1b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'usuarios_gestao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=100), nullable=False),
        sa.Column('usuario', sa.String(length=40), nullable=False),
        sa.Column('senha_hash', sa.String(length=255), nullable=False),
        sa.Column('papel', sa.String(length=15), nullable=False, server_default='visualizar'),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('deve_trocar_senha', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('login_falhas', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('login_bloqueado_ate', sa.DateTime(), nullable=True),
        sa.Column('sessao_versao', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ultimo_acesso_em', sa.DateTime(), nullable=True),
        sa.Column('criado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_usuarios_gestao_id'), 'usuarios_gestao', ['id'], unique=False)
    op.create_index(op.f('ix_usuarios_gestao_usuario'), 'usuarios_gestao', ['usuario'], unique=True)

    op.create_table(
        'auditoria',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('criado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('usuario_gestao_id', sa.Integer(), nullable=True),
        sa.Column('usuario_nome', sa.String(length=100), nullable=False),
        sa.Column('papel', sa.String(length=15), nullable=True),
        sa.Column('acao', sa.String(length=15), nullable=False),
        sa.Column('entidade', sa.String(length=40), nullable=True),
        sa.Column('entidade_id', sa.String(length=40), nullable=True),
        sa.Column('descricao', sa.String(length=255), nullable=False),
        sa.Column('metodo', sa.String(length=7), nullable=True),
        sa.Column('caminho', sa.String(length=255), nullable=True),
        sa.Column('status_http', sa.Integer(), nullable=True),
        sa.Column('dados', sa.JSON(), nullable=True),
        sa.Column('antes', sa.JSON(), nullable=True),
        sa.Column('ip', sa.String(length=45), nullable=True),
        sa.ForeignKeyConstraint(['usuario_gestao_id'], ['usuarios_gestao.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_auditoria_id'), 'auditoria', ['id'], unique=False)
    op.create_index(op.f('ix_auditoria_criado_em'), 'auditoria', ['criado_em'], unique=False)
    op.create_index(op.f('ix_auditoria_usuario_gestao_id'), 'auditoria', ['usuario_gestao_id'], unique=False)
    op.create_index(op.f('ix_auditoria_acao'), 'auditoria', ['acao'], unique=False)
    op.create_index(op.f('ix_auditoria_entidade'), 'auditoria', ['entidade'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    for indice in ('entidade', 'acao', 'usuario_gestao_id', 'criado_em', 'id'):
        op.drop_index(op.f(f'ix_auditoria_{indice}'), table_name='auditoria')
    op.drop_table('auditoria')
    op.drop_index(op.f('ix_usuarios_gestao_usuario'), table_name='usuarios_gestao')
    op.drop_index(op.f('ix_usuarios_gestao_id'), table_name='usuarios_gestao')
    op.drop_table('usuarios_gestao')
