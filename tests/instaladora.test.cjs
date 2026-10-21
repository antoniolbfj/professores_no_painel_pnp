const assert = require('node:assert/strict');
const test = require('node:test');
const { simulate } = require('./support/apps-script.cjs');

test('abrir uma planilha em branco cria o menu PNP sem alterar abas nem pedir autorização', () => {
  const app = simulate();
  app.open();
  assert.equal(app.state.menus.length, 1);
  assert.equal(app.state.menus[0].name, 'PNP');
  assert.deepEqual(app.state.menus[0].items, [{
    label: 'Preparar planilha instaladora', callback: 'prepararPlanilhaInstaladora'
  }, {
    label: 'Iniciar assistente de instalação', callback: 'iniciarAssistenteInstalacao'
  }]);
  assert.equal(app.state.alerts.length, 0);
  assert.equal(app.state.insertions, 0);
  assert.equal(app.state.lockAttempts, 0);
  assert.equal(app.state.sheets[0].name, 'Página1');
});

for (const answer of ['NO', 'CLOSE']) {
  test('cancelar ou fechar a confirmação preserva todas as abas: ' + answer, () => {
    const app = simulate({ names: ['DOCENTES', '2026', 'INSTALADORA'], answer });
    const result = app.prepare();
    assert.equal(result.status, 'cancelled');
    assert.equal(app.state.insertions, 0);
    assert.deepEqual(app.state.deleted, []);
    assert.equal(app.state.lockAttempts, 0);
    assert.deepEqual(app.state.sheets.map(sheet => sheet.name), ['DOCENTES', '2026', 'INSTALADORA']);
    assert.match(app.state.alerts[0][1], /TODAS as abas atuais serão excluídas/);
    for (const name of ['DOCENTES', '2026', 'INSTALADORA']) {
      assert.ok(app.state.alerts[0][1].includes(name));
    }
  });
}

test('confirmar cria orientações completas e deixa somente a aba INSTALADORA', () => {
  const app = simulate({ names: ['Página1', 'DOCENTES', 'Oculta'] });
  app.state.sheets[2].hidden = true;
  const result = app.prepare();
  assert.equal(result.status, 'prepared');
  assert.deepEqual(Array.from(result.removedSheets), ['Página1', 'DOCENTES', 'Oculta']);
  assert.deepEqual(app.state.deleted, ['Página1', 'DOCENTES', 'Oculta']);
  assert.equal(app.state.sheets.length, 1);
  const guide = app.state.sheets[0];
  assert.equal(guide.name, 'INSTALADORA');
  assert.equal(app.state.active, guide);
  assert.equal(guide.gridlinesHidden, true);
  assert.equal(guide.rows, 40);
  assert.equal(guide.columns, 8);
  assert.equal(guide.frozenRows, 5);
  const text = Array.from(guide.cells.values()).join('\n');
  assert.match(text, /Bem-vindo\(a\) ao Professores no Painel \(PNP\)!/);
  assert.match(text, /PROFESSORES NO PAINEL \(PNP\)/);
  assert.match(text, /CÓPIA OBRIGATÓRIA ANTES DA INSTALAÇÃO/);
  assert.match(text, /Arquivo > Fazer uma cópia/);
  assert.match(text, /Execute a instalação somente na cópia/);
  assert.match(text, /duplicar apenas esta aba não cria uma nova instalação/);
  assert.equal(app.state.releases, 1);
  assert.equal(app.state.toasts.length, 1);
  const firstDeletion = app.state.operations.findIndex(item => item.startsWith('delete:'));
  assert.ok(app.state.operations.indexOf('flush') < firstDeletion);
});

test('repetir a preparação substitui a antiga INSTALADORA sem conflito de nomes', () => {
  const app = simulate({ names: ['INSTALADORA', 'Outra aba'] });
  app.prepare();
  const previousGuide = app.state.sheets[0];
  app.prepare();
  assert.equal(previousGuide.deleted, true);
  assert.equal(app.state.sheets.length, 1);
  assert.equal(app.state.sheets[0].name, 'INSTALADORA');
  assert.equal(app.state.releases, 2);
});

test('falha na formatação preserva todas as abas originais e remove a tentativa incompleta', () => {
  const app = simulate({ names: ['DOCENTES', 'INSTALADORA'], failFormatting: true });
  assert.throws(() => app.prepare(), /Falha ao formatar/);
  assert.deepEqual(app.state.sheets, app.state.originals);
  assert.equal(app.state.originals.every(sheet => !sheet.deleted), true);
  assert.equal(app.state.deleted.length, 1);
  assert.equal(app.state.releases, 1);
  assert.equal(app.state.toasts.length, 0);
});

test('mudanças nas abas durante a confirmação exigem nova confirmação sem excluir nada', () => {
  const app = simulate({ changeSheetsInDialog: true });
  assert.throws(() => app.prepare(), /As abas da planilha mudaram/);
  assert.equal(app.state.insertions, 0);
  assert.deepEqual(app.state.deleted, []);
  assert.equal(app.state.releases, 1);
});

test('uma preparação concorrente impede qualquer mudança', () => {
  const app = simulate({ lockAvailable: false });
  assert.throws(() => app.prepare(), /Já existe uma preparação em andamento/);
  assert.equal(app.state.insertions, 0);
  assert.deepEqual(app.state.deleted, []);
  assert.equal(app.state.releases, 0);
});

test('falha ao excluir uma aba mantém as orientações e informa a interrupção', () => {
  const app = simulate({ names: ['Página1', 'Protegida'], failDeleting: 'Protegida' });
  assert.throws(() => app.prepare(), /A preparação foi interrompida/);
  assert.equal(app.state.sheets.some(sheet => sheet.name === 'Protegida'), true);
  assert.equal(app.state.sheets.some(sheet => sheet.cells.has('B7:G9')), true);
  assert.equal(app.state.releases, 1);
  assert.equal(app.state.toasts.length, 0);
});

test('fora de uma planilha vinculada falha antes de solicitar confirmação ou alterar dados', () => {
  const app = simulate({ noSpreadsheet: true });
  assert.throws(() => app.prepare(), /Abra a planilha/);
  assert.equal(app.state.alerts.length, 0);
  assert.equal(app.state.insertions, 0);
});
