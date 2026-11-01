"""
Multi-escola (multi-tenant) com isolamento automático.

Cada sessão do banco sabe de qual escola é a requisição (definir_escola, chamado
por get_estudante_atual e get_admin_atual assim que o dono do token é
identificado). A partir daí:

- toda consulta, UPDATE e DELETE do ORM em tabelas com escola_id (mixin
  EscopoEscola) ganha "WHERE escola_id = <escola>" sozinha -- inclusive joins
  e subconsultas -- então uma rota esquecida não vaza dado de outra escola;
- todo INSERT sem escola_id é carimbado com a escola da sessão (ou, nas rotas
  sem login, com a escola do aluno/registro "pai" da linha). Linha sem escola
  não é gravada: é erro de programação e quebra alto.

Sem escola na sessão (login, primeiro acesso, "esqueci minha senha", seed,
migrações), nada é filtrado: essas rotas procuram por campos únicos no
sistema todo (usuário, CPF). Consulta que precisa olhar todas as escolas mesmo
com escola na sessão (ex.: conferir se um CPF já existe em outra escola) usa
todas_as_escolas(consulta).
"""
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session, with_loader_criteria

from models import EscopoEscola

CHAVE = "escola_id"
OPCAO_TODAS = "todas_as_escolas"

# Colunas "pai" que dizem de qual escola é uma linha nova, na ordem de tentativa
PAIS = (("estudante_id", "Estudante"), ("aula_id", "Aula"), ("modulo_id", "ModuloTrilha"), ("canal_id", "Canal"),
        ("vaga_id", "Vaga"), ("sessao_id", "SessaoEntrevista"), ("turma_id", "Turma"))


class EscolaNaoDefinida(RuntimeError):
    pass


def definir_escola(db: Session, escola_id) -> None:
    db.info[CHAVE] = escola_id


def escola_da_sessao(db: Session):
    return db.info.get(CHAVE)


def todas_as_escolas(consulta):
    """Desliga o filtro de escola só nesta consulta (use com parcimônia)."""
    return consulta.execution_options(**{OPCAO_TODAS: True})


@event.listens_for(Session, "do_orm_execute")
def _filtrar_pela_escola(estado):
    escola = estado.session.info.get(CHAVE)
    if escola is None or estado.execution_options.get(OPCAO_TODAS):
        return
    if estado.is_select or estado.is_update or estado.is_delete:
        estado.statement = estado.statement.options(
            with_loader_criteria(EscopoEscola, lambda cls: cls.escola_id == escola, include_aliases=True)
        )


def _escola_do_pai(session: Session, objeto):
    import models
    with session.no_autoflush:
        for coluna, nome_modelo in PAIS:
            valor = getattr(objeto, coluna, None)
            if valor:
                pai = session.get(getattr(models, nome_modelo), valor, execution_options={OPCAO_TODAS: True})
                if pai is not None and getattr(pai, "escola_id", None):
                    return pai.escola_id
    return None


@event.listens_for(Session, "before_flush")
def _carimbar_escola(session, _contexto, _instancias):
    escola = session.info.get(CHAVE)
    for objeto in list(session.new):
        if not isinstance(objeto, EscopoEscola) or objeto.escola_id is not None:
            continue
        objeto.escola_id = escola or _escola_do_pai(session, objeto)
        if objeto.escola_id is None:
            raise EscolaNaoDefinida(f"{type(objeto).__name__} sem escola: defina a escola da sessão antes de gravar.")
    # Ninguém muda uma linha de escola pelo ORM
    for objeto in session.dirty:
        if isinstance(objeto, EscopoEscola):
            historico = inspect(objeto).attrs.escola_id.history
            if historico.deleted and historico.deleted[0] is not None and historico.added:
                raise EscolaNaoDefinida(f"{type(objeto).__name__}: não é permitido mudar a escola de um registro.")
