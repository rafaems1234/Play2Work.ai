# First2Work.AI 🚀
> A plataforma do primeiro emprego · Treine. Evolua. Seja contratado.

Prepara alunos do Ensino Médio técnico pra vagas de **Jovem Aprendiz** e dá à escola um painel pra gerir turmas, acompanhar o desempenho e indicar os melhores alunos às empresas parceiras.

**Demonstração:** https://rafaems1234.github.io/First2Work.ai/ (painel da escola em `#admin`). Roda sem backend nem IA, e tudo volta ao início ao recarregar.

Detalhes de cada função, regras e rotas: [`docs/detalhes.md`](docs/detalhes.md).

---

## O que tem

**Pro aluno**
- **Simulador de entrevista com IA:** conversa de 5 a 7 respostas e laudo final com nota, pontos fortes, pontos de melhoria e parecer. Quem calcula a nota é o servidor, nunca a IA.
- **Quiz do dia e simulado de certificação** do curso, com gabarito só no servidor.
- **Currículo em PDF** montado com o que o aluno escreveu, sem invenção.
- **Trilha EAD** com frequência que não dá pra burlar (adiantar ou acelerar o vídeo não conta).
- **Mapa de competências** (10 eixos da BNCC), ligas semanais, ofensiva e chat com a escola.

**Pra escola**
- **Painel da escola:** alunos, turmas, ficha completa (dados do PAP, contratos, histórico, laudos), filtros e exportação em CSV e PDF.
- **Indicação pra vaga:** ranking dos alunos por desempenho, com a composição da nota visível.
- **Contas por pessoa** com 4 perfis de acesso, auditoria de 2 anos e verificação em duas etapas obrigatória.
- **Várias escolas no mesmo sistema**, com os dados de cada uma isolados automaticamente.

**Custo da IA sob controle:** 1 entrevista por dia por aluno, 3 laudos oficiais por semana e teto de gasto mensal (hoje US$ 50) que corta a IA sozinho. Sem IA, tudo continua funcionando pelas regras do sistema.

## Stack

React + Vite · FastAPI (Python) · PostgreSQL + SQLAlchemy + Alembic · Google Gemini · Docker

## Como rodar

### Só o front (modo demonstração)
```bash
cd app/frontend
npm install
npm run dev          # http://localhost:5173
```

| Quem | Como entra |
|---|---|
| Aluno | usuário `rafael.sozza`, senha `first2work123` |
| Aluna no primeiro acesso | "Tenho um código da escola": CPF `222.572.222-61`, código `246810` |
| Painel (`#admin`) | `coordenacao`, `auditoria`, `secretaria` ou `professor`, senha `escola123` |

### Completo com Docker (API + Postgres)
```bash
cp app/.env.example app/.env     # preencha JWT_SECRET_KEY e ADMIN_SENHA (GEMINI_API_KEY é opcional)
docker compose up --build        # API em http://localhost:8000
```
Depois rode o front com `VITE_DEMO_MODE=false VITE_API_URL=http://localhost:8000 npm run dev`, abra `#admin`, deixe o usuário em branco e entre com a `ADMIN_SENHA` pra criar o primeiro Administrador.

### Completo sem Docker
```bash
py -3.12 -m venv .venv && .venv\Scripts\activate   # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cd app
alembic upgrade head
python seed.py                   # dados de teste (APAGA e recria os registros)
python -m uvicorn main:app --reload --port 8000
```

### Testes
```bash
cd app && pytest -q
```
Os testes usam mocks e não mexem no banco. O **CI** (`.github/workflows/ci.yml`) roda a cada PR e push na `main`: testes, `pip-audit`, build do front, `npm audit` e a montagem da imagem Docker. O Dependabot abre PRs de atualização toda segunda.

Use **Python 3.12** (o mesmo do servidor e do CI). As bibliotecas atuais não instalam mais em 3.10.

## Configuração (`app/.env`)

| Variável | Pra quê |
|---|---|
| `DATABASE_URL` | Postgres (obrigatória) |
| `JWT_SECRET_KEY` | assina os logins (obrigatória) |
| `ADMIN_SENHA` | senha de instalação, só pra criar o primeiro Administrador |
| `GEMINI_API_KEY` | IA da entrevista e do currículo (opcional) |
| `GEMINI_TETO_MENSAL_USD` e os dois preços | teto de gasto da IA |
| `CORS_ORIGINS` | endereço do front publicado |
| `DOCS_ABERTAS` | `true` abre o `/docs` (só em desenvolvimento) |

Lista completa e comentada em [`app/.env.example`](app/.env.example).

## Segurança

Senhas com bcrypt, verificação em duas etapas na gestão, perfis checados no servidor, auditoria que nem a API consegue editar, cabeçalhos de segurança e CSP, limite de tentativas por IP (só aceito do proxy confiável) banco com privilégio mínimo em produção, logs de acesso sem os valores das buscas (nome/CPF não vão pro log) e dependências auditadas no CI. Como configurar na hospedagem: [`docs/deploy/banco.md`](docs/deploy/banco.md).

## O que falta antes do piloto

- **Hospedagem:** subir a API (a ideia é Azure, região Brasil) com HTTPS, backup automático testado, segredos no cofre e monitoramento. Seguir o [`docs/deploy/banco.md`](docs/deploy/banco.md).
- **Gemini no plano pago**, com alerta de orçamento no Google.
- **Token do painel em cookie `httpOnly`:** entra junto com o domínio próprio (`first2work.com.br`).
- **Escola e jurídico:** revisão das 630 questões pelos professores, LGPD com advogado (rascunhos em [`docs/lgpd`](docs/lgpd/README.md)), registro da marca no INPI e alguém da coordenação cuidando da aba Acessos.

**Pra escalar além de uma escola:** paginação no servidor, fotos num armazenamento de arquivos, limite de tentativas no Redis, várias instâncias da API, fila pra IA e teste de carga.
