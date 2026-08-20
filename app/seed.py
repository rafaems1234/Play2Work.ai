import sys
import os
from datetime import date, timedelta
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

# Senha de demonstração do estudante de teste (id=1). Só pra facilitar login
# local -- não use isso em produção.
SENHA_DEMO = "play2work123"

def popular_banco():
    # 1. Cria as tabelas se não existirem no PostgreSQL
    models.Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("🔄 Limpando registros antigos para evitar duplicidade...")
        db.query(models.Candidatura).delete()
        db.query(models.HistoricoEntrevista).delete()
        db.query(models.Curriculo).delete()
        db.query(models.Vaga).delete()
        db.query(models.Estudante).delete()
        db.commit()

        ontem = date.today() - timedelta(days=1)

        habilidades_estudante = ["Python", "SQL", "React", "Análise de Dados", "Lógica de Programação"]

        print("👤 Inserindo estudante de teste...")
        estudante_teste = models.Estudante(
            id=1,
            nome="Gabriel Sozza",
            email="gabriel@escola.com",
            linkedin="https://linkedin.com/in/gabriel-sozza",
            senha_hash=hash_senha(SENHA_DEMO),
            nivel_gamificacao=1,
            xp_total=120,
            xp_semanal=120,
            semana_referencia=date.today() - timedelta(days=date.today().weekday()),
            categoria_status="🌌 Na Jornada",
            ofensiva_dias=4,
            ultimo_treino=ontem,
            missoes_diarias_concluidas=2,
            habilidades=habilidades_estudante,
        )
        db.add(estudante_teste)

        print("💼 Inserindo vagas (cobrindo os 4 itinerários)...")
        vagas = [
            models.Vaga(
                id=1,
                titulo_vaga="Jovem Aprendiz - Ciência de Dados",
                empresa="Vivo Telefônica",
                cnpj_empresa="02558157000162",
                localizacao="São Paulo - SP",
                tipo_modalidade="Híbrido",
                habilidades_exigidas=["Python", "SQL", "Análise de Dados"],
                area_itinerario="Tecnologia e Ciência de Dados",
                descricao_completa=(
                    "Você vai apoiar o time de dados da Vivo em análises de churn e "
                    "consumo, aprendendo Python, SQL e visualização de dados na prática. "
                    "Ideal pra quem está no itinerário de Tecnologia e Ciência de Dados "
                    "e quer o primeiro contato real com um time de analytics."
                ),
                link_inscricao="https://vagas.vivo.com.br",
            ),
            models.Vaga(
                id=2,
                titulo_vaga="Desenvolvedor Front-end Junior",
                empresa="TechSoluções",
                cnpj_empresa="42541295000100",
                localizacao="Remoto",
                tipo_modalidade="Remoto",
                habilidades_exigidas=["React", "JavaScript", "CSS"],
                area_itinerario="Tecnologia e Ciência de Dados",
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
                area_itinerario="Tecnologia e Ciência de Dados",
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
                area_itinerario="Robótica e Automação",
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
                area_itinerario="Ciências Jurídicas / Serviços Jurídicos",
                descricao_completa=(
                    "Apoio em rotinas administrativas de um escritório de Direito "
                    "Digital e LGPD: organização de processos, elaboração de peças "
                    "simples sob supervisão e atendimento a clientes."
                ),
                link_inscricao="https://machadoadvogados.com.br/carreiras",
            ),
            models.Vaga(
                id=6,
                titulo_vaga="Jovem Aprendiz - Laboratório de Análises",
                empresa="Instituto Butantan",
                cnpj_empresa="60979457000186",
                localizacao="São Paulo - SP",
                tipo_modalidade="Presencial",
                habilidades_exigidas=["Biologia", "Química", "Organização"],
                area_itinerario="Ciências da Natureza e Matemática",
                descricao_completa=(
                    "Apoio em rotinas de laboratório sob supervisão de pesquisadores: "
                    "preparo de amostras, registro de dados experimentais e noções "
                    "básicas de biossegurança. Ótimo pra quem mira vestibular na área "
                    "de ciências biológicas ou exatas."
                ),
                link_inscricao="https://butantan.gov.br/trabalhe-conosco",
            ),
        ]

        db.add_all(vagas)
        db.commit()
        print(f"🚀 Banco de dados populado com sucesso! (login demo: 'Gabriel Sozza' / {SENHA_DEMO})")

    except Exception as e:
        db.rollback()
        print(f"❌ Erro crítico ao popular o banco: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    popular_banco()
