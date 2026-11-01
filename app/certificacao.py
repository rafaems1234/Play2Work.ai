"""
Simulado de Certificação: a "prova de fogo" do curso.

- 20 questões sorteadas do banco da escola (o mesmo dos quizzes diários):
  16 do curso do aluno e 4 gerais, com as alternativas embaralhadas.
- Tentativa única por ciclo: começou, conta (fechar a aba não dá outra
  chance). Tempo limite de 40 min; o que ficar sem resposta conta como erro.
- Nota >= 70%: aprovado. A certificação fica no perfil e aparece no painel
  da escola. Abaixo disso, a tentativa fica só no histórico e o aluno pode
  tentar de novo depois de 7 dias, estudando nos quizzes diários.
- O gabarito nunca sai do servidor, nem no fim: a prova mostra só a nota,
  pra o banco de questões não ser colhido.
- Saídas da tela durante a prova (trocar de aba, minimizar) ficam registradas
  pra escola ver. Não reprovam sozinhas: é um indício, não uma prova.
"""
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from fuso import FUSO_ESCOLA
from models import Estudante, TentativaCertificacao
from services import BANCO_QUESTOES, _embaralhar_opcoes, _sortear_do_grupo

TOTAL_QUESTOES = 20
QUESTOES_GERAIS = 4
NOTA_MINIMA = 70           # % de acerto pra aprovar
DURACAO_MINUTOS = 40
DIAS_ENTRE_TENTATIVAS = 7  # o "ciclo" depois de uma reprovação


class CertificacaoBloqueada(Exception):
    def __init__(self, mensagem: str, status_code: int = 409):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status_code = status_code


def sortear_prova(itinerario: str, rng: Optional[random.Random] = None) -> list[dict]:
    rng = rng or random.Random()
    da_area = BANCO_QUESTOES.get(itinerario, [])
    escolhidas = _sortear_do_grupo(da_area, TOTAL_QUESTOES - QUESTOES_GERAIS, set(), rng)
    escolhidas += _sortear_do_grupo(BANCO_QUESTOES["Geral"], TOTAL_QUESTOES - len(escolhidas), set(), rng)
    rng.shuffle(escolhidas)
    return [_embaralhar_opcoes(p, rng) for p in escolhidas]


def tentativas_do_aluno(db: Session, estudante_id: int) -> list[TentativaCertificacao]:
    return db.query(TentativaCertificacao).filter(TentativaCertificacao.estudante_id == estudante_id).order_by(TentativaCertificacao.id.desc()).all()


def aprovacao(tentativas: list[TentativaCertificacao], itinerario: Optional[str]) -> Optional[TentativaCertificacao]:
    """A aprovação vale pro curso em que foi feita (se a escola trocar o curso, é outra certificação)."""
    return next((t for t in tentativas if t.status == "aprovada" and t.itinerario == itinerario), None)


def proxima_tentativa_em(tentativas: list[TentativaCertificacao], itinerario: Optional[str]) -> Optional[datetime]:
    reprovadas = [t for t in tentativas if t.status == "reprovada" and t.itinerario == itinerario]
    if not reprovadas:
        return None
    return max(t.concluida_em or t.iniciada_em for t in reprovadas) + timedelta(days=DIAS_ENTRE_TENTATIVAS)


def finalizar(tentativa: TentativaCertificacao, agora: datetime) -> None:
    """Corrige pelo que o servidor registrou. Sem resposta = erro. Não faz commit."""
    acertos = sum(1 for r in tentativa.respostas or [] if r.get("correta"))
    total = len(tentativa.gabarito or []) or TOTAL_QUESTOES
    tentativa.acertos = acertos
    tentativa.total = total
    tentativa.percentual = round(acertos / total * 100)
    tentativa.status = "aprovada" if tentativa.percentual >= NOTA_MINIMA else "reprovada"
    tentativa.concluida_em = min(agora, tentativa.expira_em) if tentativa.expira_em else agora


def fechar_se_venceu(tentativa: Optional[TentativaCertificacao], agora: datetime) -> bool:
    """Prova aberta que passou do tempo (aba fechada, sem internet) é corrigida como está."""
    if tentativa and tentativa.status == "em_andamento" and tentativa.expira_em and agora >= tentativa.expira_em:
        finalizar(tentativa, agora)
        return True
    return False


def iniciar(db: Session, estudante: Estudante, agora: datetime) -> TentativaCertificacao:
    if not estudante.itinerario or estudante.itinerario not in BANCO_QUESTOES:
        raise CertificacaoBloqueada("A escola ainda não definiu o seu curso. Fale com a coordenação.")
    tentativas = tentativas_do_aluno(db, estudante.id)
    for t in tentativas:
        fechar_se_venceu(t, agora)
    if any(t.status == "em_andamento" for t in tentativas):
        raise CertificacaoBloqueada("Você já tem um simulado em andamento.")
    if aprovacao(tentativas, estudante.itinerario):
        raise CertificacaoBloqueada("Você já foi aprovado no simulado de certificação deste curso.")
    proxima = proxima_tentativa_em(tentativas, estudante.itinerario)
    if proxima and agora < proxima:
        local = proxima.replace(tzinfo=timezone.utc).astimezone(FUSO_ESCOLA)
        raise CertificacaoBloqueada(f"Nova tentativa liberada em {local.strftime('%d/%m às %H:%M')}. Até lá, treine nos quizzes diários.")
    tentativa = TentativaCertificacao(
        estudante_id=estudante.id, itinerario=estudante.itinerario, status="em_andamento",
        iniciada_em=agora, expira_em=agora + timedelta(minutes=DURACAO_MINUTOS),
        gabarito=sortear_prova(estudante.itinerario), respostas=[], saidas_de_tela=0,
    )
    db.add(tentativa)
    return tentativa


def responder(tentativa: TentativaCertificacao, indice: int, opcao: int, agora: datetime) -> None:
    """Uma questão por vez, na ordem, sem voltar e sem dizer se acertou."""
    if tentativa.status != "em_andamento":
        raise CertificacaoBloqueada("Esse simulado já foi encerrado.")
    if fechar_se_venceu(tentativa, agora):
        raise CertificacaoBloqueada("O tempo do simulado acabou.")
    respostas = list(tentativa.respostas or [])
    if indice != len(respostas) or indice >= len(tentativa.gabarito):
        raise CertificacaoBloqueada("Responda as questões na ordem.", 400)
    questao = tentativa.gabarito[indice]
    if not 0 <= opcao < len(questao["opcoes"]):
        raise CertificacaoBloqueada("Alternativa inválida.", 400)
    respostas.append({"indice": indice, "opcao": opcao, "correta": opcao == questao["resposta_correta_index"]})
    tentativa.respostas = respostas  # lista nova: o SQLAlchemy só percebe a mudança do JSON assim


def prova_para_tela(tentativa: TentativaCertificacao) -> dict:
    """Questões sem o gabarito."""
    return {
        "id": tentativa.id,
        "questoes": [{"pergunta": q["pergunta"], "opcoes": q["opcoes"]} for q in tentativa.gabarito],
        "respondidas": len(tentativa.respostas or []),
        "expira_em": tentativa.expira_em.isoformat() if tentativa.expira_em else None,
    }


def resultado(tentativa: TentativaCertificacao) -> dict:
    return {
        "id": tentativa.id,
        "itinerario": tentativa.itinerario,
        "status": tentativa.status,
        "acertos": tentativa.acertos,
        "total": tentativa.total,
        "percentual": tentativa.percentual,
        "iniciada_em": tentativa.iniciada_em.isoformat() if tentativa.iniciada_em else None,
        "concluida_em": tentativa.concluida_em.isoformat() if tentativa.concluida_em else None,
        "saidas_de_tela": tentativa.saidas_de_tela or 0,
    }
