/**
 * @file SetupVersao10.gs
 * @fileoverview Instalação estrutural autossuficiente e verificação da versão 10.0.9.
 * @version 10.0.9
 */

const SETUP_V10_CONFIG = Object.freeze({
  version: '10.0.9',
  minimumRows: 200,
  headerBackground: '#166534',
  headerFontColor: '#ffffff'
});

/** Retorna o contrato imutável da instalação sem executar alterações. */
function obterPlanoInstalacaoVersao10() {
  return Object.freeze({
    structureOnly: true,
    additiveOnly: true,
    includeAreaCatalog: false,
    createInitialUser: false,
    preservedImportedSheets: Object.freeze([
      'DOCENTES', 'abas anuais', 'ALUNOXCAMPUSX[ano]'
    ]),
    newStructure: TEACHER_CONDITIONS_CONFIG.sheetName
  });
}

/** Nome explícito disponibilizado no pacote da versão 10.0.5. */
function obterPlanoInstalacaoVersao1005() {
  return obterPlanoInstalacaoVersao10();
}

/** Nome explícito disponibilizado no pacote da versão 10.0.6. */
function obterPlanoInstalacaoVersao1006() {
  return obterPlanoInstalacaoVersao10();
}

/** Nome explícito disponibilizado no pacote da versão 10.0.7. */
function obterPlanoInstalacaoVersao1007() {
  return obterPlanoInstalacaoVersao10();
}

/** Nome explícito disponibilizado no pacote da versão 10.0.8. */
function obterPlanoInstalacaoVersao1008() {
  return obterPlanoInstalacaoVersao10();
}

/** Nome explícito disponibilizado no pacote da versão 10.0.9. */
function obterPlanoInstalacaoVersao1009() {
  return obterPlanoInstalacaoVersao10();
}

/**
 * Instala o PNP somente em uma cópia de um modelo preparado.
 * O coordenador cria as estruturas, cadastra a conta bootstrap autorizada na
 * primeira instalação e valida o módulo da Ema, sem importar dados acadêmicos.
 */
function instalarVersao10() {
  return executarInstalacaoProtegidaPnp_();
}

/** Ponto de entrada recomendado pelo instalador da versão 10.0.5. */
function instalarVersao1005() {
  return instalarVersao10();
}

/** Ponto de entrada recomendado pelo instalador da versão 10.0.6. */
function instalarVersao1006() {
  return instalarVersao10();
}

/** Ponto de entrada recomendado pelo instalador da versão 10.0.7. */
function instalarVersao1007() {
  return instalarVersao10();
}

/** Ponto de entrada recomendado pelo instalador da versão 10.0.8. */
function instalarVersao1008() {
  return instalarVersao10();
}

/** Ponto de entrada recomendado pelo instalador da versão 10.0.9. */
function instalarVersao1009() {
  return instalarVersao10();
}

/**
 * Instalador estrutural autossuficiente da versão 10.
 * Cria somente abas e cabeçalhos ausentes; registros existentes são preservados.
 */
function criarEstruturasVersao10_() {
  validarRequisitosInstalacaoPnp_();
  AccessControlService.requireSetupPrivilege();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Nenhuma planilha ativa foi encontrada.');
  const definitions = [
    {
      name: KNOWLEDGE_AREAS_CONFIG.sheetName,
      headers: KNOWLEDGE_AREAS_CONFIG.headers,
      checkboxColumns: [5]
    },
    {
      name: TEACHER_AREAS_CONFIG.associationSheetName,
      headers: TEACHER_AREAS_CONFIG.associationHeaders,
      checkboxColumns: [6]
    },
    {
      name: TEACHER_AREAS_CONFIG.controlSheetName,
      headers: TEACHER_AREAS_CONFIG.controlHeaders,
      checkboxColumns: [2]
    },
    {
      name: TEACHER_CONDITIONS_CONFIG.sheetName,
      headers: TEACHER_CONDITIONS_CONFIG.headers,
      checkboxColumns: [7, 8, 13]
    },
    {
      name: ACCESS_CONTROL_CONFIG.userSheetName,
      headers: ACCESS_CONTROL_CONFIG.userHeaders,
      checkboxColumns: [5]
    },
    {
      name: ACCESS_CONTROL_CONFIG.auditSheetName,
      headers: ACCESS_CONTROL_CONFIG.auditHeaders,
      checkboxColumns: []
    }
  ];
  const result = { created: [], preserved: [], migrated: [] };
  definitions.forEach(function(definition) {
    let sheet = spreadsheet.getSheetByName(definition.name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(definition.name);
      sheet.getRange(1, 1, 1, definition.headers.length)
        .setValues([definition.headers.slice()]);
      result.created.push(definition.name);
    } else {
      if (migrarEstruturaVersao1007_(sheet, definition)) {
        result.migrated.push(definition.name);
      }
      validarCabecalhosVersao10_(sheet, definition.headers);
      result.preserved.push(definition.name);
    }
    formatarEstruturaVersao10_(sheet, definition);
  });
  SpreadsheetApp.flush();
  return result;
}

/**
 * Acrescenta apenas a coluna nova da 10.0.7 quando a estrutura 10.0.6 é
 * reconhecida integralmente. Nenhum registro existente é movido ou apagado.
 */
function migrarEstruturaVersao1007_(sheet, definition) {
  if (definition.name !== TEACHER_AREAS_CONFIG.associationSheetName) return false;
  const legacyHeaders = TEACHER_AREAS_CONFIG.associationHeaders.slice(0, 8);
  const actualLegacy = sheet.getRange(1, 1, 1, legacyHeaders.length).getDisplayValues()[0];
  const matchesLegacy = legacyHeaders.every(function(header, index) {
    return String(actualLegacy[index] || '').trim() === header;
  });
  if (!matchesLegacy) return false;
  if (sheet.getMaxColumns() < TEACHER_AREAS_CONFIG.associationHeaders.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      TEACHER_AREAS_CONFIG.associationHeaders.length - sheet.getMaxColumns()
    );
  }
  const lastHeader = String(sheet.getRange(1, 9).getDisplayValue() || '').trim();
  if (lastHeader === 'Semestre_Fim') return false;
  if (lastHeader) return false;
  sheet.getRange(1, 9).setValue('Semestre_Fim');
  return true;
}

function validarCabecalhosVersao10_(sheet, expectedHeaders) {
  const actual = sheet.getRange(1, 1, 1, expectedHeaders.length).getDisplayValues()[0];
  const invalid = expectedHeaders.filter(function(header, index) {
    return String(actual[index] || '').trim() !== header;
  });
  if (invalid.length > 0) {
    throw new Error('A aba ' + sheet.getName()
      + ' possui cabeçalhos incompatíveis. Nenhum dado foi alterado: '
      + invalid.join(', ') + '.');
  }
}

function formatarEstruturaVersao10_(sheet, definition) {
  const requiredColumns = definition.headers.length;
  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < SETUP_V10_CONFIG.minimumRows + 1) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      SETUP_V10_CONFIG.minimumRows + 1 - sheet.getMaxRows()
    );
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, requiredColumns)
    .setFontWeight('bold')
    .setBackground(SETUP_V10_CONFIG.headerBackground)
    .setFontColor(SETUP_V10_CONFIG.headerFontColor)
    .setWrap(true);
  definition.checkboxColumns.forEach(function(column) {
    // insertCheckboxes() redefine os valores; uma retomada deve preservar
    // os indicadores existentes, inclusive o Super Usuário já cadastrado.
    const range = sheet.getRange(2, column, SETUP_V10_CONFIG.minimumRows, 1);
    const values = range.getValues();
    range.insertCheckboxes();
    range.setValues(values);
  });
  sheet.autoResizeColumns(1, requiredColumns);
}

/** Smoke test específico do módulo de ajuda. */
function executarSmokeTestVersao10() {
  AccessControlService.requireSetupPrivilege();
  const context = AccessControlService.getContext();
  const bootstrap = HelpAssistantService.buildBootstrap(context);
  const checks = [
    { check: 'version', ok: bootstrap.version === SETUP_V10_CONFIG.version },
    { check: 'states', ok: bootstrap.states.indexOf('WAITING_FOR_CLICK') >= 0 },
    { check: 'tutorials', ok: bootstrap.tutorials.length >= 2 },
    { check: 'dashboard_tutorial', ok: Boolean(HelpTutorialCatalog.getById('dashboard')) },
    { check: 'persistence_contract', ok: Boolean(bootstrap.progress) },
    { check: 'readiness_contract', ok: Boolean(bootstrap.readiness) },
    { check: 'release_notes', ok: Boolean(bootstrap.releaseNotes
        && bootstrap.releaseNotes.version === SETUP_V10_CONFIG.version) },
    { check: 'general_report_tutorial', ok: Boolean(
      HelpTutorialCatalog.getById('general-report')
    ) },
    { check: 'teacher_conditions_tutorial', ok: Boolean(
      HelpTutorialCatalog.getById('teacher-conditions')
    ) }
  ];
  const failed = checks.filter(function(item) { return !item.ok; });
  const result = { ok: failed.length === 0, checks: checks };
  Logger.log(JSON.stringify({
    level: result.ok ? 'INFO' : 'ERROR',
    event: 'setup_v10_smoke_test',
    origemExecucao: 'teste',
    metadata: result
  }));
  if (!result.ok) {
    throw new Error('Smoke test da versão 10.0.9 falhou: '
      + failed.map(function(item) { return item.check; }).join(', '));
  }
  return result;
}

/** Smoke test com nome explícito para o pacote 10.0.5. */
function executarSmokeTestVersao1005() {
  return executarSmokeTestVersao10();
}

/** Smoke test com nome explícito para o pacote 10.0.6. */
function executarSmokeTestVersao1006() {
  return executarSmokeTestVersao10();
}

/** Smoke test com nome explícito para o pacote 10.0.7. */
function executarSmokeTestVersao1007() {
  return executarSmokeTestVersao10();
}

/** Smoke test com nome explícito para o pacote 10.0.8. */
function executarSmokeTestVersao1008() {
  return executarSmokeTestVersao10();
}

/** Smoke test com nome explícito para o pacote 10.0.9. */
function executarSmokeTestVersao1009() {
  return executarSmokeTestVersao10();
}

/** Diagnóstico sem mutações do módulo de ajuda. */
function diagnosticarVersao10() {
  AccessControlService.requireSetupPrivilege();
  const context = AccessControlService.getContext();
  const bootstrap = HelpAssistantService.buildBootstrap(context);
  return {
    version: SETUP_V10_CONFIG.version,
    profile: bootstrap.user.profile,
    persistenceEnabled: bootstrap.persistenceEnabled,
    tutorialCount: bootstrap.tutorials.length,
    autoStartTutorialId: bootstrap.autoStartTutorialId,
    readiness: bootstrap.readiness
  };
}

/** Diagnóstico com nome explícito para o pacote 10.0.5. */
function diagnosticarVersao1005() {
  return diagnosticarVersao10();
}

/** Diagnóstico com nome explícito para o pacote 10.0.6. */
function diagnosticarVersao1006() {
  return diagnosticarVersao10();
}

/** Diagnóstico com nome explícito para o pacote 10.0.7. */
function diagnosticarVersao1007() {
  return diagnosticarVersao10();
}

/** Diagnóstico com nome explícito para o pacote 10.0.8. */
function diagnosticarVersao1008() {
  return diagnosticarVersao10();
}

/** Diagnóstico com nome explícito para o pacote 10.0.9. */
function diagnosticarVersao1009() {
  return diagnosticarVersao10();
}
