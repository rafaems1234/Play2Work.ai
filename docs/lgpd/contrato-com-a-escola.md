# Pontos para o contrato com a escola (proteção de dados) — RASCUNHO

> Lista de cláusulas a discutir com o advogado e com a escola. Não é minuta pronta. Ver [README](README.md).

1. **Papéis:** a escola é a **controladora** dos dados dos alunos e da equipe; o First2Work.ai é o **operador** e só trata os dados conforme as instruções da escola e este contrato.
2. **Objeto do tratamento:** preparação para o mundo do trabalho, acompanhamento pedagógico, indicação a vagas de Jovem Aprendiz, controle de carga horária EAD e certificados.
3. **Suboperadores:** Google (API Gemini, para o simulador de entrevista e o gerador de currículo) e `[provedor de hospedagem]`. O operador avisa a escola antes de trocar ou incluir suboperador.
4. **Plano da IA:** compromisso de usar plano da API que **não use o conteúdo para treinar modelos**.
5. **Isolamento:** os dados de uma escola nunca são acessíveis por outra (o sistema é multi-escola com isolamento automático).
6. **Acesso da equipe da escola:** contas individuais com perfis (Administrador, Auditor, Alterar, Visualizar), auditoria guardada por 2 anos. A escola é responsável por quem ela cadastra e por desativar contas de quem sai.
7. **Segurança:** medidas técnicas listadas no [README](README.md); comunicação de **incidente de segurança** à escola em até `[X]` horas.
8. **Direitos dos titulares:** o operador ajuda a escola a atender pedidos de acesso, correção e exclusão em até `[X]` dias.
9. **Prazo de guarda e fim do contrato:** ao fim do contrato, a escola é desativada (ninguém entra) e os dados são **devolvidos** (exportação) e **apagados** em até `[X]` dias, salvo obrigação legal de guarda.
10. **Dado sensível:** o perfil de desenvolvimento só é visível à escola e não é enviado à IA nem a empresas.
11. **Empresas parceiras:** o compartilhamento com empresas acontece só por indicação da escola e no limite do necessário ao processo seletivo.
