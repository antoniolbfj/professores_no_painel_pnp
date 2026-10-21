# Professores no Painel PNP

Código do projeto Google Apps Script **Carga Horária Docente**, versão **10.0.9**, com preparação da planilha instaladora do **Professores no Painel (PNP)**.

- ID do projeto: `1Fv9UdxL6YOCIFip2YbZ-jO2SVLat9zInOQTQScdGSN8ILge8fe-6mj8T`
- Importação: 21 de outubro de 2026.
- Importação original: 16 arquivos JavaScript, 3 arquivos HTML e o manifesto `appsscript.json`.
- Ambiente: Google Apps Script V8, com fuso `America/Sao_Paulo`.

## Desenvolvimento e sincronização

Requer Node.js 20 ou superior e uma conta Google com acesso ao projeto. A API do Apps Script deve estar habilitada nas configurações da conta.

```sh
git clone https://github.com/antoniolbfj/professores_no_painel_pnp.git
cd professores_no_painel_pnp
npx @google/clasp@3.4.1 login
npx @google/clasp@3.4.1 status
```

O arquivo `.clasp.json` aponta para o projeto original e não contém credenciais. O login deve permanecer na máquina de cada desenvolvedor.

Para obter as alterações feitas no editor do Apps Script, use `npx @google/clasp@3.4.1 pull`. Esse comando sobrescreve os arquivos locais correspondentes; salve ou faça commit das alterações locais antes de executá-lo.

Para enviar alterações locais ao projeto original, revise o diff e execute `npx @google/clasp@3.4.1 push`. O envio atualiza o código do projeto; a publicação de uma nova versão do aplicativo web é uma etapa separada.

## Preparar uma planilha instaladora

1. Use uma planilha em branco e incorpore os arquivos do projeto ao Apps Script vinculado a ela, acessível em **Extensões > Apps Script**. Ao usar `clasp` para isso, configure o ID do projeto vinculado à nova planilha; o `.clasp.json` deste repositório aponta para o projeto original.
2. Salve o projeto e recarregue ou reabra a planilha. O gatilho simples `onOpen` adiciona o menu **PNP**. Também é possível executar `onOpen` manualmente pelo editor para atualizar o menu.
3. Escolha **PNP > Preparar planilha instaladora**. Na primeira execução, o Google poderá solicitar autorização. A função também pode ser executada pelo editor com o nome `prepararPlanilhaInstaladora`.
4. Confira a confirmação: **todas as abas existentes e seus dados serão excluídos**. Ao confirmar, a função cria e formata uma nova aba **INSTALADORA** e depois exclui as anteriores, inclusive uma eventual aba com esse mesmo nome. Cancelar preserva a planilha.
5. A aba apresenta as boas-vindas ao PNP e a exigência de usar **Arquivo > Fazer uma cópia** antes de instalar. Cada instalação deve utilizar uma cópia completa e independente do modelo.

A preparação funciona antes da criação de `USUARIOS` e não depende do cadastro administrativo do sistema. Ela deve ser executada por alguém com permissão para editar a planilha e autorizar o script. Somente a ação explícita de preparação exclui abas; abrir a planilha apenas cria o menu.

Este passo prepara o modelo e suas orientações. A rotina estrutural existente continua em `instalarVersao1009()`, no arquivo `SetupVersao10.js`. A exigência de fazer uma cópia é apresentada na aba; este passo ainda não implementa um bloqueio de execução no arquivo original. O fluxo de primeira instalação também precisa tratar o cadastro inicial do Super Usuário: atualmente cria `USUARIOS` vazia e exige um Super Usuário ativo na verificação final.

## Verificação local da preparação

```sh
node --test tests/instaladora.test.cjs
```

Os testes usam uma simulação dos serviços do Apps Script para verificar o menu, confirmação, cancelamento, substituição das abas, repetição da preparação e falhas antes da exclusão. A aparência e a autorização devem ser conferidas em uma planilha descartável no Google Planilhas.

## Estrutura

- `Controller.js`, `Dao.js` e `DataManagement.js`: controle da aplicação e acesso aos dados.
- `AcademicAnalytics.js`, `TeacherAreas.js`, `KnowledgeAreas.js` e `TeacherConditions.js`: regras acadêmicas e docentes.
- `AccessControl.js` e `SystemReset.js`: controle de acesso e administração.
- `TeacherPdfReport.js` e `GeneralTeacherPdfReport.js`: relatórios PDF.
- `HelpAssistant.js`, `HelpPersistence.js`, `HelpTutorials.js` e `HelpAssistant_.html`: assistente de ajuda.
- `index.html` e `TeacherConditionsView.html`: interface.
- `SetupVersao10.js`: rotinas de instalação estrutural.
- `Instaladora.js`: menu PNP e preparação da aba de boas-vindas do modelo instalador.
- `Tests.js`: suíte de testes existente para execução no ambiente do Apps Script.

A aplicação depende de serviços do Google, incluindo o contexto da planilha ativa. A cópia para o GitHub não inclui os dados das planilhas, propriedades, gatilhos, permissões ou implantações. O manifesto preserva a configuração do aplicativo web com acesso restrito ao domínio e execução como o usuário que realiza a implantação.

O `.claspignore` limita a sincronização aos arquivos do Apps Script. Credenciais, dependências e arquivos locais são excluídos pelo `.gitignore`.
