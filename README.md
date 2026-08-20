# Play2Work.AI 🚀 
> **Desafio dos Dados Vivo 2026** – Inclusão Produtiva de Jovens com IA e Gamificação

O **Play2Work.AI** é um ecossistema tecnológico completo projetado para democratizar o acesso à orientação profissional e impulsionar a empregabilidade de jovens estudantes em busca do primeiro emprego e vagas de Jovem Aprendiz.

Através de uma abordagem de **gamificação comportamental** (inspirada em mecânicas como Duolingo e RPGs de alta performance), a plataforma transforma a preparação para processos seletivos em uma jornada viciante. O sistema utiliza Inteligência Artificial de última geração integrada a bancos relacionais para analisar perfis, simular entrevistas realistas da Vivo, escolher um itinerário formativo e calcular a aderência técnica (*match*) de vagas em tempo real — tudo isso atrás de autenticação real, com cada estudante dono da própria conta e do próprio progresso.

---

## ⚙️ Funcionalidades Core

1. **Autenticação real (login/registro/reset de senha).** Conta protegida por senha com hash `bcrypt` e sessão via **JWT**. O login é feito por **nome de exibição** (ex: "Gabriel Sozza"), não por e-mail — e-mail e LinkedIn só são pedidos no cadastro. Como o nome não é único (pode existir mais de um "João Silva"), o login testa a senha contra todas as contas com aquele nome até achar a que bate. Sem servidor de e-mail configurado, o "Resetar senha" gera uma **senha temporária exibida na própria tela**, que o estudante troca no primeiro acesso seguinte (tela obrigatória de "Definir nova senha" antes de liberar o app).
2. **Itinerários formativos (like Duolingo/idiomas).** O estudante escolhe **um** dos 4 itinerários oficiais do desafio (Tecnologia e Ciência de Dados, Robótica e Automação, Ciências Jurídicas, Ciências da Natureza e Matemática) numa aba própria de navegação. O itinerário atual fica sempre visível ao lado do ícone de ofensiva no cabeçalho, e both o **Quiz do Dia** e o **Simulador de Entrevista com IA** giram em torno do curso escolhido.
3. **Mural de Vagas com Match Inteligente + candidatura real.** Algoritmo que cruza as competências do aluno com os requisitos das vagas, calculando o percentual de aderência e dando um boost extra para vagas que combinam com o itinerário escolhido (essas vagas sobem para o topo do mural e ganham um selo "combina com seu curso"). Clicar num card abre um painel de detalhes no estilo LinkedIn (descrição completa, habilidades exigidas, localização) com botão de **Aplicar**, que persiste a candidatura no banco (idempotente — não duplica se o estudante aplicar de novo) e fica consultável em "Minhas candidaturas".
4. **Validação de Dados Corporativos.** Integração assíncrona (via `httpx.AsyncClient`, com as consultas rodando em paralelo) com APIs externas (BrasilAPI) para buscar e validar a Razão Social real das empresas parceiras a partir do CNPJ, garantindo um mural antifraude e verificado sem bloquear o event loop da API.
5. **Simulador de Entrevista Interativo com IA.** Chatbot síncrono que atua como o Recrutador Chefe da Vivo, com perguntas contextualizadas pelo itinerário escolhido pelo estudante. A IA avalia as respostas, gera feedbacks construtivos e distribui XP de forma dinâmica (penalizando inputs aleatórios ou vazios com 0 XP para evitar abusos).
6. **Quiz do Dia com mecânicas de jogo.** Quiz de 10 perguntas geradas por IA sobre o itinerário escolhido, com botão de **dica** (elimina uma alternativa errada) e **pular** (avança sem gastar vida), cada um limitado a 2 usos por quiz, cronômetro ao vivo, contador de combo/streak de acertos e botão de voltar direto pro mural.
7. **Sistema de vidas, moedas e congelamento de ofensiva.** O estudante tem até 5 vidas, perde uma a cada erro no quiz, e regenera 1 vida a cada 2h (ou compra com moedas). Acertar o quiz perfeitamente 5 vezes seguidas dá uma vida bônus automática. A cada 7 dias de ofensiva contínua, o estudante ganha 1 congelamento, consumido automaticamente se ele perder um único dia (protegendo a sequência). Um calendário mensal (botão ao lado do ícone de ofensiva) mostra dias feitos, congelados e perdidos.
8. **Gerador Estrito de Currículo Profissional.** Transforma descrições informais de jovens em currículos estruturados utilizando IA Generativa com tipagem estrita de dados, com exportação simulada para LinkedIn.
9. **Liga Dinâmica (Leaderboard).** Controle de ofensivas diárias, cálculo automático de categorias de status ("Na Jornada" até "CONTRATADO!") e ranking global em tempo real (Top 10), com o XP semanal zerado automaticamente a cada nova semana.

---

## 🛠️ Arquitetura e Stack Tecnológica

O projeto foi construído seguindo rigorosos padrões de mercado de governança de dados, escalabilidade, segurança e separação de conceitos (*Clean Architecture*):

- **Front-end (Apresentação):** **React.js + Vite** – SPA reativa e modular, com **Framer Motion** para animações, ícones **Phosphor**, tela de login/registro com fundo animado ("aurora") compartilhado com o app principal, e uma sessão persistida via token JWT em `localStorage`.
- **Back-end (Serviços/API):** **FastAPI (Python)** – Servidor ASGI de alta performance, assíncrono, com injeção de dependências nativa (`Depends`) tanto para a sessão do banco quanto para o **estudante autenticado** (extraído do JWT em toda rota protegida), e validação de contratos via **Pydantic**.
- **Autenticação:** **bcrypt** para hash de senha e **PyJWT** para tokens *bearer* (`HS256`, expiração de 7 dias). Nenhuma rota confia mais em um `estudante_id` enviado pelo cliente — a identidade vem sempre do token.
- **Banco de Dados (Persistência):** **PostgreSQL** – Banco relacional. Utiliza o tipo nativo `ARRAY(String)` para as matrizes de habilidades de estudantes e vagas, e tabelas dedicadas para candidaturas e atividade diária (calendário de gamificação).
- **ORM:** **SQLAlchemy** – Mapeamento objeto-relacional com gerenciamento eficiente de sessões (*pooling* transacional), prevenção de *SQL Injection* e deleções em cascata seguras.
- **Migrações de schema:** **Alembic** – todo o schema é versionado; nenhuma alteração de tabela depende de recriar o banco do zero.
- **Inteligência Artificial:** **Google Gemini 2.5 Flash** – Integração via SDK oficial (`google-genai`), com `response_schema` e `response_mime_type="application/json"` para retorno estruturado. Sem `GEMINI_API_KEY` configurada, o sistema cai automaticamente em respostas de fallback pré-definidas (quiz, entrevista e currículo continuam funcionando).
- **Qualidade de Código & Testes:** Suite de testes de integração com **FastAPI TestClient** e **Unittest Mock**, cobrindo autenticação, gamificação, vagas/candidaturas e itinerários, simulando o banco e o usuário logado via `app.dependency_overrides` — sem custos de API ou poluição do banco de produção.

---

## 📂 Estrutura Arquitetural do Sistema

```text
Play2Work.ai/
├── requirements.txt          # Dependências do ecossistema Python (.venv)
└── app/                      # CORE DO BACK-END (FastAPI)
    ├── alembic/               # Migrações de schema versionadas (Alembic)
    ├── alembic.ini            # Configuração do Alembic
    ├── auth.py                # Hash/verificação de senha, JWT, dependência get_estudante_atual
    ├── database.py            # Configuração de engine, pooling do Postgres e SessionLocal
    ├── models.py              # Modelagem relacional (Estudante, Vaga, Candidatura, AtividadeDiaria, etc.)
    ├── schemas.py              # Contratos Pydantic e Schemas JSON estritos p/ IA do Gemini
    ├── services.py             # Core de Negócio: gamificação, match de vagas, itinerários e SDK do Gemini
    ├── routes.py               # Endpoints REST (auth, vagas, quiz, itinerário, currículo, ranking)
    ├── main.py                 # Ponto de entrada da API, middlewares e inicialização do Uvicorn
    ├── seed.py                 # Script automatizado de população/sincronização do PostgreSQL
    ├── test_main.py            # Testes de integração mockados (FastAPI TestClient + dependency_overrides)
    ├── .env                    # DATABASE_URL, GEMINI_API_KEY e JWT_SECRET_KEY locais (não versionado)
    │
    └── frontend/               # CORE DO FRONT-END (React.js + Vite)
        └── src/
            ├── api.js          # apiFetch: injeta o token JWT, trata 401 derrubando a sessão
            ├── components/
            │   ├── Auth.jsx            # Login (nome+senha), registro e reset de senha
            │   ├── AccountSettings.jsx # "Sobre a conta": trocar senha, editar LinkedIn
            │   ├── AuroraBackground.jsx# Fundo animado compartilhado (login + app)
            │   ├── CourseSelector.jsx  # Aba de escolha de itinerário
            │   ├── DailyQuiz.jsx       # Quiz do dia (dica, pular, combo, cronômetro)
            │   ├── JobMatchBoard.jsx   # Mural de vagas + modal de detalhes/candidatura
            │   ├── InterviewSimulator.jsx
            │   ├── ResumeBuilder.jsx
            │   └── WeeklyLeaderboard.jsx
            ├── App.jsx         # Hub central: sessão, navegação, estado global do estudante
            ├── index.css       # Variáveis de design token (:root), fontes e Reset CSS
            └── main.jsx        # Ponto de inicialização do Virtual DOM do React
```

---

## 🚀 Como Rodar Localmente

### Pré-requisitos

- **Python 3.10+**
- **PostgreSQL** rodando localmente (porta padrão `5432`)
- **Node.js 18+** (para o front-end com Vite)

### 1. Back-end (FastAPI)

```bash
# Criar e ativar o ambiente virtual (uma vez só)
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac

# Instalar dependências
pip install -r requirements.txt
```

Crie o arquivo `app/.env` com as credenciais do seu Postgres local:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/nome_do_banco
GEMINI_API_KEY=
JWT_SECRET_KEY=
```

> **`GEMINI_API_KEY`** — opcional. Sem ela, o app cai automaticamente em respostas de fallback pré-definidas em vez de chamar a IA. Para ativar a IA de verdade, gere uma chave gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free tier: ~1.500 requisições/dia, sem cartão) e cole nessa variável.
>
> **`JWT_SECRET_KEY`** — recomendado para dev contínuo. Se não for definida, o backend gera uma chave aleatória a cada `python main.py`, o que **invalida todas as sessões logadas a cada reinício**. Gere uma fixa uma vez com `python -c "import secrets; print(secrets.token_hex(32))"` e cole aqui.

Aplique as migrações (cria/atualiza as tabelas via Alembic — é o jeito correto de manter o schema em dia, inclusive em bancos já existentes):

```bash
cd app
alembic upgrade head
```

Depois, popule o banco com dados de teste (pode rodar de novo a qualquer momento, ele limpa e recria os registros — mas não mexe mais no schema, isso agora é papel do Alembic):

```bash
python seed.py
```

Isso cria um estudante de demonstração — login: **nome** `Gabriel Sozza`, **senha** `play2work123` — com itinerário definido e vagas cobrindo os 4 trilhos formativos.

> Sempre que `models.py` mudar (nova coluna, nova tabela), gere uma migração com `alembic revision --autogenerate -m "descrição"` e rode `alembic upgrade head` — não dá pra confiar só no `create_all` do seed.py pra isso, ele cria tabelas novas mas nunca altera uma tabela que já existe.

Suba a API:

```bash
# de dentro da pasta app/
python -m uvicorn main:app --reload --port 8000
```

A API sobe em `http://127.0.0.1:8000` (docs interativos em `/docs`).

### 2. Front-end (React + Vite)

```bash
cd app/frontend
npm install
npm run dev
```

O front-end sobe em `http://localhost:5173` e já aponta para o back-end em `http://127.0.0.1:8000`.

### 3. Rodando os testes

```bash
cd app
pytest -q
```

Os testes usam `app.dependency_overrides` para trocar a sessão do banco e o estudante autenticado por mocks — não tocam no Postgres real nem fazem chamadas de API.

---

## 🔐 Fluxo de autenticação (resumo)

- `POST /api/auth/registrar` — cria a conta (nome, e-mail, senha, LinkedIn opcional). E-mail precisa ser único; nome **não** precisa.
- `POST /api/auth/login` — recebe `nome` + `senha`. Se houver mais de uma conta com o mesmo nome, o backend testa a senha contra cada uma até achar a correta.
- `POST /api/auth/resetar-senha` — recebe o e-mail cadastrado e devolve uma senha temporária em texto, já marcando a conta para forçar troca no próximo login (não depende de nenhum serviço de e-mail).
- `POST /api/auth/trocar-senha` — troca a senha (exige a senha atual); é a tela obrigatória exibida logo após um login com senha temporária.
- `PUT /api/auth/conta` — atualiza o LinkedIn do perfil.
- Toda rota autenticada usa `Authorization: Bearer <token>`, injetado automaticamente pelo `apiFetch` do front-end a partir do token salvo em `localStorage`.
