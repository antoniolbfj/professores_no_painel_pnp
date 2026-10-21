/**
 * @file Controller.gs
 * @fileoverview Controlador principal da aplicação.
 * Responsável pelas rotas web, preparação dos registros e endpoints da API interna.
 * @version 10.0.9
 */


/**
 * Identificação da versão implantada.
 *
 * @const {Object}
 */
const APP_INFO = Object.freeze({
  name: 'Carga Horária Docente',
  version: '10.0.9'
});


/**
 * Parâmetros oficiais pré-preenchidos para análise da carga semanal de aulas.
 * Os valores podem ser alterados apenas no frontend para simulações da sessão.
 *
 * @const {Object}
 */
const TEACHING_LOAD_REFERENCE = Object.freeze({
  source: Object.freeze({
    title: 'Portaria MEC nº 750, de 30 de julho de 2024',
    annexItem: '11',
    measurementUnit: 'hora de 60 minutos',
    scope: 'carga horária semanal de aulas'
  }),
  calendar: Object.freeze({
    daysSemester1: 100,
    weeksSemester1: 20,
    daysSemester2: 100,
    weeksSemester2: 20
  }),
  weeklyRanges: Object.freeze({
    integral: Object.freeze({ minimum: 10, maximum: 20 }),
    partial: Object.freeze({ minimum: 8, maximum: 12 })
  }),
  specialConditions: Object.freeze({
    source: 'Resolução IFTM nº 29/2019, de 27 de março de 2019',
    strictoSensu: Object.freeze({ minimum: 8, maximum: 12 }),
    directionOrGratifiedFunction: Object.freeze({ minimum: 4, maximum: 12 }),
    campusDirectionMayBeExempt: true,
    appliesOnlyDuringCondition: true
  }),
  classDurationMinutes: 50
});

/**
 * Regras acadêmicas compartilhadas pela camada de controle.
 * A classificação semestral considera exclusivamente o campo SEMESTRE da base.
 * O campo PERÍODO representa a posição curricular e não participa dos cálculos.
 *
 * @const {Object}
 */
const DashboardRules = {
  /**
   * Normaliza o semestre de oferta de uma disciplina.
   *
   * @param {*} value Valor bruto do campo SEMESTRE.
   * @returns {string} String vazia para oferta anual, "1" ou "2" para oferta semestral.
   * @throws {Error} Quando o valor informado não representa uma oferta anual, de 1º ou de 2º semestre.
   */
  normalizeSemester: function(value) {
    if (value === null || value === undefined || String(value).trim() === '') {
      return '';
    }

    const semester = String(value).trim();
    if (semester !== '1' && semester !== '2') {
      throw new Error('Valor inválido no campo SEMESTRE: "' + semester + '".');
    }

    return semester;
  },

  /**
   * Retorna o fator da carga horária que pertence ao semestre selecionado.
   * Disciplinas anuais são divididas igualmente entre os dois semestres.
   *
   * @param {*} recordSemester Valor bruto do campo SEMESTRE do registro.
   * @param {string|number} selectedSemester Semestre de destino: 1 ou 2.
   * @returns {number} 0, 0.5 ou 1.
   */
  getSemesterAllocationFactor: function(recordSemester, selectedSemester) {
    const semester = DashboardRules.normalizeSemester(recordSemester);
    const target = String(selectedSemester).trim();

    if (target !== '1' && target !== '2') {
      throw new Error('Semestre de destino inválido: "' + target + '".');
    }

    if (semester === '') return 0.5;
    return semester === target ? 1 : 0;
  },

  /**
   * Converte hora-relógio em hora-aula equivalente.
   * A duração é um parâmetro do dashboard e não altera a unidade armazenada na base.
   *
   * @param {*} clockHours Carga horária registrada em horas de 60 minutos.
   * @param {*} classDurationMinutes Duração configurada para uma hora-aula.
   * @returns {number} Carga equivalente em horas-aula.
   * @throws {Error} Quando a carga ou a duração não são números válidos.
   */
  clockHoursToClassHours: function(clockHours, classDurationMinutes) {
    const hours = Number(clockHours);
    const duration = Number(classDurationMinutes);

    if (!Number.isFinite(hours)) {
      throw new Error('Carga em hora-relógio inválida: "' + clockHours + '".');
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Duração da hora-aula inválida: "' + classDurationMinutes + '".');
    }

    return hours * (60 / duration);
  },

  /**
   * Prepara um registro para consumo pelo frontend, sem alterar o objeto original.
   *
   * @param {Object} row Registro extraído pelo DAO.
   * @returns {Object} Registro enriquecido com semestre canônico e fatores de alocação.
   */
  prepareRecord: function(row) {
    const semester = DashboardRules.normalizeSemester(row['SEMESTRE']);
    const prepared = Object.assign({}, row);

    prepared['SEMESTRE_OFERTA'] = semester;
    prepared['FATOR_SEMESTRE_1'] = DashboardRules.getSemesterAllocationFactor(semester, '1');
    prepared['FATOR_SEMESTRE_2'] = DashboardRules.getSemesterAllocationFactor(semester, '2');

    return prepared;
  },

  /**
   * Prepara a coleção completa de registros para o dashboard.
   *
   * @param {Array<Object>} rows Registros extraídos pelo DAO.
   * @returns {Array<Object>} Registros preparados para o frontend.
   */
  prepareRecords: function(rows) {
    return rows.map(DashboardRules.prepareRecord);
  },

  /**
   * Retorna uma cópia serializável dos parâmetros oficiais da versão 9.8.
   *
   * @returns {Object} Referência normativa e valores iniciais.
   */
  getTeachingLoadReference: function() {
    return JSON.parse(JSON.stringify(TEACHING_LOAD_REFERENCE));
  },

  /**
   * Resolve a faixa semanal aplicável ao regime de trabalho.
   *
   * @param {*} weeklyContractHours Jornada semanal contratual: 20 ou 40.
   * @param {Object} [ranges] Faixas opcionais usadas em simulação.
   * @returns {{minimum:number|null,maximum:number|null}}
   */
  resolveWeeklyRange: function(weeklyContractHours, ranges) {
    const contract = Number(weeklyContractHours);
    const source = ranges || TEACHING_LOAD_REFERENCE.weeklyRanges;
    if (contract === 40) {
      return {
        minimum: Number(source.integral.minimum),
        maximum: Number(source.integral.maximum)
      };
    }
    if (contract === 20) {
      return {
        minimum: Number(source.partial.minimum),
        maximum: Number(source.partial.maximum)
      };
    }
    return { minimum: null, maximum: null };
  },

  /**
   * Classifica uma média semanal sem interpretar a jornada total do docente.
   *
   * @param {*} weeklyClockHours Média semanal de carga de aulas.
   * @param {*} weeklyContractHours Jornada contratual.
   * @param {Object} [ranges] Faixas opcionais usadas em simulação.
   * @param {Array<Object>} [conditions] Condições administrativas vigentes.
   * @returns {string} BELOW, BELOW_JUSTIFIED, WITHIN, ABOVE ou UNASSESSED.
   */
  classifyWeeklyTeachingLoad: function(
    weeklyClockHours,
    weeklyContractHours,
    ranges,
    conditions
  ) {
    const average = Number(weeklyClockHours);
    const range = DashboardRules.resolveWeeklyRange(weeklyContractHours, ranges);
    if (!Number.isFinite(average)
        || range.minimum === null
        || range.maximum === null
        || !Number.isFinite(range.minimum)
        || !Number.isFinite(range.maximum)) {
      return 'UNASSESSED';
    }
    if (average < range.minimum) {
      const justified = (Array.isArray(conditions) ? conditions : []).some(
        function(condition) {
          return condition
            && condition.active !== false
            && condition.justifiesBelowMinimum === true;
        }
      );
      return justified ? 'BELOW_JUSTIFIED' : 'BELOW';
    }
    if (average > range.maximum) return 'ABOVE';
    return 'WITHIN';
  }
};

/**
 * Renderiza a aplicação web.
 *
 * @param {GoogleAppsScript.Events.DoGet} e Evento HTTP do Apps Script.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} Página principal da aplicação.
 */
function include(filename) {
  const allowedIncludes = Object.freeze(['HelpAssistant_', 'TeacherConditionsView']);
  if (allowedIncludes.indexOf(String(filename || '')) === -1) {
    throw new Error('Componente HTML não autorizado.');
  }
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
  const html = HtmlService.createTemplateFromFile('index').evaluate();
  html.setTitle('Carga Horária Docente | IFTM - Campus Uberlândia')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}



/**
 * Retorna um plano leve para o carregamento progressivo do dashboard.
 * Nenhum registro acadêmico completo é lido neste endpoint.
 *
 * @returns {string} Plano com anos e quantidades de registros disponíveis.
 */
function getDashboardLoadPlan() {
  try {
    AccessControlService.requireInstitutionalUser();
    const plan = Dao.getDashboardLoadPlan();
    const referenceData = typeof TeacherAreasService !== 'undefined'
      ? TeacherAreasService.getDashboardReferenceData()
      : { areas: [], summary: {}, health: {} };
    referenceData.teacherConditions = typeof TeacherConditionsService !== 'undefined'
      ? TeacherConditionsService.getDashboardReferenceData()
      : { summary: {}, health: { available: false } };
    referenceData.teachingLoad = DashboardRules.getTeachingLoadReference();
    plan.referenceData = referenceData;
    return JSON.stringify({
      status: 'success',
      plan: plan,
      meta: {
        app: APP_INFO.name,
        version: APP_INFO.version
      }
    });
  } catch (error) {
    Logger.log('Erro no Controller (getDashboardLoadPlan): ' + error.message);
    return JSON.stringify({
      status: 'error',
      message: 'Falha ao preparar o carregamento: ' + error.message
    });
  }
}

/**
 * Carrega e cruza os dados de um único ano letivo.
 * A divisão por ano permite que o frontend informe a etapa real em andamento.
 *
 * @param {string|number} year Ano letivo.
 * @returns {string} Dados e indicadores do ano solicitado.
 */
function getDashboardYearData(year) {
  try {
    AccessControlService.requireInstitutionalUser();
    const normalizedYear = String(year === null || year === undefined ? '' : year).trim();
    if (!/^\d{4}$/.test(normalizedYear)) {
      throw new Error('Ano letivo inválido: "' + normalizedYear + '".');
    }

    const rawData = Dao.extractDataFromYear(normalizedYear);
    const preparedData = DashboardRules.prepareRecords(rawData);
    const studentsByYear = {};
    studentsByYear[normalizedYear] = Dao.extractStudentRowsForYear(normalizedYear);
    const analytics = AcademicAnalytics.buildFromSources(
      preparedData,
      studentsByYear,
      Dao.extractTeacherRegistry()
    );

    return JSON.stringify({
      status: 'success',
      year: normalizedYear,
      data: analytics.rows,
      professorIndicators: analytics.professorIndicators,
      diagnostics: analytics.diagnostics,
      meta: {
        app: APP_INFO.name,
        version: APP_INFO.version,
        recordCount: analytics.rows.length,
        teacherRegistryAvailable: analytics.diagnostics.teacherRegistryAvailable
      }
    });
  } catch (error) {
    Logger.log('Erro no Controller (getDashboardYearData): ' + error.message);
    return JSON.stringify({
      status: 'error',
      message: 'Falha ao processar o ano solicitado: ' + error.message
    });
  }
}

/**
 * Retorna os registros acadêmicos preparados para o frontend.
 *
 * @returns {string} Resposta JSON com status e dados do dashboard.
 */
function getDashboardData() {
  try {
    AccessControlService.requireInstitutionalUser();
    const rawData = Dao.extractDataFromSheets();
    const preparedData = DashboardRules.prepareRecords(rawData);
    const analytics = AcademicAnalytics.build(preparedData);

    return JSON.stringify({
      status: 'success',
      data: analytics.rows,
      professorIndicators: analytics.professorIndicators,
      diagnostics: analytics.diagnostics,
      meta: {
        app: APP_INFO.name,
        version: APP_INFO.version,
        recordCount: analytics.rows.length,
        teacherRegistryAvailable: analytics.diagnostics.teacherRegistryAvailable
      }
    });
  } catch (error) {
    Logger.log('Erro no Controller (getDashboardData): ' + error.message);
    return JSON.stringify({
      status: 'error',
      message: 'Falha ao processar os dados: ' + error.message
    });
  }
}


/**
 * Retorna um diagnóstico leve da implantação e da planilha ativa.
 * Não lê todas as linhas da base.
 *
 * @returns {string} Estado serializado da aplicação.
 */
function getAppHealth() {
  try {
    AccessControlService.requireInstitutionalUser();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetCount = spreadsheet ? spreadsheet.getSheets().length : 0;

    const sheets = spreadsheet ? spreadsheet.getSheets() : [];
    const annualSheetCount = sheets.filter(function(sheet) {
      return /^\d{4}$/.test(sheet.getName());
    }).length;
    const studentSheetCount = sheets.filter(function(sheet) {
      return /^ALUNOXCAMPUSX\d{4}$/.test(sheet.getName());
    }).length;
    const teacherRegistryAvailable = sheets.some(function(sheet) {
      return sheet.getName() === 'DOCENTES';
    });
    const knowledgeAreasSheet = spreadsheet
      ? spreadsheet.getSheetByName('AREAS_CONHECIMENTO')
      : null;
    let knowledgeAreasHeadersValid = false;
    let knowledgeAreasRecordCount = 0;
    if (knowledgeAreasSheet && typeof KNOWLEDGE_AREAS_CONFIG !== 'undefined') {
      const actualHeaders = knowledgeAreasSheet.getRange(
        1,
        1,
        1,
        KNOWLEDGE_AREAS_CONFIG.headers.length
      ).getDisplayValues()[0];
      knowledgeAreasHeadersValid = KNOWLEDGE_AREAS_CONFIG.headers.every(function(header, index) {
        return String(actualHeaders[index] || '').trim() === header;
      });
      try {
        knowledgeAreasRecordCount = typeof KnowledgeAreasService !== 'undefined'
          ? KnowledgeAreasService.list().areas.length
          : Math.max(knowledgeAreasSheet.getLastRow() - 1, 0);
      } catch (ignoredAreaCountError) {
        knowledgeAreasRecordCount = Math.max(knowledgeAreasSheet.getLastRow() - 1, 0);
      }
    }

    const teacherAreasReference = typeof TeacherAreasService !== 'undefined'
      ? TeacherAreasService.getDashboardReferenceData()
      : { summary: {}, health: {} };
    const teacherConditionsReference = typeof TeacherConditionsService !== 'undefined'
      ? TeacherConditionsService.getDashboardReferenceData()
      : { summary: {}, health: { available: false, headersValid: false } };

    return JSON.stringify({
      status: spreadsheet ? 'healthy' : 'unhealthy',
      app: APP_INFO.name,
      version: APP_INFO.version,
      sheetCount: sheetCount,
      annualSheetCount: annualSheetCount,
      studentSheetCount: studentSheetCount,
      teacherRegistryAvailable: teacherRegistryAvailable,
      knowledgeAreas: {
        enabled: typeof KNOWLEDGE_AREAS_CONFIG !== 'undefined',
        sheetAvailable: Boolean(knowledgeAreasSheet),
        headersValid: knowledgeAreasHeadersValid,
        recordCount: knowledgeAreasRecordCount
      },
      teacherAreas: {
        enabled: typeof TEACHER_AREAS_CONFIG !== 'undefined',
        associationSheetAvailable: Boolean(teacherAreasReference.health.associationsAvailable),
        controlSheetAvailable: Boolean(teacherAreasReference.health.controlsAvailable),
        assignmentCount: Number(teacherAreasReference.summary.assignmentCount || 0),
        activeAssignmentCount: Number(teacherAreasReference.summary.activeAssignmentCount || 0),
        controlledTeacherCount: Number(teacherAreasReference.summary.controlledTeacherCount || 0)
      },
      teacherConditions: {
        enabled: typeof TEACHER_CONDITIONS_CONFIG !== 'undefined',
        sheetAvailable: Boolean(teacherConditionsReference.health.available),
        headersValid: Boolean(teacherConditionsReference.health.headersValid),
        conditionCount: Number(teacherConditionsReference.summary.conditionCount || 0),
        activeConditionCount: Number(
          teacherConditionsReference.summary.activeConditionCount || 0
        ),
        teacherCount: Number(teacherConditionsReference.summary.teacherCount || 0)
      },
      dataManagement: {
        enabled: typeof DATA_MANAGEMENT_CONFIG !== 'undefined',
        disciplineHeaderCount: typeof DATA_MANAGEMENT_CONFIG !== 'undefined'
          ? DATA_MANAGEMENT_CONFIG.reportContracts.disciplines.headers.length
          : 0,
        studentHeaderCount: typeof DATA_MANAGEMENT_CONFIG !== 'undefined'
          ? DATA_MANAGEMENT_CONFIG.reportContracts.students.headers.length
          : 0,
        teacherHeaderCount: typeof DATA_MANAGEMENT_CONFIG !== 'undefined'
          ? DATA_MANAGEMENT_CONFIG.reportContracts.teachers.headers.length
          : 0,
        maxBackupsPerDataset: typeof DATA_MANAGEMENT_CONFIG !== 'undefined'
          ? DATA_MANAGEMENT_CONFIG.maxBackupsPerDataset
          : 0
      }
    });
  } catch (error) {
    Logger.log('Erro no health check: ' + error.message);
    return JSON.stringify({
      status: 'unhealthy',
      app: APP_INFO.name,
      version: APP_INFO.version,
      message: error.message
    });
  }
}
