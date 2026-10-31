import sys
import os
from datetime import date, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session

# Evita UnicodeEncodeError ao imprimir emojis no console padrão do Windows (cp1252)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Garante o mapeamento correto dos caminhos locais
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from database import SessionLocal, engine
from auth import hash_senha
import models
from nomes import escolher_nome_exibicao
from fuso import hoje as hoje_na_escola

# Senha de demonstração do estudante de teste (id=1). Só pra facilitar login
# local -- não use isso em produção.
SENHA_DEMO = "play2work123"
RESPOSTA_SEGURANCA_DEMO = "sozza"

# Login do aluno: a senha é o CPF. CPFs fictícios (só com os dígitos
# verificadores certos, pra passar na validação do cadastro).
CPF_DEMO = "52998224725"
NASCIMENTO_DEMO = date(2008, 3, 15)


def gerar_cpf_ficticio(base9: str) -> str:
    digitos = base9
    for tamanho in (9, 10):
        soma = sum(int(digitos[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digitos += str((soma * 10) % 11 % 10)
    return digitos

def popular_banco():
    # 1. Cria as tabelas se não existirem no PostgreSQL
    models.Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("🔄 Limpando registros antigos para evitar duplicidade...")
        db.query(models.QuizSessao).delete()
        db.query(models.Candidatura).delete()
        db.query(models.HistoricoEntrevista).delete()
        db.query(models.Curriculo).delete()
        db.query(models.Vaga).delete()
        db.query(models.Estudante).delete()
        db.query(models.Turma).delete()
        db.commit()

        print("🏫 Inserindo turmas...")
        turmas = [
            models.Turma(id=1, nome="2º A", turno="Manhã"),
            models.Turma(id=2, nome="3º A", turno="Manhã"),
            models.Turma(id=3, nome="3º B", turno="Tarde"),
        ]
        db.add_all(turmas)
        db.flush()

        ontem = hoje_na_escola() - timedelta(days=1)

        habilidades_estudante = ["Python", "SQL", "React", "Análise de Dados", "Lógica de Programação"]

        print("👤 Inserindo estudante de teste...")
        estudante_teste = models.Estudante(
            id=1,
            nome="Rafael Sozza",
            nome_exibicao="Rafael S.",
            cpf=CPF_DEMO,
            data_nascimento=NASCIMENTO_DEMO,
            email="rafael@escola.com",
            linkedin="https://linkedin.com/in/rafael-sozza",
            senha_hash=hash_senha(SENHA_DEMO),
            pergunta_seguranca="Qual o seu sobrenome?",
            resposta_seguranca_hash=hash_senha(RESPOSTA_SEGURANCA_DEMO),
            nivel_gamificacao=1,
            xp_total=120,
            xp_semanal=120,
            semana_referencia=hoje_na_escola() - timedelta(days=hoje_na_escola().weekday()),
            categoria_status="🌌 Na Jornada",
            liga="Bronze",
            ofensiva_dias=4,
            ultimo_treino=ontem,
            missoes_diarias_concluidas=2,
            habilidades=habilidades_estudante,
            itinerario="Ciência de Dados",
            turma_id=2,
        )
        db.add(estudante_teste)

        print("👥 Inserindo colegas de turma (todos os itinerários)...")
        # (nome, turma, itinerário, xp, ofensiva, habilidades, taxa de acerto no quiz em %)
        colegas = [
            ("Bianca Ferreira", 2, "Ciência de Dados", 640, 18, ["Python", "SQL", "Análise de Dados", "Comunicação"], 90),
            ("Lucas Andrade", 3, "Ciência de Dados", 210, 3, ["JavaScript", "React", "CSS"], 60),
            ("Júlia Martins", 2, "Mecatrônica", 480, 12, ["Arduino", "Lógica de Programação", "Trabalho em Equipe"], 80),
            ("Gabriel Souza", 1, "Mecatrônica", 150, 1, ["Arduino", "Matemática"], 50),
            ("Ana Clara Lima", 2, "Serviços Jurídicos", 560, 21, ["Comunicação", "Organização", "Redação", "LGPD"], 90),
            ("Matheus Rocha", 3, "Serviços Jurídicos", 320, 6, ["Redação", "Atendimento"], 70),
            ("Beatriz Nunes", 3, "Recursos Humanos", 590, 15, ["Comunicação", "Organização", "Pacote Office", "Atendimento"], 80),
            ("Isabela Duarte", 1, "Recursos Humanos", 260, 4, ["Comunicação", "Trabalho em Equipe"], 70),
            ("Guilherme Pires", 1, "Administração", 410, 9, ["Pacote Office", "Organização", "Matemática"], 80),
            ("Mariana Costa", 3, "Inteligência Artificial", 180, 2, ["Python", "Organização"], 60),
            # Outro Rafael com sobrenome em S: vira "Rafael Si." no ranking, não um segundo "Rafael S."
            ("Rafael Silva", 1, "Ciência de Dados", 300, 5, ["Python", "Excel"], 70),
        ]
        inicio_semana = hoje_na_escola() - timedelta(days=hoje_na_escola().weekday())
        nomes_usados = {"rafael s."}
        for idx, (nome, turma_id, itinerario, xp, ofensiva, habilidades, taxa) in enumerate(colegas, start=2):
            nome_exibicao = escolher_nome_exibicao(nome, nomes_usados)
            nomes_usados.add(nome_exibicao.lower())
            email = nome.lower().replace(" ", ".").replace("ú", "u").replace("á", "a") + "@escola.com"
            db.add(models.Estudante(
                id=idx, nome=nome, nome_exibicao=nome_exibicao, email=email, turma_id=turma_id, itinerario=itinerario,
                cpf=gerar_cpf_ficticio(f"{idx}{idx}{idx}{idx + 3}{idx + 5}{idx}{idx}{idx}{idx}"[-9:].rjust(9, "1")),
                data_nascimento=date(2007 + idx % 2, 1 + idx % 12, 1 + idx * 2),
                xp_total=xp, xp_semanal=xp // 3, semana_referencia=inicio_semana,
                nivel_gamificacao=1 + xp // 300, ofensiva_dias=ofensiva, ultimo_treino=ontem,
                habilidades=habilidades, liga="Bronze",
            ))
            # 1 quiz concluído de 10 perguntas com a taxa de acerto do aluno,
            # pra a nota de desempenho do painel da escola ter dado real
            acertos = taxa // 10
            db.add(models.QuizSessao(
                estudante_id=idx, tema="Quiz de demonstração", concluido=True,
                gabarito=[{"resposta_correta_index": 0, "explicacao": ""}] * 10,
                respostas=[{"pulou": False, "correta": i < acertos} for i in range(10)],
            ))
        db.flush()

        print("💼 Inserindo vagas (cobrindo os 5 itinerários)...")
        vagas = [
            models.Vaga(
                id=1,
                titulo_vaga="Jovem Aprendiz - Ciência de Dados",
                empresa="Vivo Telefônica",
                cnpj_empresa="02558157000162",
                localizacao="São Paulo - SP",
                tipo_modalidade="Híbrido",
                habilidades_exigidas=["Python", "SQL", "Análise de Dados"],
                area_itinerario="Ciência de Dados",
                descricao_completa=(
                    "Você vai apoiar o time de dados da Vivo em análises de churn e "
                    "consumo, aprendendo Python, SQL e visualização de dados na prática. "
                    "Ideal pra quem está no itinerário de Ciência de Dados "
                    "e quer o primeiro contato real com um time de analytics."
                ),
                link_inscricao="https://vagas.vivo.com.br",
            ),
            models.Vaga(
                id=2,
                titulo_vaga="Desenvolvedor Front-end Júnior",
                empresa="TechSoluções",
                cnpj_empresa="42541295000100",
                localizacao="Remoto",
                tipo_modalidade="Remoto",
                habilidades_exigidas=["React", "JavaScript", "CSS"],
                area_itinerario="Ciência de Dados",
                descricao_completa=(
                    "Squad pequeno construindo produtos web com React. Você vai revisar "
                    "PRs de verdade, aprender componentização e boas práticas de front-end "
                    "com mentoria semanal de um dev sênior."
                ),
                link_inscricao="https://techsolucoes.com/carreiras",
            ),
            models.Vaga(
                id=3,
                titulo_vaga="Assistente de TI",
                empresa="Suzano Papel e Celulose",
                cnpj_empresa="16404287000116",
                localizacao="Três Lagoas - MS",
                tipo_modalidade="Presencial",
                habilidades_exigidas=["Lógica de Programação", "SQL"],
                area_itinerario="Ciência de Dados",
                descricao_completa=(
                    "Suporte ao time de infraestrutura de TI da unidade fabril: "
                    "manutenção de estações de trabalho, apoio em chamados e primeiros "
                    "passos em automação de rotinas com scripts simples."
                ),
                link_inscricao="https://suzano.gupy.io",
            ),
            models.Vaga(
                id=4,
                titulo_vaga="Jovem Aprendiz - Automação e Robótica",
                empresa="Bosch Manufatura",
                cnpj_empresa="45241757000135",
                localizacao="Campinas - SP",
                tipo_modalidade="Presencial",
                habilidades_exigidas=["Lógica de Programação", "Arduino", "Trabalho em Equipe"],
                area_itinerario="Mecatrônica",
                descricao_completa=(
                    "Você vai acompanhar a equipe de automação industrial em projetos "
                    "de prototipagem com Arduino e sensores, entendendo como uma linha "
                    "de produção real funciona por dentro."
                ),
                link_inscricao="https://carreiras.bosch.com.br",
            ),
            models.Vaga(
                id=5,
                titulo_vaga="Estagiário de Departamento Jurídico",
                empresa="Machado Advogados Associados",
                cnpj_empresa="11222333000144",
                localizacao="São Paulo - SP",
                tipo_modalidade="Híbrido",
                habilidades_exigidas=["Comunicação", "Organização", "Redação"],
                area_itinerario="Serviços Jurídicos",
                descricao_completa=(
                    "Apoio em rotinas administrativas de um escritório de Direito "
                    "Digital e LGPD: organização de processos, elaboração de peças "
                    "simples sob supervisão e atendimento a clientes."
                ),
                link_inscricao="https://machadoadvogados.com.br/carreiras",
            ),
            models.Vaga(
                id=6,
                titulo_vaga="Jovem Aprendiz - Auxiliar Administrativo",
                empresa="Prefeitura Municipal (parceira)",
                cnpj_empresa=None,
                localizacao="Três Lagoas - MS",
                tipo_modalidade="Presencial",
                habilidades_exigidas=["Pacote Office", "Organização", "Atendimento"],
                area_itinerario="Administração",
                descricao_completa=(
                    "Apoio no protocolo e no arquivo de documentos, atendimento ao "
                    "público, controle de planilhas e rotinas de compras e almoxarifado."
                ),
                link_inscricao=None,
            ),
            models.Vaga(
                id=7,
                titulo_vaga="Jovem Aprendiz - Assistente Jurídico",
                empresa="Defensoria Parceira (Programa Jovem Cidadão)",
                localizacao="Três Lagoas - MS",
                tipo_modalidade="Presencial",
                habilidades_exigidas=["Redação", "Organização", "Atendimento", "LGPD"],
                area_itinerario="Serviços Jurídicos",
                descricao_completa=(
                    "Apoio no atendimento ao público, triagem e digitalização de "
                    "documentos, controle de prazos e organização de processos, sempre "
                    "com sigilo e supervisão de um servidor."
                ),
            ),
            models.Vaga(
                id=8,
                titulo_vaga="Jovem Aprendiz - Recursos Humanos",
                empresa="Suzano Papel e Celulose",
                cnpj_empresa="16404287000116",
                localizacao="Três Lagoas - MS",
                tipo_modalidade="Presencial",
                habilidades_exigidas=["Comunicação", "Organização", "Pacote Office", "Atendimento"],
                area_itinerario="Recursos Humanos",
                descricao_completa=(
                    "Você vai apoiar o time de RH em recrutamento e seleção (triagem de "
                    "currículos, agendamento de entrevistas), integração de novos "
                    "colaboradores e rotinas de departamento pessoal."
                ),
                link_inscricao="https://suzano.gupy.io",
            ),
            models.Vaga(
                id=9,
                titulo_vaga="Auxiliar de Departamento Pessoal (Aprendiz)",
                empresa="Contabilidade Horizonte",
                localizacao="Campo Grande - MS",
                tipo_modalidade="Híbrido",
                habilidades_exigidas=["Organização", "Pacote Office", "Comunicação"],
                area_itinerario="Recursos Humanos",
                descricao_completa=(
                    "Apoio em admissões, conferência de folha de ponto, organização de "
                    "documentos de funcionários e atendimento a dúvidas sobre férias e benefícios."
                ),
            ),
            models.Vaga(
                id=10,
                titulo_vaga="Jovem Aprendiz - Inteligência Artificial",
                empresa="TechSoluções",
                cnpj_empresa="42541295000100",
                localizacao="Remoto",
                tipo_modalidade="Remoto",
                habilidades_exigidas=["Python", "Lógica de Programação", "Análise de Dados"],
                area_itinerario="Inteligência Artificial",
                descricao_completa=(
                    "Apoio ao time que treina modelos de IA: organização e limpeza de dados, "
                    "testes de chatbots e documentação dos resultados."
                ),
            ),
        ]

        db.add_all(vagas)
        db.commit()

        # Os registros acima usam ids fixos; sem isso, o primeiro aluno/vaga/
        # turma cadastrado pelo painel da escola tentaria reusar o id 1.
        for tabela in ("turmas", "estudantes", "vagas"):
            db.execute(text(f"SELECT setval(pg_get_serial_sequence('{tabela}', 'id'), (SELECT MAX(id) FROM {tabela}))"))
        db.commit()
        print(f"🚀 Banco de dados populado com sucesso! Senha do aluno demo (CPF): {CPF_DEMO}")

    except Exception as e:
        db.rollback()
        print(f"❌ Erro crítico ao popular o banco: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    popular_banco()
