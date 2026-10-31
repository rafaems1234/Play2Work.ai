"""cursos reais da escola no lugar dos itinerários provisórios

Os itinerários eram uma estimativa; os cursos de verdade são os da planilha
de controle do PAP: Serviços Jurídicos, Ciência de Dados, Administração,
Recursos Humanos, Mecatrônica e Inteligência Artificial. Renomeia os
equivalentes em alunos, vagas e módulos da trilha. "Ciências da Natureza e
Matemática" não tem equivalente: fica sem curso, pra escola reclassificar.

Revision ID: d2e8f1a4b6c3
Revises: c9d4a7e2f8b1
Create Date: 2026-10-31 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd2e8f1a4b6c3'
down_revision: Union[str, Sequence[str], None] = 'c9d4a7e2f8b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MAPA = [
    ('Tecnologia e Ciência de Dados', 'Ciência de Dados'),
    ('Robótica e Automação', 'Mecatrônica'),
    ('Ciências Jurídicas / Serviços Jurídicos', 'Serviços Jurídicos'),
    ('Recursos Humanos e Gestão de Pessoas', 'Recursos Humanos'),
]
SEM_EQUIVALENTE = 'Ciências da Natureza e Matemática'
COLUNAS = [('estudantes', 'itinerario'), ('vagas', 'area_itinerario'), ('modulos_trilha', 'itinerario')]


def upgrade() -> None:
    """Upgrade schema."""
    for tabela, coluna in COLUNAS:
        for velho, novo in MAPA:
            op.execute(f"UPDATE {tabela} SET {coluna} = '{novo}' WHERE {coluna} = '{velho}'")
        op.execute(f"UPDATE {tabela} SET {coluna} = NULL WHERE {coluna} = '{SEM_EQUIVALENTE}'")


def downgrade() -> None:
    """Downgrade schema. Quem era de Ciências da Natureza (ou dos cursos novos) não volta sozinho."""
    for tabela, coluna in COLUNAS:
        for velho, novo in MAPA:
            op.execute(f"UPDATE {tabela} SET {coluna} = '{velho}' WHERE {coluna} = '{novo}'")
