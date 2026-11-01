"""
Rotas do Simulado de Certificação (regras em certificacao.py):

  GET  /certificacao                         situação do aluno (aprovado, prova aberta, próxima tentativa)
  POST /certificacao/iniciar                 começa a prova (conta como tentativa)
  POST /certificacao/{id}/responder          uma questão, na ordem, sem dizer se acertou
  POST /certificacao/{id}/saida-de-tela      registra que o aluno saiu da tela durante a prova
  POST /certificacao/{id}/finalizar          corrige e devolve só a nota
  GET  /admin/estudantes/{id}/certificacao   tentativas do aluno, pra ficha da escola
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import certificacao
from auth import get_admin_atual, get_estudante_atual
from certificacao import CertificacaoBloqueada
from competencias import registrar_evidencias
from database import get_db
from fuso import agora_utc
from models import Estudante, TentativaCertificacao

router_aluno = APIRouter(tags=["Play2Work.AI - Simulado de certificação"])
router_admin = APIRouter(prefix="/admin", tags=["Play2Work.AI - Painel da Escola"], dependencies=[Depends(get_admin_atual)])


class RespostaRequest(BaseModel):
    indice: int
    opcao: int


REGRAS = {
    "total_questoes": certificacao.TOTAL_QUESTOES,
    "nota_minima": certificacao.NOTA_MINIMA,
    "duracao_minutos": certificacao.DURACAO_MINUTOS,
    "dias_entre_tentativas": certificacao.DIAS_ENTRE_TENTATIVAS,
}


def _erro(e: CertificacaoBloqueada) -> HTTPException:
    return HTTPException(status_code=e.status_code, detail=e.mensagem)


def _tentativa_do_aluno(db: Session, tentativa_id: int, estudante: Estudante) -> TentativaCertificacao:
    tentativa = db.query(TentativaCertificacao).filter(
        TentativaCertificacao.id == tentativa_id, TentativaCertificacao.estudante_id == estudante.id,
    ).with_for_update().first()
    if not tentativa:
        raise HTTPException(status_code=404, detail="Simulado não encontrado.")
    return tentativa


def _registrar_aprovacao(db: Session, tentativa: TentativaCertificacao) -> None:
    if tentativa.status == "aprovada":
        registrar_evidencias(db, tentativa.estudante_id, {"conhecimento": tentativa.percentual}, origem="certificacao", origem_id=tentativa.id)


@router_aluno.get("/certificacao")
def situacao(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    agora = agora_utc()
    tentativas = certificacao.tentativas_do_aluno(db, estudante.id)
    for t in tentativas:
        if certificacao.fechar_se_venceu(t, agora):
            _registrar_aprovacao(db, t)
    db.commit()
    aprovada = certificacao.aprovacao(tentativas, estudante.itinerario)
    aberta = next((t for t in tentativas if t.status == "em_andamento"), None)
    proxima = certificacao.proxima_tentativa_em(tentativas, estudante.itinerario)
    liberada = bool(estudante.itinerario) and not aprovada and not aberta and not (proxima and agora < proxima)
    return {
        "regras": REGRAS,
        "itinerario": estudante.itinerario,
        "aprovacao": certificacao.resultado(aprovada) if aprovada else None,
        "em_andamento": certificacao.prova_para_tela(aberta) if aberta else None,
        "ultima": certificacao.resultado(tentativas[0]) if tentativas and tentativas[0].status != "em_andamento" else None,
        "proxima_tentativa_em": proxima.isoformat() if proxima and agora < proxima else None,
        "pode_comecar": liberada,
    }


@router_aluno.post("/certificacao/iniciar", status_code=201)
def iniciar(estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    try:
        tentativa = certificacao.iniciar(db, estudante, agora_utc())
    except CertificacaoBloqueada as e:
        db.commit()  # guarda provas vencidas que foram corrigidas no caminho
        raise _erro(e)
    db.commit()
    db.refresh(tentativa)
    return certificacao.prova_para_tela(tentativa)


@router_aluno.post("/certificacao/{tentativa_id}/responder")
def responder(tentativa_id: int, data: RespostaRequest, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    tentativa = _tentativa_do_aluno(db, tentativa_id, estudante)
    try:
        certificacao.responder(tentativa, data.indice, data.opcao, agora_utc())
    except CertificacaoBloqueada as e:
        db.commit()
        raise _erro(e)
    db.commit()
    return {"respondidas": len(tentativa.respostas), "total": len(tentativa.gabarito)}


@router_aluno.post("/certificacao/{tentativa_id}/saida-de-tela")
def saida_de_tela(tentativa_id: int, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    tentativa = _tentativa_do_aluno(db, tentativa_id, estudante)
    if tentativa.status == "em_andamento":
        tentativa.saidas_de_tela = (tentativa.saidas_de_tela or 0) + 1
        db.commit()
    return {"saidas_de_tela": tentativa.saidas_de_tela}


@router_aluno.post("/certificacao/{tentativa_id}/finalizar")
def finalizar(tentativa_id: int, estudante: Estudante = Depends(get_estudante_atual), db: Session = Depends(get_db)):
    """Corrige o que o servidor registrou (o que faltou responder conta como erro) e devolve só a nota."""
    tentativa = _tentativa_do_aluno(db, tentativa_id, estudante)
    if tentativa.status == "em_andamento":
        certificacao.finalizar(tentativa, agora_utc())
        _registrar_aprovacao(db, tentativa)
        db.commit()
    return {**certificacao.resultado(tentativa), "nota_minima": certificacao.NOTA_MINIMA, "dias_entre_tentativas": certificacao.DIAS_ENTRE_TENTATIVAS}


@router_admin.get("/estudantes/{estudante_id}/certificacao")
def tentativas_do_aluno(estudante_id: int, db: Session = Depends(get_db)):
    return [certificacao.resultado(t) for t in certificacao.tentativas_do_aluno(db, estudante_id)]
