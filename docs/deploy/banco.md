# Deploy: banco, proxy e variáveis de segurança

Checklist do que configurar na hospedagem pra API subir com as proteções ligadas.
Nada disso vale pro `docker compose` de desenvolvimento.

## 1. Dois usuários no Postgres

A API **não** entra no banco como dono nem como superusuário. São dois usuários:

| Usuário | Pra quê | Variável |
|---|---|---|
| `first2work_dono` | dono do banco: as migrações criam e alteram tabelas | `MIGRACAO_DATABASE_URL` |
| `first2work_api` | a API: só lê e grava dados, sem criar nem apagar tabela | `DATABASE_URL` |

1. Antes da primeira subida, rode [`banco_usuarios.sql`](banco_usuarios.sql) como administrador do Postgres (troque as duas senhas).
2. Suba a API uma vez. O `preparar_banco.py` cria as tabelas como dono, e elas já nascem liberadas pra API.
3. Rode [`endurecer_historico.sql`](endurecer_historico.sql) como `first2work_dono`. A partir daí, nem a API consegue editar a auditoria nem o log de frequência.

Conferido num Postgres 16 em 01/11/2026: como `first2work_api`, ler e gravar funciona; criar tabela, apagar tabela, editar a auditoria e editar ou apagar o log de frequência dão "permissão negada"; apagar um registro "pai" continua apagando os "filhos" em cascata.

Use `?sslmode=require` nas duas URLs. O banco não deve aceitar conexão da internet, só da API.

## 2. IP real atrás do proxy (`FORWARDED_ALLOW_IPS`)

O limite de tentativas de login e a auditoria usam o IP de quem chamou. Atrás do proxy da hospedagem, o IP real vem no cabeçalho `X-Forwarded-For`, que qualquer um consegue escrever. Por isso a API só acredita nesse cabeçalho quando a conexão vem de um IP listado em `FORWARDED_ALLOW_IPS`.

- O padrão do contêiner é `127.0.0.1`: ignora o cabeçalho de todo mundo.
- Na hospedagem, coloque o IP ou a faixa do proxy dela.
- `*` **só** se o contêiner não for acessível direto da internet, apenas pelo proxy (ingress interno).

## 3. Variáveis de segurança

| Variável | Produção | Por quê |
|---|---|---|
| `DOCS_ABERTAS` | vazia (fechada) | `/docs` mostra todas as rotas da API |
| `GESTAO_2FA_OBRIGATORIA` | vazia (= true) | o painel mostra dados de menores |
| `JWT_SECRET_KEY` | segredo forte, no cofre | assina os logins |
| `APP_ENV` | vazia (= produção) | `local` libera localhost no CORS e o cookie sem HTTPS |
| `CORS_ORIGINS` | só o endereço do front (`https://first2work.com.br`) | o navegador só deixa esse front chamar a API; localhost é ignorado |
| `REDIS_URL` | Redis gerenciado (ex.: Azure Cache for Redis, `rediss://` com senha) | limite de tentativas igual em todas as instâncias da API |
| `ARMAZENAMENTO` | `azure` com várias instâncias; `disco` + volume com backup num servidor só | fotos e materiais fora do banco |
| `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER` | no cofre; contêiner **privado** | os arquivos só saem pela API, que confere quem pode ver |
| `GEMINI_TETO_MENSAL_USD` + preços | definidos | corta a IA ao bater o teto |

Segredos (senhas do banco, `JWT_SECRET_KEY`, `GEMINI_API_KEY`, `ADMIN_SENHA`, a senha do Redis e a conexão do Blob) ficam no cofre de segredos da hospedagem (ex.: Azure Key Vault), não num `.env` dentro do servidor.

## 4. Verificação em duas etapas

Toda conta da gestão ativa no primeiro login (QR Code num app autenticador). Celular perdido: outro Administrador clica em **Zerar verificação** na aba Equipe. Se for o único Administrador: `python resetar_2fa.py usuario`, no servidor (fica na auditoria).

## 5. Front publicado

O build coloca uma Content-Security-Policy no `index.html`: só roda script do próprio site e do player do YouTube, e só conversa com a API de `VITE_API_URL`. Se a API mudar de endereço, gere o build de novo com o endereço novo.

    VITE_DEMO_MODE=false VITE_API_URL=https://api.first2work.com.br VITE_BASE=/ npm run build

A sessão do painel é um cookie `httpOnly` + `Secure` + `SameSite=Lax` emitido pela API. O navegador só o manda se o front e a API forem do **mesmo domínio** (`first2work.com.br` e `api.first2work.com.br`): front no GitHub Pages com API no Azure não funciona pro painel. Tudo em HTTPS.

## 6. Arquivos (fotos e materiais)

Ficam fora do Postgres, então o **backup tem duas partes**: o banco e o armazenamento (o volume `arquivos` do Docker, ou o contêiner do Blob com *soft delete* e versionamento ligados). Restaurar só um dos dois deixa fotos faltando ou sobrando.

Ao atualizar um servidor que já tinha fotos dentro do banco, rode uma vez:

    python arquivos.py migrar          # move pro armazenamento; pode repetir
    python arquivos.py orfaos          # lista arquivos sem registro no banco (--apagar remove)
