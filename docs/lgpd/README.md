# LGPD — rascunhos para revisão jurídica

> **Atenção:** estes textos são um **rascunho técnico**, escrito a partir do que o sistema realmente coleta e faz (mapeado no código em 31/10/2026). **Não são aconselhamento jurídico** e **não devem ser publicados sem revisão de um advogado** com experiência em LGPD e em dados de crianças e adolescentes. Os trechos entre `[colchetes]` precisam ser preenchidos.

| Documento | Para quem | Arquivo |
|---|---|---|
| Política de privacidade | alunos, responsáveis e escola | [politica-de-privacidade.md](politica-de-privacidade.md) |
| Termo de consentimento do responsável | responsável legal do aluno menor de idade | [consentimento-do-responsavel.md](consentimento-do-responsavel.md) |
| Pontos para o contrato com a escola (operador × controlador) | escola cliente | [contrato-com-a-escola.md](contrato-com-a-escola.md) |

## Mapa dos dados (o que o sistema guarda)

| Dado | De quem | Onde no sistema | Quem vê |
|---|---|---|---|
| Nome, CPF, data de nascimento, e-mail, celular, turma, curso | aluno | cadastro (`estudantes`) | escola; o aluno vê os próprios |
| Nome e celular do responsável | responsável | cadastro | escola |
| Endereço, documentos, sexo, nº de cadastro SED, turno, ano escolar | aluno | ficha do PAP | escola |
| **Perfil de desenvolvimento (Típico/Atípico)** — **dado sensível** (saúde, art. 5º, II) | aluno | ficha do PAP | só a escola |
| Foto de identificação e foto do currículo (opcional) | aluno | `fotos_estudantes`, `fotos_curriculo` | escola; aluno |
| Currículo gerado e texto que o aluno escreveu sobre si | aluno | `curriculos` | escola; aluno |
| Conversas do simulador de entrevista e laudos | aluno | `historico_entrevistas`, `sessoes_entrevista` | escola; aluno |
| Resultados de quiz, simulado de certificação, aulas EAD, competências | aluno | várias tabelas | escola; aluno |
| Mensagens do chat com a escola | aluno e gestão | `mensagens` | participantes do canal |
| Contratos de aprendizagem (empresa, CNPJ, vigência) | aluno | `contratos_aprendizagem` | escola |
| Contas da gestão (nome, usuário, perfil) e auditoria (ações, IP) | equipe da escola | `usuarios_gestao`, `auditoria` | Administrador e Auditor da escola |

**Compartilhamento com terceiros:** o texto que o aluno escreve no simulador de entrevista e no gerador de currículo é enviado ao **Google (API Gemini)** para gerar a resposta da entrevistadora, o laudo e o currículo. No **plano gratuito** da API, o Google pode usar esse conteúdo para melhorar os próprios produtos; para dados de menores, **usar o plano pago** (que não usa o conteúdo para treino) antes do piloto e citar o Google como suboperador. Hospedagem do sistema: `[provedor de nuvem e região]`.

**Prazos de guarda já implementados:** auditoria da gestão, 2 anos (removida sozinha). Os demais dados ficam enquanto a escola mantiver o aluno cadastrado — **definir com a escola** o prazo após o fim do vínculo (ex.: fim do Ensino Médio + `[X]` anos) e implementar a exclusão.

**Medidas de segurança já implementadas:** senhas com bcrypt; primeiro acesso por código entregue pela escola; trava de conta após tentativas erradas; contas da gestão por pessoa com perfis de acesso; auditoria de inclusões, alterações, exclusões e exportações; sessões que caem ao trocar senha ou perfil; fotos servidas só com login; isolamento entre escolas; dados sensíveis só para a escola.
