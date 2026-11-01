-- Usuários do Postgres em produção (ver banco.md).
--
-- Rode UMA vez, conectado como administrador do servidor Postgres, ANTES da
-- primeira subida da API. Troque as duas senhas (gere com:
--   python -c "import secrets; print(secrets.token_urlsafe(32))"
-- ) e guarde-as no cofre de segredos da hospedagem, nunca no repositório.
--
--   first2work_dono  dono do banco: cria/altera tabelas (só as migrações usam)
--   first2work_api   o que a API usa: lê e grava dados, nada de DDL
--
-- Depois disso:
--   MIGRACAO_DATABASE_URL=postgresql://first2work_dono:<senha>@<host>:5432/first2work?sslmode=require
--   DATABASE_URL=postgresql://first2work_api:<senha>@<host>:5432/first2work?sslmode=require

CREATE ROLE first2work_dono LOGIN PASSWORD 'TROQUE-ESTA-SENHA-DO-DONO';
CREATE ROLE first2work_api  LOGIN PASSWORD 'TROQUE-ESTA-SENHA-DA-API';

CREATE DATABASE first2work OWNER first2work_dono;

\connect first2work

-- Ninguém além do dono cria nada no schema public
REVOKE ALL ON DATABASE first2work FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO first2work_dono;
GRANT CONNECT ON DATABASE first2work TO first2work_api;
GRANT USAGE ON SCHEMA public TO first2work_api;

-- Tabelas e sequências que as migrações criarem daqui pra frente (como o dono)
-- já nascem liberadas pra API ler e gravar
ALTER DEFAULT PRIVILEGES FOR ROLE first2work_dono IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO first2work_api;
ALTER DEFAULT PRIVILEGES FOR ROLE first2work_dono IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO first2work_api;

-- Depois da PRIMEIRA subida (quando as tabelas já existem), rode também
-- endurecer_historico.sql: tira da API o poder de editar o histórico.
