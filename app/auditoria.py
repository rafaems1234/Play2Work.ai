"""
Auditoria do Painel da Escola: o que cada pessoa da gestão fez.

Um middleware (MiddlewareAuditoria, registrado em main.py) olha toda
requisição de alteração em /api/admin (POST/PUT/DELETE/PATCH) e grava quem
fez, quando, de qual IP, o quê (descrição legível), o que foi enviado (sem
senhas, códigos nem arquivos) e -- em exclusões e alterações de registros
conhecidos -- como o registro estava ANTES, lido do banco antes da rota rodar.
Também grava os logins (certos e errados), as recusas por falta de permissão
e as exportações de lista (que o painel avisa em /admin/auditoria/exportacao).

Os registros só crescem: nenhuma rota edita ou apaga. Passados 2 anos
(RETENCAO_DIAS), são removidos automaticamente (purgar_antigos), como pede a
LGPD: guardar só pelo tempo necessário.
"""
import json
import logging
import re
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from starlette.concurrency import run_in_threadpool

from database import SessionLocal
from fuso import agora_utc
from models import (
    Aula, Candidatura, Canal, ContratoAprendizagem, Estudante, MaterialAula, ModuloTrilha,
    ObservacaoEstudante, PedidoNovaSenha, RegistroAuditoria, RodadaEntrevista, Turma, UsuarioGestao, Vaga,
)

logger = logging.getLogger(__name__)

RETENCAO_DIAS = 730  # 2 anos
PREFIXO = "/api/admin"
METODOS_DE_ALTERACAO = {"POST", "PUT", "DELETE", "PATCH"}
TAMANHO_MAXIMO_CORPO = 64_000
CAMPOS_SENSIVEIS = re.compile(r"senha|password|codigo|token|hash|imagem|base64|arquivo|conteudo|gabarito", re.I)

ACOES = {
    "incluiu": "Incluiu", "alterou": "Alterou", "excluiu": "Excluiu", "exportou": "Exportou",
    "entrou": "Entrou no painel", "falhou_login": "Errou o login", "negado": "Tentou sem permissão",
}

# (método, padrão do caminho sem /api/admin) -> (ação, entidade, descrição, modelo pra foto do "antes")
ROTAS = [
    ("POST", r"/turmas", "incluiu", "turma", "Cadastrou a turma {nome}", None),
    ("POST", r"/estudantes", "incluiu", "aluno", "Cadastrou o aluno {nome}", None),
    ("PUT", r"/estudantes/(\d+)", "alterou", "aluno", "Alterou o cadastro de {aluno}", Estudante),
    ("PUT", r"/estudantes/(\d+)/status", "alterou", "aluno", "Mudou o status de contratação de {aluno} para {status}", Estudante),
    ("POST", r"/estudantes/(\d+)/contratos", "incluiu", "contrato", "Incluiu contrato de aprendizagem de {aluno}", None),
    ("PUT", r"/contratos/(\d+)", "alterou", "contrato", "Alterou o contrato de aprendizagem #{id}", ContratoAprendizagem),
    ("DELETE", r"/contratos/(\d+)", "excluiu", "contrato", "Excluiu o contrato de aprendizagem #{id}", ContratoAprendizagem),
    ("PUT", r"/estudantes/(\d+)/foto", "alterou", "foto", "Trocou a foto de {aluno}", None),
    ("DELETE", r"/estudantes/(\d+)/foto", "excluiu", "foto", "Excluiu a foto de {aluno}", None),
    ("POST", r"/estudantes/(\d+)/observacoes", "incluiu", "observacao", "Anotou uma observação na ficha de {aluno}", None),
    ("DELETE", r"/observacoes/(\d+)", "excluiu", "observacao", "Excluiu a observação #{id}", ObservacaoEstudante),
    ("PUT", r"/candidaturas/(\d+)", "alterou", "candidatura", "Atualizou a candidatura #{id}", Candidatura),
    ("POST", r"/vagas", "incluiu", "vaga", "Cadastrou a vaga {titulo_vaga} ({empresa})", None),
    ("POST", r"/vagas/(\d+)/indicar", "incluiu", "indicacao", "Indicou aluno(s) para a vaga #{id}", Vaga),
    ("POST", r"/rodadas-entrevista/(\d+)/confirmar", "alterou", "rodada_entrevista", "Confirmou a Meta de Entrevista (rodada #{id})", RodadaEntrevista),
    ("POST", r"/rodadas-entrevista/(\d+)/nao-confirmar", "alterou", "rodada_entrevista", "Não confirmou a meta e abriu nova rodada (rodada #{id})", RodadaEntrevista),
    ("POST", r"/modulos", "incluiu", "modulo", "Criou o módulo {titulo}", None),
    ("PUT", r"/modulos/(\d+)", "alterou", "modulo", "Alterou o módulo #{id}", ModuloTrilha),
    ("DELETE", r"/modulos/(\d+)", "excluiu", "modulo", "Excluiu o módulo #{id}", ModuloTrilha),
    ("POST", r"/modulos/(\d+)/aulas", "incluiu", "aula", "Criou a aula {titulo}", None),
    ("PUT", r"/aulas/(\d+)", "alterou", "aula", "Alterou a aula #{id}", Aula),
    ("DELETE", r"/aulas/(\d+)", "excluiu", "aula", "Excluiu a aula #{id}", Aula),
    ("PUT", r"/aulas/(\d+)/perguntas", "alterou", "aula", "Alterou as perguntas de fixação da aula #{id}", None),
    ("POST", r"/aulas/(\d+)/materiais", "incluiu", "material", "Enviou material para a aula #{id}", None),
    ("DELETE", r"/materiais/(\d+)", "excluiu", "material", "Excluiu o material #{id}", MaterialAula),
    ("PUT", r"/estudantes/(\d+)/certificados/(\d+)", "alterou", "certificado", "Marcou a retirada do certificado de {aluno}", None),
    ("DELETE", r"/estudantes/(\d+)/certificados/(\d+)", "excluiu", "certificado", "Desfez a retirada do certificado de {aluno}", None),
    ("POST", r"/mensagens/diretos", "incluiu", "conversa", "Abriu conversa com aluno", None),
    ("POST", r"/mensagens/grupos", "incluiu", "grupo", "Criou o grupo {nome}", None),
    ("PUT", r"/mensagens/grupos/(\d+)", "alterou", "grupo", "Alterou o grupo #{id}", Canal),
    ("POST", r"/mensagens/canais/(\d+)/mensagens", "incluiu", "mensagem", "Enviou mensagem no canal #{id}", None),
    ("POST", r"/mensagens/(\d+)/ocultar", "alterou", "mensagem", "Ocultou a mensagem #{id}", None),
    ("POST", r"/estudantes/(\d+)/codigo-acesso", "incluiu", "codigo_acesso", "Gerou código de acesso para {aluno}", None),
    ("POST", r"/turmas/(\d+)/codigos-acesso", "incluiu", "codigo_acesso", "Gerou códigos de acesso da turma #{id}", Turma),
    ("POST", r"/pedidos-senha/(\d+)/aprovar", "alterou", "pedido_senha", "Aprovou o pedido de senha nova de {aluno_do_pedido}", PedidoNovaSenha),
    ("POST", r"/pedidos-senha/(\d+)/recusar", "alterou", "pedido_senha", "Recusou o pedido de senha nova de {aluno_do_pedido}", PedidoNovaSenha),
    ("POST", r"/gestao/usuarios", "incluiu", "usuario_gestao", "Criou a conta de {nome} ({papel})", None),
    ("PUT", r"/gestao/usuarios/(\d+)", "alterou", "usuario_gestao", "Alterou a conta da gestão #{id}", UsuarioGestao),
    ("POST", r"/gestao/usuarios/(\d+)/resetar-senha", "alterou", "usuario_gestao", "Gerou senha temporária para a conta #{id}", None),
    ("POST", r"/gestao/minha-senha", "alterou", "usuario_gestao", "Trocou a própria senha", None),
    ("POST", r"/auditoria/exportacao", "exportou", "exportacao", "Exportou {descricao}", None),
]
_ROTAS = [(m, re.compile(rf"^{p}$"), a, e, d, mod) for m, p, a, e, d, mod in ROTAS]


def identificar(metodo: str, caminho: str):
    """(ação, entidade, ids, modelo, modelo de descrição) da rota, ou um genérico."""
    resto = caminho[len(PREFIXO):] if caminho.startswith(PREFIXO) else caminho
    for m, padrao, acao, entidade, descricao, modelo in _ROTAS:
        achou = padrao.match(resto) if m == metodo else None
        if achou:
            return acao, entidade, achou.groups(), modelo, descricao
    generico = {"POST": "incluiu", "PUT": "alterou", "PATCH": "alterou", "DELETE": "excluiu"}.get(metodo, "alterou")
    return generico, None, (), None, f"{metodo} {resto}"


def limpar(valor, profundidade: int = 0):
    """Tira senhas, códigos, arquivos e textos enormes do que vai pro log."""
    if profundidade > 4:
        return "…"
    if isinstance(valor, dict):
        return {k: ("[omitido]" if CAMPOS_SENSIVEIS.search(str(k)) else limpar(v, profundidade + 1)) for k, v in list(valor.items())[:60]}
    if isinstance(valor, list):
        return [limpar(v, profundidade + 1) for v in valor[:60]]
    if isinstance(valor, str):
        return valor if len(valor) <= 500 else valor[:500] + "…"
    return valor


def _serializavel(valor):
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (str, int, float, bool)) or valor is None:
        return valor
    if isinstance(valor, (list, dict)):
        return limpar(json.loads(json.dumps(valor, default=str)))
    return str(valor)


def foto_do_registro(objeto) -> dict:
    """As colunas do registro (sem as sensíveis e sem binários) -- o "antes" da auditoria."""
    dados = {}
    for coluna in objeto.__table__.columns:
        if CAMPOS_SENSIVEIS.search(coluna.name) or coluna.type.__class__.__name__ == "LargeBinary":
            continue
        dados[coluna.name] = _serializavel(getattr(objeto, coluna.name, None))
    return dados


def _descrever(modelo_descricao: str, ids: tuple, dados: dict, nome_aluno: Optional[str], extra: Optional[dict] = None) -> str:
    valores = {k: v for k, v in (dados or {}).items() if isinstance(v, (str, int, float))}
    valores.update(extra or {})
    valores["id"] = ids[0] if ids else "?"
    valores["aluno"] = f"{nome_aluno} (#{ids[0]})" if nome_aluno else (f"aluno #{ids[0]}" if ids else "aluno")
    try:
        texto = modelo_descricao.format_map(_Padrao(valores))
    except (ValueError, IndexError):
        texto = modelo_descricao
    return texto[:255]


class _Padrao(dict):
    def __missing__(self, chave):
        return "—"


def purgar_antigos(db) -> int:
    """Remove o que passou do prazo de guarda (2 anos). Quem chama faz o commit."""
    limite = agora_utc() - timedelta(days=RETENCAO_DIAS)
    return db.query(RegistroAuditoria).filter(RegistroAuditoria.criado_em < limite).delete(synchronize_session=False)


# ------------------------------------------------------------------ gravação (fora da requisição)

def _foto_antes(modelo, ids: tuple) -> Optional[dict]:
    if not modelo or not ids:
        return None
    db = SessionLocal()
    try:
        objeto = db.get(modelo, int(ids[0]))
        return foto_do_registro(objeto) if objeto else None
    finally:
        db.close()


def gravar(registro: dict) -> None:
    """Grava um registro numa sessão própria (a da rota já foi fechada)."""
    db = SessionLocal()
    try:
        tentado = registro.pop("usuario_tentado", None)
        if not registro.get("escola_id") and tentado:
            # Login errado: se o usuário existe, o registro vai pra escola dele
            conta = db.query(UsuarioGestao).filter(UsuarioGestao.usuario == tentado.strip().lower()).first()
            registro["escola_id"] = conta.escola_id if conta else None
        extra = {}
        if registro.get("entidade") == "pedido_senha" and registro.get("ids"):
            # Pedido de senha: a descrição leva o nome do aluno, não o número do pedido
            pedido = db.get(PedidoNovaSenha, int(registro["ids"][0]))
            aluno_pedido = db.get(Estudante, pedido.estudante_id) if pedido else None
            extra["aluno_do_pedido"] = f"{aluno_pedido.nome} (pedido #{pedido.id})" if aluno_pedido else f"pedido #{registro['ids'][0]}"
        if registro.get("entidade_aluno_id"):
            aluno = db.get(Estudante, int(registro.pop("entidade_aluno_id")))
            registro["descricao"] = _descrever(registro.pop("modelo_descricao"), registro.pop("ids"), registro.get("dados") or {}, aluno.nome if aluno else None)
        else:
            registro.pop("entidade_aluno_id", None)
            registro["descricao"] = _descrever(registro.pop("modelo_descricao"), registro.pop("ids"), registro.get("dados") or {}, None, extra)
        db.add(RegistroAuditoria(**registro))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Falha ao gravar a auditoria: %s", registro.get("caminho"))
    finally:
        db.close()


def _ip(scope) -> Optional[str]:
    cabecalhos = dict(scope.get("headers") or [])
    encaminhado = cabecalhos.get(b"x-forwarded-for")
    if encaminhado:
        return encaminhado.decode("latin-1").split(",")[0].strip()[:45]
    cliente = scope.get("client")
    return cliente[0][:45] if cliente else None


class MiddlewareAuditoria:
    """ASGI puro: guarda o corpo da requisição e o status da resposta sem atrapalhar a rota."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith(PREFIXO) or scope["method"] not in METODOS_DE_ALTERACAO:
            return await self.app(scope, receive, send)

        metodo, caminho = scope["method"], scope["path"]
        acao, entidade, ids, modelo, modelo_descricao = identificar(metodo, caminho)
        eh_login = caminho == f"{PREFIXO}/login"
        antes = None
        if modelo and ids:  # alteração/exclusão de um registro conhecido: foto de como estava
            try:
                antes = await run_in_threadpool(_foto_antes, modelo, ids)
            except Exception:
                logger.exception("Falha ao ler o 'antes' da auditoria")

        corpo = bytearray()
        status_http = {"codigo": 500}

        async def receber():
            mensagem = await receive()
            if mensagem["type"] == "http.request" and len(corpo) < TAMANHO_MAXIMO_CORPO:
                corpo.extend(mensagem.get("body", b""))
            return mensagem

        async def enviar(mensagem):
            if mensagem["type"] == "http.response.start":
                status_http["codigo"] = mensagem["status"]
            await send(mensagem)

        try:
            await self.app(scope, receber, enviar)
        finally:
            try:
                dados = json.loads(bytes(corpo) or b"{}") if corpo else None
            except (ValueError, UnicodeDecodeError):
                dados = {"_corpo": "não é JSON (arquivo/formulário)"}
            gestor = (scope.get("state") or {}).get("gestor")
            codigo = status_http["codigo"]

            if eh_login:
                registro_acao = "entrou" if codigo < 400 else "falhou_login"
                nome = gestor.nome if gestor else f"(tentou como '{str((dados or {}).get('usuario', ''))[:40]}')"
                descricao = "Entrou no painel" if codigo < 400 else "Errou usuário ou senha do painel"
            elif gestor is None:
                registro_acao, nome, descricao = None, None, None  # sem login válido: a rota já recusou com 401
            elif codigo == 403:
                registro_acao, nome, descricao = "negado", gestor.nome, f"Tentou sem permissão: {metodo} {caminho[len(PREFIXO):]}"
            elif codigo < 400:
                registro_acao, nome, descricao = acao, gestor.nome, None
            else:
                registro_acao, nome, descricao = None, None, None  # erro de validação etc.: nada mudou

            if registro_acao:
                registro = {
                    "escola_id": getattr(gestor, "escola_id", None),
                    "usuario_tentado": None if gestor else str((dados or {}).get("usuario", ""))[:40],
                    "usuario_gestao_id": getattr(gestor, "id", None),
                    "usuario_nome": nome[:100],
                    "papel": getattr(gestor, "papel", None),
                    "acao": registro_acao,
                    "entidade": None if eh_login else entidade,
                    "entidade_id": ids[0] if ids else None,
                    "metodo": metodo,
                    "caminho": caminho[:255],
                    "status_http": codigo,
                    "dados": limpar(dados) if isinstance(dados, (dict, list)) else None,
                    "antes": antes if registro_acao in ("alterou", "excluiu") else None,
                    "ip": _ip(scope),
                    "ids": ids,
                    "modelo_descricao": descricao or modelo_descricao,
                    "entidade_aluno_id": ids[0] if ids and "{aluno}" in (descricao or modelo_descricao) else None,
                }
                try:
                    await run_in_threadpool(gravar, registro)
                except Exception:
                    logger.exception("Falha ao gravar a auditoria")
