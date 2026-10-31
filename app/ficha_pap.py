import json
import os
import re
from datetime import date
from typing import Optional

from fastapi import HTTPException

# Ficha do PAP: os campos da planilha de controle da escola (aba "Jovens PAP").
# A lista de campos, rótulos e opções fica em frontend/src/data/ficha_pap.json
# -- o painel monta o formulário e a exportação pelo mesmo arquivo, e o modo
# demonstração valida igual. Aqui só se valida e converte.

CAMINHO = os.path.join(os.path.dirname(__file__), "frontend", "src", "data", "ficha_pap.json")
with open(CAMINHO, encoding="utf-8") as _arquivo:
    FICHA = json.load(_arquivo)

STATUS_APRENDIZ: dict[str, str] = FICHA["status_aprendiz"]   # chave interna -> rótulo da planilha
CAMPOS_ALUNO = [c["campo"] for c in FICHA["aluno"]]
CAMPOS_CONTRATO = [c["campo"] for c in FICHA["contrato"]]


def validar(secao: str, dados: dict, parcial: bool = False) -> dict:
    """
    Confere e converte os campos de uma seção ('aluno' ou 'contrato').
    Campo desconhecido é ignorado; vazio vira None. parcial=True não exige os
    obrigatórios (edição de só alguns campos).
    """
    limpos = {}
    for definicao in FICHA[secao]:
        campo, rotulo, tipo = definicao["campo"], definicao["rotulo"], definicao["tipo"]
        if campo not in dados:
            if definicao.get("obrigatorio") and not parcial:
                raise HTTPException(status_code=400, detail=f"Preencha: {rotulo}")
            continue
        valor = dados[campo]
        if isinstance(valor, str):
            valor = valor.strip()
        if valor in (None, ""):
            if definicao.get("obrigatorio"):
                raise HTTPException(status_code=400, detail=f"Preencha: {rotulo}")
            limpos[campo] = None
            continue
        if tipo == "opcao":
            if valor not in definicao["opcoes"]:
                raise HTTPException(status_code=400, detail=f"{rotulo}: opção inválida")
        elif tipo == "data":
            try:
                valor = date.fromisoformat(str(valor))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"{rotulo}: data inválida")
        elif tipo == "inteiro":
            try:
                valor = int(valor)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"{rotulo}: use um número inteiro")
            if not 0 <= valor <= definicao.get("max", 10_000):
                raise HTTPException(status_code=400, detail=f"{rotulo}: valor fora do permitido")
        elif tipo == "cnpj":
            valor = re.sub(r"\D", "", str(valor))
            if len(valor) != 14:
                raise HTTPException(status_code=400, detail=f"{rotulo}: precisa ter 14 dígitos")
        else:
            valor = str(valor)[: definicao.get("max", 255)]
        limpos[campo] = valor
    return limpos


def para_dict(objeto, secao: str) -> dict:
    """Campos de uma seção prontos pra JSON (datas em ISO)."""
    saida = {}
    for campo in (CAMPOS_ALUNO if secao == "aluno" else CAMPOS_CONTRATO):
        valor = getattr(objeto, campo, None)
        saida[campo] = valor.isoformat() if isinstance(valor, date) else valor
    return saida


def contrato_para_dict(contrato) -> Optional[dict]:
    if contrato is None:
        return None
    return {"id": contrato.id, "estudante_id": contrato.estudante_id, **para_dict(contrato, "contrato")}


def conferir_contrato(dados: dict) -> None:
    """Regras entre campos: datas em ordem e motivo quando o contrato é finalizado."""
    if dados.get("data_final") and dados.get("data_inicial") and dados["data_final"] < dados["data_inicial"]:
        raise HTTPException(status_code=400, detail="A data final não pode ser antes da data inicial.")
    if dados.get("aditivo_fim") and dados.get("aditivo_inicio") and dados["aditivo_fim"] < dados["aditivo_inicio"]:
        raise HTTPException(status_code=400, detail="O fim do aditivo não pode ser antes do início.")
    if dados.get("status") == "Finalizado" and not dados.get("motivo"):
        raise HTTPException(status_code=400, detail="Informe o motivo do encerramento do contrato.")
