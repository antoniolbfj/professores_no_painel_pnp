const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'Instaladora.js'), 'utf8');

function simulate(options = {}) {
  let nextId = 1;
  const state = {
    sheets: [], menus: [], alerts: [], deleted: [], toasts: [], operations: [],
    releases: 0, lockAttempts: 0, insertions: 0
  };

  function createSheet(name) {
    const sheet = {
      id: nextId++, name, deleted: false, rows: 1000, columns: 26, cells: new Map(),
      gridlinesHidden: false, frozenRows: 0,
      getSheetId() { return this.id; },
      getName() {
        assert.equal(this.deleted, false, 'Não consultar uma aba excluída.');
        return this.name;
      },
      setName(value) {
        assert.equal(state.sheets.some(other => other !== this && other.name === value), false);
        this.name = value;
        return this;
      },
      getMaxRows() { return this.rows; },
      getMaxColumns() { return this.columns; },
      deleteRows(first, count) { assert.equal(first + count - 1, this.rows); this.rows -= count; },
      deleteColumns(first, count) { assert.equal(first + count - 1, this.columns); this.columns -= count; },
      setHiddenGridlines(value) { this.gridlinesHidden = value; },
      setTabColor(value) { this.tabColor = value; },
      setColumnWidth() {},
      setColumnWidths() {},
      setRowHeights() {},
      setFrozenRows(value) { this.frozenRows = value; },
      getRange(address) {
        if (options.failFormatting && this.created) throw new Error('Falha ao formatar.');
        const range = {
          merge() { return this; },
          setValue(value) { sheet.cells.set(address, value); return this; }
        };
        for (const method of [
          'setBackground', 'setFontFamily', 'setFontSize', 'setFontColor',
          'setVerticalAlignment', 'setWrap', 'setFontWeight', 'setHorizontalAlignment'
        ]) range[method] = function() { return this; };
        return range;
      }
    };
    state.sheets.push(sheet);
    return sheet;
  }

  for (const name of options.names || ['Página1']) createSheet(name);
  state.originals = state.sheets.slice();

  const spreadsheet = {
    getSheets() { return state.sheets.slice(); },
    insertSheet() {
      state.insertions++;
      state.operations.push('insert');
      const sheet = createSheet('Temporária ' + nextId);
      sheet.created = true;
      return sheet;
    },
    deleteSheet(sheet) {
      assert.equal(state.sheets.length > 1, true, 'Preservar pelo menos uma aba.');
      if (options.failDeleting === sheet.name) throw new Error('Não foi possível excluir a aba.');
      state.operations.push('delete:' + sheet.name);
      state.deleted.push(sheet.name);
      state.sheets = state.sheets.filter(other => other !== sheet);
      sheet.deleted = true;
    },
    setActiveSheet(sheet) { state.active = sheet; },
    moveActiveSheet(position) { assert.equal(position, 1); },
    toast(...args) { state.toasts.push(args); }
  };
  const ui = {
    ButtonSet: { YES_NO: 'YES_NO' },
    Button: { YES: 'YES', NO: 'NO', CLOSE: 'CLOSE' },
    createMenu(name) {
      const menu = {
        name, items: [],
        addItem(label, callback) { this.items.push({ label, callback }); return this; },
        addToUi() { state.menus.push(this); }
      };
      return menu;
    },
    alert(...args) {
      state.alerts.push(args);
      if (options.changeSheetsInDialog) createSheet('Adicionada durante a confirmação');
      return options.answer || 'YES';
    }
  };
  const context = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet() { return options.noSpreadsheet ? null : spreadsheet; },
      getUi() { return ui; },
      flush() { state.operations.push('flush'); }
    },
    LockService: {
      getDocumentLock() {
        return {
          tryLock() { state.lockAttempts++; return options.lockAvailable !== false; },
          releaseLock() { state.releases++; }
        };
      }
    }
  });
  vm.runInContext(source, context, { filename: 'Instaladora.js' });
  return {
    state,
    open() { return vm.runInContext('onOpen()', context); },
    prepare() { return vm.runInContext('prepararPlanilhaInstaladora()', context); }
  };
}

test('abrir uma planilha em branco cria o menu PNP sem alterar abas nem pedir autorização', () => {
  const app = simulate();
  app.open();
  assert.equal(app.state.menus.length, 1);
  assert.equal(app.state.menus[0].name, 'PNP');
  assert.deepEqual(app.state.menus[0].items, [{
    label: 'Preparar planilha instaladora', callback: 'prepararPlanilhaInstaladora'
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
  assert.match(text, /Bem-vindo\(a\)!/);
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
