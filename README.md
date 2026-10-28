# Play2Work.AI 🚀 
> Inclusão Produtiva de Jovens com IA e Gamificação

O **Play2Work.AI** é um ecossistema tecnológico completo projetado para democratizar o acesso à orientação profissional e impulsionar a empregabilidade de jovens estudantes em busca do primeiro emprego e vagas de Jovem Aprendiz.

Através de uma abordagem de **gamificação comportamental** (inspirada em mecânicas de jogos e RPGs de alta performance), a plataforma transforma a preparação para processos seletivos em uma jornada viciante. O sistema utiliza Inteligência Artificial de última geração integrada a bancos relacionais para analisar perfis, simular entrevistas realistas, escolher um itinerário formativo e calcular a aderência técnica (*match*) de vagas em tempo real. O aluno entra com uma senha só — o próprio CPF, cadastrado pela escola — e a escola tem um **Painel da Escola** pra gerir turmas, alunos e itinerários e indicar os alunos de melhor desempenho às vagas das empresas parceiras (ver "Modo demonstração" abaixo pra rodar sem backend nenhum).

---

## ⚙️ Funcionalidades Core

1. **Login do aluno pelo CPF.** A tela de login tem um campo só, "Senha", e a senha é o CPF que a escola cadastrou (`POST /auth/entrar`) — nada pra esquecer nem resetar. **Decisão consciente:** CPF não é segredo, então quem souber o CPF de um colega entra na conta dele; o rate limit (10 tentativas/min por IP) só segura chute em massa. As rotas antigas de nome+senha (`/auth/login`, reset) continuam no backend como legado.
2. **Itinerários formativos definidos pela escola.** 5 itinerários do Ensino Médio: Tecnologia e Ciência de Dados, Robótica e Automação, Ciências Jurídicas, Ciências da Natureza e Matemática e **Recursos Humanos e Gestão de Pessoas**. Quem cadastra o itinerário de cada aluno é a escola, no painel — o aluno só vê o dele (a aba Curso é só leitura e `POST /itinerario/escolher` responde 403), pra ninguém trocar de área só pra subir no ranking de uma vaga. O **Quiz do Dia** e o **Simulador de Entrevista com IA** giram em torno do itinerário.
3. **Painel da Escola (`/admin`, ou `#admin` na URL).** Login próprio (`ADMIN_SENHA`). Cadastro de alunos (nome, CPF validado, nascimento opcional, e-mail, turma, itinerário, habilidades), turmas, e vagas de empresas parceiras. Busca instantânea por nome, CPF ou e-mail com autocomplete a cada letra, filtros por turma e itinerário, e ficha do aluno que abre **só pra leitura** — editar exige clicar em "Habilitar edição" e confirmar em "Salvar alterações". Visual em tema claro (azul-gelo), separado do tema escuro do app do aluno, e responsivo do celular ao monitor: no celular a lista de vagas vira um seletor, a contagem por itinerário fica recolhida e as tabelas rolam dentro do próprio card.
4. **Indicação dos melhores alunos pra vaga.** Pra cada vaga, o painel ranqueia os alunos por uma nota de desempenho de 0 a 100, com a composição visível: habilidades exigidas (35), itinerário igual ao da vaga (20), acerto no quiz validado no servidor (25), XP relativo ao melhor aluno (15) e ofensiva (5). A escola filtra por turma/itinerário, seleciona o top N e indica; a indicação vira uma candidatura marcada `indicada_pela_escola`, e o aluno vê "A escola te indicou" no detalhe da vaga.
5. **Nome de exibição único.** Cada aluno ganha um nome curto e único gerado do nome completo ("Rafael S."); se já existir, o sistema diferencia ("Rafael Si.", "Rafael Sozza", "Rafael V. Sozza", e só por último "Rafael Sozza 2"). É esse nome que aparece no ranking (`nomes.py`).
6. **Mural de Vagas com Match Inteligente + candidatura real.** Algoritmo que cruza as competências do aluno com os requisitos das vagas, calculando o percentual de aderência e dando um boost extra para vagas que combinam com o itinerário escolhido (essas vagas sobem para o topo do mural e ganham um selo "combina com seu curso"). Clicar num card abre um painel de detalhes no estilo LinkedIn (descrição completa, habilidades exigidas, localização) com botão de **Aplicar**, que persiste a candidatura no banco (idempotente — não duplica se o estudante aplicar de novo) e fica consultável em "Minhas candidaturas".
7. **Validação de Dados Corporativos.** Integração assíncrona (via `httpx.AsyncClient`, com as consultas rodando em paralelo) com APIs externas (BrasilAPI) para buscar e validar a Razão Social real das empresas parceiras a partir do CNPJ, garantindo um mural antifraude e verificado sem bloquear o event loop da API.
8. **Simulador de Entrevista Interativo com IA.** Chatbot síncrono que atua como um recrutador experiente, com perguntas contextualizadas pelo itinerário escolhido pelo estudante. A IA avalia as respostas, gera feedbacks construtivos e distribui XP de forma dinâmica (penalizando inputs aleatórios ou vazios com 0 XP para evitar abusos).
9. **Quiz do Dia com banco de questões, mecânicas de jogo e resultado validado no servidor.** Quiz de 10 perguntas sobre o itinerário: com `GEMINI_API_KEY`, geradas pela IA (que recebe as perguntas recentes do aluno pra não repetir); sem ela, sorteadas do **banco de questões** (`frontend/src/data/banco_questoes.json`, 20 perguntas por área + 15 de soft skills, o mesmo arquivo usado pelo modo demo) — 8 da área e 2 gerais, evitando as perguntas dos últimos 5 quizzes e embaralhando a ordem das alternativas a cada vez. A tela final mostra % de acerto, XP, tempo e ofensiva em cartões animados que mudam de cor com o desempenho (vermelho → amarelo → azul → verde) e com a chama crescendo conforme a ofensiva. Tem com botão de **dica** (elimina uma alternativa errada) e **pular** (avança sem gastar vida), cada um limitado a 2 usos por quiz, cronômetro ao vivo, contador de combo/streak de acertos e botão de voltar direto pro mural. O gabarito nunca é enviado ao cliente antecipadamente — cada resposta é conferida e registrada pelo backend em `/quiz/responder`, e o XP/vidas ganhos em `/quiz/submit` são contados a partir do que o servidor registrou, não do que o cliente afirma ter acertado.
10. **Sistema de vidas, moedas e congelamento de ofensiva (sem anúncios).** O estudante tem até 5 vidas e perde uma a cada erro no quiz. Cada vida perdida volta sozinha **a cada 30 min**, uma por vez, até encher (ou compra com moedas). **Combo de 5 acertos seguidos devolve 1 vida** (erro ou pulo zera o combo), e acertar o quiz perfeitamente 5 vezes seguidas dá uma vida bônus. A cada 7 dias de ofensiva contínua, o estudante ganha 1 congelamento, consumido automaticamente se ele perder um único dia (protegendo a sequência). Um calendário mensal (botão ao lado do ícone de ofensiva) mostra dias feitos, congelados e perdidos.
11. **Gerador de Currículo com PDF.** Transforma descrições informais de jovens (escola, cursos, grêmio, projetos) em currículos estruturados via IA Generativa com tipagem estrita, incluindo uma seção de **experiências e projetos** pensada pra quem ainda não teve emprego. A IA só escreve o conteúdo (objetivo, habilidades, experiências e áreas sugeridas, em JSON); o layout é um modelo fixo de folha A4 (`ResumeBuilder.jsx`). O currículo aparece nessa folha e o botão **Baixar PDF** gera o arquivo pronto pra mandar (via impressão do navegador, sem biblioteca extra). Exportação para LinkedIn segue simulada (sandbox).
12. **Status de carreira + Liga semanal.** Cálculo automático de categoria de status a partir do XP total ("Na Jornada" até "CONTRATADO!"), e uma **liga semanal separada** (10 ligas: Bronze → Prata → Ouro → Safira → Rubi → Esmeralda → Ametista → Pérola → Obsidiana → Diamante, cada uma com sua taça): a cada virada de semana, o terço de cima do grupo sobe de patamar e o terço de baixo desce (num grupo cheio de 30: 10 sobem, 10 ficam e 10 descem; ninguém desce em grupos com menos de 4 pessoas), com o ranking (`WeeklyLeaderboard`) mostrando só os colegas da própria liga e destacando as zonas de promoção/rebaixamento.
13. **Aviso de sequência em risco.** Se o estudante ainda não treinou hoje e tem uma ofensiva ativa, um banner no topo avisa ("sua sequência de X dias está em risco") com atalho direto pro Quiz do Dia — dispensável por aquele dia.
14. **Feedback sonoro e animado.** Sons curtos sintetizados via Web Audio API (sem arquivos de áudio) para acerto/erro no quiz, level-up e mudança de liga, com confete e toasts no level-up/promoção. Um botão no cabeçalho liga/desliga o som (preferência salva no navegador).
15. **Tela de abertura.** Landing em estilo tech (grade, terminal de IA "digitando", números animados e a jornada em 6 passos) que apresenta a proposta antes de entrar na plataforma — `Enter` ou o botão entram, e clicar no logo volta pra ela.

---

## 🛠️ Arquitetura e Stack Tecnológica

O projeto foi construído seguindo rigorosos padrões de mercado de governança de dados, escalabilidade, segurança e separação de conceitos (*Clean Architecture*):

- **Front-end (Apresentação):** **React.js + Vite** – SPA reativa e modular, com **Framer Motion** para animações, ícones **Phosphor**, sem tela de login, e um **modo demonstração** (`src/mockApi.js`) que simula toda a API no navegador pra rodar sem backend.
- **Back-end (Serviços/API):** **FastAPI (Python)** – Servidor ASGI de alta performance, assíncrono, com injeção de dependências nativa (`Depends`) para a sessão do banco e para o estudante único da demonstração, e validação de contratos via **Pydantic**.
- **Autenticação:** JWT (`PyJWT`) com papel no token — `aluno` (emitido em `/auth/entrar`, senha = CPF) e `admin` (emitido em `/admin/login` com `ADMIN_SENHA`). Um não abre as rotas do outro. `JWT_SECRET_KEY` é obrigatória.
- **Rate limiting:** **slowapi** limita por IP as rotas mais sensíveis a força-bruta e enumeração (`/auth/entrar`, `/admin/login`, `/auth/login`, `/auth/registrar`, `/auth/pergunta-seguranca`, `/auth/resetar-senha`).
- **Banco de Dados (Persistência):** **PostgreSQL** – Banco relacional. Utiliza o tipo nativo `ARRAY(String)` para as matrizes de habilidades de estudantes e vagas, e tabelas dedicadas para candidaturas e atividade diária (calendário de gamificação).
- **ORM:** **SQLAlchemy** – Mapeamento objeto-relacional com gerenciamento eficiente de sessões (*pooling* transacional), prevenção de *SQL Injection* e deleções em cascata seguras.
- **Migrações de schema:** **Alembic** – todo o schema é versionado; nenhuma alteração de tabela depende de recriar o banco do zero.
- **Inteligência Artificial:** **Google Gemini (plano gratuito)** – modelo `gemini-3.5-flash-lite` por padrão (troque com `GEMINI_MODEL` no `.env`), via SDK oficial (`google-genai`), com `response_schema` e `response_mime_type="application/json"` para retorno estruturado. Sem `GEMINI_API_KEY` configurada, o sistema cai automaticamente em respostas de fallback pré-definidas (quiz, entrevista e currículo continuam funcionando).
- **Qualidade de Código & Testes:** Suite de testes de integração com **FastAPI TestClient** e **Unittest Mock**, cobrindo autenticação, gamificação, vagas/candidaturas e itinerários, simulando o banco e o usuário logado via `app.dependency_overrides` — sem custos de API ou poluição do banco de produção.

---

## 📂 Estrutura Arquitetural do Sistema

```text
Play2Work.ai/
├── requirements.txt          # Dependências do ecossistema Python (.venv)
└── app/                      # CORE DO BACK-END (FastAPI)
    ├── alembic/               # Migrações de schema versionadas (Alembic)
    ├── alembic.ini            # Configuração do Alembic
    ├── auth.py                # JWT com papel (aluno/admin), validação de CPF, get_estudante_atual/get_admin_atual
    ├── admin_routes.py        # Painel da Escola: turmas, alunos, vagas, ranking de desempenho e indicação
    ├── nomes.py               # Regra do nome de exibição único ("Rafael S.") -- usada também pela migração
    ├── limiter.py              # Instância compartilhada do slowapi (rate limit por IP)
    ├── database.py            # Configuração de engine, pooling do Postgres e SessionLocal
    ├── models.py              # Modelagem relacional (Estudante, Vaga, Candidatura, QuizSessao, AtividadeDiaria, etc.)
    ├── schemas.py              # Contratos Pydantic e Schemas JSON estritos p/ IA do Gemini
    ├── services.py             # Core de Negócio: gamificação, match de vagas, itinerários e SDK do Gemini
    ├── routes.py               # Endpoints REST (auth, vagas, quiz, itinerário, currículo, ranking)
    ├── main.py                 # Ponto de entrada da API, middlewares e inicialização do Uvicorn
    ├── seed.py                 # Script automatizado de população/sincronização do PostgreSQL
    ├── test_main.py            # Testes de integração mockados (FastAPI TestClient + dependency_overrides)
    ├── .env                    # Segredos locais: DATABASE_URL, GEMINI_API_KEY, JWT_SECRET_KEY, ADMIN_SENHA (não versionado)
    ├── .env.example            # Modelo do .env com as variáveis vazias (versionado)
    │
    └── frontend/               # CORE DO FRONT-END (React.js + Vite)
        └── src/
            ├── api.js          # apiFetch: roteia pro backend real ou pro mockApi.js (modo demonstração)
            ├── mockApi.js      # Simula toda a API no navegador (modo demonstração, sem backend)
            ├── data/banco_questoes.json # Banco de perguntas por itinerário (lido pelo backend e pelo modo demo)
            ├── utils/formatos.js # Máscaras/validação de CPF e data, busca sem acento
            ├── utils/sound.js  # Sons curtos via Web Audio API (acerto/erro/level-up/liga)
            ├── components/
            │   ├── AccountSettings.jsx # "Sobre a conta": LinkedIn e sair
            │   ├── LoginAluno.jsx      # Login do aluno: senha = CPF
            │   ├── AdminPanel.jsx      # Painel da Escola (alunos, turmas, vagas e indicação)
            │   ├── QuizResultado.jsx   # Tela final do quiz (cartões animados por desempenho)
            │   ├── TechBackground.jsx  # Fundo tech compartilhado (grade + brilho + varredura)
            │   ├── IntroScreen.jsx     # Tela de abertura (landing da apresentação)
            │   ├── Logo.jsx            # Marca em SVG (mesmo desenho de public/favicon.svg)
            │   ├── CourseSelector.jsx  # Aba do itinerário (só leitura -- quem define é a escola)
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

Copie `app/.env.example` para `app/.env` e preencha (o `.env` é ignorado pelo git, então os segredos nunca sobem pro GitHub):

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/nome_do_banco
GEMINI_API_KEY=
GEMINI_MODEL=
JWT_SECRET_KEY=
ADMIN_SENHA=
```

> **`GEMINI_API_KEY`** — opcional. Sem ela, o app usa respostas de fallback (e o quiz sorteia do banco de questões) em vez de chamar a IA. Pra ativar a IA de verdade, gere uma chave gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (sem cartão) e cole nessa variável. O modelo padrão é o `gemini-3.5-flash-lite`: o `gemini-2.5-flash` não aceita mais chaves novas e o `gemini-3.8-flash` só libera 5 pedidos por minuto no plano grátis. Pra usar outro, defina `GEMINI_MODEL`. Se o Google estiver sobrecarregado (503), o backend tenta mais uma vez; se a cota estourar (429), cai direto no fallback. **A chave fica só no `.env`, que não vai pro git** — nunca coloque no código nem no front (no GitHub Pages ela ficaria pública).
>
> **`ADMIN_SENHA`** — senha do Painel da Escola. Sem ela, `/admin/login` responde 503 e o painel fica fechado (não existe senha padrão).
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

Isso cria 3 turmas, 12 alunos espalhados pelos 5 itinerários (com um quiz concluído cada, pra o ranking de desempenho ter dado) e 9 vagas, incluindo Jurídico e RH. Aluno de demonstração: **senha (CPF)** `529.982.247-25` (Rafael Sozza). Os CPFs do seed são fictícios — só têm os dígitos verificadores certos.

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
>
> **Neste modo não há IA:** a entrevista segue uma lista fixa de perguntas com XP sorteado (só respostas muito curtas levam 0), e o currículo é montado por palavras-chave do texto digitado. A IA de verdade (Gemini) só roda com o backend ligado e `GEMINI_API_KEY` no `app/.env`.
>
> **Versão publicada:** o workflow `.github/workflows/deploy-pages.yml` publica o front em modo demonstração a cada push na `main` que mexa em `app/frontend/` — https://rafaems1234.github.io/Play2Work.ai/ (painel em `#admin`).

### 3. Rodando os testes

```bash
cd app
pytest -q
```

Os testes usam `app.dependency_overrides` para trocar a sessão do banco e o estudante autenticado por mocks — não tocam no Postgres real nem fazem chamadas de API.

---

## 🔐 Login

- **Aluno:** `POST /api/auth/entrar` com `{cpf}` → token JWT com papel `aluno`. O front guarda o token e manda em `Authorization: Bearer`; sem token, as rotas do aluno respondem 401 e o app volta pro login.
- **Escola:** `POST /api/admin/login` com `{senha}` (= `ADMIN_SENHA`) → token com papel `admin`, válido por 12h, exigido em todas as rotas `/api/admin/*`.
- No **modo demonstração**, a senha do aluno é `529.982.247-25` e a do painel é `escola123`.
- As rotas legadas `/auth/registrar`, `/login`, `/pergunta-seguranca`, `/resetar-senha` e `/trocar-senha` continuam no backend (cobertas por `test_main.py`), mas o front não usa mais.

## 🎯 Integridade do Quiz do Dia

O resultado do quiz não é autodeclarado pelo cliente. O fluxo é:

1. `POST /api/quiz/generate` cria uma `QuizSessao` no banco com o gabarito (resposta certa + explicação de cada pergunta) e devolve ao cliente só `pergunta`+`opcoes` — nunca a resposta certa.
2. `POST /api/quiz/responder` recebe a alternativa escolhida (ou `null` pra pular) pergunta a pergunta, confere contra o gabarito guardado no servidor e só então devolve se acertou e qual era a resposta certa. Pulos são limitados a 2 por quiz, validado no servidor.
3. `POST /api/quiz/dica` sorteia uma alternativa errada pra eliminar — o servidor sabe a resposta certa, o cliente nunca calcula isso sozinho. Limitado a 2 por quiz, validado no servidor.
4. `POST /api/quiz/submit` exige que todas as perguntas tenham sido respondidas e conta acertos/pulos a partir do que o próprio servidor registrou em `/quiz/responder` — o cliente não envia mais "acertos"/"total" de forma autodeclarada.
