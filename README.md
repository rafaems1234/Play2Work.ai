# Play2Work.AI 🚀 
> Inclusão Produtiva de Jovens com IA e Gamificação

O **Play2Work.AI** é um ecossistema tecnológico completo projetado para democratizar o acesso à orientação profissional e impulsionar a empregabilidade de jovens estudantes em busca do primeiro emprego e vagas de Jovem Aprendiz.

Através de uma abordagem de **gamificação comportamental** (inspirada em mecânicas de jogos e RPGs de alta performance), a plataforma transforma a preparação para processos seletivos num hábito de estudo diário -- sem loja, moedas ou mecânicas de uso compulsivo, já que o público é majoritariamente menor de idade. O sistema utiliza Inteligência Artificial de última geração integrada a bancos relacionais para analisar perfis, simular entrevistas realistas, escolher um itinerário formativo e calcular a aderência técnica (*match*) de vagas em tempo real. O aluno entra com usuário e senha próprios (o primeiro acesso é com CPF + um código que a escola entrega em mãos) e a escola tem um **Painel da Escola** pra gerir turmas, alunos e itinerários e indicar os alunos de melhor desempenho às vagas das empresas parceiras (ver "Modo demonstração" abaixo pra rodar sem backend nenhum).

---

## ⚙️ Funcionalidades Core

1. **Acesso do aluno: usuário + senha, com primeiro acesso pela escola** (`acesso.py`, `acesso_routes.py`). CPF não é segredo, então ele sozinho não abre a conta de ninguém:
    - **Usuário** gerado no cadastro a partir do nome, único e sem acento (`rafael.sozza`, `rafael.v.sozza`, `rafael.sozza2`).
    - **Primeiro acesso:** a coordenação gera no painel (aba **Acessos**) um **código de 6 dígitos**, de um aluno ou da turma inteira com bilhetes pra imprimir e recortar, e entrega em mãos. O aluno toca em "Tenho um código da escola", digita CPF + código, vê o usuário dele e cria a senha (8+ caracteres, letras e números, sem CPF nem o usuário). O código vale 7 dias, é de uso único, só o hash fica no banco, e 5 erros anulam o código. Daí em diante o login é usuário + senha; o CPF fica só no cadastro.
    - **Esqueci minha senha:** o aluno pede uma senha nova na tela de entrada (usuário ou CPF; a resposta é a mesma exista a conta ou não). O pedido aparece na aba **Acessos**, com contador na aba e atalho pro WhatsApp do aluno e do responsável. A coordenação **aprova** (gera um código novo pra entregar em mãos) ou **recusa** (com motivo). Aprovar não troca a senha: quem pediu no lugar de outro não recebe nada, e a senha antiga vale até o aluno usar o código. Todo pedido fica no histórico.
    - **Trocar senha** em "Minha conta", com a senha atual.
    - **Segurança:** senha nova (por qualquer caminho) derruba todas as sessões abertas (`sessao_versao` no token). 5 senhas erradas travam a conta por 10 min; o limite por IP é folgado (60/min) porque a turma inteira sai pelo mesmo IP do laboratório. Saíram o login só com CPF, o cadastro aberto e o reset por pergunta de segurança.
2. **Itinerários formativos definidos pela escola.** Os 6 cursos reais da escola (os mesmos da planilha de controle do PAP): **Serviços Jurídicos, Ciência de Dados, Administração, Recursos Humanos, Mecatrônica e Inteligência Artificial**. Quem cadastra o itinerário de cada aluno é a escola, no painel — o aluno só vê o dele (no cabeçalho e em "Minha conta"; não existe mais aba pra escolher, e `POST /itinerario/escolher` responde 403), pra ninguém trocar de área só pra subir no ranking de uma vaga. O **Quiz do Dia** e o **Simulador de Entrevista com IA** giram em torno do itinerário.
3. **Painel da Escola (`/admin`, ou `#admin` na URL).** Uma conta por pessoa da gestão, com perfil de acesso (item 8d). Cadastro de alunos (nome, CPF validado, nascimento opcional, e-mail, turma, itinerário, habilidades), turmas, e vagas de empresas parceiras. Busca instantânea por nome, CPF ou e-mail com autocomplete a cada letra, filtros por turma e itinerário, e ficha do aluno que abre **só pra leitura** — editar exige clicar em "Habilitar edição" e confirmar em "Salvar alterações". Visual em tema claro (azul-gelo), separado do tema escuro do app do aluno, e responsivo do celular ao monitor: no celular a lista de vagas vira um seletor, a contagem por itinerário fica recolhida e as tabelas rolam dentro do próprio card.
4. **Indicação dos melhores alunos pra vaga.** Pra cada vaga, o painel ranqueia os alunos por uma nota de desempenho de 0 a 100, com a composição visível: habilidades exigidas (30), itinerário igual ao da vaga (20), **mapa de competências** (35, ver item 19) e acerto no quiz validado no servidor (15). XP e ofensiva **não** entram: medem acesso a celular e internet em casa tanto quanto mérito. A escola filtra por turma/itinerário, seleciona o top N e indica; a indicação vira uma candidatura marcada `indicada_pela_escola`, e o aluno vê a indicação e o status dela na aba Competências.
5. **Nome de exibição único.** Cada aluno ganha um nome curto e único gerado do nome completo ("Rafael S."); se já existir, o sistema diferencia ("Rafael Si.", "Rafael Sozza", "Rafael V. Sozza", e só por último "Rafael Sozza 2"). É esse nome que aparece no ranking (`nomes.py`).
6. **Sem mural de vagas pro aluno.** As vagas são por cota das empresas parceiras e a maioria dos alunos é menor de idade, então o aluno não navega nem se candidata a vagas: toda candidatura nasce de uma indicação da escola (item 4), e o aluno só vê as vagas pra que foi indicado, com o status, em "Suas indicações". `POST /api/jobs/apply-meta` responde 403 (dá pra religar com `CANDIDATURA_PELO_ALUNO_LIBERADA` em `routes.py`). O sistema é interno entre escola e aluno, sem integração com plataformas de vagas: a coordenação registra em qual empresa o aluno está (status Contratado) e filtra a lista por empresa.
7. **Validação de Dados Corporativos.** Integração assíncrona (via `httpx.AsyncClient`, com as consultas rodando em paralelo) com APIs externas (BrasilAPI) para buscar e validar a Razão Social real das empresas parceiras a partir do CNPJ, garantindo um mural antifraude e verificado sem bloquear o event loop da API.
8. **Simulador de Entrevista contínua com Laudo Final** (`entrevista.py`, `entrevista_routes.py`). Em vez de nota a cada resposta, é uma entrevista de verdade: a IA faz um papel fixo de **entrevistadora** de Jovem Aprendiz (instrução de sistema separada do texto do aluno), conversa de **5 a 7 respostas** com o contexto inteiro da sessão, comenta, faz ganchos com o que o aluno contou e aprofunda. **Nada de nota durante o chat.** Depois do mínimo ela pode encerrar; na 7ª resposta o servidor encerra mesmo que ela queira perguntar mais. Aí aparece **"Finalizar e gerar laudo"**.
    - **Laudo de desempenho:** uma única chamada ao Gemini com a conversa inteira devolve notas de 0 a 10 (relevância, clareza, exemplos reais, postura), **pontos fortes**, **pontos de melhoria** e o **parecer da recrutadora**. A **nota geral (0-100) e o XP (até 150) são calculados no servidor** a partir das notas, nunca pela IA; quem foge das perguntas fica com no máximo 20. O laudo abre numa janela no app e fica salvo na tabela `sessoes_entrevista`; a escola vê na ficha do aluno (aba Histórico) com a conversa inteira. Só as **3 primeiras entrevistas do dia dão XP** (o laudo sai sempre). Gerar o laudo trava a sessão no banco, então dois cliques não dão XP em dobro. Entrevista concluída conta como treino do dia e vira evidência no mapa de competências.
    - **Triagem antes da IA:** conta, palavrão, texto sem sentido, resposta repetida, dados pessoais e desvios por padrão (regex sobre o texto normalizado: "esquece a entrevista", "finge que...", "me ajuda na lição de química", "o que é uma ligação covalente?") são barrados sem gastar cota. A entrevistadora adverte no papel, repete só a pergunta e isso **não conta como resposta** (o app marca "não contou"). Se a IA classificar como fora do tema, a fala dela é descartada do mesmo jeito. Relato de risco ou violência pausa a entrevista e orienta a procurar a coordenação ou o CVV (188).
    - **Retoma de onde parou:** a entrevista aberta fica no servidor (`GET /entrevista/sessao-atual`); recarregar a página não perde a conversa. "Recomeçar" descarta a atual sem laudo.
    - Sem `GEMINI_API_KEY`, com a cota estourada e no modo demo, tudo continua funcionando: as perguntas vêm do banco e o laudo sai pelas regras de reserva (tamanho, exemplos concretos e gírias). Regras e textos em `frontend/src/data/entrevista.json`, usado pelo backend e pela demo. As mensagens do formato antigo (nota por resposta) continuam na ficha.
    - **Rodadas e feed compacto da escola:** cada laudo traz uma **síntese de uma frase** escrita pela IA ("Boa articulação técnica; demonstrou leve timidez"). As entrevistas contam em **rodadas de 5**: média de 80% ou mais marca **"Meta de Entrevista Atingida"**, que fica **pendente até a coordenação confirmar** (ou mandar pra uma nova rodada) — a nota da IA sozinha não carimba o aluno. Abaixo de 80%, a próxima entrevista abre a rodada seguinte (2ª, 3ª...). Na ficha (aba Histórico) a escola vê a evolução entre rodadas ("1ª 62% → 2ª 74% → 3ª 83%") e uma linha por entrevista: data, %, cor (verde/amarelo/vermelho) e a síntese; clicar abre o laudo completo e a conversa. A lista de alunos mostra o selo "Meta: confirmar" / "Meta de entrevista". Depois da meta, as entrevistas viram treino livre. Tabelas `rodadas_entrevista` e `sessoes_entrevista.resumo`.
    - **Roadmap (voz):** a entrevista por voz ficou pra depois do piloto — áudio de menor numa API pública exige consentimento do responsável e plano pago, e o laboratório não tem microfones nem silêncio. Quando entrar, a liberação é por **desempenho** (3 laudos de texto com nota 70 ou mais), nunca por XP ou ofensiva (que medem acesso à internet em casa).
8b. **Simulado de Certificação ("prova de fogo")** (`certificacao.py`, `certificacao_routes.py`, `SimuladoCertificacao.jsx`, no topo da aba Quiz). **20 questões** sorteadas do banco da escola: 16 do curso do aluno e 4 gerais (do banco global, mas sem cair prazo do CPC pra quem é de Ciência de Dados), com as alternativas embaralhadas. **Tentativa única por ciclo:** começou, conta (fechar a aba não dá outra chance); 40 minutos; uma questão por vez, sem voltar e sem dizer se acertou; o que ficar sem resposta conta como erro. **70% ou mais:** aprovado — a certificação fica no perfil (vale pro curso em que foi feita), vira evidência no eixo Conhecimento e aparece no painel (selo "Certificado 85%" na lista e o histórico de tentativas na ficha). **Abaixo de 70%:** a tentativa fica só no histórico e o aluno é orientado a treinar nos quizzes diários; nova tentativa em **7 dias**. O gabarito nunca vai pro navegador, nem no fim (a tela mostra só a nota, pra o banco não ser colhido). Saídas da tela durante a prova (trocar de aba, minimizar) ficam registradas pra escola — é um indício, não reprova sozinho. Tabela `tentativas_certificacao`.
8c. **Proteção contra cópia nas avaliações.** O app inteiro já bloqueia seleção, copiar, recortar, botão direito e arrastar (`index.css` + `main.jsx`); nas telas de avaliação (quiz diário e simulado), o componente `AreaProva` reforça com `user-select: none !important` e bloqueio direto dos eventos `copy`/`cut`/`contextmenu`/`dragstart`. **Limite honesto:** isso não impede foto do celular nem digitar a pergunta em outro lugar — por isso o simulado também tem tempo limite, não mostra gabarito e registra as saídas da tela; o mais seguro é aplicar a prova no laboratório, com alguém da escola presente.
8d. **Contas da gestão, perfis de acesso e auditoria** (`gestao_routes.py`, `auditoria.py`, abas **Equipe** e **Auditoria** do painel). Saiu a senha única do painel: cada pessoa tem a sua conta, e o **Administrador** (o "admin do admin") cria as contas e escolhe o perfil de cada uma:

    | Perfil | Vê o painel | Altera | Vê a auditoria | Cria contas e escolhe perfis |
    |---|---|---|---|---|
    | **Administrador** | sim | sim | sim | sim |
    | **Auditor** | sim | não | sim | não |
    | **Alterar** | sim | sim | não | não |
    | **Visualizar** | sim | não | não | não |

    - Quem garante é o **servidor**, não a tela: perfil sem permissão de alterar recebe 403 em qualquer POST/PUT/DELETE do painel (a tentativa fica na auditoria). Conta nova ou senha resetada vem com **senha temporária**, mostrada uma vez, e o painel só libera depois de a pessoa criar a dela (10+ caracteres, letras e números). 5 senhas erradas travam a conta por 15 min. Mudar o perfil ou desativar derruba na hora as sessões abertas. Sempre existe pelo menos um Administrador ativo; contas não se apagam, só se desativam.
    - **Primeira vez:** a `ADMIN_SENHA` do `.env` virou **senha de instalação** — entra-se com ela (usuário em branco) só enquanto não existe nenhum Administrador, pra criar o primeiro. Depois disso ela para de funcionar.
    - **Auditoria:** um middleware registra tudo o que é incluído, alterado ou excluído no painel (cadastro e edição de aluno, status de contratação, contratos, observações, vagas e indicações, trilha EAD, certificados, códigos de acesso, pedidos de senha, chat, contas da gestão, confirmação de meta), os logins certos e errados, as tentativas sem permissão e as **exportações** (CSV/PDF de alunos, relatórios, bilhetes, a própria auditoria). Cada registro tem quando, quem (nome e perfil copiados), o quê em linguagem de gente ("Alterou o cadastro de Bianca Ferreira (#2)"), o que foi enviado — **sem senhas, códigos nem arquivos** — e, nas alterações e exclusões, **como estava antes**, lido do banco antes da mudança. A aba Auditoria filtra por pessoa, ação, o que foi mexido, período e busca, com paginação e exportação em CSV.
    - **Guarda de 2 anos:** nenhuma rota edita ou apaga registro de auditoria; os que passam de 730 dias saem automaticamente. As observações da ficha agora levam o nome de quem anotou.
    - Ponto conhecido: o registro é gravado logo depois que a alteração dá certo, numa conexão própria; se o banco cair exatamente nesse instante, a alteração fica sem registro (sai no log do servidor). Pra rede estadual, vale mover pra mesma transação da alteração, como no Sozza Command.
8e. **Multi-escola (várias escolas no mesmo sistema)** (`tenancy.py`, tabela `escolas`, `criar_escola.py`). Cada escola é um cliente isolado: 27 tabelas têm `escola_id` e **toda consulta, UPDATE e DELETE feitos por um aluno ou por uma conta da gestão saem filtrados pela escola dela sozinhos** — o filtro é aplicado na sessão do banco assim que o dono do token é identificado, então uma rota esquecida não vaza dado de outra escola. Todo registro novo é carimbado com a escola da sessão (ou do aluno "pai", nas rotas sem login); registro sem escola não é gravado.
    - **Únicos:** nome de turma, e-mail e nome de exibição (ranking) valem **por escola**; **CPF e usuários de login** (aluno e gestão) continuam únicos no sistema todo, porque o login e o primeiro acesso não perguntam a escola. CPF já cadastrado em outra escola é recusado **sem mostrar o nome** do aluno de lá.
    - **Nova escola:** `python criar_escola.py "Nome da escola" identificador "Nome do Administrador" usuario.admin` cria a escola com o primeiro Administrador (senha temporária mostrada uma vez, troca obrigatória). A partir daí a própria escola cria as contas da equipe e cadastra os alunos. A senha de instalação (`ADMIN_SENHA`) vale só pra primeira escola, enquanto ela não tem Administrador.
    - **Fim de contrato:** `escolas.ativa = false` barra todo mundo da escola (painel, app e login) e mantém os dados; apagar a escola apaga os dados dela em cascata.
    - **Ranking, vagas, trilha, chat e auditoria** são sempre só da escola. O nome da escola aparece no topo do painel.
    - **Teste de isolamento real:** `test_multiescola.py` cria uma escola temporária num Postgres de **teste** e confere que ela não lê nem altera nada das outras (`PLAY2WORK_TEST_DB=... pytest test_multiescola.py`; sem a variável, é pulado).
    - Ficam sem `escola_id` só as tabelas acessadas sempre pelo registro "pai" já filtrado (fotos, mapa de competências, leituras do chat). Ainda não existe um painel da Sozza/plataforma pra listar e gerenciar as escolas: hoje é pelo script e pelo banco.
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
21. **Trilha EAD (integração a distância).** A integração que hoje leva uma semana presencial pode ser feita pela plataforma. O conteúdo é **100% produzido e gravado pelos professores da escola**; o Play2Work.ai só fornece a plataforma (guarda, controla acesso, registra frequência e gera relatório). A escola monta **módulos** (por itinerário ou comuns a todos) com **aulas**: vídeo (link do YouTube não listado ou do Vimeo — só o ID é guardado), texto, materiais pra baixar (áudio leve e PDF, até 10 MB, tipo conferido pelos bytes) e **perguntas de fixação**. Rotas em `aulas_routes.py`, regras em `aulas.py`.
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

- **Front-end (Apresentação):** **React.js + Vite** – SPA reativa e modular, com **Framer Motion** para animações, ícones **Phosphor**, login do aluno (usuário + senha, primeiro acesso com CPF + código) e do Painel da Escola, e um **modo demonstração** (`src/mockApi.js`) que simula toda a API no navegador pra rodar sem backend.
- **Back-end (Serviços/API):** **FastAPI (Python)** – Servidor ASGI de alta performance, assíncrono, com injeção de dependências nativa (`Depends`) para a sessão do banco e para o estudante único da demonstração, e validação de contratos via **Pydantic**.
- **Autenticação:** JWT (`PyJWT`) com papel no token — `aluno` (emitido em `/auth/login` ou no fim do primeiro acesso, com a versão da sessão: senha nova derruba os tokens antigos) e `admin` (emitido em `/admin/login` para uma conta da gestão, com o perfil decidindo o que ela pode). Um não abre as rotas do outro. `JWT_SECRET_KEY` é obrigatória.
- **Rate limiting:** **slowapi** limita por IP as rotas mais sensíveis a força-bruta e enumeração (`/admin/login`, `/auth/login`, `/auth/primeiro-acesso`, `/auth/esqueci-senha`, `/auth/trocar-senha`). O login do aluno também trava a conta depois de 5 senhas erradas, e o código de acesso morre depois de 5 erros.
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
    ├── acesso.py              # Acesso do aluno: usuário, código da escola, senha, trava da conta, pedidos de senha nova
    ├── acesso_routes.py       # Login, primeiro acesso, esqueci minha senha, trocar senha e a aba Acessos do painel
    ├── admin_routes.py        # Painel da Escola: turmas, alunos, ficha, status de contratação, vagas, ranking e indicação
    ├── aulas.py               # Trilha EAD: frequência em blocos de 10 s, fixação embaralhada, conclusão
    ├── aulas_routes.py        # Trilha EAD: módulos, aulas, materiais, relatório de carga horária e retirada de certificados
    ├── atividades.py          # "O que você faria?" (situações de trabalho)
    ├── entrevista.py          # Simulador: triagem, conversa contínua (5-7 respostas), laudo, nota e XP calculados no servidor
    ├── entrevista_routes.py   # Rotas do simulador: sessão, mensagens, laudo final e rodadas de 5
    ├── certificacao.py        # Simulado de certificação: sorteio, tentativa única por ciclo, correção
    ├── certificacao_routes.py # Rotas do simulado (aluno) e histórico de tentativas (painel)
    ├── gestao_routes.py       # Login da gestão, contas e perfis (Equipe) e consulta/exportação da auditoria
    ├── auditoria.py           # Middleware que registra o que cada conta da gestão faz (guarda de 2 anos)
    ├── tenancy.py             # Multi-escola: filtro automático por escola em toda consulta e carimbo no INSERT
    ├── criar_escola.py        # Cria uma escola nova com o primeiro Administrador
    ├── preparar_banco.py      # Subida do contêiner: cria as tabelas num banco vazio ou aplica as migrações; garante uma escola
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
            ├── mockAcesso.js    # Modo demonstração do acesso (login, código da escola, pedidos de senha nova)
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
            │   ├── AdminAcessos.jsx     # Aba Acessos: pedidos de senha nova, códigos de acesso e bilhetes
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

### Jeito rápido: Docker (API + Postgres com um comando)

Precisa só do Docker Desktop ligado.

```bash
cp app/.env.example app/.env      # no Windows: copy app\.env.example app\.env
# edite app/.env: JWT_SECRET_KEY (obrigatória), ADMIN_SENHA (senha de instalação), GEMINI_API_KEY (opcional)
docker compose up --build         # ou -d pra rodar em segundo plano
```

- A API sobe em **http://localhost:8000** (troque com `API_PORTA=8765 docker compose up --build`). Na primeira subida o contêiner **cria as tabelas, marca a versão das migrações e cria a "Escola piloto"**; nas próximas, só aplica as migrações que faltam (`app/preparar_banco.py`).
- O Postgres fica num volume (`dados_postgres`): parar e subir de novo não perde nada. Pra zerar: `docker compose down -v`.
- Primeiro acesso ao painel: rode o front (`cd app/frontend && npm install && VITE_DEMO_MODE=false VITE_API_URL=http://localhost:8000 npm run dev`), abra `#admin`, deixe o usuário em branco e entre com a `ADMIN_SENHA` pra criar o primeiro Administrador.
- Front publicado em outro endereço? Ponha o endereço em `CORS_ORIGINS` no `app/.env`.

### Jeito manual

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
> **`ADMIN_SENHA`** — senha de **instalação** do painel: só funciona enquanto não existe nenhuma conta de Administrador (entre com o usuário em branco e crie a sua). Sem ela e sem contas, o painel fica fechado (não existe senha padrão). O `seed.py` cria a conta `coordenacao` / `Coordena2026` (Administrador) pra desenvolvimento.
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

Isso cria 3 turmas, 12 alunos espalhados pelos 6 cursos (com um quiz concluído cada, pra o ranking de desempenho ter dado) e 10 vagas, ao menos uma por curso. Aluno de demonstração: usuário `rafael.sozza`, senha `play2work123`. A Bianca ainda não fez o primeiro acesso: o seed imprime o CPF dela, e o código é `246810`. Também fica um pedido de senha nova do Lucas esperando na aba Acessos. Os CPFs do seed são fictícios — só têm os dígitos verificadores certos.

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

| Quem | Onde | Como entra |
|---|---|---|
| Rafael (primeiro acesso no app, integração por fazer) | tela inicial → Entrar | usuário `rafael.sozza`, senha `play2work123` |
| Bianca (contratada, integração concluída e certificado retirado, grupo da empresa) | Entrar → "Tenho um código da escola" | CPF `222.572.222-61` + código `246810`, e cria a senha |
| Painel da Escola | `#admin` na URL | `coordenacao` (Administrador), `auditoria` (Auditor), `secretaria` (Alterar) ou `professor` (Visualizar), senha `escola123` |

Tudo o que se faz no modo demonstração fica só na memória da aba: recarregar a página volta ao estado inicial.

### 3. Rodando os testes

```bash
cd app
pytest -q
```

Os testes usam `app.dependency_overrides` para trocar a sessão do banco e o estudante autenticado por mocks — não tocam no Postgres real nem fazem chamadas de API.

---

## 🔐 Login

- **Aluno:** `POST /api/auth/login` com `{usuario, senha}` (ou `POST /api/auth/primeiro-acesso` com `{cpf, codigo, nova_senha}`) → token JWT com papel `aluno`, válido por **4h** (`JWT_EXPIRA_HORAS_ALUNO`). O front guarda o token **só na aba** (`sessionStorage`) e manda em `Authorization: Bearer`; fechar o navegador encerra a sessão, pra o próximo aluno do laboratório não cair na conta do anterior. Sem token, as rotas do aluno respondem 401 e o app volta pro login.
- **Escola:** `POST /api/admin/login` com `{usuario, senha}` → token da conta da gestão (com a versão da sessão), válido por 12h, exigido em todas as rotas `/api/admin/*`; o perfil (Administrador, Auditor, Alterar, Visualizar) decide o que a conta pode. Sem nenhum Administrador, a `ADMIN_SENHA` entra como instalação.
- Senha esquecida: `POST /api/auth/esqueci-senha` cria um pedido; o painel aprova em `POST /api/admin/pedidos-senha/{id}/aprovar` (devolve o código, só dessa vez) ou recusa. Códigos avulsos: `POST /api/admin/estudantes/{id}/codigo-acesso` e `POST /api/admin/turmas/{id}/codigos-acesso`.
- No **modo demonstração**, ver a tabela de logins acima; a senha do painel é `escola123`.

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

Situação em 31/10/2026. Já resolvido nesta rodada: login do aluno por usuário + senha (primeiro acesso com código da escola), contas da gestão com perfis e auditoria de 2 anos, entrevista contínua com laudo, rodadas e simulado de certificação.

**Precisa de decisão ou de gente da escola (o código não resolve sozinho):**

- **Conteúdo do banco de questões:** as 630 perguntas precisam de revisão dos professores — agora com mais urgência, porque o **simulado de certificação** sorteia delas e uma resposta errada no banco pode reprovar um aluno. Atenção principal às que citam números de lei (CLT, FGTS do aprendiz, prazos do CPC, cotas).
- **LGPD** (rascunhos prontos em [`docs/lgpd`](docs/lgpd/README.md), com o mapa dos dados que o sistema guarda — **precisam de revisão de advogado**): política de privacidade, termos de uso, consentimento do responsável (a maioria é menor) e contrato com a escola dizendo que ela é a controladora dos dados e o Play2Work o operador. **Gemini:** no plano gratuito o Google pode usar o conteúdo enviado pra melhorar os produtos; com texto de aluno menor de idade, usar o plano pago antes do piloto.
- **Quem atende o painel:** combinar com a coordenação quem cuida da aba Acessos (pedidos de senha — sem alguém atendendo, o aluno que esqueceu a senha fica sem entrar, inclusive nas férias) e quem confirma as Metas de Entrevista.
- **Hospedagem:** só o front (modo demonstração) está publicado. O backend já está pronto pra subir em contêiner (`Dockerfile` e `docker-compose.yml` com Postgres 16; a API aplica as migrações sozinha e lê `CORS_ORIGINS` pra aceitar o front publicado). Falta escolher o provedor, ligar HTTPS e o backup automático do banco. A preparação do banco foi testada num Postgres zerado e num já existente e o `docker compose config` valida, mas a imagem ainda não foi construída numa máquina com o Docker ligado.

**Melhorias técnicas conhecidas:**

- **Escala:** a lista e a exportação de alunos carregam tudo no navegador — ótimo pra ~600, inviável pra 50 mil. Pra rede estadual, filtros e exportação passam pro servidor com paginação, e as fotos vão pra um armazenamento de arquivos (ex.: Blob Storage).
- **Painel da plataforma:** o multi-escola está pronto, mas criar/desativar escolas ainda é pelo `criar_escola.py` e pelo banco; falta uma tela pra equipe do Play2Work gerenciar as escolas (e, depois, cobrança por escola).
- **Perfis mais finos:** os perfis da gestão valem pro painel inteiro; dá pra evoluir pra permissões por aba (ex.: alguém que só mexe na Trilha EAD). Pros perfis Visualizar e Auditor, os botões de alterar já ficam escondidos (e o servidor recusa de qualquer jeito).
- **Auditoria na mesma transação:** o registro é gravado logo depois da alteração, numa conexão própria; pra rede estadual, mover pra mesma transação da alteração (como no Sozza Command).
- **Resolvido em 31/10/2026:** **conflito de edição** — cada alteração do cadastro do aluno soma uma versão (`versao_cadastro`, com quem e quando); quem salvar a ficha com uma versão velha recebe "Fulano alterou o cadastro de X em 31/10 às 15:04, enquanto você editava" e nada é gravado (a ficha recarrega com a versão atual); vale também pra edição que o aluno faz no app; fotos saem da memória da página ao sair (painel e app); foto HEIC/qualquer imagem que o navegador abra é convertida em JPEG antes de subir; limite de 10 envios de foto por minuto (30 no painel); busca por telefone só a partir de 5 dígitos.
- **Safari/iOS às vezes não dispara `afterprint`:** depois de baixar o PDF o título da aba pode ficar "Curriculo - Fulano" até recarregar.

**Verificado e o que falta verificar:**

- **Migrações conferidas num Postgres 16 de verdade (31/10/2026):** numa cópia do banco de dev, todas as revisões de `c4e8a1b2d3f5` até `f2b8d4a6c1e3` (versão do cadastro) subiram sem erro, os downgrades/upgrades das novas também, e o `alembic check` não acusou diferença entre o banco e o `models.py`. Na migração dos cursos, quem estava em Ciências da Natureza fica sem curso, pra escola reclassificar.
- **Testado no navegador com o backend real e o Gemini de verdade:** login e primeiro acesso do aluno, pedido de senha e aprovação, códigos da turma, gerador de currículo, entrevista contínua com laudo, simulado de certificação (reprovação, bloqueio do ciclo, anti-cópia, saída de tela), contas da gestão e auditoria.
- **Não verificado ainda:** uma impressão real do PDF e dos bilhetes de código de acesso pela janela do navegador; as rodadas de 5 entrevistas de ponta a ponta no navegador (cobertas pelos testes automatizados, mas exigiriam ~35 chamadas ao Gemini); as telas novas no **modo demonstração** (o build passa, mas não foram clicadas).
