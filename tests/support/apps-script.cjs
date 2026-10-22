const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');

function simulate(options = {}) {
  let nextId = 1;
  const state = {
    sheets: [], menus: [], alerts: [], dialogs: [], deleted: [], toasts: [], operations: [],
    releases: 0, lockAttempts: 0, insertions: 0,
    spreadsheetId: options.spreadsheetId || 'modelo-id',
    email: options.email || 'antoniobarros@iftm.edu.br',
    failUserWrites: options.failUserWrites || 0,
    failInstalledViewWrites: options.failInstalledViewWrites || 0,
    failHides: options.failHides || 0,
    failInstalledPropertyWrites: options.failInstalledPropertyWrites || 0,
    scriptProperties: new Map(options.scriptProperties || [])
  };

  function parseRange(args) {
    if (typeof args[0] === 'number') return [args[0], args[1], args[2] || 1, args[3] || 1];
    const match = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(args[0]);
    assert.ok(match, 'Endereço de intervalo válido: ' + args[0]);
    const col = text => Array.from(text).reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
    const firstColumn = col(match[1]);
    const firstRow = Number(match[2]);
    return [firstRow, firstColumn, Number(match[4] || match[2]) - firstRow + 1,
      col(match[3] || match[1]) - firstColumn + 1];
  }

  function createSheet(name) {
    const sheet = {
      id: nextId++, name, deleted: false, rows: 1000, columns: 26,
      cells: new Map(), grid: new Map(), hiddenRows: new Set(),
      gridlinesHidden: false, frozenRows: 0,
      getSheetId() { return this.id; },
      isSheetHidden() { return Boolean(this.hidden); },
      showSheet() { this.hidden = false; return this; },
      hideSheet() {
        assert.ok(state.sheets.some(other => other !== this && !other.isSheetHidden()),
          'A planilha precisa manter uma aba visível.');
        if (state.failHides > 0 && this.name === 'DOCENTES_AREAS') {
          state.failHides--;
          throw new Error('Falha simulada ao ocultar uma tabela.');
        }
        this.hidden = true;
        return this;
      },
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
      getLastRow() {
        return Math.max(0, ...Array.from(this.grid).filter(([, value]) => value !== '' && value != null)
          .map(([key]) => Number(key.split(':')[0])));
      },
      getLastColumn() {
        return Math.max(0, ...Array.from(this.grid).filter(([, value]) => value !== '' && value != null)
          .map(([key]) => Number(key.split(':')[1])));
      },
      getDataRange() { return this.getRange(1, 1, this.getLastRow() || 1, this.getLastColumn() || 1); },
      deleteRows(first, count) { assert.equal(first + count - 1, this.rows); this.rows -= count; },
      deleteColumns(first, count) { assert.equal(first + count - 1, this.columns); this.columns -= count; },
      insertRowsAfter(after, count) { assert.equal(after, this.rows); this.rows += count; },
      insertColumnsAfter(after, count) { assert.equal(after, this.columns); this.columns += count; },
      hideRows(row) { this.hiddenRows.add(row); },
      setHiddenGridlines(value) { this.gridlinesHidden = value; },
      setTabColor(value) { this.tabColor = value; },
      setColumnWidth() {}, setColumnWidths() {}, setRowHeights() {}, autoResizeColumns() {},
      setFrozenRows(value) { this.frozenRows = value; },
      getRange(...args) {
        if (options.failFormatting && this.created) throw new Error('Falha ao formatar.');
        const [row, col, rows, cols] = parseRange(args);
        const range = {
          merge() { return this; },
          getValue() { return sheet.grid.get(row + ':' + col) ?? ''; },
          getValues() {
            return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) =>
              sheet.grid.get((row + r) + ':' + (col + c)) ?? ''));
          },
          getDisplayValue() { return String(this.getValue()); },
          getDisplayValues() { return this.getValues().map(values => values.map(String)); },
          setValue(value) {
            if (sheet.name === 'PNP INSTALADA' && args[0] === 'B4:G5'
                && state.failInstalledViewWrites > 0) {
              state.failInstalledViewWrites--;
              throw new Error('Falha simulada ao finalizar a apresentação.');
            }
            sheet.grid.set(row + ':' + col, value);
            if (typeof args[0] === 'string') sheet.cells.set(args[0], value);
            return this;
          },
          setValues(values) {
            assert.equal(values.length, rows);
            if (sheet.name === 'USUARIOS' && row === 2 && col === 1 && state.failUserWrites > 0) {
              state.failUserWrites--;
              throw new Error('Falha simulada no cadastro inicial.');
            }
            values.forEach((valuesRow, r) => {
              assert.equal(valuesRow.length, cols);
              valuesRow.forEach((value, c) => sheet.grid.set((row + r) + ':' + (col + c), value));
            });
            return this;
          },
          insertCheckboxes() {
            // A API real redefine as células para false: preservação é testada.
            for (let r = row; r < row + rows; r++) {
              for (let c = col; c < col + cols; c++) sheet.grid.set(r + ':' + c, false);
            }
            return this;
          }
        };
        for (const method of [
          'setBackground', 'setFontFamily', 'setFontSize', 'setFontColor',
          'setVerticalAlignment', 'setWrap', 'setFontWeight', 'setHorizontalAlignment'
        ]) range[method] = function() { return this; };
        return range;
      },
      appendRow(values) { this.getRange(this.getLastRow() + 1, 1, 1, values.length).setValues([values]); }
    };
    state.sheets.push(sheet);
    return sheet;
  }

  for (const name of options.names || ['Página1']) createSheet(name);
  for (const original of options.seed || []) {
    const sheet = state.sheets.find(item => item.name === original.name);
    sheet.grid = new Map(original.grid);
    sheet.cells = new Map(original.cells);
    sheet.hiddenRows = new Set(original.hiddenRows);
    sheet.rows = original.rows;
    sheet.columns = original.columns;
    sheet.hidden = original.hidden;
  }
  state.originals = state.sheets.slice();

  const spreadsheet = {
    getId() { return state.spreadsheetId; },
    getName() { return options.name || 'Minha planilha PNP'; },
    getSheets() { return state.sheets.slice(); },
    getSheetByName(name) { return state.sheets.find(sheet => sheet.name === name) || null; },
    insertSheet(name) {
      state.insertions++;
      state.operations.push('insert');
      const sheet = createSheet(name || 'Temporária ' + nextId);
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
    ButtonSet: { YES_NO: 'YES_NO', OK: 'OK' },
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
      if (options.onAlert) options.onAlert(state, spreadsheet);
      if (options.changeSheetsInDialog) createSheet('Adicionada durante a confirmação');
      return options.answer || 'YES';
    },
    showModalDialog(html, title) { state.dialogs.push({ html, title }); }
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
    },
    HtmlService: {
      createHtmlOutputFromFile(name) {
        return {
          content: fs.readFileSync(path.join(root, name + '.html'), 'utf8'),
          setWidth(value) { this.width = value; return this; },
          setHeight(value) { this.height = value; return this; }
        };
      }
    },
    Session: { getActiveUser() { return { getEmail() { return state.email; } }; } },
    Utilities: { getUuid() { return 'uuid-' + nextId++; } },
    PropertiesService: {
      getUserProperties() { return { getProperty() { return null; } }; },
      getScriptProperties() {
        return {
          getProperty(key) { return state.scriptProperties.get(key) ?? null; },
          setProperty(key, value) {
            if (state.failInstalledPropertyWrites > 0) {
              state.failInstalledPropertyWrites--;
              throw new Error('Falha simulada ao registrar instalação vigente.');
            }
            state.scriptProperties.set(key, value);
            return this;
          }
        };
      }
    },
    Logger: { log() {} }
  });
  for (const name of fs.readdirSync(root).filter(name => name.endsWith('.js')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
  }
  const app = {
    state, spreadsheet,
    evaluate(code) { return vm.runInContext(code, context); },
    open() { return this.evaluate('onOpen()'); },
    prepare() { return this.evaluate('prepararPlanilhaInstaladora()'); },
    start() { return this.evaluate('iniciarAssistenteInstalacao()'); },
    install() { return this.evaluate('executarInstalacaoPnp()'); },
    record() {
      const sheet = spreadsheet.getSheetByName('INSTALADORA') || spreadsheet.getSheetByName('PNP INSTALADA');
      const raw = sheet && sheet.getRange('A40').getValue();
      return raw ? JSON.parse(raw) : null;
    },
    copy(newId, overrides = {}) {
      return simulate({ ...options, names: state.sheets.map(sheet => sheet.name),
        seed: state.sheets, spreadsheetId: newId, ...overrides });
    }
  };
  return app;
}

module.exports = { simulate };
