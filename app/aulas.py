import random
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse, parse_qs
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import Estudante, ModuloTrilha, Aula, ProgressoAula, LogFrequencia, RetiradaCertificado
from competencias import registrar_evidencias
from fuso import agora_utc

# Trilha EAD: regras de frequência e conclusão das aulas.
#
# Frequência: o player (ou, numa aula só de texto/áudio, o relógio da página
# enquanto ela está visível) manda de tempos em tempos o trecho do conteúdo
# que acabou de passar -- [de_segundo, ate_segundo]. O servidor marca blocos
# de 10 s como assistidos. Duas travas contra "pular a aula":
#   1. Adiantar o vídeo não marca nada: só conta o trecho que foi reproduzido.
#   2. Um trecho não pode ser maior que o tempo que passou de verdade desde o
#      último registro (em velocidade normal, 1x) -- senão um cliente
#      adulterado mandaria "assisti 0 a 3600" num registro só, e assistir
#      acelerado também não conta.
# No player, o aluno só pode voltar pra rever; avançar, só até o ponto mais
# longe que já assistiu sem pular (pode_avancar_ate_segundo) -- "como ao vivo".

BLOCO_SEGUNDOS = 10
VELOCIDADE_MAXIMA = 1.0       # integração: sem acelerar o vídeo
FOLGA_SEGUNDOS = 15           # atraso de rede entre um registro e outro
MARCO_LOG_PERCENTUAL = 10     # grava no log de frequência a cada 10% novos
# XP só quando a aula é CONCLUÍDA (frequência mínima + fixação): assistir
# vale 20 e a fixação 25, pagos juntos -- quem assiste um pedaço e sai não ganha.
XP_ASSISTIR_AULA = 20
XP_FIXACAO_AULA = 25
XP_POR_AULA = XP_ASSISTIR_AULA + XP_FIXACAO_AULA
XP_MODULO_CONCLUIDO = 50      # bônus ao concluir todas as aulas do módulo

PADROES_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def extrair_video(link: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Link do YouTube (watch, youtu.be, embed, shorts) ou do Vimeo -> (provedor, id).
    Só o ID é guardado: o front monta o player, e ninguém consegue cadastrar
    um iframe de um site qualquer.
    """
    if not link or not link.strip():
        return None, None
    url = urlparse(link.strip() if "://" in link else f"https://{link.strip()}")
    host = (url.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    partes = [p for p in url.path.split("/") if p]
    candidato = None
    if host in ("youtube.com", "youtube-nocookie.com"):
        if url.path == "/watch":
            candidato = parse_qs(url.query).get("v", [None])[0]
        elif len(partes) >= 2 and partes[0] in ("embed", "shorts", "live", "v"):
            candidato = partes[1]
        if candidato and PADROES_YOUTUBE_ID.match(candidato):
            return "youtube", candidato
    elif host == "youtu.be" and partes:
        if PADROES_YOUTUBE_ID.match(partes[0]):
            return "youtube", partes[0]
    elif host in ("vimeo.com", "player.vimeo.com"):
        numeros = [p for p in partes if p.isdigit()]
        if numeros:
            return "vimeo", numeros[0]
    raise HTTPException(status_code=400, detail="Link de vídeo não reconhecido. Use um link do YouTube (pode ser não listado) ou do Vimeo.")


def total_blocos(aula: Aula) -> int:
    return max(1, -(-aula.duracao_segundos // BLOCO_SEGUNDOS))  # arredonda pra cima


def _registrar_log(db: Session, estudante_id: int, aula: Aula, evento: str, percentual: int, nota: Optional[int] = None) -> None:
    db.add(LogFrequencia(
        estudante_id=estudante_id, aula_id=aula.id, evento=evento, percentual_assistido=percentual,
        nota=nota, nota_de_corte=aula.nota_minima if nota is not None else None,
    ))


def buscar_ou_iniciar_progresso(db: Session, estudante: Estudante, aula: Aula) -> ProgressoAula:
    progresso = db.query(ProgressoAula).filter(ProgressoAula.estudante_id == estudante.id, ProgressoAula.aula_id == aula.id).first()
    if progresso is None:
        progresso = ProgressoAula(
            estudante_id=estudante.id, aula_id=aula.id, blocos_assistidos="0" * total_blocos(aula),
            percentual_assistido=0, tentativas_fixacao=0, ultimo_registro_em=agora_utc(),
        )
        db.add(progresso)
        _registrar_log(db, estudante.id, aula, "inicio", 0)
    return progresso


def registrar_trecho(db: Session, estudante: Estudante, aula: Aula, progresso: ProgressoAula, de_segundo: float, ate_segundo: float, agora: Optional[datetime] = None) -> dict:
    """Marca os blocos do trecho assistido e devolve o progresso atualizado. Quem chama faz o commit."""
    agora = agora or agora_utc()
    de_segundo = max(0.0, float(de_segundo))
    ate_segundo = min(float(aula.duracao_segundos), float(ate_segundo))
    if ate_segundo <= de_segundo:
        raise HTTPException(status_code=400, detail="Trecho inválido.")

    referencia = progresso.ultimo_registro_em or agora
    tempo_real = max(0.0, (agora - referencia).total_seconds())
    permitido = tempo_real * VELOCIDADE_MAXIMA + FOLGA_SEGUNDOS
    if ate_segundo - de_segundo > permitido:
        # Não é erro do aluno (pode ser o celular que dormiu): só não conta além do possível
        ate_segundo = de_segundo + permitido

    blocos = list(progresso.blocos_assistidos or "0" * total_blocos(aula))
    if len(blocos) != total_blocos(aula):  # a escola mudou a duração da aula depois
        blocos = (blocos + ["0"] * total_blocos(aula))[:total_blocos(aula)]
    # Bloco conta se o trecho cobriu pelo menos metade dele
    for indice in range(len(blocos)):
        inicio, fim = indice * BLOCO_SEGUNDOS, min((indice + 1) * BLOCO_SEGUNDOS, aula.duracao_segundos)
        coberto = min(fim, ate_segundo) - max(inicio, de_segundo)
        if coberto >= (fim - inicio) / 2:
            blocos[indice] = "1"

    percentual_antes = progresso.percentual_assistido or 0
    progresso.blocos_assistidos = "".join(blocos)
    progresso.percentual_assistido = round(blocos.count("1") / len(blocos) * 100)
    progresso.ultimo_registro_em = agora
    if progresso.percentual_assistido // MARCO_LOG_PERCENTUAL > percentual_antes // MARCO_LOG_PERCENTUAL:
        _registrar_log(db, estudante.id, aula, "progresso", progresso.percentual_assistido)

    return estado_do_progresso(aula, progresso)


def ponto_mais_longe_sem_pular(aula: Aula, progresso: Optional[ProgressoAula]) -> int:
    """
    Até onde o aluno já assistiu de forma contínua desde o início, em
    segundos -- o player não deixa avançar além disso (voltar pode sempre).
    """
    blocos = (progresso.blocos_assistidos if progresso else "") or ""
    continuos = len(blocos) - len(blocos.lstrip("1"))
    return min(aula.duracao_segundos, continuos * BLOCO_SEGUNDOS)


def estado_do_progresso(aula: Aula, progresso: Optional[ProgressoAula]) -> dict:
    percentual = progresso.percentual_assistido if progresso else 0
    return {
        "percentual_assistido": percentual,
        "pode_avancar_ate_segundo": ponto_mais_longe_sem_pular(aula, progresso),
        "percentual_minimo": aula.percentual_minimo_assistido,
        "pode_fazer_fixacao": percentual >= aula.percentual_minimo_assistido and bool(aula.perguntas),
        "melhor_nota_fixacao": progresso.melhor_nota_fixacao if progresso else None,
        "tentativas_fixacao": progresso.tentativas_fixacao if progresso else 0,
        "nota_minima": aula.nota_minima,
        "concluida_em": progresso.concluida_em.isoformat() if progresso and progresso.concluida_em else None,
    }


def sortear_fixacao(aula: Aula, progresso: ProgressoAula) -> list[dict]:
    """
    Abre uma tentativa: sorteia a ordem das perguntas e, dentro de cada uma,
    a das alternativas -- quem reprovou não decora "é a segunda". O sorteio
    fica guardado no progresso (o servidor corrige pela alternativa original)
    e só muda na próxima tentativa; reabrir a atividade mostra a mesma ordem.
    Devolve as perguntas sem gabarito. Quem chama faz o commit.
    """
    por_id = {p.id: p for p in aula.perguntas}
    sorteio = progresso.embaralhamento_fixacao
    if not sorteio or {item["pergunta_id"] for item in sorteio} != set(por_id):
        perguntas = list(aula.perguntas)
        random.shuffle(perguntas)
        sorteio = [{"pergunta_id": p.id, "opcoes": random.sample(range(len(p.opcoes)), len(p.opcoes))} for p in perguntas]
        progresso.embaralhamento_fixacao = sorteio
    return [
        {"id": item["pergunta_id"], "enunciado": por_id[item["pergunta_id"]].enunciado,
         "opcoes": [por_id[item["pergunta_id"]].opcoes[i] for i in item["opcoes"]]}
        for item in sorteio
    ]


def corrigir_fixacao(db: Session, estudante: Estudante, aula: Aula, progresso: ProgressoAula, respostas: list[Optional[int]]) -> dict:
    """
    Corrige a fixação, grava a tentativa no log e conclui a aula se o aluno
    atingiu a frequência mínima E a nota de corte. Reprovado vê quais errou,
    mas não a resposta certa -- senão a segunda tentativa vira cópia.
    Quem chama processa a gamificação (xp_concedido) e faz o commit.
    """
    if progresso.percentual_assistido < aula.percentual_minimo_assistido:
        raise HTTPException(status_code=403, detail=f"Assista pelo menos {aula.percentual_minimo_assistido}% da aula antes da atividade.")
    if not aula.perguntas:
        raise HTTPException(status_code=400, detail="Esta aula não tem atividade de fixação.")
    sorteio = progresso.embaralhamento_fixacao
    por_id = {p.id: p for p in aula.perguntas}
    if not sorteio or {item["pergunta_id"] for item in sorteio} != set(por_id):
        raise HTTPException(status_code=409, detail="A atividade mudou. Abra de novo pra responder.")
    if len(respostas) != len(sorteio):
        raise HTTPException(status_code=400, detail="Responda todas as perguntas.")

    # As respostas vêm na ordem sorteada; traduz pra alternativa original de cada pergunta
    perguntas = [por_id[item["pergunta_id"]] for item in sorteio]
    acertos_por_pergunta = [
        resposta is not None and 0 <= resposta < len(item["opcoes"]) and item["opcoes"][resposta] == p.resposta_correta_index
        for resposta, item, p in zip(respostas, sorteio, perguntas)
    ]
    nota = round(sum(acertos_por_pergunta) / len(perguntas) * 100)
    aprovado = nota >= aula.nota_minima

    progresso.tentativas_fixacao = (progresso.tentativas_fixacao or 0) + 1
    progresso.embaralhamento_fixacao = None  # a próxima tentativa sorteia de novo
    progresso.melhor_nota_fixacao = max(progresso.melhor_nota_fixacao or 0, nota)
    _registrar_log(db, estudante.id, aula, "fixacao", progresso.percentual_assistido, nota)

    concluiu_agora = aprovado and progresso.concluida_em is None
    if concluiu_agora:
        progresso.concluida_em = agora_utc()
        _registrar_log(db, estudante.id, aula, "conclusao", progresso.percentual_assistido, nota)
        registrar_evidencias(db, estudante.id, {"conhecimento": nota}, origem="aula", origem_id=aula.id)

    return {
        "nota": nota,
        "nota_minima": aula.nota_minima,
        "aprovado": aprovado,
        "concluiu_agora": concluiu_agora,
        "xp_concedido": XP_POR_AULA if concluiu_agora else 0,
        "correcao": [
            {
                "pergunta_id": p.id,
                "acertou": acertou,
                # Aprovado vê a certa -- na posição em que ela apareceu pra ele
                **({"resposta_correta_index": item["opcoes"].index(p.resposta_correta_index), "explicacao": p.explicacao} if aprovado else {}),
            }
            for p, item, acertou in zip(perguntas, sorteio, acertos_por_pergunta)
        ],
        **estado_do_progresso(aula, progresso),
    }


def certificados_dos_alunos(db: Session, alunos: list[Estudante], com_observacao: bool = True) -> dict[int, list[dict]]:
    """
    Certificado de conclusão de cada aluno: um por módulo publicado (do
    itinerário dele ou comum a todos) em que ele concluiu todas as aulas
    publicadas. O documento é entregue em mãos na escola -- 'retirado_em'
    nulo = concluiu e ainda não buscou. Quem já retirou continua na lista
    mesmo se depois a escola publicar uma aula nova no módulo.
    """
    resultado: dict[int, list[dict]] = {a.id: [] for a in alunos}
    if not alunos:
        return resultado
    ids = [a.id for a in alunos]
    modulos = db.query(ModuloTrilha).filter(ModuloTrilha.publicado.is_(True)).order_by(ModuloTrilha.ordem, ModuloTrilha.id).all()
    aulas_por_modulo = {m.id: [a.id for a in m.aulas if a.publicada] for m in modulos}
    todas_as_aulas = [aula_id for aula_ids in aulas_por_modulo.values() for aula_id in aula_ids]
    conclusoes = {
        (estudante_id, aula_id): concluida_em
        for estudante_id, aula_id, concluida_em in db.query(ProgressoAula.estudante_id, ProgressoAula.aula_id, ProgressoAula.concluida_em).filter(
            ProgressoAula.estudante_id.in_(ids), ProgressoAula.aula_id.in_(todas_as_aulas or [0]), ProgressoAula.concluida_em.isnot(None),
        ).all()
    }
    retiradas = {(r.estudante_id, r.modulo_id): r for r in db.query(RetiradaCertificado).filter(RetiradaCertificado.estudante_id.in_(ids)).all()}

    for aluno in alunos:
        for modulo in modulos:
            aula_ids = aulas_por_modulo[modulo.id]
            datas = [conclusoes.get((aluno.id, aula_id)) for aula_id in aula_ids]
            concluiu = bool(aula_ids) and modulo.itinerario in (None, aluno.itinerario) and all(datas)
            retirada = retiradas.get((aluno.id, modulo.id))
            if not concluiu and not retirada:
                continue
            item = {
                "modulo_id": modulo.id,
                "modulo": modulo.titulo,
                "concluido_em": max(datas).isoformat() if concluiu else None,
                "retirado_em": retirada.retirado_em.isoformat() if retirada else None,
            }
            if com_observacao:
                item["observacao"] = retirada.observacao if retirada else None
            resultado[aluno.id].append(item)
    return resultado
