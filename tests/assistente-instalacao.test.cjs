const assert = require('node:assert/strict');
const test = require('node:test');
const { simulate } = require('./support/apps-script.cjs');

function preparedCopy(options = {}) {
  const model = simulate();
  model.prepare();
  return model.copy('copia-id', options);
}

test('preparação concluída registra o ID do modelo em uma linha oculta que acompanha a cópia', () => {
  const model = simulate();
  model.prepare();
  assert.equal(model.record().sourceSpreadsheetId, 'modelo-id');
  assert.equal(model.record().kind, 'PNP_INSTALLER');
  assert.ok(Number.isFinite(Date.parse(model.record().preparedAt)));
  assert.equal(model.record().installation, null);
  assert.ok(model.state.sheets[0].hiddenRows.has(40));
  const copy = model.copy('copia-id');
  assert.equal(copy.record().sourceSpreadsheetId, 'modelo-id');
  assert.ok(copy.state.sheets[0].hiddenRows.has(40));
});

test('planilha sem preparação e aba INSTALADORA criada manualmente não abrem o assistente', () => {
  for (const names of [['Página1'], ['INSTALADORA']]) {
    const app = simulate({ names });
    assert.equal(app.start().status, 'blocked');
    assert.match(app.state.alerts[0][1], /preparação.*não foi concluída/);
    assert.equal(app.state.dialogs.length, 0);
    assert.equal(app.state.insertions, 0);
    assert.throws(() => app.install(), /preparação.*não foi concluída/);
  }
});

test('modelo original é bloqueado mesmo depois de renomear o arquivo', () => {
  const model = simulate({ name: 'Cópia de PNP' });
  model.prepare();
  assert.equal(model.start().status, 'blocked');
  assert.match(model.state.alerts.at(-1)[1], /modelo original não é permitida/);
  assert.equal(model.state.dialogs.length, 0);
  assert.throws(() => model.install(), /modelo original não é permitida/);
  assert.equal(model.record().installation, null);
  assert.equal(model.state.sheets.length, 1);
});

for (const invalid of ['', '{', '{}', JSON.stringify({ kind: 'PNP_INSTALLER', version: 99 }),
  JSON.stringify({ kind: 'PNP_INSTALLER', version: 1, sourceSpreadsheetId: 'modelo-id', preparedAt: 'inválida' })]) {
  test('registro ausente, antigo ou inválido bloqueia a instalação: ' + invalid, () => {
    const copy = preparedCopy();
    copy.state.sheets[0].getRange('A40').setValue(invalid);
    assert.throws(() => copy.install(), /preparação.*não foi concluída/);
    assert.equal(copy.state.sheets.length, 1);
    assert.equal(copy.state.insertions, 0);
  });
}

test('cópia preparada abre o assistente com boas-vindas ao PNP e não instala ao abrir', () => {
  const copy = preparedCopy();
  assert.equal(copy.start().status, 'opened');
  assert.equal(copy.state.dialogs.length, 1);
  assert.match(copy.state.dialogs[0].title, /Professores no Painel \(PNP\)/);
  assert.match(copy.state.dialogs[0].html.content, /Bem-vindo\(a\) ao Professores no Painel \(PNP\)!/);
  assert.equal(copy.state.sheets.length, 1);
  assert.equal(copy.record().installation, null);
  const context = copy.evaluate('obterContextoAssistenteInstalacaoPnp()');
  assert.equal(context.email, 'antoniobarros@iftm.edu.br');
  assert.equal(context.firstSuperUser, context.email);
  assert.equal(context.installed, false);
  assert.equal(context.sheets.length, 6);
});

for (const entry of ['instalarVersao10', 'instalarVersao1005', 'instalarVersao1006',
  'instalarVersao1007', 'instalarVersao1008', 'instalarVersao1009', 'criarEstruturasVersao10_']) {
  test('execução direta também exige preparação e cópia: ' + entry, () => {
    const blank = simulate();
    assert.throws(() => blank.evaluate(entry + '()'), /preparação.*não foi concluída/);
    assert.equal(blank.state.insertions, 0);
    const model = simulate();
    model.prepare();
    assert.throws(() => model.evaluate(entry + '()'), /modelo original não é permitida/);
    assert.equal(model.record().installation, null);
    assert.equal(model.state.sheets.length, 1);
  });
}

test('a confirmação da instalação revalida os requisitos após a abertura do assistente', () => {
  const copy = preparedCopy();
  copy.start();
  copy.state.sheets[0].getRange('A40').setValue('');
  assert.throws(() => copy.install(), /preparação.*não foi concluída/);
  assert.equal(copy.state.sheets.length, 1);
  assert.equal(copy.state.insertions, 0);
});

test('instalação completa cria as seis estruturas e cadastra somente o Super Usuário autorizado', () => {
  const copy = preparedCopy();
  const result = copy.install();
  assert.equal(result.status, 'installed');
  assert.equal(result.initialSuperUserCreated, true);
  assert.equal(result.helpAssistant.ok, true);
  assert.equal(result.structures.created.length, 6);
  assert.equal(copy.state.sheets.length, 7);
  assert.equal(copy.record().sourceSpreadsheetId, 'modelo-id');
  assert.equal(copy.record().installation.spreadsheetId, 'copia-id');
  assert.equal(copy.record().installation.status, 'installed');
  const users = copy.evaluate('AccessControlService.readUsers()');
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'antoniobarros@iftm.edu.br');
  assert.equal(users[0].profile, 'SUPER_USUARIO');
  assert.equal(users[0].active, true);
  assert.equal(copy.spreadsheet.getSheetByName('AREAS_CONHECIMENTO').getLastRow(), 1);
  assert.equal(copy.spreadsheet.getSheetByName('DOCENTES'), null);
  assert.equal(copy.state.releases, 1);
});

test('conta sem autorização não inicia nem grava a instalação', () => {
  const copy = preparedCopy({ email: 'outra@iftm.edu.br' });
  assert.equal(copy.start().status, 'blocked');
  assert.throws(() => copy.install(), /Somente o primeiro Super Usuário/);
  assert.equal(copy.record().installation, null);
  assert.equal(copy.state.sheets.length, 1);
});

test('operação concorrente bloqueia antes de gravar o andamento', () => {
  const copy = preparedCopy({ lockAvailable: false });
  assert.throws(() => copy.install(), /Outra operação está em andamento/);
  assert.equal(copy.record().installation, null);
  assert.equal(copy.state.sheets.length, 1);
});

test('nova chamada após sucesso informa instalação existente sem recriar estruturas ou usuários', () => {
  const copy = preparedCopy();
  copy.install();
  const previousInsertions = copy.state.insertions;
  const record = copy.record();
  assert.equal(copy.install().status, 'already_installed');
  assert.equal(copy.state.insertions, previousInsertions);
  assert.deepEqual(copy.record(), record);
  assert.equal(copy.evaluate('AccessControlService.readUsers().length'), 1);
  assert.equal(copy.evaluate('obterContextoAssistenteInstalacaoPnp().installed'), true);
});

test('retomada após falha no cadastro funciona com USUARIOS ainda vazia', () => {
  const copy = preparedCopy({ failUserWrites: 1 });
  assert.throws(() => copy.install(), /Falha simulada no cadastro inicial/);
  assert.equal(copy.record().installation.status, 'failed');
  assert.equal(copy.evaluate('AccessControlService.readUsers().length'), 0);
  assert.equal(copy.install().status, 'installed');
  assert.equal(copy.evaluate('AccessControlService.readUsers().length'), 1);
});

test('retomada após falha na verificação preserva Super Usuário e indicadores existentes', () => {
  const copy = preparedCopy();
  copy.evaluate('const originalSmokeForTest = executarSmokeTestVersao10; '
    + 'executarSmokeTestVersao10 = function() { throw new Error("Falha de verificação."); };');
  assert.throws(() => copy.install(), /Falha de verificação/);
  assert.equal(copy.record().installation.status, 'failed');
  assert.equal(copy.evaluate('AccessControlService.readUsers()[0].active'), true);
  const areas = copy.spreadsheet.getSheetByName('AREAS_CONHECIMENTO');
  areas.getRange(2, 5).setValue(true);
  copy.evaluate('executarSmokeTestVersao10 = originalSmokeForTest;');
  assert.equal(copy.install().status, 'installed');
  assert.equal(copy.evaluate('AccessControlService.readUsers().length'), 1);
  assert.equal(copy.evaluate('AccessControlService.readUsers()[0].active'), true);
  assert.equal(areas.getRange(2, 5).getValue(), true);
});

test('copiar uma instalação já iniciada não equivale a copiar o modelo preparado', () => {
  const installed = preparedCopy();
  installed.install();
  const other = installed.copy('outra-copia-id');
  assert.throws(() => other.install(), /cópia de uma instalação já iniciada/);
  assert.equal(other.start().status, 'blocked');
  assert.equal(other.state.insertions, 0);
});

test('repreparar uma cópia torna esse arquivo um novo modelo que também exige cópia', () => {
  const copy = preparedCopy();
  copy.prepare();
  assert.equal(copy.record().sourceSpreadsheetId, 'copia-id');
  assert.throws(() => copy.install(), /modelo original não é permitida/);
  assert.equal(copy.copy('copia-do-novo-modelo').install().status, 'installed');
});

test('contratos existentes de estrutura e controle de acesso continuam válidos', () => {
  const app = simulate();
  app.evaluate('test_SetupVersao10_structureOnlyContract(); '
    + 'test_AccessControl_profileAndDomainContract(); test_AccessControl_areaPermissionMatrix();');
});
