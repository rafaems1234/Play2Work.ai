import sys
import os
from datetime import date, timedelta
from sqlalchemy.orm import Session

# Garante o mapeamento correto dos caminhos locais
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from database import SessionLocal, engine
import models

def popular_banco():
    # 1. Cria as tabelas se não existirem no PostgreSQL
    models.Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("🔄 Limpando registros antigos para evitar duplicidade...")
        db.query(models.HistoricoEntrevista).delete()
        db.query(models.Curriculo).delete()
        db.query(models.Vaga).delete()
        db.query(models.Estudante).delete()
        db.commit()

        ontem = date.today() - timedelta(days=1)
        
        # 🌟 CORRIGIDO: Voltando a ser uma lista real (Array do Python) compatível com o PostgreSQL ARRAY
        habilidades_estudante = ["Python", "SQL", "React", "Análise de Dados", "Lógica de Programação"]

        print("👤 Inserindo estudante de teste...")
        estudante_teste = models.Estudante(
            id=1,                                
            nome="Gabriel",
            email="gabriel@escola.com",
            nivel_gamificacao=1,
            # 🌟 CORRIGIDO: Alterado de 'pontos' para 'xp_total'
            xp_total=120,                        
            xp_semanal=120,                      
            categoria_status="🌌 Na Jornada",   
            ofensiva_dias=4,                     
            ultimo_treino=ontem,                 
            missoes_diarias_concluidas=2,        
            habilidades=habilidades_estudante    # Enviando como lista estruturada
        )
        db.add(estudante_teste)

        print("💼 Inserindo vagas de tecnologia...")
        vaga_1 = models.Vaga(
            id=1,
            titulo_vaga="Jovem Aprendiz - Ciência de Dados",
            empresa="Vivo Telefônica",
            cnpj_empresa="02558157000162",    
            localizacao="São Paulo - SP",
            tipo_modalidade="Híbrido",
            habilidades_exigidas=["Python", "SQL", "Análise de Dados"], # 🌟 CORRIGIDO: Lista
            link_inscricao="https://vagas.vivo.com.br"
        )

        vaga_2 = models.Vaga(
            id=2,
            titulo_vaga="Desenvolvedor Front-end Junior",
            empresa="TechSoluções",
            cnpj_empresa="42541295000100",    
            localizacao="Remoto",
            tipo_modalidade="Remoto",
            habilidades_exigidas=["React", "JavaScript", "CSS"], # 🌟 CORRIGIDO: Lista
            link_inscricao="https://techsolucoes.com/carreiras"
        )

        vaga_3 = models.Vaga(
            id=3,
            titulo_vaga="Assistente de TI",
            empresa="Suzano Papel e Celulose",
            cnpj_empresa="16404287000116",    
            localizacao="Três Lagoas - MS",
            tipo_modalidade="Presencial",
            habilidades_exigidas=["Lógica de Programação", "SQL"], # 🌟 CORRIGIDO: Lista
            link_inscricao="https://suzano.gupy.io"
        )

        db.add_all([vaga_1, vaga_2, vaga_3])
        db.commit()
        print("🚀 Banco de dados populado com sucesso para o PostgreSQL!")

    except Exception as e:
        db.rollback()
        print(f"❌ Erro crítico ao popular o banco: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    popular_banco()