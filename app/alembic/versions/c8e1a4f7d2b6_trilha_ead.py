"""trilha_ead

Revision ID: c8e1a4f7d2b6
Revises: b3d5f1a8c2e9
Create Date: 2026-10-29 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8e1a4f7d2b6'
down_revision: Union[str, Sequence[str], None] = 'b3d5f1a8c2e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'modulos_trilha',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=150), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('itinerario', sa.String(length=60), nullable=True),
        sa.Column('ordem', sa.Integer(), nullable=False),
        sa.Column('publicado', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('criado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_modulos_trilha_id'), 'modulos_trilha', ['id'], unique=False)
    op.create_index(op.f('ix_modulos_trilha_itinerario'), 'modulos_trilha', ['itinerario'], unique=False)

    op.create_table(
        'aulas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('modulo_id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=150), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('ordem', sa.Integer(), nullable=False),
        sa.Column('video_provedor', sa.String(length=10), nullable=True),
        sa.Column('video_id', sa.String(length=40), nullable=True),
        sa.Column('duracao_segundos', sa.Integer(), nullable=False),
        sa.Column('texto', sa.Text(), nullable=True),
        sa.Column('carga_horaria_minutos', sa.Integer(), nullable=False),
        sa.Column('percentual_minimo_assistido', sa.Integer(), nullable=False),
        sa.Column('nota_minima', sa.Integer(), nullable=False),
        sa.Column('publicada', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('criada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('atualizada_em', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['modulo_id'], ['modulos_trilha.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_aulas_id'), 'aulas', ['id'], unique=False)
    op.create_index(op.f('ix_aulas_modulo_id'), 'aulas', ['modulo_id'], unique=False)

    op.create_table(
        'perguntas_fixacao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('aula_id', sa.Integer(), nullable=False),
        sa.Column('enunciado', sa.Text(), nullable=False),
        sa.Column('opcoes', sa.JSON(), nullable=False),
        sa.Column('resposta_correta_index', sa.Integer(), nullable=False),
        sa.Column('explicacao', sa.Text(), nullable=True),
        sa.Column('ordem', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['aula_id'], ['aulas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_perguntas_fixacao_id'), 'perguntas_fixacao', ['id'], unique=False)
    op.create_index(op.f('ix_perguntas_fixacao_aula_id'), 'perguntas_fixacao', ['aula_id'], unique=False)

    op.create_table(
        'materiais_aula',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('aula_id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=10), nullable=False),
        sa.Column('nome_arquivo', sa.String(length=150), nullable=False),
        sa.Column('tipo_mime', sa.String(length=60), nullable=False),
        sa.Column('tamanho_bytes', sa.Integer(), nullable=False),
        sa.Column('conteudo', sa.LargeBinary(), nullable=False),
        sa.Column('enviado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['aula_id'], ['aulas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_materiais_aula_id'), 'materiais_aula', ['id'], unique=False)
    op.create_index(op.f('ix_materiais_aula_aula_id'), 'materiais_aula', ['aula_id'], unique=False)

    op.create_table(
        'progresso_aulas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('aula_id', sa.Integer(), nullable=False),
        sa.Column('blocos_assistidos', sa.Text(), nullable=False),
        sa.Column('percentual_assistido', sa.Integer(), nullable=False),
        sa.Column('ultimo_registro_em', sa.DateTime(), nullable=True),
        sa.Column('melhor_nota_fixacao', sa.Integer(), nullable=True),
        sa.Column('tentativas_fixacao', sa.Integer(), nullable=False),
        sa.Column('embaralhamento_fixacao', sa.JSON(), nullable=True),
        sa.Column('iniciada_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('concluida_em', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['aula_id'], ['aulas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('estudante_id', 'aula_id', name='uq_progresso_estudante_aula'),
    )
    op.create_index(op.f('ix_progresso_aulas_id'), 'progresso_aulas', ['id'], unique=False)
    op.create_index(op.f('ix_progresso_aulas_estudante_id'), 'progresso_aulas', ['estudante_id'], unique=False)
    op.create_index(op.f('ix_progresso_aulas_aula_id'), 'progresso_aulas', ['aula_id'], unique=False)

    op.create_table(
        'log_frequencia',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('estudante_id', sa.Integer(), nullable=False),
        sa.Column('aula_id', sa.Integer(), nullable=False),
        sa.Column('evento', sa.String(length=20), nullable=False),
        sa.Column('percentual_assistido', sa.Integer(), nullable=False),
        sa.Column('nota', sa.Integer(), nullable=True),
        sa.Column('nota_de_corte', sa.Integer(), nullable=True),
        sa.Column('registrado_em', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['aula_id'], ['aulas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['estudante_id'], ['estudantes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_log_frequencia_id'), 'log_frequencia', ['id'], unique=False)
    op.create_index(op.f('ix_log_frequencia_estudante_id'), 'log_frequencia', ['estudante_id'], unique=False)
    op.create_index(op.f('ix_log_frequencia_aula_id'), 'log_frequencia', ['aula_id'], unique=False)
    op.create_index(op.f('ix_log_frequencia_registrado_em'), 'log_frequencia', ['registrado_em'], unique=False)

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


def downgrade() -> None:
    """Downgrade schema."""
    for tabela, indices in [
        ('certificados', ['modulo_id', 'estudante_id', 'id']),
        ('log_frequencia', ['registrado_em', 'aula_id', 'estudante_id', 'id']),
        ('progresso_aulas', ['aula_id', 'estudante_id', 'id']),
        ('materiais_aula', ['aula_id', 'id']),
        ('perguntas_fixacao', ['aula_id', 'id']),
        ('aulas', ['modulo_id', 'id']),
        ('modulos_trilha', ['itinerario', 'id']),
    ]:
        for coluna in indices:
            op.drop_index(op.f(f'ix_{tabela}_{coluna}'), table_name=tabela)
        op.drop_table(tabela)
