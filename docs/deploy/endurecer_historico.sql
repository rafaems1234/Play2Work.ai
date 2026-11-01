-- Rode conectado ao banco first2work como first2work_dono, DEPOIS da primeira
-- subida da API (as tabelas precisam existir). Pode rodar de novo sem problema.
--
-- Histórico que ninguém edita, nem a própria API: se um dia alguém achar uma
-- falha na API, ainda assim não consegue reescrever o que foi registrado.
--
--   auditoria       a API só insere; DELETE fica porque os registros com mais
--                   de 2 anos saem automaticamente (auditoria.py)
--   log_frequencia  a API só insere (apagar aluno apaga em cascata, e a cascata
--                   do Postgres roda como dono da tabela, não como a API)

REVOKE UPDATE ON auditoria FROM first2work_api;
REVOKE UPDATE, DELETE ON log_frequencia FROM first2work_api;
