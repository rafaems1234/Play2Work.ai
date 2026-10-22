# Play2Work.AI 🚀 
> Inclusão Produtiva de Jovens com IA e Gamificação

O **Play2Work.AI** é um ecossistema tecnológico completo projetado para democratizar o acesso à orientação profissional e impulsionar a empregabilidade de jovens estudantes em busca do primeiro emprego e vagas de Jovem Aprendiz.

Através de uma abordagem de **gamificação comportamental** (inspirada em mecânicas de jogos e RPGs de alta performance), a plataforma transforma a preparação para processos seletivos em uma jornada viciante. O sistema utiliza Inteligência Artificial de última geração integrada a bancos relacionais para analisar perfis, simular entrevistas realistas, escolher um itinerário formativo e calcular a aderência técnica (*match*) de vagas em tempo real. O app não tem tela de login — abre direto no progresso de um único estudante (pensado pra demonstração/apresentação; ver "Modo demonstração" abaixo pra rodar sem backend nenhum).

---

## ⚙️ Funcionalidades Core

1. **Sem tela de login.** O app abre direto no progresso de um único estudante (`ESTUDANTE_UNICO_ID` em `auth.py`) — pensado pra demonstração/apresentação, não pra multiusuário. O backend ainda guarda as rotas de `bcrypt`/JWT (`/auth/registrar`, `/auth/login`, reset de senha) como código legado, mas nenhuma delas é chamada pelo front hoje.
2. **Itinerários formativos.** O estudante escolhe **um** dos 4 itinerários formativos do Ensino Médio (Tecnologia e Ciência de Dados, Robótica e Automação, Ciências Jurídicas, Ciências da Natureza e Matemática) numa aba própria de navegação. O itinerário atual fica sempre visível ao lado do ícone de ofensiva no cabeçalho, e both o **Quiz do Dia** e o **Simulador de Entrevista com IA** giram em torno do curso escolhido.
3. **Mural de Vagas com Match Inteligente + candidatura real.** Algoritmo que cruza as competências do aluno com os requisitos das vagas, calculando o percentual de aderência e dando um boost extra para vagas que combinam com o itinerário escolhido (essas vagas sobem para o topo do mural e ganham um selo "combina com seu curso"). Clicar num card abre um painel de detalhes no estilo LinkedIn (descrição completa, habilidades exigidas, localização) com botão de **Aplicar**, que persiste a candidatura no banco (idempotente — não duplica se o estudante aplicar de novo) e fica consultável em "Minhas candidaturas".
4. **Validação de Dados Corporativos.** Integração assíncrona (via `httpx.AsyncClient`, com as consultas rodando em paralelo) com APIs externas (BrasilAPI) para buscar e validar a Razão Social real das empresas parceiras a partir do CNPJ, garantindo um mural antifraude e verificado sem bloquear o event loop da API.
5. **Simulador de Entrevista Interativo com IA.** Chatbot síncrono que atua como um recrutador experiente, com perguntas contextualizadas pelo itinerário escolhido pelo estudante. A IA avalia as respostas, gera feedbacks construtivos e distribui XP de forma dinâmica (penalizando inputs aleatórios ou vazios com 0 XP para evitar abusos).
6. **Quiz do Dia com mecânicas de jogo e resultado validado no servidor.** Quiz de 10 perguntas geradas por IA sobre o itinerário escolhido, com botão de **dica** (elimina uma alternativa errada) e **pular** (avança sem gastar vida), cada um limitado a 2 usos por quiz, cronômetro ao vivo, contador de combo/streak de acertos e botão de voltar direto pro mural. O gabarito nunca é enviado ao cliente antecipadamente — cada resposta é conferida e registrada pelo backend em `/quiz/responder`, e o XP/vidas ganhos em `/quiz/submit` são contados a partir do que o servidor registrou, não do que o cliente afirma ter acertado.
7. **Sistema de vidas, moedas e congelamento de ofensiva.** O estudante tem até 5 vidas, perde uma a cada erro no quiz, e regenera 1 vida a cada 2h (ou compra com moedas). Acertar o quiz perfeitamente 5 vezes seguidas dá uma vida bônus automática. A cada 7 dias de ofensiva contínua, o estudante ganha 1 congelamento, consumido automaticamente se ele perder um único dia (protegendo a sequência). Um calendário mensal (botão ao lado do ícone de ofensiva) mostra dias feitos, congelados e perdidos.
8. **Gerador de Currículo com PDF.** Transforma descrições informais de jovens (escola, cursos, grêmio, projetos) em currículos estruturados via IA Generativa com tipagem estrita, incluindo uma seção de **experiências e projetos** pensada pra quem ainda não teve emprego. O currículo aparece numa folha A4 formatada e o botão **Baixar PDF** gera o arquivo pronto pra mandar (via impressão do navegador, sem biblioteca extra). Exportação para LinkedIn segue simulada (sandbox).
9. **Status de carreira + Liga semanal.** Cálculo automático de categoria de status a partir do XP total ("Na Jornada" até "CONTRATADO!"), e uma **liga semanal separada** (10 ligas: Bronze → Prata → Ouro → Safira → Rubi → Esmeralda → Ametista → Pérola → Obsidiana → Diamante, cada uma com sua taça): a cada virada de semana, o top 3 da liga sobe de patamar e os últimos 3 descem (só em grupos com 4+ pessoas), com o ranking (`WeeklyLeaderboard`) mostrando só os colegas da própria liga e destacando as zonas de promoção/rebaixamento.
10. **Aviso de sequência em risco.** Se o estudante ainda não treinou hoje e tem uma ofensiva ativa, um banner no topo avisa ("sua sequência de X dias está em risco") com atalho direto pro Quiz do Dia — dispensável por aquele dia.
11. **Feedback sonoro e animado.** Sons curtos sintetizados via Web Audio API (sem arquivos de áudio) para acerto/erro no quiz, level-up e mudança de liga, com confete e toasts no level-up/promoção. Um botão no cabeçalho liga/desliga o som (preferência salva no navegador).
12. **Tela de abertura.** Landing em estilo tech (grade, terminal de IA "digitando", números animados e a jornada em 6 passos) que apresenta a proposta antes de entrar na plataforma — `Enter` ou o botão entram, e clicar no logo volta pra ela.

---

## 🛠️ Arquitetura e Stack Tecnológica

O projeto foi construído seguindo rigorosos padrões de mercado de governança de dados, escalabilidade, segurança e separação de conceitos (*Clean Architecture*):

- **Front-end (Apresentação):** **React.js + Vite** – SPA reativa e modular, com **Framer Motion** para animações, ícones **Phosphor**, sem tela de login, e um **modo demonstração** (`src/mockApi.js`) que simula toda a API no navegador pra rodar sem backend.
- **Back-end (Serviços/API):** **FastAPI (Python)** – Servidor ASGI de alta performance, assíncrono, com injeção de dependências nativa (`Depends`) para a sessão do banco e para o estudante único da demonstração, e validação de contratos via **Pydantic**.
- **Autenticação:** removida da experiência do usuário — o backend mantém `bcrypt`/`PyJWT` como código legado (rotas `/auth/*` ainda funcionam via API, mas não são chamadas pelo front). `JWT_SECRET_KEY` continua obrigatória pra essas rotas legadas subirem sem erro.
- **Rate limiting:** **slowapi** limita por IP as rotas mais sensíveis a força-bruta e enumeração (`/auth/login`, `/auth/registrar`, `/auth/pergunta-seguranca`, `/auth/resetar-senha`).
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
    ├── limiter.py              # Instância compartilhada do slowapi (rate limit por IP)
    ├── database.py            # Configuração de engine, pooling do Postgres e SessionLocal
    ├── models.py              # Modelagem relacional (Estudante, Vaga, Candidatura, QuizSessao, AtividadeDiaria, etc.)
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
            ├── api.js          # apiFetch: roteia pro backend real ou pro mockApi.js (modo demonstração)
            ├── mockApi.js      # Simula toda a API no navegador (modo demonstração, sem backend)
            ├── utils/sound.js  # Sons curtos via Web Audio API (acerto/erro/level-up/liga)
            ├── components/
            │   ├── AccountSettings.jsx # "Sobre a conta": trocar senha, editar LinkedIn
            │   ├── TechBackground.jsx  # Fundo tech compartilhado (grade + brilho + varredura)
            │   ├── IntroScreen.jsx     # Tela de abertura (landing da apresentação)
            │   ├── Logo.jsx            # Marca em SVG (mesmo desenho de public/favicon.svg)
            │   ├── CourseSelector.jsx  # Aba de escolha de itinerário
            │   ├── DailyQuiz.jsx       # Quiz do dia (dica, pular, combo, cronômetro)
            │   ├── JobMatchBoard.jsx   # Mural de vagas + modal de detalhes/candidatura
            │   ├── InterviewSimulator.jsx
            │   ├── ResumeBuilder.jsx
            │   └── WeeklyLeaderboard.jsx
            ├── App.jsx         # Hub central: sessão, navegação, estado global do estudante
            ├── index.css       # Design tokens (:root) — a cor de destaque do app inteiro é --accent-rgb
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
> **`JWT_SECRET_KEY`** — **obrigatória**. O backend não sobe sem ela (mesmo padrão de `DATABASE_URL`) — não existe fallback de segredo gerado na hora. Gere uma vez com `python -c "import secrets; print(secrets.token_hex(32))"` e cole aqui.

Aplique as migrações (cria/atualiza as tabelas via Alembic — é o jeito correto de manter o schema em dia, inclusive em bancos já existentes):

```bash
cd app
alembic upgrade head
```

Depois, popule o banco com dados de teste (pode rodar de novo a qualquer momento, ele limpa e recria os registros — mas não mexe mais no schema, isso agora é papel do Alembic):

```bash
python seed.py
```

Isso cria um estudante de demonstração — login: **nome** `Rafael Sozza`, **senha** `play2work123`, **pergunta de segurança** "Qual o seu sobrenome?" → resposta `sozza` — com itinerário definido e vagas cobrindo os 4 trilhos formativos.

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

> **Modo demonstração (sem backend).** Por padrão (`VITE_DEMO_MODE` não definida, ou `true`), o front roda **sozinho** — todas as chamadas de API são respondidas por dados fictícios simulados no navegador (`src/mockApi.js`), sem precisar de backend, Postgres nem `.env`. Ideal pra apresentar o produto ou mandar o link do repositório pra alguém testar com um `npm install && npm run dev`. Um selo **"🎭 Demonstração"** aparece no cabeçalho enquanto esse modo estiver ativo. Pra apontar pro backend real (Postgres + Gemini), crie `app/frontend/.env` com `VITE_DEMO_MODE=false`.

### 3. Rodando os testes

```bash
cd app
pytest -q
```

Os testes usam `app.dependency_overrides` para trocar a sessão do banco e o estudante autenticado por mocks — não tocam no Postgres real nem fazem chamadas de API.

---

## 🔐 Sobre a remoção da tela de login

O front não tem mais tela de login: `get_estudante_atual` (em `auth.py`) resolve sempre pro mesmo estudante (`ESTUDANTE_UNICO_ID = 1`, o "Rafael Sozza" do `seed.py`), sem exigir token. As rotas `/api/auth/registrar`, `/login`, `/pergunta-seguranca`, `/resetar-senha` e `/trocar-senha` continuam existindo no backend (código legado, ainda cobertas por `test_main.py`), mas não são mais chamadas pelo front.

## 🎯 Integridade do Quiz do Dia

O resultado do quiz não é autodeclarado pelo cliente. O fluxo é:

1. `POST /api/quiz/generate` cria uma `QuizSessao` no banco com o gabarito (resposta certa + explicação de cada pergunta) e devolve ao cliente só `pergunta`+`opcoes` — nunca a resposta certa.
2. `POST /api/quiz/responder` recebe a alternativa escolhida (ou `null` pra pular) pergunta a pergunta, confere contra o gabarito guardado no servidor e só então devolve se acertou e qual era a resposta certa. Pulos são limitados a 2 por quiz, validado no servidor.
3. `POST /api/quiz/dica` sorteia uma alternativa errada pra eliminar — o servidor sabe a resposta certa, o cliente nunca calcula isso sozinho. Limitado a 2 por quiz, validado no servidor.
4. `POST /api/quiz/submit` exige que todas as perguntas tenham sido respondidas e conta acertos/pulos a partir do que o próprio servidor registrou em `/quiz/responder` — o cliente não envia mais "acertos"/"total" de forma autodeclarada.
