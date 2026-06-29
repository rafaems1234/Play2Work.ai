# Play2Work.AI 🚀 
> **Desafio dos Dados Vivo 2026** – Inclusão Produtiva de Jovens com IA e Gamificação

O **Play2Work.AI** é um ecossistema tecnológico completo projetado para democratizar o acesso à orientação profissional e impulsionar a empregabilidade de jovens estudantes em busca do primeiro emprego e vagas de Jovem Aprendiz. 

Através de uma abordagem de **gamificação comportamental** (inspirada em mecânicas como Duolingo e RPGs de alta performance), a plataforma transforma a preparação para processos seletivos em uma jornada viciante. O sistema utiliza Inteligência Artificial de última geração integrada a bancos relacionais para analisar perfis, simular entrevistas realistas da Vivo e calcular a aderência técnica (*match*) de vagas em tempo real.

---

## ⚙️ Funcionalidades Core (MVP Implementado)

1. **Mural de Vagas com Match Inteligente:** Algoritmo matemático baseado em intersecção de conjuntos relacionais que cruza as competências do aluno com os requisitos das vagas, calculando o percentual exato de aderência.
2. **Validação de Dados Corporativos:** Integração assíncrona com APIs externas (BrasilAPI) para buscar e validar a Razão Social real das empresas parceiras a partir do CNPJ, garantindo um mural antifraude e verificado.
3. **Simulador de Entrevista Interativo com IA:** Chatbot síncrono que atua como o Recrutador Chefe da Vivo. A IA avalia as respostas do jovem, gera feedbacks construtivos e distribui XP de forma dinâmica (penalizando inputs aleatórios ou vazios com 0 XP para evitar abusos).
4. **Gerador Estrito de Currículo Profissional:** Transforma descrições informais de jovens em currículos estruturados utilizando IA Generativa com tipagem estrita de dados.
5. **Sistema de Retenção e Liga Dinâmica (Leaderboard):** Controle de ofensivas diárias (*streaks*), cálculo automático de categorias de status ("Na Jornada" até "CONTRATADO!") e ranking global em tempo real (Top 10).

---

## 🛠️ Arquitetura e Stack Tecnológica

O projeto foi construído seguindo rigorosos padrões de mercado de governança de dados, escalabilidade, segurança e separação de conceitos (*Clean Architecture*):

- **Front-end (Apresentação):** **React.js** – Interface SPA (*Single Page Application*) reativa, modular, com gerenciamento de estado otimizado, troca dinâmica de abas e uma estilização customizada focada na experiência do usuário (*UX/UI Gamer / Dark Mode*).
- **Back-end (Serviços/API):** **FastAPI (Python)** – Servidor ASGI de alta performance, assíncrono, robusto, com injeção de dependências nativa e validação de contratos de dados via **Pydantic**.
- **Banco de Dados (Persistência):** **PostgreSQL** – Banco de dados relacional robusto. Utiliza o tipo nativo `ARRAY(String)` para garantir a integridade e consultas de alta performance nas matrizes de habilidades de estudantes e vagas.
- **ORM:** **SQLAlchemy** – Mapeamento objeto-relacional com gerenciamento eficiente de sessões (*pooling* transacional), prevenção de *SQL Injection* e deleções em cascata seguras.
- **Inteligência Artificial:** **Google Gemini 2.5 Flash** – Integração nativa de última geração através da nova SDK oficial (`google-genai`). Utiliza engenharia de prompts avançada com `response_schema` e `response_mime_type="application/json"` para garantir o retorno de dados estruturados em JSON estrito, mitigando alucinações.
- **Qualidade de Código & Testes:** Suite de testes de integração automatizados desenvolvida com **FastAPI TestClient** e **Unittest Mock**, garantindo cobertura completa das rotas simulando o banco de dados em memória, sem custos de API ou poluição do banco de produção.

---

## 📂 Estrutura Arquitetural do Sistema

```text
Play2Work.ai/
├── app/                      # CORE DO BACK-END (FastAPI)
│   ├── database.py           # Configuração de engine, pooling do Postgres e SessionLocal
│   ├── models.py             # Modelagem relacional (Estudante, Vaga, HistoricoEntrevista, Curriculo)
│   ├── schemas.py            # Contratos Pydantic e Schemas JSON estritos p/ IA do Gemini
│   ├── services.py           # Core de Negócio, lógica de Gamificação e SDK do Gemini 2.5 Flash
│   ├── routes.py             # Endpoints REST, tratamento de CORS e barramentos corporativos
│   └── main.py               # Ponto de entrada da API, middlewares e inicialização do Uvicorn
├── test/                     # SUITE DE TESTES
│   └── test_main.py          # Testes unitários e de integração mockados (Garante CI/CD estável)
├── seed.py                   # Script automatizado de população/sincronização do PostgreSQL
├── requirements.txt          # Dependências do ecossistema Python (.venv)
│
└── frontend/                 # CORE DO FRONT-END (React.js)
    ├── src/
    │   ├── components/       # Componentes: JobMatchBoard, InterviewSimulator, ResumeBuilder, Leaderboard
    │   ├── App.jsx           # Hub central de estados, navegação e controle global de abas
    │   ├── index.css         # Variáveis de design token (:root), fontes e Reset CSS gamer
    │   └── main.jsx          # Ponto de inicialização do Virtual DOM do React