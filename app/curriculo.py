import json
import os
import re
from datetime import date
from typing import Callable, Optional

from entrevista import REGRAS as REGRAS_ENTREVISTA, CONTA, CPF, TELEFONE, normalizar, _palavras, _tem_expressao
from fuso import hoje

# Gerador de currículo. O modelo da folha é fixo (FolhaCurriculo.jsx) e o
# cabeçalho -- nome completo, idade, nascimento, contato, turma e itinerário --
# vem do cadastro que a escola fez, nunca da IA. A IA só escreve objetivo,
# experiências e competências, e só a partir do que o aluno contou:
#   1. triagem local: texto curto, sem sentido, com palavrão, pedido fora do
#      tema ou dados pessoais nem chega na IA -- não gera currículo;
#   2. a IA também pode recusar (texto_valido = false);
#   3. o que a IA devolver passa por ancorar(): experiência ou habilidade sem
#      base no texto do aluno (ou nas habilidades cadastradas) é descartada.
# Vocabulário em frontend/src/data/curriculo.json (o modo demo usa o mesmo).

CAMINHO_REGRAS = os.path.join(os.path.dirname(__file__), "frontend", "src", "data", "curriculo.json")
with open(CAMINHO_REGRAS, encoding="utf-8") as _arquivo:
    REGRAS = json.load(_arquivo)

MAXIMOS = REGRAS["maximos"]
PALAVRAS_VAZIAS = set(REGRAS["palavras_vazias"])


class TextoRecusado(ValueError):
    """O texto do aluno não serve pra montar um currículo; a mensagem diz o que escrever."""


def idade(nascimento: Optional[date]) -> Optional[int]:
    if not nascimento:
        return None
    dia = hoje()
    return dia.year - nascimento.year - ((dia.month, dia.day) < (nascimento.month, nascimento.day))


def dados_do_sistema(estudante) -> dict:
    """Cabeçalho e formação da folha: o que a escola cadastrou (o aluno não digita, a IA não toca)."""
    return {
        "nome": estudante.nome,
        "idade": idade(estudante.data_nascimento),
        "data_nascimento": estudante.data_nascimento.isoformat() if estudante.data_nascimento else None,
        "email": estudante.email,
        "telefone": estudante.telefone,
        "linkedin": estudante.linkedin,
        "turma": estudante.turma.nome if getattr(estudante, "turma", None) else None,
        "itinerario": estudante.itinerario,
    }


def triagem(texto: str) -> Optional[str]:
    """Motivo de recusa (chave de REGRAS['recusas']) ou None se o texto pode virar currículo."""
    normalizado = normalizar(texto)
    palavras = _palavras(normalizado)
    if _tem_expressao(normalizado, REGRAS_ENTREVISTA["palavras_inadequadas"]):
        return "inadequado"
    if CPF.search(normalizado) or TELEFONE.search(normalizado) or "minha senha" in normalizado:
        return "dados_pessoais"
    if CONTA.search(normalizado) or _tem_expressao(normalizado, REGRAS_ENTREVISTA["pedidos_fora_do_tema"]):
        return "fora_do_tema"
    letras = re.sub(r"[^a-z]", "", normalizado)
    if not letras:
        return "sem_sentido"
    vogais = sum(letras.count(v) for v in "aeiou")
    # Texto "de verdade" tem vogais e poucas palavras repetidas ("bla bla bla bla")
    if vogais / len(letras) < 0.25 or re.search(r"([a-z])\1{3,}", letras) or (len(palavras) >= 6 and len(set(palavras)) / len(palavras) < 0.4):
        return "sem_sentido"
    if len(palavras) < REGRAS["palavras_minimas"]:
        return "curto"
    return None


def _raizes(texto: str) -> set[str]:
    """Palavras significativas reduzidas aos 5 primeiros caracteres ('organizei' ~ 'organizar')."""
    return {p[:5] for p in _palavras(normalizar(texto)) if len(p) >= 4 and p not in PALAVRAS_VAZIAS}


def _limpar_lista(itens, maximo: int) -> list[str]:
    vistos, resultado = set(), []
    for item in itens or []:
        if not isinstance(item, str):
            continue
        item = re.sub(r"\s+", " ", item).strip(" -•·\t")[:160]
        chave = normalizar(item)
        if item and chave not in vistos:
            vistos.add(chave)
            resultado.append(item)
    return resultado[:maximo]


def ancorar(cv: dict, texto: str, habilidades_cadastradas: list[str]) -> dict:
    """Tira do que a IA escreveu tudo que não tem base no texto do aluno (sem invenção)."""
    base = _raizes(texto)
    base_hab = base | _raizes(" ".join(habilidades_cadastradas or []))
    numeros_do_texto = set(re.findall(r"\d+", texto))

    def tem_base(item: str, raizes: set[str], minimo: float) -> bool:
        do_item = _raizes(item)
        return bool(do_item) and len(do_item & raizes) >= max(1, minimo * len(do_item))

    experiencias = [
        e for e in _limpar_lista(cv.get("experiencias"), MAXIMOS["experiencias"])
        # Pelo menos 30% das palavras vêm do texto, e nenhum número (ano, nota, quantidade) inventado
        if tem_base(e, base, 0.3) and set(re.findall(r"\d+", e)) <= numeros_do_texto
    ]
    hard_skills = [h for h in _limpar_lista(cv.get("hard_skills"), MAXIMOS["hard_skills"]) if tem_base(h, base_hab, 0.5)]
    return {
        "objetivo_profissional": (cv.get("objetivo_profissional") or "").strip()[:600],
        "experiencias": experiencias,
        "hard_skills": hard_skills,
        # Competência comportamental é inferida do que ele contou ("fiz com meus colegas" = trabalho em equipe)
        "soft_skills": _limpar_lista(cv.get("soft_skills"), MAXIMOS["soft_skills"]),
        "sugestao_areas_atuacao": _limpar_lista(cv.get("sugestao_areas_atuacao"), MAXIMOS["areas"]),
    }


def montar_sem_ia(texto: str, estudante) -> dict:
    """
    Currículo de reserva (sem IA ou se ela falhar): frases do próprio texto que
    descrevem algo que o aluno fez, habilidades reconhecidas no texto + as
    cadastradas pela escola, e o objetivo pelo itinerário.
    """
    normalizado = normalizar(texto)
    frases = re.split(r"[.;\n!?]+|,\s+(?=(?:e\s+)?(?:fiz|faco|faço|participo|participei|ajudo|ajudei|organizo|trabalho|criei|desenvolvi))", texto)
    experiencias = [
        f.strip()[0].upper() + f.strip()[1:]
        for f in frases
        if len(f.strip()) > 8 and any(re.search(rf"\b{v}", normalizar(f)) for v in REGRAS["verbos_experiencia"])
    ]
    do_texto = [h for h in REGRAS["habilidades_conhecidas"] if re.search(rf"\b{re.escape(normalizar(h))}\b", normalizado)]
    soft = [nome for raizes, nome in REGRAS["soft_por_palavra"] if any(re.search(rf"\b{r}", normalizado) for r in raizes)]
    area = estudante.itinerario
    return {
        "objetivo_profissional": (
            f"Estudante do Ensino Médio em busca da primeira oportunidade como Jovem Aprendiz{f' na área de {area}' if area else ''}, "
            "com vontade de aplicar na prática o que venho aprendendo e de crescer junto com a equipe."
        ),
        "experiencias": _limpar_lista(experiencias, MAXIMOS["experiencias"]),
        "hard_skills": _limpar_lista(do_texto + list(estudante.habilidades or []), MAXIMOS["hard_skills"]),
        "soft_skills": _limpar_lista(soft, MAXIMOS["soft_skills"]),
        "sugestao_areas_atuacao": [f"Jovem Aprendiz em {area}"] if area else ["Jovem Aprendiz"],
    }


def gerar(texto: str, estudante, gerar_com_ia: Callable[[str], Optional[dict]]) -> dict:
    """
    Conteúdo do currículo (sem o cabeçalho, que vem de dados_do_sistema).
    Levanta TextoRecusado se o texto não serve. gerar_com_ia(texto) -> dict da IA ou None.
    """
    motivo = triagem(texto)
    if motivo:
        raise TextoRecusado(REGRAS["recusas"][motivo])
    da_ia = gerar_com_ia(texto)
    if da_ia is not None:
        situacao = da_ia.get("situacao", "valido")
        if situacao != "valido":
            raise TextoRecusado(REGRAS["recusas"].get(situacao, REGRAS["recusas"]["fora_do_tema"]))
        cv = ancorar(da_ia, texto, list(estudante.habilidades or []))
        if cv["objetivo_profissional"]:
            # As habilidades que a escola cadastrou também entram (a IA pode não ter citado)
            cv["hard_skills"] = _limpar_lista(cv["hard_skills"] + list(estudante.habilidades or []), MAXIMOS["hard_skills"])
            return cv
    return montar_sem_ia(texto, estudante)
