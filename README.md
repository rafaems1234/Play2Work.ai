# Play2Work.AI 🚀 
> Inclusão Produtiva de Jovens com IA e Gamificação

O **Play2Work.AI** é um ecossistema tecnológico completo projetado para democratizar o acesso à orientação profissional e impulsionar a empregabilidade de jovens estudantes em busca do primeiro emprego e vagas de Jovem Aprendiz.

Através de uma abordagem de **gamificação comportamental** (inspirada em mecânicas de jogos e RPGs de alta performance), a plataforma transforma a preparação para processos seletivos num hábito de estudo diário -- sem loja, moedas ou mecânicas de uso compulsivo, já que o público é majoritariamente menor de idade. O sistema utiliza Inteligência Artificial de última geração integrada a bancos relacionais para analisar perfis, simular entrevistas realistas, escolher um itinerário formativo e calcular a aderência técnica (*match*) de vagas em tempo real. O aluno entra com uma senha só — o próprio CPF, cadastrado pela escola — e a escola tem um **Painel da Escola** pra gerir turmas, alunos e itinerários e indicar os alunos de melhor desempenho às vagas das empresas parceiras (ver "Modo demonstração" abaixo pra rodar sem backend nenhum).

---

## ⚙️ Funcionalidades Core

1. **Login do aluno pelo CPF.** A tela de login tem um campo só, "Senha", e a senha é o CPF que a escola cadastrou (`POST /auth/entrar`) — nada pra esquecer nem resetar. **Decisão consciente:** CPF não é segredo, então quem souber o CPF de um colega entra na conta dele; o rate limit (10 tentativas/min por IP) só segura chute em massa. As rotas antigas de nome+senha (`/auth/login`, reset) continuam no backend como legado.
2. **Itinerários formativos definidos pela escola.** Os 6 cursos reais da escola (os mesmos da planilha de controle do PAP): **Serviços Jurídicos, Ciência de Dados, Administração, Recursos Humanos, Mecatrônica e Inteligência Artificial**. Quem cadastra o itinerário de cada aluno é a escola, no painel — o aluno só vê o dele (no cabeçalho e em "Minha conta"; não existe mais aba pra escolher, e `POST /itinerario/escolher` responde 403), pra ninguém trocar de área só pra subir no ranking de uma vaga. O **Quiz do Dia** e o **Simulador de Entrevista com IA** giram em torno do itinerário.
3. **Painel da Escola (`/admin`, ou `#admin` na URL).** Login próprio (`ADMIN_SENHA`). Cadastro de alunos (nome, CPF validado, nascimento opcional, e-mail, turma, itinerário, habilidades), turmas, e vagas de empresas parceiras. Busca instantânea por nome, CPF ou e-mail com autocomplete a cada letra, filtros por turma e itinerário, e ficha do aluno que abre **só pra leitura** — editar exige clicar em "Habilitar edição" e confirmar em "Salvar alterações". Visual em tema claro (azul-gelo), separado do tema escuro do app do aluno, e responsivo do celular ao monitor: no celular a lista de vagas vira um seletor, a contagem por itinerário fica recolhida e as tabelas rolam dentro do próprio card.
4. **Indicação dos melhores alunos pra vaga.** Pra cada vaga, o painel ranqueia os alunos por uma nota de desempenho de 0 a 100, com a composição visível: habilidades exigidas (30), itinerário igual ao da vaga (20), **mapa de competências** (35, ver item 19) e acerto no quiz validado no servidor (15). XP e ofensiva **não** entram: medem acesso a celular e internet em casa tanto quanto mérito. A escola filtra por turma/itinerário, seleciona o top N e indica; a indicação vira uma candidatura marcada `indicada_pela_escola`, e o aluno vê a indicação e o status dela na aba Competências.
5. **Nome de exibição único.** Cada aluno ganha um nome curto e único gerado do nome completo ("Rafael S."); se já existir, o sistema diferencia ("Rafael Si.", "Rafael Sozza", "Rafael V. Sozza", e só por último "Rafael Sozza 2"). É esse nome que aparece no ranking (`nomes.py`).
6. **Sem mural de vagas pro aluno.** As vagas são por cota das empresas parceiras e a maioria dos alunos é menor de idade, então o aluno não navega nem se candidata a vagas: toda candidatura nasce de uma indicação da escola (item 4), e o aluno só vê as vagas pra que foi indicado, com o status, em "Suas indicações". `POST /api/jobs/apply-meta` responde 403 (dá pra religar com `CANDIDATURA_PELO_ALUNO_LIBERADA` em `routes.py`). O sistema é interno entre escola e aluno, sem integração com plataformas de vagas: a coordenação registra em qual empresa o aluno está (status Contratado) e filtra a lista por empresa.
7. **Validação de Dados Corporativos.** Integração assíncrona (via `httpx.AsyncClient`, com as consultas rodando em paralelo) com APIs externas (BrasilAPI) para buscar e validar a Razão Social real das empresas parceiras a partir do CNPJ, garantindo um mural antifraude e verificado sem bloquear o event loop da API.
8. **Simulador de Entrevista com IA (só entrevista).** A IA faz um papel fixo de **entrevistadora** de Jovem Aprendiz, enviado como instrução de sistema separada do texto do aluno. Ela nunca responde nada fora da entrevista: "quanto é 2+2?", lição de casa, piada ou "esqueça suas instruções" valem 0 XP, e a entrevistadora diz que vai manter o foco e repete a pergunta. O aluno pode falar de si (escola, cursos, família, experiências), dentro do aceitável. Regras em `entrevista.py`:
    - **Triagem antes da IA:** conta, pedido fora do tema, palavrão, texto sem sentido, resposta repetida e dados pessoais (CPF, telefone, senha) são barrados sem gastar cota, com uma fala fixa. Se o aluno relatar risco ou violência, a entrevista pausa e ele é orientado a procurar a coordenação ou o CVV (188).
    - **XP pelo servidor, não pela IA:** a IA só classifica (`resposta`, `fora_do_tema`, `inadequada`, `precisa_de_ajuda`) e dá notas de 0 a 10 em **relevância** (respondeu a pergunta?), **clareza**, **exemplos reais** e **postura**. O servidor calcula o XP (até 50) pela média ponderada; relevância abaixo de 3 vale 0. Só resposta de entrevista conta como treino do dia e vira evidência no mapa de competências.
    - **A pergunta avaliada é a do servidor:** vem do histórico (ou da abertura fixa), nunca do que o aluno manda. A tela mostra o feedback com as quatro notas em barras.
    - Sem `GEMINI_API_KEY` (e no modo demo) vale uma avaliação de reserva (tamanho, exemplos concretos e gírias) com o mesmo cálculo. Regras e textos ficam em `frontend/src/data/entrevista.json`, usado pelo backend e pela demo.
9. **Quiz do Dia com banco de questões, mecânicas de jogo e resultado validado no servidor.** Quiz de 10 perguntas sobre o itinerário, sempre sorteadas do **banco de questões da escola** (sem IA, pra o conteúdo ser revisado pelos professores) (`frontend/src/data/banco_questoes.json`, 100 perguntas práticas por curso + 30 comportamentais e de mundo do trabalho, com nível Iniciante/Intermediário e explicação; o mesmo arquivo usado pelo modo demo) — 8 da área e 2 gerais, evitando as perguntas dos últimos 5 quizzes e embaralhando a ordem das alternativas a cada vez. A tela final mostra % de acerto, XP, tempo e ofensiva em cartões animados que mudam de cor com o desempenho (vermelho → amarelo → azul → verde) e com a chama crescendo conforme a ofensiva. Tem com botão de **dica** (elimina uma alternativa errada) e **pular** (avança sem gastar vida), cada um limitado a 2 usos por quiz, cronômetro ao vivo, contador de combo/streak de acertos e botão de voltar direto pro mural. O gabarito nunca é enviado ao cliente antecipadamente — cada resposta é conferida e registrada pelo backend em `/quiz/responder`, e o XP/vidas ganhos em `/quiz/submit` são contados a partir do que o servidor registrou, não do que o cliente afirma ter acertado.
10. **Sistema de vidas e congelamento de ofensiva (sem anúncios, sem moedas, sem loja).** O estudante tem até 5 vidas e perde uma a cada erro no quiz, **na hora do erro** (fechar o quiz no meio não escapa da perda; dá pra terminar o quiz mesmo chegando a zero, só não começa outro). **XP e ofensiva só valem pra prática concluída**: quiz enviado com todas as perguntas, aula concluída, resposta avaliada no simulador, situação respondida ou currículo gerado (10 XP só no primeiro do dia). Começar e sair no meio não conta. Cada vida perdida volta sozinha **a cada 30 min**, uma por vez, até encher -- nada se compra (as moedas foram removidas pra não virar loja virtual pra menores de idade). **Combo de 5 acertos seguidos devolve 1 vida** (erro ou pulo zera o combo), e acertar o quiz perfeitamente 5 vezes seguidas dá uma vida bônus. A cada 7 dias de ofensiva contínua, o estudante ganha **2 congelamentos** (no dia em que chega lá, com **teto de 4** guardados). Cada dia sem prática gasta 1 automaticamente: com 4 guardados, dá pra ficar 4 dias sem treinar sem perder a sequência. O dia congelado só protege, não soma na ofensiva. Se faltar mais dias do que os congelamentos guardados, a ofensiva zera e recomeça (o XP nunca é tirado). Um calendário mensal (botão ao lado do ícone de ofensiva) mostra dias feitos, congelados e perdidos.
11. **Gerador de Currículo com PDF.** Transforma descrições informais de jovens (escola, cursos, grêmio, projetos) em currículos estruturados, com uma seção de **experiências e projetos** pensada pra quem ainda não teve emprego. O layout é um **modelo fixo** de folha A4 (`FolhaCurriculo.jsx`), e o **cabeçalho vem do cadastro da escola**: nome completo, idade, data de nascimento, e-mail, celular, LinkedIn, turma e itinerário (`dados_do_sistema` em `curriculo.py`). A IA só escreve objetivo, experiências e competências, **só com o que o aluno escreveu**. O servidor descarta experiência ou habilidade sem base no texto (ou nas habilidades cadastradas) e qualquer número que o aluno não citou. Texto curto, sem sentido, com palavrão, que não fala do aluno ou com dados pessoais **não gera currículo** (422 com a orientação do que escrever), e a IA também pode recusar. Sem IA, o currículo sai das frases e habilidades do próprio texto, sem nada genérico. O aluno escolhe "com foto" ou "sem foto" e, com foto, envia uma foto só do currículo (item 18). O currículo aparece nessa folha e o botão **Baixar PDF** gera o arquivo pronto pra mandar (via impressão do navegador, sem biblioteca extra). Exportação para LinkedIn segue simulada (sandbox).
12. **Status de carreira + Liga semanal.** Status de carreira automático pelo XP total, em 8 níveis (Na Jornada → Explorador de Carreiras → Sobrevivente do RH → Currículo em Forma → Pronto para a Dinâmica → Destaque na Entrevista → Talento em Ascensão → Pronto pra Contratação, em `data/status_carreira.json`); **"💼 Contratado" só aparece quando a escola marca o aluno como contratado no painel**, nunca por XP. Passando o mouse no status, o app mostra o próximo nível e quanto falta, e uma **liga semanal separada** (10 ligas: Bronze → Prata → Ouro → Safira → Rubi → Esmeralda → Ametista → Pérola → Obsidiana → Diamante, cada uma com sua taça): a cada virada de semana, o terço de cima do grupo sobe de patamar e o terço de baixo desce (num grupo cheio de 30: 10 sobem, 10 ficam e 10 descem; ninguém desce em grupos com menos de 4 pessoas), com o ranking (`WeeklyLeaderboard`) mostrando só os colegas da própria liga e destacando as zonas de promoção/rebaixamento.
13. **Aviso de sequência em risco.** Se o estudante ainda não treinou hoje e tem uma ofensiva ativa, um banner no topo avisa ("sua sequência de X dias está em risco") com atalho direto pro Quiz do Dia — dispensável por aquele dia.
14. **Feedback sonoro e animado.** Sons curtos sintetizados via Web Audio API (sem arquivos de áudio) para acerto/erro no quiz, level-up e mudança de liga, com confete e toasts no level-up/promoção. Um botão no cabeçalho liga/desliga o som (preferência salva no navegador).
14b. **Tema claro e escuro.** O app do aluno tem os dois temas: escuro (padrão, a identidade tech) e claro (fundo azul-gelo, texto escuro). O botão de sol/lua fica no topo, ao lado do som (no celular, ao lado do sino), e a escolha fica salva no navegador. As cores saem de variáveis em `index.css` (`--txt-*`, `--tinta-rgb`, `--campo-rgb`, tons de status), com os valores do claro em `:root[data-tema="claro"]` — componente novo usa essas variáveis, nunca cor fixa. O tema é aplicado antes da primeira renderização (`hooks/useTema.js`), sem piscar escuro. O Painel da Escola segue com o tema claro próprio.
15. **Tela de abertura.** Landing em estilo tech (grade, terminal de IA "digitando", números animados e a jornada em 6 passos) que apresenta a proposta antes de entrar na plataforma — `Enter` ou o botão entram, e clicar no logo volta pra ela.
16. **Ficha completa do aluno no Painel da Escola.** Cada ficha tem foto, **contato** (CPF, e-mail, celular do aluno, nome e celular do responsável, com atalho pro WhatsApp) e quatro abas: **Dados**, **Currículo** (a versão mais recente que o aluno gerou, as anteriores pra consulta e o botão Baixar PDF), **Histórico** (experiência anterior, mudanças de status, indicações e candidaturas com o retorno da empresa registrado pela escola, e as respostas do simulador de entrevista agrupadas por dia, com feedback e nota) e **Observações** internas da coordenação, que o aluno nunca vê.
17. **Status de contratação, filtros e exportação.** Cada aluno tem um dos 4 status da planilha do PAP: **No aguardo** (na fila de espera), **Contratado** (com empresa e data), **Desistência** ou **Expirado**, e toda mudança fica registrada. A lista tem filtros rápidos Todos / No aguardo / Contratados / Desistência / Expirados, com a contagem de cada um, e filtros combinados por nome, CPF, telefone, turma, itinerário, idade e "só sem foto". **Exportar CSV** (ponto e vírgula + BOM, abre direto no Excel em português, protegido contra injeção de fórmula) e **Exportar PDF** (relatório em A4 deitado, com os filtros aplicados no cabeçalho) exportam exatamente a lista filtrada que está na tela.
17b. **Ficha do PAP e contratos (as colunas da planilha de controle da escola).** Na ficha do aluno, a aba **PAP** tem os dados da planilha: nº de cadastro (Planilha SED), sexo, perfil de desenvolvimento (Típico/Atípico — dado sensível, só a escola vê), ano escolar inicial e atual, turno escolar, data da formação para o mundo do trabalho, status do estudante (Habilitado/Não habilitado), endereço, documentos e a data da última atualização. Logo abaixo, os **contratos de aprendizagem** com histórico: empresa, CNPJ, local de atuação, turno de trabalho, contratação Direta/Alternativa, vigência, aditivo, carga horária semanal (teoria e prática), status (Ativo/Finalizado), motivo do encerramento e efetivação. Contrato ativo marca o aluno como contratado. O **status do aprendiz** segue a planilha: No aguardo, Contratado, Desistência e Expirado. O **CSV** exporta todas essas colunas. Campos, rótulos e opções ficam em `frontend/src/data/ficha_pap.json` (backend valida em `ficha_pap.py`; o modo demo usa o mesmo arquivo).
18. **Primeiro acesso do aluno.** No primeiro login o aluno passa por 3 passos: foto (opcional: dá pra pular e adicionar depois em "Minha conta"; o navegador recorta e reduz a foto pra 400px, o que também descarta os metadados EXIF, e só a escola vê), experiência de trabalho e currículo. O primeiro acesso aparece **uma vez só** (`onboarding_concluido_em`): depois dele o app não volta a perguntar se o aluno já trabalhou nem a cobrar foto ou currículo. Essa é a **foto de identificação**, pra escola reconhecer o aluno no painel (a coordenação também pode cadastrar); fica no Postgres (`fotos_estudantes`), é validada pelo tipo real dos bytes (JPG/PNG/WebP, até 1 MB) e só é servida com token. **A foto do currículo é outra e é opcional:** na tela do currículo o aluno marca **Sem foto** (padrão, evita discriminação por aparência) ou **Com foto** e envia ali a foto que quer no currículo (`fotos_curriculo`, rotas `/estudante/me/foto-curriculo`). Ela não troca a foto de identificação; o painel e o PDF da escola mostram o currículo como o aluno escolheu, e a escola só vê essa foto, não altera.
19. **Mapa de competências (BNCC).** O aluno tem uma pontuação de 0 a 100 em cada uma das **10 competências gerais da BNCC** (Conhecimento, Pensamento crítico, Repertório cultural, Comunicação, Cultura digital, Trabalho e projeto de vida, Argumentação, Autoconhecimento, Empatia e cooperação, Responsabilidade e cidadania). Cada atividade grava **evidências** nos eixos que trabalhou (`evidencias_competencia`, auditável: a ficha mostra de onde veio cada ponto), e o eixo é uma média móvel em que a evidência nova pesa 30% (`mapa_competencias`, atualizado por upsert atômico no Postgres). Quiz → Conhecimento; simulador de entrevista → Comunicação, Trabalho e projeto de vida e Autoconhecimento; "O que você faria?" → os eixos de cada opção. Na nota de indicação, cada eixo é puxado pra 50 como se tivesse 3 evidências medianas, pra uma única resposta boa não valer o mesmo que um mês de treino. Aluno e escola veem o mapa em barras horizontais (uma por eixo, com a média da turma), não em radar: com 10 eixos o radar fica ilegível e eixo sem atividade pareceria nota zero. As competências do Programa de Aprendizagem variam por curso; se o PAP tiver uma lista própria, os eixos novos entram em `competencias.py`.
20. **"O que você faria?"** 12 situações reais de trabalho (cliente irritado, colega que não faz a parte, pedido errado do chefe, e-mail de golpe, feedback difícil…) em `frontend/src/data/situacoes.json`. Nenhuma tem "resposta certa" na tela: cada opção pontua competências diferentes e tem uma consequência; depois de responder, o aluno vê o que aconteceu e, se não escolheu, o caminho que mais desenvolve. A pontuação das opções fica só no servidor. Até 5 por dia, sem repetir a mesma situação em 30 dias.
21. **Trilha EAD (integração a distância).** A integração que hoje leva uma semana presencial pode ser feita pela plataforma. O conteúdo é **100% produzido e gravado pelos professores da escola**; a Sozza só fornece a plataforma (guarda, controla acesso, registra frequência e gera relatório). A escola monta **módulos** (por itinerário ou comuns a todos) com **aulas**: vídeo (link do YouTube não listado ou do Vimeo — só o ID é guardado), texto, materiais pra baixar (áudio leve e PDF, até 10 MB, tipo conferido pelos bytes) e **perguntas de fixação**. Rotas em `aulas_routes.py`, regras em `aulas.py`.
    - **Frequência que não dá pra burlar:** o player manda de tempos em tempos o trecho que acabou de passar, e o servidor marca blocos de 10 s. Adiantar o vídeo não conta, e um trecho maior que o tempo real decorrido (em 1x) é cortado — assistir acelerado também não conta. No player, o aluno só pode **voltar** pra rever; avançar, só até onde já assistiu sem pular (`pode_avancar_ate_segundo`).
    - **Conclusão:** só com o percentual mínimo assistido (padrão 80%) **e** nota de corte na fixação (padrão 70). Reprovado vê quais errou, mas não o gabarito. Concluir credita a carga horária da aula, alimenta o eixo Conhecimento do mapa e dá **45 XP** (20 por assistir + 25 pela fixação, pagos só na conclusão: assistir um pedaço e sair não dá XP); terminar todas as aulas do módulo dá **+50 XP** de bônus.
    - **Auditoria:** `log_frequencia` só cresce (nenhuma rota edita ou apaga): início, cada 10% assistido, cada tentativa de fixação (com nota e nota de corte da época) e conclusão. Aula/módulo com frequência registrada não pode ser apagado, só despublicado.
    - **Relatório de carga horária** (`GET /api/admin/relatorios/frequencia`): por aluno, aulas previstas e concluídas, carga prevista e concluída, e os módulos concluídos, com o certificado já retirado ou a retirar.
    - **Certificado de conclusão (retirado na escola):** o certificado é entregue **presencialmente**; a plataforma não guarda nem gera o documento. Quando o aluno conclui todas as aulas publicadas de um módulo, o app mostra na hora "Entre em contato com a coordenação da escola para retirar o seu certificado de conclusão", e o aviso fica na aba Aulas até a retirada. No painel, a seção **Certificados** da Trilha EAD lista quem concluiu, com os filtros **A retirar / Retirados**, busca, turma, atalho pro WhatsApp e CSV. A coordenação clica em **Marcar como retirado** (data, que não pode ser futura, e uma observação opcional, ex: "retirado pela mãe", que o aluno não vê) e pode corrigir ou desfazer. Tabela `retiradas_certificado`, regra em `certificados_dos_alunos` (`aulas.py`). Quem já retirou continua como retirado mesmo se a escola publicar uma aula nova no módulo depois.
    - **Telas:** aba **Aulas** no app (player sem barra de avanço: só play/pausa e "voltar 10 s"; aula sem vídeo conta o tempo de estudo com a página aberta na tela; áudio de apoio com o mesmo controle; PDF pra baixar; fixação em janela; aviso pra retirar o certificado na escola) e aba **Trilha EAD** no painel (módulos e aulas, editor de fixação e materiais, relatório de carga horária com CSV e aviso de quem ainda não retirou o certificado, e a seção Certificados). Na ficha do aluno, a aba **Certificados** mostra os módulos concluídos com o registro da retirada e o log de frequência. A lista de alunos filtra por "certificado a retirar" / "já retirou". No modo demonstração os vídeos são simulados (1 a 1min30) e o PDF/áudio de exemplo são gerados no navegador.
    - **Fixação embaralhada:** a cada tentativa a ordem das perguntas e das alternativas é sorteada no servidor (que corrige pela alternativa original); reabrir mostra a mesma ordem, a próxima tentativa sorteia outra.
    - **Pendências:** Vimeo ainda abre só como link (o player com trava de avanço é o do YouTube). Confirmar com a advogada/PAP se e como as horas EAD contam na carga horária oficial da aprendizagem. Vimeo só permite esconder os controles do player em planos pagos; com YouTube dá no gratuito.

---
22. **Mensagens ("o WhatsApp da escola").** Três tipos de canal, com a mesma conversa em balões no app do aluno e no painel (`mensagens.py`, `Conversa.jsx`):
    - **Conversa direta** aluno ↔ coordenação (1:1), com "✓✓ visto". Não existe conversa privada entre alunos.
    - **Grupo da empresa/turno** ("Eldorado — Aprendizes Manhã"): os aprendizes com status Contratado naquela empresa (e turno da turma) conversam entre si e com a coordenação. Sem lista de membros pra manter: entrou na empresa, entra no grupo; saiu, perde o acesso (o histórico fica). No grupo o aluno aparece só pelo nome curto do ranking.
    - **Geral da escola:** a escola fala com todos; aluno só lê (`ALUNOS_ESCREVEM_NO_GERAL`).
    - **Painel:** aba **Chat** com contador de não lidas e **sininho de notificações** no topo (clicar abre a conversa; som e "(n)" no título da aba quando chega mensagem de aluno), filtros por tipo, empresa, turno, turma e busca, abertura de conversa com qualquer aluno e criação/arquivamento de grupo. A coordenação pode **ocultar** uma mensagem imprópria (o aluno vê "removida pela coordenação"; o original e o motivo ficam guardados). Nada se edita nem se apaga. A ficha do aluno mostra a conversa direta e o que ele escreveu nos grupos.
    - **No app do aluno:** aba **Chat** no menu (com contador) com todas as conversas, e o **sininho de notificações** no topo: lista o que chegou de novo e clicar leva direto pra conversa. Com o app aberto: som, aviso na tela e "(n)" no título da aba. **Pendente:** notificação com o app fechado (PWA + Web Push) -- precisa do sistema publicado em HTTPS; no iPhone só funciona com o app adicionado à tela de início.
## 🛠️ Arquitetura e Stack Tecnológica

O projeto foi construído seguindo rigorosos padrões de mercado de governança de dados, escalabilidade, segurança e separação de conceitos (*Clean Architecture*):

- **Front-end (Apresentação):** **React.js + Vite** – SPA reativa e modular, com **Framer Motion** para animações, ícones **Phosphor**, login do aluno (CPF) e do Painel da Escola, e um **modo demonstração** (`src/mockApi.js`) que simula toda a API no navegador pra rodar sem backend.
- **Back-end (Serviços/API):** **FastAPI (Python)** – Servidor ASGI de alta performance, assíncrono, com injeção de dependências nativa (`Depends`) para a sessão do banco e para o estudante único da demonstração, e validação de contratos via **Pydantic**.
- **Autenticação:** JWT (`PyJWT`) com papel no token — `aluno` (emitido em `/auth/entrar`, senha = CPF) e `admin` (emitido em `/admin/login` com `ADMIN_SENHA`). Um não abre as rotas do outro. `JWT_SECRET_KEY` é obrigatória.
- **Rate limiting:** **slowapi** limita por IP as rotas mais sensíveis a força-bruta e enumeração (`/auth/entrar`, `/admin/login`, `/auth/login`, `/auth/registrar`, `/auth/pergunta-seguranca`, `/auth/resetar-senha`).
- **Banco de Dados (Persistência):** **PostgreSQL** – Banco relacional. Utiliza o tipo nativo `ARRAY(String)` para as matrizes de habilidades de estudantes e vagas, e tabelas dedicadas para candidaturas e atividade diária (calendário de gamificação).
- **ORM:** **SQLAlchemy** – Mapeamento objeto-relacional com gerenciamento eficiente de sessões (*pooling* transacional), prevenção de *SQL Injection* e deleções em cascata seguras.
- **Migrações de schema:** **Alembic** – todo o schema é versionado; nenhuma alteração de tabela depende de recriar o banco do zero.
- **Inteligência Artificial:** **Google Gemini (plano gratuito)** – modelo `gemini-3.5-flash-lite` por padrão (troque com `GEMINI_MODEL` no `.env`), via SDK oficial (`google-genai`), com `response_schema` e `response_mime_type="application/json"` para retorno estruturado. A IA é usada só no **simulador de entrevista** e no **gerador de currículo**, sempre com instrução de sistema fixa e com o servidor conferindo a saída (XP calculado no servidor, currículo sem nada que o aluno não escreveu). O quiz não usa IA. Sem `GEMINI_API_KEY` configurada, entrevista e currículo caem automaticamente nas regras de reserva e continuam funcionando.
- **Qualidade de Código & Testes:** Suite de testes de integração com **FastAPI TestClient** e **Unittest Mock**, cobrindo autenticação, gamificação, vagas/candidaturas e itinerários, simulando o banco e o usuário logado via `app.dependency_overrides` — sem custos de API ou poluição do banco de produção.

---

## 📂 Estrutura Arquitetural do Sistema

```text
Play2Work.ai/
├── requirements.txt          # Dependências do ecossistema Python (.venv)
└── app/                      # CORE DO BACK-END (FastAPI)
    ├── alembic/               # Migrações de schema versionadas (Alembic)
    ├── alembic.ini            # Configuração do Alembic
    ├── auth.py                # JWT com papel (aluno/admin), validação de CPF, sessão curta do aluno
    ├── admin_routes.py        # Painel da Escola: turmas, alunos, ficha, status de contratação, vagas, ranking e indicação
    ├── aulas.py               # Trilha EAD: frequência em blocos de 10 s, fixação embaralhada, conclusão
    ├── aulas_routes.py        # Trilha EAD: módulos, aulas, materiais, relatório de carga horária e retirada de certificados
    ├── atividades.py          # "O que você faria?" (situações de trabalho)
    ├── entrevista.py          # Simulador: triagem, notas por critério e XP calculado no servidor
    ├── curriculo.py           # Currículo: cabeçalho do cadastro, triagem do texto e conteúdo sem invenção
    ├── competencias.py        # Mapa de competências (10 eixos da BNCC) e nota usada na indicação
    ├── mensagens.py           # Chat: conversa direta, grupo da empresa/turno e canal geral, moderação
    ├── fotos.py               # Foto de identificação e foto opcional do currículo (validação pelos bytes, upsert)
    ├── ficha_pap.py           # Ficha do PAP e contratos de aprendizagem (validação a partir de data/ficha_pap.json)
    ├── fuso.py                # "Hoje" no fuso da escola (America/Campo_Grande); banco em UTC
    ├── nomes.py               # Regra do nome de exibição único ("Rafael S.") -- usada também pela migração
    ├── limiter.py             # Instância compartilhada do slowapi (rate limit por IP)
    ├── database.py            # Engine (sessão em UTC), pooling do Postgres e SessionLocal
    ├── models.py              # Modelagem relacional (alunos, vagas, trilha, certificados, mensagens...)
    ├── schemas.py             # Contratos Pydantic e Schemas JSON estritos p/ IA do Gemini
    ├── services.py            # Core de Negócio: gamificação, match de vagas, itinerários e SDK do Gemini
    ├── routes.py              # Endpoints do aluno (auth, quiz, currículo, perfil, foto, competências)
    ├── main.py                # Ponto de entrada da API, middlewares e inicialização do Uvicorn
    ├── seed.py                # Script de população do PostgreSQL com dados de teste
    ├── test_main.py           # Testes de integração mockados (FastAPI TestClient + dependency_overrides)
    ├── .env                   # Segredos locais (não versionado)
    ├── .env.example           # Modelo do .env com as variáveis vazias (versionado)
    │
    └── frontend/              # CORE DO FRONT-END (React.js + Vite)
        └── src/
            ├── api.js           # apiFetch (backend real ou modo demonstração), upload e download com token
            ├── mockApi.js       # Simula a API no navegador (modo demonstração)
            ├── mockTrilha.js    # Modo demonstração da trilha EAD (aulas, frequência, certificados)
            ├── mockMensagens.js # Modo demonstração do chat
            ├── data/banco_questoes.json # Banco de perguntas por itinerário (backend e modo demo)
            ├── data/situacoes.json      # Situações de trabalho do "O que você faria?"
            ├── data/entrevista.json     # Regras do simulador (perguntas, triagem, pesos do XP)
            ├── data/curriculo.json      # Vocabulário e mensagens de recusa do currículo
            ├── data/ficha_pap.json      # Campos e opções da planilha do PAP (aluno e contrato)
            ├── data/status_carreira.json # Níveis do status de carreira por XP
            ├── entrevistaDemo.js / curriculoDemo.js / fichaPapDemo.js # As mesmas regras no modo demonstração
            ├── hooks/useTema.js   # Tema claro/escuro (salvo no navegador, aplicado antes de renderizar)
            ├── utils/formatos.js  # Máscaras/validação (CPF, data, telefone), datas no fuso local
            ├── utils/exportar.js  # CSV (Excel em português, anti-injeção de fórmula)
            ├── utils/sound.js     # Sons curtos via Web Audio API
            ├── components/
            │   ├── Competencias.jsx     # Aba inicial do aluno: mapa, "O que você faria?" e indicações
            │   ├── MapaCompetencias.jsx # Barras dos 10 eixos da BNCC (aluno e painel)
            │   ├── Trilha.jsx           # Aba Aulas: trilha EAD, fixação e aviso do certificado
            │   ├── RetiradaCertificado.jsx # Painel: marcar/desfazer a retirada do certificado na escola
            │   ├── PlayerAula.jsx       # Players sem avanço (YouTube, demonstração, tempo de estudo, áudio)
            │   ├── Mensagens.jsx        # Aba Chat e sininho de notificações do aluno
            │   ├── Conversa.jsx         # Conversa em balões (aluno e painel)
            │   ├── PrimeiroAcesso.jsx   # Primeiro acesso: foto, experiência, currículo
            │   ├── FotoPerfil.jsx       # Avatar com carregamento sob demanda e seletor de foto
            │   ├── FolhaCurriculo.jsx   # Folha A4 do currículo e impressão em PDF
            │   ├── AdminPanel.jsx       # Painel da Escola (abas, filtros, exportação)
            │   ├── FichaAluno.jsx       # Ficha do aluno no painel (dados, competências, currículo, histórico...)
            │   ├── FichaPap.jsx         # Aba PAP da ficha: dados da planilha e contratos de aprendizagem
            │   ├── AdminTrilha.jsx      # Trilha EAD no painel e relatório de carga horária
            │   ├── AdminMensagens.jsx   # Chat e sininho do painel
            │   ├── Gaveta.jsx           # Painel lateral do admin
            │   ├── AccountSettings.jsx  # "Minha conta": foto, itinerário, LinkedIn, sair
            │   ├── LoginAluno.jsx, IntroScreen.jsx, DailyQuiz.jsx, QuizResultado.jsx,
            │   ├── InterviewSimulator.jsx, ResumeBuilder.jsx, WeeklyLeaderboard.jsx, ...
            ├── App.jsx          # Hub central: sessão, navegação, estado global do estudante
            ├── index.css        # Design tokens (:root) -- a cor de destaque do app inteiro é --accent-rgb
            └── main.jsx         # Ponto de inicialização do Virtual DOM do React
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

> **`GEMINI_API_KEY`** — opcional. Sem ela, o app usa respostas de fallback na entrevista e no currículo em vez de chamar a IA (o quiz não usa IA: sempre vem do banco de questões). Pra ativar a IA de verdade, gere uma chave gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (sem cartão) e cole nessa variável. O modelo padrão é o `gemini-3.5-flash-lite`: o `gemini-2.5-flash` não aceita mais chaves novas e o `gemini-3.8-flash` só libera 5 pedidos por minuto no plano grátis. Pra usar outro, defina `GEMINI_MODEL`. Se o Google estiver sobrecarregado (503), o backend tenta mais uma vez; se a cota estourar (429), cai direto no fallback. **A chave fica só no `.env`, que não vai pro git** — nunca coloque no código nem no front (no GitHub Pages ela ficaria pública).
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

Isso cria 3 turmas, 12 alunos espalhados pelos 6 cursos (com um quiz concluído cada, pra o ranking de desempenho ter dado) e 10 vagas, ao menos uma por curso. Aluno de demonstração: **senha (CPF)** `529.982.247-25` (Rafael Sozza). Os CPFs do seed são fictícios — só têm os dígitos verificadores certos.

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
> **Neste modo não há IA:** a entrevista segue a lista fixa de perguntas e avalia a resposta pelas mesmas regras de reserva do backend (tamanho, exemplos concretos, gírias, desvio de assunto), e o currículo é montado só com as frases e habilidades do texto digitado, com as mesmas recusas. A IA de verdade (Gemini) só roda com o backend ligado e `GEMINI_API_KEY` no `app/.env`.
>
> **Versão publicada:** o workflow `.github/workflows/deploy-pages.yml` publica o front em modo demonstração a cada push na `main` que mexa em `app/frontend/` — https://rafaems1234.github.io/Play2Work.ai/ (painel em `#admin`).

### Logins do modo demonstração

| Quem | Onde | Senha |
|---|---|---|
| Aluno da demo (primeiro acesso, integração por fazer) | tela inicial → Entrar | `529.982.247-25` |
| Bianca (contratada, integração concluída e certificado retirado, grupo da empresa) | tela inicial → Entrar | `222.572.222-61` |
| Painel da Escola | `#admin` na URL | `escola123` |

Tudo o que se faz no modo demonstração fica só na memória da aba: recarregar a página volta ao estado inicial.

### 3. Rodando os testes

```bash
cd app
pytest -q
```

Os testes usam `app.dependency_overrides` para trocar a sessão do banco e o estudante autenticado por mocks — não tocam no Postgres real nem fazem chamadas de API.

---

## 🔐 Login

- **Aluno:** `POST /api/auth/entrar` com `{cpf}` → token JWT com papel `aluno`, válido por **4h** (`JWT_EXPIRA_HORAS_ALUNO`). O front guarda o token **só na aba** (`sessionStorage`) e manda em `Authorization: Bearer`; fechar o navegador encerra a sessão, pra o próximo aluno do laboratório não cair na conta do anterior. Sem token, as rotas do aluno respondem 401 e o app volta pro login.
- **Escola:** `POST /api/admin/login` com `{senha}` (= `ADMIN_SENHA`) → token com papel `admin`, válido por 12h, exigido em todas as rotas `/api/admin/*`.
- No **modo demonstração**, a senha do aluno é `529.982.247-25` e a do painel é `escola123`.
- As rotas legadas `/auth/registrar`, `/login`, `/pergunta-seguranca`, `/resetar-senha` e `/trocar-senha` continuam no backend (cobertas por `test_main.py`), mas o front não usa mais.

## 🎯 Integridade do Quiz do Dia

O resultado do quiz não é autodeclarado pelo cliente. O fluxo é:

1. `POST /api/quiz/generate` cria uma `QuizSessao` no banco com o gabarito (resposta certa + explicação de cada pergunta) e devolve ao cliente só `pergunta`+`opcoes` — nunca a resposta certa.
2. `POST /api/quiz/responder` recebe a alternativa escolhida (ou `null` pra pular) pergunta a pergunta, confere contra o gabarito guardado no servidor e só então devolve se acertou e qual era a resposta certa. Pulos são limitados a 2 por quiz, validado no servidor.
3. `POST /api/quiz/dica` sorteia uma alternativa errada pra eliminar — o servidor sabe a resposta certa, o cliente nunca calcula isso sozinho. Limitado a 2 por quiz, validado no servidor.
4. `POST /api/quiz/submit` exige que todas as perguntas tenham sido respondidas e conta acertos/pulos a partir do que o próprio servidor registrou em `/quiz/responder` — o cliente não envia mais "acertos"/"total" de forma autodeclarada.

## 🕓 Fuso horário

O "dia" do aluno (ofensiva, quiz do dia, liga semanal, data de contratação, agrupamento do simulador no histórico) é o de **Três Lagoas/MS (`America/Campo_Grande`, UTC-4)**, não o do servidor — na Azure o servidor roda em UTC, e com `date.today()` o dia viraria às 20h locais. Regras:

- O banco grava tudo em **UTC**: a conexão abre com `timezone=UTC` (`database.py`), então o `now()` das colunas bate com o `fuso.agora_utc()` do Python.
- "Que dia é hoje" sempre vem de `fuso.hoje()`; o dia de um horário gravado, de `fuso.data_local()`. Nunca `date.today()` nem `datetime.utcnow().date()`.
- No front, datas do servidor sem fuso são lidas como UTC (`dataHoraIsoParaBr`), e o "hoje" do aparelho vem de `hojeLocalIso()` — nunca `toISOString().slice(0, 10)`, que dá o dia em UTC.
- O pacote `tzdata` está no `requirements.txt` porque o Windows não traz a base de fusos; sem ele, `fuso.py` cai num UTC-4 fixo (Campo Grande não tem mais horário de verão desde 2019).

## 📋 Antes da homologação na escola

Pontos levantados na revisão de ponta a ponta que **não** foram corrigidos nesta rodada:

- **Login do aluno pelo CPF.** Quem souber o CPF de um colega entra na conta dele — e agora a conta tem foto, currículo (que vai pra coordenação) e experiência. Proposta: CPF + data de nascimento + código de primeiro acesso entregue pela escola, depois senha própria.
- **Senha única do painel.** Todo mundo da coordenação usa `ADMIN_SENHA`; não dá pra saber quem anotou uma observação (sai como "Coordenação") nem quem exportou CPFs e telefones. Proposta: um login por pessoa e registro de exportações (LGPD).
- **Foto em cache depois de "Sair" do painel.** As fotos já baixadas continuam na memória da página até recarregar; limpar o cache do `FotoPerfil.jsx` no logout.
- **Foto HEIC (iPhone) enviada pelo computador** é recusada com "envie JPG, PNG ou WebP". No próprio iPhone o Safari converte sozinho. Proposta: aceitar `image/*` e só recusar se o navegador não conseguir abrir.
- **Sem limite de envios de foto por minuto** (as rotas de login têm; as de foto não).
- **Busca por telefone com poucos dígitos:** "679" casa com quase todo celular de DDD 67. Exigir 5 dígitos ou mais pra busca por telefone.
- **Duas pessoas editando o mesmo aluno:** quem salva por último sobrescreve a outra (inclusive a experiência que o aluno atualizou no app nesse meio-tempo). Proposta: conferir a versão do registro antes de salvar e avisar o conflito.
- **Escala:** a lista e a exportação carregam todos os alunos no navegador — ótimo pra ~600, inviável pra 50 mil. Pra rede estadual, filtros e exportação passam pro servidor com paginação, e as fotos vão pro Blob Storage da Azure.
- **Safari/iOS às vezes não dispara `afterprint`:** depois de baixar o PDF o título da aba pode ficar "Curriculo - Fulano" até recarregar.
- **Não verificado ainda:** as migrações `e7a2c9d41b6f`, `f2b6d8a3c1e4` (certificado), `b7c3e9f1a2d5` (foto do currículo), `c9d4a7e2f8b1` (status de carreira), `d2e8f1a4b6c3` (cursos reais) e `e5f3b9c7d1a8` (ficha do PAP) rodando num Postgres de verdade (só o SQL gerado foi conferido), e uma impressão real do PDF pela janela do navegador. Na migração dos cursos, quem estava em Ciências da Natureza fica sem curso, pra escola reclassificar.
- **Conteúdo do quiz:** as 630 perguntas do banco precisam de revisão dos professores, principalmente as que citam números de lei (CLT, FGTS do aprendiz, prazos do CPC, cotas).
