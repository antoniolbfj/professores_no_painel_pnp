# Professores no Painel PNP

Código do projeto Google Apps Script **Carga Horária Docente**, versão **10.0.9**, importado sem alterações funcionais.

- ID do projeto: `1Fv9UdxL6YOCIFip2YbZ-jO2SVLat9zInOQTQScdGSN8ILge8fe-6mj8T`
- Importação: 21 de outubro de 2026.
- Conteúdo: 16 arquivos JavaScript, 3 arquivos HTML e o manifesto `appsscript.json`.
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

## Estrutura

- `Controller.js`, `Dao.js` e `DataManagement.js`: controle da aplicação e acesso aos dados.
- `AcademicAnalytics.js`, `TeacherAreas.js`, `KnowledgeAreas.js` e `TeacherConditions.js`: regras acadêmicas e docentes.
- `AccessControl.js` e `SystemReset.js`: controle de acesso e administração.
- `TeacherPdfReport.js` e `GeneralTeacherPdfReport.js`: relatórios PDF.
- `HelpAssistant.js`, `HelpPersistence.js`, `HelpTutorials.js` e `HelpAssistant_.html`: assistente de ajuda.
- `index.html` e `TeacherConditionsView.html`: interface.
- `SetupVersao10.js`: rotinas de instalação estrutural.
- `Tests.js`: suíte de testes existente para execução no ambiente do Apps Script.

A aplicação depende de serviços do Google, incluindo o contexto da planilha ativa. A cópia para o GitHub não inclui os dados das planilhas, propriedades, gatilhos, permissões ou implantações. O manifesto preserva a configuração do aplicativo web com acesso restrito ao domínio e execução como o usuário que realiza a implantação.

O `.claspignore` limita a sincronização aos arquivos do Apps Script. Credenciais, dependências e arquivos locais são excluídos pelo `.gitignore`.
