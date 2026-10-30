from typing import Optional
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from models import Estudante, EvidenciaCompetencia, MapaCompetencia
from fuso import agora_utc

# Mapa de competências do aluno, nos eixos das 10 competências gerais da
# Educação Básica da BNCC (MEC). É a lista oficial e fixa que dá pra citar na
# prestação de contas; as competências do Programa de Aprendizagem variam por
# curso/ocupação, então se o PAP tiver uma lista própria ela entra aqui como
# eixos novos (código novo = linha nova; nada no banco precisa mudar).
#
# Cada atividade concluída registra "evidências" (0-100) nos eixos que ela
# trabalhou; a pontuação do eixo é uma média móvel dessas evidências.
COMPETENCIAS = [
    {"codigo": "conhecimento", "nome": "Conhecimento", "bncc": 1,
     "descricao": "Usar os conhecimentos construídos pra entender a realidade e continuar aprendendo."},
    {"codigo": "pensamento_critico", "nome": "Pensamento crítico e criativo", "bncc": 2,
     "descricao": "Investigar, refletir, analisar criticamente e criar soluções."},
    {"codigo": "repertorio_cultural", "nome": "Repertório cultural", "bncc": 3,
     "descricao": "Valorizar e fruir as diversas manifestações artísticas e culturais."},
    {"codigo": "comunicacao", "nome": "Comunicação", "bncc": 4,
     "descricao": "Se expressar com clareza, nas linguagens verbal, escrita, digital e outras."},
    {"codigo": "cultura_digital", "nome": "Cultura digital", "bncc": 5,
     "descricao": "Usar tecnologias digitais de forma crítica, ética e responsável."},
    {"codigo": "trabalho_projeto_vida", "nome": "Trabalho e projeto de vida", "bncc": 6,
     "descricao": "Entender o mundo do trabalho e fazer escolhas alinhadas ao seu projeto de vida."},
    {"codigo": "argumentacao", "nome": "Argumentação", "bncc": 7,
     "descricao": "Argumentar com base em fatos e defender ideias com respeito."},
    {"codigo": "autoconhecimento", "nome": "Autoconhecimento e autocuidado", "bncc": 8,
     "descricao": "Conhecer a si mesmo, reconhecer suas emoções e lidar com elas."},
    {"codigo": "empatia_cooperacao", "nome": "Empatia e cooperação", "bncc": 9,
     "descricao": "Dialogar, resolver conflitos e trabalhar em equipe com respeito ao outro."},
    {"codigo": "responsabilidade", "nome": "Responsabilidade e cidadania", "bncc": 10,
     "descricao": "Agir com autonomia, responsabilidade, ética e compromisso."},
]
CODIGOS_COMPETENCIAS = [c["codigo"] for c in COMPETENCIAS]

# Média móvel: cada evidência nova pesa 30% na pontuação do eixo -- as
# recentes contam mais, então o mapa acompanha a evolução do aluno.
PESO_EVIDENCIA_NOVA = 0.3

# Pra indicação a vagas, cada eixo é puxado pra 50 ("ainda não sabemos")
# como se tivesse 3 evidências medianas a mais. Sem isso, um aluno com uma
# única resposta boa teria 100 e passaria na frente de quem treinou o mês todo.
PONTUACAO_NEUTRA = 50
EVIDENCIAS_NEUTRAS = 3


def _limitar(pontos) -> int:
    return max(0, min(100, int(round(pontos))))


def registrar_evidencias(db: Session, estudante_id: int, pontos_por_competencia: dict[str, float], origem: str, origem_id: Optional[int] = None) -> None:
    """
    Grava as evidências de uma atividade e atualiza o mapa. O upsert faz a
    conta da média móvel dentro do próprio Postgres (ON CONFLICT ... SET
    pontuacao = antiga*0.7 + nova*0.3), então duas atividades terminando ao
    mesmo tempo não se sobrescrevem. Quem chama faz o commit.
    """
    agora = agora_utc()
    for codigo, pontos in pontos_por_competencia.items():
        if codigo not in CODIGOS_COMPETENCIAS:
            raise ValueError(f"Competência desconhecida: {codigo}")
        pontos = _limitar(pontos)
        db.add(EvidenciaCompetencia(estudante_id=estudante_id, competencia=codigo, pontos=pontos, origem=origem, origem_id=origem_id))
        comando = pg_insert(MapaCompetencia).values(
            estudante_id=estudante_id, competencia=codigo, pontuacao=float(pontos), total_evidencias=1, atualizado_em=agora,
        )
        db.execute(comando.on_conflict_do_update(
            index_elements=[MapaCompetencia.estudante_id, MapaCompetencia.competencia],
            set_={
                "pontuacao": MapaCompetencia.pontuacao * (1 - PESO_EVIDENCIA_NOVA) + comando.excluded.pontuacao * PESO_EVIDENCIA_NOVA,
                "total_evidencias": MapaCompetencia.total_evidencias + 1,
                "atualizado_em": agora,
            },
        ))


def mapas_de_varios(db: Session, estudante_ids: list[int]) -> dict[int, dict[str, tuple[float, int]]]:
    """{estudante_id: {codigo: (pontuacao, total_evidencias)}} numa consulta só."""
    mapas = {eid: {} for eid in estudante_ids}
    if estudante_ids:
        linhas = db.query(MapaCompetencia.estudante_id, MapaCompetencia.competencia, MapaCompetencia.pontuacao, MapaCompetencia.total_evidencias).filter(
            MapaCompetencia.estudante_id.in_(estudante_ids),
        ).all()
        for estudante_id, codigo, pontuacao, total in linhas:
            mapas[estudante_id][codigo] = (pontuacao, total)
    return mapas


def nota_de_competencias(mapa: dict[str, tuple[float, int]]) -> float:
    """
    Fração 0-1 que entra na nota de indicação: média dos 10 eixos, cada um
    puxado pra 50 conforme tem poucas evidências (ver EVIDENCIAS_NEUTRAS).
    Eixo sem nenhuma evidência conta como 50 -- não pune nem premia o que a
    plataforma ainda não mediu.
    """
    soma = 0.0
    for codigo in CODIGOS_COMPETENCIAS:
        pontuacao, total = mapa.get(codigo, (PONTUACAO_NEUTRA, 0))
        soma += (pontuacao * total + PONTUACAO_NEUTRA * EVIDENCIAS_NEUTRAS) / (total + EVIDENCIAS_NEUTRAS)
    return soma / len(CODIGOS_COMPETENCIAS) / 100


def media_da_turma(db: Session, turma_id: Optional[int]) -> dict[str, float]:
    """Pontuação média de cada eixo entre os alunos da turma (ou da escola toda, sem turma)."""
    consulta = db.query(MapaCompetencia.competencia, func.avg(MapaCompetencia.pontuacao)).join(
        Estudante, Estudante.id == MapaCompetencia.estudante_id,
    )
    if turma_id is not None:
        consulta = consulta.filter(Estudante.turma_id == turma_id)
    return {codigo: round(media) for codigo, media in consulta.group_by(MapaCompetencia.competencia).all()}


def mapa_para_tela(db: Session, estudante: Estudante) -> dict:
    """Os 10 eixos na ordem da BNCC, com a pontuação do aluno e a média da turma."""
    mapa = mapas_de_varios(db, [estudante.id])[estudante.id]
    turma = media_da_turma(db, estudante.turma_id)
    eixos = []
    for comp in COMPETENCIAS:
        pontuacao, total = mapa.get(comp["codigo"], (None, 0))
        eixos.append({
            **comp,
            "pontuacao": round(pontuacao) if pontuacao is not None else None,
            "total_evidencias": total,
            "media_turma": turma.get(comp["codigo"]),
        })
    return {"eixos": eixos, "referencia_media": "turma" if estudante.turma_id else "escola"}
