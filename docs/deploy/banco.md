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
| `CORS_ORIGINS` | só o endereço do front | o navegador só deixa esse front chamar a API |
| `GEMINI_TETO_MENSAL_USD` + preços | definidos | corta a IA ao bater o teto |

Segredos (senhas do banco, `JWT_SECRET_KEY`, `GEMINI_API_KEY`, `ADMIN_SENHA`) ficam no cofre de segredos da hospedagem (ex.: Azure Key Vault), não num `.env` dentro do servidor.

## 4. Verificação em duas etapas

Toda conta da gestão ativa no primeiro login (QR Code num app autenticador). Celular perdido: outro Administrador clica em **Zerar verificação** na aba Equipe. Se for o único Administrador: `python resetar_2fa.py usuario`, no servidor (fica na auditoria).

## 5. Front publicado

O build coloca uma Content-Security-Policy no `index.html`: só roda script do próprio site e do player do YouTube, e só conversa com a API de `VITE_API_URL`. Se a API mudar de endereço, gere o build de novo com o endereço novo.
