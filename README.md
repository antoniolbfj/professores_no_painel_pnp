# Professores no Painel PNP

Código do projeto Google Apps Script **Carga Horária Docente**, versão **10.0.9**, com preparação do modelo e assistente de instalação do **Professores no Painel (PNP)**.

- Projeto de origem, somente referência: `1Fv9UdxL6YOCIFip2YbZ-jO2SVLat9zInOQTQScdGSN8ILge8fe-6mj8T`
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

O arquivo `.clasp.json` aponta para o **projeto de teste** `1Ab6kAtQoQiUfXMCKg3GUXO6Vg0INe-Q0HZyEI4yXNTUI93bGQEsRC0Uo`, vinculado à planilha [PNP - INSTALADOR](https://docs.google.com/spreadsheets/d/1dOqReA6uHzx-eYWG06iS3nVE2W351F2B63hk8a8c2xo/edit). O projeto original deve ser preservado e não deve receber envios de código. Essa configuração não contém credenciais; o login deve permanecer na máquina de cada desenvolvedor.

Para obter as alterações feitas no editor do Apps Script, use `npx @google/clasp@3.4.1 pull`. Esse comando sobrescreve os arquivos locais correspondentes; salve ou faça commit das alterações locais antes de executá-lo.

Para enviar alterações locais ao projeto de teste, confira o ID em `.clasp.json`, revise o diff e execute `npx @google/clasp@3.4.1 push`. O envio atualiza o código do projeto; a publicação de uma nova versão do aplicativo web é uma etapa separada.

## Preparar uma planilha instaladora

1. Use a planilha de teste indicada acima ou incorpore os arquivos a outro projeto vinculado a uma planilha em branco, acessível em **Extensões > Apps Script**. Ao usar `clasp` com outra planilha, configure o ID do projeto vinculado a ela; o `.clasp.json` deste repositório aponta para o projeto de teste.
2. Salve o projeto e recarregue ou reabra a planilha. O gatilho simples `onOpen` adiciona o menu **PNP**. Também é possível executar `onOpen` manualmente pelo editor para atualizar o menu.
3. Escolha **PNP > Preparar planilha instaladora**. Na primeira execução, o Google poderá solicitar autorização. A função também pode ser executada pelo editor com o nome `prepararPlanilhaInstaladora`.
4. Confira a confirmação: **todas as abas existentes e seus dados serão excluídos**. Ao confirmar, a função cria e formata uma nova aba **INSTALADORA** e depois exclui as anteriores, inclusive uma eventual aba com esse mesmo nome. Cancelar preserva a planilha.
5. A aba apresenta as boas-vindas ao PNP e a exigência de usar **Arquivo > Fazer uma cópia** antes de instalar. Cada instalação deve utilizar uma cópia completa e independente do modelo.

A preparação funciona antes da criação de `USUARIOS` e não depende do cadastro administrativo do sistema. Ela deve ser executada por alguém com permissão para editar a planilha e autorizar o script. Somente a ação explícita de preparação exclui abas; abrir a planilha apenas cria o menu.

## Iniciar o assistente de instalação

1. Após preparar o modelo, use **Arquivo > Fazer uma cópia**. Abra o arquivo criado e recarregue a planilha para visualizar o menu PNP.
2. Na cópia, escolha **PNP > Iniciar assistente de instalação**. O assistente apresenta as boas-vindas ao **Professores no Painel (PNP)** e confere a preparação, a cópia e a conta autorizada.
3. Clique em **Continuar**, confira a planilha de destino, a conta e as seis abas previstas. Marque a confirmação e clique em **Instalar PNP**.
4. Aguarde a criação/validação das estruturas e a verificação final. Após a conclusão, configure os acessos e importe os dados necessários ao sistema. A publicação do aplicativo web continua sendo uma etapa separada.

A preparação registra o ID do arquivo modelo em uma linha oculta da aba `INSTALADORA`. Esse registro acompanha a cópia completa do arquivo. O servidor exige um registro válido e um ID de arquivo diferente do modelo antes de abrir o assistente e novamente antes de instalar. Apenas renomear o arquivo, criar uma aba `INSTALADORA` manualmente ou copiar um arquivo sem preparação concluída não atende aos requisitos.

As mesmas verificações se aplicam a `instalarVersao10()`, aos aliases `instalarVersao1005()` a `instalarVersao1009()` e à rotina interna de criação de estruturas. Uma instalação já concluída não é repetida; uma tentativa interrompida pode ser retomada na mesma cópia, preservando os registros e sem duplicar o primeiro usuário. Para criar outra instalação, copie novamente o modelo preparado, pois cópias de uma instalação já iniciada são bloqueadas.

Na primeira instalação, a conta autorizada continua sendo a definida em `ACCESS_CONTROL_CONFIG.firstSuperUser`. O coordenador cadastra essa conta como Super Usuário ativo depois de criar as estruturas e antes da verificação final. O plano estrutural permanece sem importação de dados acadêmicos nem catálogo inicial de áreas. Uma aba `USUARIOS` ainda vazia também permite a retomada pela conta inicial autorizada.

**Modelos preparados com versões anteriores desta função precisam ser preparados novamente e copiados depois da atualização do código.** Eles ainda não possuem o registro de origem. Execute a preparação no modelo destinado a esse fim, lembrando que ela exclui todas as outras abas após confirmação.

## Verificação local

```sh
node --test tests/instaladora.test.cjs
node --test tests/assistente-instalacao.test.cjs
```

Os testes executam o código do projeto com serviços do Apps Script simulados. Cobrem preparação, cancelamento, exclusão das abas, registro de origem, bloqueios no modelo e sem preparação, chamadas diretas, instalação completa, cadastro inicial, concorrência, retomada e repetição após sucesso. A cópia real do arquivo e a autorização do Google devem ser conferidas em uma planilha descartável no Google Planilhas.

## Estrutura

- `Controller.js`, `Dao.js` e `DataManagement.js`: controle da aplicação e acesso aos dados.
- `AcademicAnalytics.js`, `TeacherAreas.js`, `KnowledgeAreas.js` e `TeacherConditions.js`: regras acadêmicas e docentes.
- `AccessControl.js` e `SystemReset.js`: controle de acesso e administração.
- `TeacherPdfReport.js` e `GeneralTeacherPdfReport.js`: relatórios PDF.
- `HelpAssistant.js`, `HelpPersistence.js`, `HelpTutorials.js` e `HelpAssistant_.html`: assistente de ajuda.
- `index.html` e `TeacherConditionsView.html`: interface.
- `SetupVersao10.js`: rotinas de instalação estrutural.
- `Instaladora.js`: menu PNP e preparação da aba de boas-vindas do modelo instalador.
- `AssistenteInstalacao.js` e `AssistenteInstalacaoView.html`: validações, diálogo guiado e coordenação da instalação.
- `Tests.js`: suíte de testes existente para execução no ambiente do Apps Script.

A aplicação depende de serviços do Google, incluindo o contexto da planilha ativa. A cópia para o GitHub não inclui os dados das planilhas, propriedades, gatilhos, permissões ou implantações. O manifesto preserva a configuração do aplicativo web com acesso restrito ao domínio e execução como o usuário que realiza a implantação.

O `.claspignore` limita a sincronização aos arquivos do Apps Script. Credenciais, dependências e arquivos locais são excluídos pelo `.gitignore`.
