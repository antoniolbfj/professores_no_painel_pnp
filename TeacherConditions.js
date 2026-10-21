/**
 * @file TeacherConditions.gs
 * @fileoverview Cadastro administrativo de condições especiais dos docentes.
 * O relatório DOCENTES permanece como fonte oficial; esta camada complementar
 * nunca é sobrescrita pelas importações em lote.
 * @version 10.0.9
 */

const TEACHER_CONDITIONS_CONFIG = Object.freeze({
  version: '10.0.9',
  sheetName: 'DOCENTES_CONDICOES',
  headers: Object.freeze([
    'ID_Condicao',
    'Matricula_Docente',
    'Descricao',
    'Motivo',
    'Minimo_Semanal',
    'Maximo_Semanal',
    'Dispensa_Aulas',
    'Justifica_Abaixo_Minimo',
    'Ano_Inicio',
    'Semestre_Inicio',
    'Ano_Fim',
    'Semestre_Fim',
    'Ativa',
    'Origem',
    'Criado_Em',
    'Atualizado_Em',
    'Criado_Por',
    'Atualizado_Por'
  ]),
  lockTimeoutMilliseconds: 30000,
  normativeSource: 'Resolução IFTM nº 29/2019, de 27 de março de 2019'
});

const TeacherConditionsService = {
  /** Enriquece o espelho importado sem alterar qualquer dado oficial. */
  enrichTeacherRegistry: function(teachers) {
    const source = Array.isArray(teachers) ? teachers : [];
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const conditions = spreadsheet
      ? TeacherConditionsService._readConditionsSafely(spreadsheet)
      : [];
    const byRegistration = {};
    conditions.forEach(function(condition) {
      if (!byRegistration[condition.registration]) {
        byRegistration[condition.registration] = [];
      }
      byRegistration[condition.registration].push(
        TeacherConditionsService._toPublicCondition(condition)
      );
    });
    return source.map(function(teacher) {
      const registration = TeacherConditionsService.normalizeRegistration(
        teacher.registration
      );
      return Object.assign({}, teacher, {
        registration: registration,
        conditions: (byRegistration[registration] || [])
          .slice()
          .sort(TeacherConditionsService._compareConditions)
      });
    });
  },

  /** Resumo leve usado no carregamento e no diagnóstico do dashboard. */
  getDashboardReferenceData: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet
      ? spreadsheet.getSheetByName(TEACHER_CONDITIONS_CONFIG.sheetName)
      : null;
    if (!sheet) {
      return {
        summary: { conditionCount: 0, activeConditionCount: 0, teacherCount: 0 },
        health: { available: false, headersValid: false }
      };
    }
    try {
      TeacherConditionsService._assertHeaders(sheet);
      const conditions = TeacherConditionsService._readConditions(sheet);
      const teachers = {};
      conditions.forEach(function(condition) {
        if (condition.active) teachers[condition.registration] = true;
      });
      return {
        summary: {
          conditionCount: conditions.length,
          activeConditionCount: conditions.filter(function(item) {
            return item.active;
          }).length,
          teacherCount: Object.keys(teachers).length
        },
        health: { available: true, headersValid: true }
      };
    } catch (error) {
      return {
        summary: { conditionCount: 0, activeConditionCount: 0, teacherCount: 0 },
        health: { available: true, headersValid: false, message: error.message }
      };
    }
  },

  /** Lista segura para o cadastro administrativo. */
  listManagementData: function() {
    const spreadsheet = TeacherConditionsService._getSpreadsheetOrThrow();
    const sheet = TeacherConditionsService._getSheetOrThrow(spreadsheet);
    TeacherConditionsService._assertHeaders(sheet);
    const conditions = TeacherConditionsService._readConditions(sheet);
    const byRegistration = {};
    conditions.forEach(function(condition) {
      if (!byRegistration[condition.registration]) {
        byRegistration[condition.registration] = [];
      }
      byRegistration[condition.registration].push(
        TeacherConditionsService._toPublicCondition(condition)
      );
    });

    const teachers = Dao.extractTeacherRegistryRaw().map(function(teacher) {
      const registration = TeacherConditionsService.normalizeRegistration(
        teacher.registration
      );
      const teacherConditions = (byRegistration[registration] || [])
        .slice()
        .sort(TeacherConditionsService._compareConditions);
      return {
        registration: registration,
        name: String(teacher.name || '').trim(),
        jobTitle: String(teacher.jobTitle || '').trim(),
        workloadCode: String(teacher.workloadCode || '').trim(),
        workRegimeLabel: String(teacher.workRegimeLabel || 'Regime não identificado'),
        weeklyContractHours: TeacherConditionsService._optionalNumber(
          teacher.weeklyContractHours
        ),
        officialFunction: String(teacher.officialFunction || '').trim(),
        reducedWorkload: teacher.reducedWorkload === true,
        conditions: teacherConditions,
        suggestions: TeacherConditionsService._buildSuggestions(
          teacher,
          teacherConditions
        )
      };
    }).sort(function(first, second) {
      return first.name.localeCompare(second.name, 'pt-BR', {
        sensitivity: 'base', numeric: true
      });
    });

    return {
      meta: { version: TEACHER_CONDITIONS_CONFIG.version },
      teachers: teachers,
      summary: {
        teacherCount: teachers.length,
        conditionCount: conditions.length,
        activeConditionCount: conditions.filter(function(item) {
          return item.active;
        }).length,
        suggestionCount: teachers.reduce(function(sum, teacher) {
          return sum + teacher.suggestions.length;
        }, 0)
      }
    };
  },

  /** Cria ou edita uma condição, preservando criação e histórico. */
  save: function(payload, actor) {
    const normalized = TeacherConditionsService._validatePayload(payload || {});
    return TeacherConditionsService._withLock(function() {
      const spreadsheet = TeacherConditionsService._getSpreadsheetOrThrow();
      const sheet = TeacherConditionsService._getSheetOrThrow(spreadsheet);
      TeacherConditionsService._assertHeaders(sheet);
      const teachers = Dao.extractTeacherRegistryRaw();
      const teacherExists = teachers.some(function(teacher) {
        return TeacherConditionsService.normalizeRegistration(teacher.registration)
          === normalized.registration;
      });
      if (!teacherExists) {
        throw TeacherConditionsService._validationError(
          'A matrícula não existe no espelho importado de docentes.'
        );
      }

      const conditions = TeacherConditionsService._readConditions(sheet);
      const existing = normalized.id
        ? conditions.filter(function(item) { return item.id === normalized.id; })[0]
        : null;
      if (normalized.id && !existing) {
        throw TeacherConditionsService._validationError('Condição não encontrada.');
      }
      const duplicate = conditions.some(function(item) {
        return item.id !== normalized.id
          && item.registration === normalized.registration
          && TeacherConditionsService._normalizeText(item.description)
            === TeacherConditionsService._normalizeText(normalized.description)
          && item.active
          && normalized.active
          && TeacherConditionsService._periodsOverlap(item, normalized);
      });
      if (duplicate) {
        throw TeacherConditionsService._validationError(
          'Já existe uma condição ativa com a mesma descrição e vigência sobreposta.'
        );
      }

      const now = new Date();
      const userEmail = String(actor && actor.email || '').trim().toLowerCase();
      const persisted = Object.assign({}, normalized, {
        id: existing ? existing.id : Utilities.getUuid(),
        sourceRow: existing ? existing.sourceRow : 0,
        origin: 'ADMINISTRADOR',
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
        createdBy: existing ? existing.createdBy : userEmail,
        updatedBy: userEmail
      });

      if (existing) {
        sheet.getRange(
          existing.sourceRow,
          1,
          1,
          TEACHER_CONDITIONS_CONFIG.headers.length
        ).setValues([TeacherConditionsService._conditionToRow(persisted)]);
      } else {
        const rowNumber = TeacherConditionsService._findAppendRow(sheet);
        TeacherConditionsService._ensureRows(sheet, rowNumber);
        sheet.getRange(
          rowNumber,
          1,
          1,
          TEACHER_CONDITIONS_CONFIG.headers.length
        ).setValues([TeacherConditionsService._conditionToRow(persisted)]);
      }
      SpreadsheetApp.flush();
      AccessControlService.audit(
        existing ? 'CONDICAO_DOCENTE_EDITADA' : 'CONDICAO_DOCENTE_CADASTRADA',
        'SUCESSO',
        {
          id: persisted.id,
          matricula: persisted.registration,
          descricao: persisted.description
        },
        actor
      );
      return TeacherConditionsService.listManagementData();
    });
  },

  /** Inativa ou reativa sem excluir a linha histórica. */
  setActive: function(conditionId, active, actor) {
    const id = String(conditionId || '').trim();
    if (!id) throw TeacherConditionsService._validationError('Condição não informada.');
    const desiredActive = TeacherConditionsService._toBoolean(active, false);
    return TeacherConditionsService._withLock(function() {
      const spreadsheet = TeacherConditionsService._getSpreadsheetOrThrow();
      const sheet = TeacherConditionsService._getSheetOrThrow(spreadsheet);
      TeacherConditionsService._assertHeaders(sheet);
      const condition = TeacherConditionsService._readConditions(sheet)
        .filter(function(item) { return item.id === id; })[0];
      if (!condition) {
        throw TeacherConditionsService._validationError('Condição não encontrada.');
      }
      const updated = Object.assign({}, condition, {
        active: desiredActive,
        updatedAt: new Date(),
        updatedBy: String(actor && actor.email || '').trim().toLowerCase()
      });
      sheet.getRange(
        condition.sourceRow,
        1,
        1,
        TEACHER_CONDITIONS_CONFIG.headers.length
      ).setValues([TeacherConditionsService._conditionToRow(updated)]);
      SpreadsheetApp.flush();
      AccessControlService.audit(
        desiredActive ? 'CONDICAO_DOCENTE_REATIVADA' : 'CONDICAO_DOCENTE_INATIVADA',
        'SUCESSO',
        { id: id, matricula: condition.registration, descricao: condition.description },
        actor
      );
      return TeacherConditionsService.listManagementData();
    });
  },

  /** Regra pura de vigência anual/semestral. */
  conditionAppliesToPeriod: function(condition, year, semester) {
    const item = condition || {};
    if (item.active === false) return false;
    const normalizedYear = TeacherConditionsService._normalizeYear(year, false);
    if (!normalizedYear) return false;
    const normalizedSemester = TeacherConditionsService._normalizeSemester(semester, false);
    const rangeStart = Number(normalizedYear) * 2;
    const rangeEnd = rangeStart + (normalizedSemester === '1'
      ? 0
      : (normalizedSemester === '2' ? 1 : 1));
    const actualStart = rangeStart + (normalizedSemester === '2' ? 1 : 0);
    const conditionStart = Number(item.startYear) * 2
      + (String(item.startSemester || '') === '2' ? 1 : 0);
    const conditionEnd = item.endYear
      ? Number(item.endYear) * 2 + (String(item.endSemester || '') === '1' ? 0 : 1)
      : Number.POSITIVE_INFINITY;
    return actualStart <= conditionEnd && rangeEnd >= conditionStart;
  },

  /** Seleciona apenas condições vigentes no recorte informado. */
  filterForPeriod: function(conditions, year, semester) {
    return (Array.isArray(conditions) ? conditions : []).filter(function(condition) {
      return TeacherConditionsService.conditionAppliesToPeriod(
        condition,
        year,
        semester
      );
    });
  },

  normalizeRegistration: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .replace(/\.0+$/, '');
  },

  /** @private */
  _validatePayload: function(payload) {
    const registration = TeacherConditionsService.normalizeRegistration(
      payload.registration
    );
    if (!registration) {
      throw TeacherConditionsService._validationError('Matrícula docente não informada.');
    }
    const description = TeacherConditionsService._cleanText(payload.description);
    const reason = TeacherConditionsService._cleanText(payload.reason);
    if (description.length < 3 || description.length > 140) {
      throw TeacherConditionsService._validationError(
        'Informe uma descrição entre 3 e 140 caracteres.'
      );
    }
    if (reason.length < 3 || reason.length > 500) {
      throw TeacherConditionsService._validationError(
        'Informe um motivo entre 3 e 500 caracteres.'
      );
    }
    const exemption = TeacherConditionsService._toBoolean(payload.exemption, false);
    const minimum = TeacherConditionsService._optionalNumber(payload.minimum);
    const maximum = TeacherConditionsService._optionalNumber(payload.maximum);
    if ((minimum === null) !== (maximum === null)) {
      throw TeacherConditionsService._validationError(
        'Informe conjuntamente o mínimo e o máximo semanal, ou deixe ambos vazios.'
      );
    }
    if (minimum !== null && (minimum < 0 || maximum < minimum || maximum > 80)) {
      throw TeacherConditionsService._validationError('Faixa semanal inválida.');
    }
    const startYear = TeacherConditionsService._normalizeYear(payload.startYear, true);
    const startSemester = TeacherConditionsService._normalizeSemester(
      payload.startSemester,
      false
    );
    const endYear = TeacherConditionsService._normalizeYear(payload.endYear, false);
    const endSemester = TeacherConditionsService._normalizeSemester(
      payload.endSemester,
      false
    );
    if (endSemester && !endYear) {
      throw TeacherConditionsService._validationError(
        'Informe o ano final antes do semestre final.'
      );
    }
    if (endYear) {
      const startPosition = Number(startYear) * 2 + (startSemester === '2' ? 1 : 0);
      const endPosition = Number(endYear) * 2 + (endSemester === '1' ? 0 : 1);
      if (endPosition < startPosition) {
        throw TeacherConditionsService._validationError(
          'A vigência final não pode ser anterior à inicial.'
        );
      }
    }
    return {
      id: String(payload.id || '').trim(),
      registration: registration,
      description: description,
      reason: reason,
      minimum: exemption ? null : minimum,
      maximum: exemption ? null : maximum,
      exemption: exemption,
      justifiesBelowMinimum: TeacherConditionsService._toBoolean(
        payload.justifiesBelowMinimum,
        true
      ),
      startYear: startYear,
      startSemester: startSemester,
      endYear: endYear,
      endSemester: endSemester,
      active: TeacherConditionsService._toBoolean(payload.active, true)
    };
  },

  /** @private */
  _buildSuggestions: function(teacher, existingConditions) {
    const suggestions = [];
    const currentYear = String(new Date().getFullYear());
    const activeDescriptions = (existingConditions || []).filter(function(condition) {
      return condition.active !== false;
    }).map(function(condition) {
      return TeacherConditionsService._normalizeText(condition.description);
    });
    const officialFunction = String(teacher.officialFunction || '').trim();
    if (officialFunction) {
      const functionSuggestion = TeacherConditionsService._suggestFunction(
        officialFunction,
        currentYear
      );
      if (activeDescriptions.indexOf(
        TeacherConditionsService._normalizeText(functionSuggestion.description)
      ) < 0) {
        suggestions.push(functionSuggestion);
      }
    }
    if (teacher.reducedWorkload === true) {
      const reducedDescription = 'Jornada reduzida';
      if (activeDescriptions.indexOf(
        TeacherConditionsService._normalizeText(reducedDescription)
      ) < 0) {
        const contract = TeacherConditionsService._optionalNumber(
          teacher.weeklyContractHours
        );
        const range = typeof DashboardRules !== 'undefined'
          ? DashboardRules.resolveWeeklyRange(contract)
          : { minimum: null, maximum: null };
        suggestions.push({
          kind: 'WORKLOAD',
          description: reducedDescription,
          reason: 'Jornada de ' + contract
            + ' horas identificada na coluna J do relatório DOCENTES.',
          minimum: range.minimum,
          maximum: range.maximum,
          exemption: false,
          justifiesBelowMinimum: true,
          startYear: currentYear,
          startSemester: '',
          endYear: '',
          endSemester: ''
        });
      }
    }
    return suggestions;
  },

  /** @private */
  _suggestFunction: function(value, currentYear) {
    const normalized = TeacherConditionsService._normalizeText(value);
    let description = 'Função administrativa';
    let exemption = false;
    let minimum = 4;
    let maximum = 12;
    if (normalized.indexOf('DIRETOR(A) GERAL') >= 0
        || normalized.indexOf('DIRETOR GERAL') >= 0
        || normalized.indexOf('DIRETORA GERAL') >= 0) {
      description = 'Direção Geral';
      exemption = true;
      minimum = null;
      maximum = null;
    } else if (normalized.indexOf('COORDENADOR(A) GERAL') >= 0) {
      description = 'Coordenação Geral';
    } else if (normalized.indexOf('DO CURSO') >= 0
        || normalized.indexOf('DOS CURSOS') >= 0) {
      description = 'Coordenação de Curso';
    } else if (normalized.indexOf('COORDENADOR') >= 0
        || normalized.indexOf('COORDENADORA') >= 0) {
      description = 'Coordenação';
    } else if (normalized.indexOf('DIRETOR') >= 0
        || normalized.indexOf('DIRETORA') >= 0) {
      description = 'Direção';
    }
    return {
      kind: 'FUNCTION',
      description: description,
      reason: 'Função importada: ' + String(value || '').trim() + '. '
        + 'Parâmetro sugerido conforme ' + TEACHER_CONDITIONS_CONFIG.normativeSource + '.',
      minimum: minimum,
      maximum: maximum,
      exemption: exemption,
      justifiesBelowMinimum: true,
      startYear: currentYear,
      startSemester: '',
      endYear: '',
      endSemester: ''
    };
  },

  /** @private */
  _readConditionsSafely: function(spreadsheet) {
    try {
      const sheet = spreadsheet.getSheetByName(TEACHER_CONDITIONS_CONFIG.sheetName);
      if (!sheet) return [];
      TeacherConditionsService._assertHeaders(sheet);
      return TeacherConditionsService._readConditions(sheet);
    } catch (error) {
      Logger.log(JSON.stringify({
        level: 'WARNING',
        event: 'teacher_conditions_unavailable_for_dashboard',
        appVersion: TEACHER_CONDITIONS_CONFIG.version,
        message: error.message
      }));
      return [];
    }
  },

  /** @private */
  _readConditions: function(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    const values = sheet.getRange(
      2,
      1,
      lastRow - 1,
      TEACHER_CONDITIONS_CONFIG.headers.length
    ).getValues();
    const result = [];
    values.forEach(function(row, offset) {
      if (!TeacherConditionsService._rowHasMeaningfulData(row)) return;
      const condition = TeacherConditionsService._rowToCondition(row, offset + 2);
      if (!condition.id || !condition.registration || !condition.description) {
        throw new Error(
          'Linha ' + (offset + 2) + ' incompleta em '
          + TEACHER_CONDITIONS_CONFIG.sheetName + '.'
        );
      }
      result.push(condition);
    });
    const ids = {};
    result.forEach(function(condition) {
      if (ids[condition.id]) {
        throw new Error('ID de condição duplicado: ' + condition.id + '.');
      }
      ids[condition.id] = true;
    });
    return result;
  },

  /** @private */
  _rowToCondition: function(row, sourceRow) {
    return {
      sourceRow: sourceRow,
      id: String(row[0] || '').trim(),
      registration: TeacherConditionsService.normalizeRegistration(row[1]),
      description: TeacherConditionsService._cleanText(row[2]),
      reason: TeacherConditionsService._cleanText(row[3]),
      minimum: TeacherConditionsService._optionalNumber(row[4]),
      maximum: TeacherConditionsService._optionalNumber(row[5]),
      exemption: TeacherConditionsService._toBoolean(row[6], false),
      justifiesBelowMinimum: TeacherConditionsService._toBoolean(row[7], true),
      startYear: TeacherConditionsService._normalizeYear(row[8], false),
      startSemester: TeacherConditionsService._normalizeSemester(row[9], false),
      endYear: TeacherConditionsService._normalizeYear(row[10], false),
      endSemester: TeacherConditionsService._normalizeSemester(row[11], false),
      active: TeacherConditionsService._toBoolean(row[12], false),
      origin: String(row[13] || '').trim(),
      createdAt: TeacherConditionsService._toDateOrNull(row[14]),
      updatedAt: TeacherConditionsService._toDateOrNull(row[15]),
      createdBy: String(row[16] || '').trim().toLowerCase(),
      updatedBy: String(row[17] || '').trim().toLowerCase()
    };
  },

  /** @private */
  _conditionToRow: function(item) {
    return [
      item.id,
      item.registration,
      item.description,
      item.reason,
      item.minimum === null ? '' : item.minimum,
      item.maximum === null ? '' : item.maximum,
      item.exemption === true,
      item.justifiesBelowMinimum === true,
      item.startYear,
      item.startSemester,
      item.endYear,
      item.endSemester,
      item.active === true,
      item.origin || 'ADMINISTRADOR',
      item.createdAt || '',
      item.updatedAt || '',
      item.createdBy || '',
      item.updatedBy || ''
    ];
  },

  /** @private */
  _toPublicCondition: function(item) {
    return {
      id: item.id,
      registration: item.registration,
      description: item.description,
      reason: item.reason,
      minimum: item.minimum,
      maximum: item.maximum,
      exemption: item.exemption === true,
      justifiesBelowMinimum: item.justifiesBelowMinimum === true,
      startYear: item.startYear,
      startSemester: item.startSemester,
      endYear: item.endYear,
      endSemester: item.endSemester,
      active: item.active === true,
      origin: item.origin,
      createdAt: TeacherConditionsService._formatDate(item.createdAt),
      updatedAt: TeacherConditionsService._formatDate(item.updatedAt),
      createdBy: item.createdBy,
      updatedBy: item.updatedBy
    };
  },

  /** @private */
  _periodsOverlap: function(first, second) {
    const firstStart = Number(first.startYear) * 2
      + (String(first.startSemester || '') === '2' ? 1 : 0);
    const firstEnd = first.endYear
      ? Number(first.endYear) * 2 + (String(first.endSemester || '') === '1' ? 0 : 1)
      : Number.POSITIVE_INFINITY;
    const secondStart = Number(second.startYear) * 2
      + (String(second.startSemester || '') === '2' ? 1 : 0);
    const secondEnd = second.endYear
      ? Number(second.endYear) * 2 + (String(second.endSemester || '') === '1' ? 0 : 1)
      : Number.POSITIVE_INFINITY;
    return firstStart <= secondEnd && secondStart <= firstEnd;
  },

  /** @private */
  _assertHeaders: function(sheet) {
    const actual = sheet.getRange(
      1,
      1,
      1,
      TEACHER_CONDITIONS_CONFIG.headers.length
    ).getDisplayValues()[0];
    const problems = [];
    TEACHER_CONDITIONS_CONFIG.headers.forEach(function(expected, index) {
      const found = String(actual[index] || '').trim();
      if (found !== expected) {
        problems.push('coluna ' + (index + 1) + ': esperado "' + expected
          + '", encontrado "' + (found || '[vazio]') + '"');
      }
    });
    if (problems.length > 0) {
      throw new Error('A aba ' + TEACHER_CONDITIONS_CONFIG.sheetName
        + ' possui cabeçalhos incompatíveis: ' + problems.join(' | ') + '.');
    }
  },

  /** @private */
  _getSpreadsheetOrThrow: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('Nenhuma planilha ativa foi encontrada.');
    return spreadsheet;
  },

  /** @private */
  _getSheetOrThrow: function(spreadsheet) {
    const sheet = spreadsheet.getSheetByName(TEACHER_CONDITIONS_CONFIG.sheetName);
    if (!sheet) {
      throw new Error('A estrutura de condições docentes ainda não foi instalada. '
        + 'Execute instalarVersao1009().');
    }
    return sheet;
  },

  /** @private */
  _withLock: function(callback) {
    const lock = LockService.getDocumentLock();
    lock.waitLock(TEACHER_CONDITIONS_CONFIG.lockTimeoutMilliseconds);
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  },

  /** @private */
  _findAppendRow: function(sheet) {
    const lastRow = Math.max(sheet.getLastRow(), 1);
    if (lastRow <= 1) return 2;
    const values = sheet.getRange(
      2,
      1,
      lastRow - 1,
      TEACHER_CONDITIONS_CONFIG.headers.length
    ).getValues();
    let lastMeaningful = -1;
    values.forEach(function(row, index) {
      if (TeacherConditionsService._rowHasMeaningfulData(row)) lastMeaningful = index;
    });
    return lastMeaningful < 0 ? 2 : lastMeaningful + 3;
  },

  /** @private */
  _ensureRows: function(sheet, targetRow) {
    if (sheet.getMaxRows() < targetRow) {
      sheet.insertRowsAfter(sheet.getMaxRows(), targetRow - sheet.getMaxRows());
    }
  },

  /** @private */
  _rowHasMeaningfulData: function(row) {
    return (row || []).some(function(value, index) {
      if ([6, 7, 12].indexOf(index) >= 0 && value === false) return false;
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
  },

  /** @private */
  _compareConditions: function(first, second) {
    if (first.active !== second.active) return first.active ? -1 : 1;
    return String(first.description || '').localeCompare(
      String(second.description || ''),
      'pt-BR',
      { sensitivity: 'base', numeric: true }
    );
  },

  /** @private */
  _normalizeYear: function(value, required) {
    const text = String(value === null || value === undefined ? '' : value).trim();
    if (!text && !required) return '';
    if (!/^\d{4}$/.test(text) || Number(text) < 1900 || Number(text) > 2200) {
      throw TeacherConditionsService._validationError(
        required ? 'Informe um ano inicial válido.' : 'Ano de vigência inválido.'
      );
    }
    return text;
  },

  /** @private */
  _normalizeSemester: function(value, required) {
    const text = String(value === null || value === undefined ? '' : value).trim();
    if (!text && !required) return '';
    if (text !== '1' && text !== '2') {
      throw TeacherConditionsService._validationError('Semestre de vigência inválido.');
    }
    return text;
  },

  /** @private */
  _optionalNumber: function(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  },

  /** @private */
  _toBoolean: function(value, defaultValue) {
    if (value === true || value === false) return value;
    const normalized = String(value === null || value === undefined ? '' : value)
      .trim().toLowerCase();
    if (['true', 'verdadeiro', 'sim', '1'].indexOf(normalized) >= 0) return true;
    if (['false', 'falso', 'não', 'nao', '0'].indexOf(normalized) >= 0) return false;
    return Boolean(defaultValue);
  },

  /** @private */
  _cleanText: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .replace(/\s+/g, ' ');
  },

  /** @private */
  _normalizeText: function(value) {
    return TeacherConditionsService._cleanText(value)
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  },

  /** @private */
  _toDateOrNull: function(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  },

  /** @private */
  _formatDate: function(value) {
    const date = TeacherConditionsService._toDateOrNull(value);
    return date ? Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm'
    ) : '';
  },

  /** @private */
  _validationError: function(message) {
    const error = new Error(message);
    error.code = 'VALIDATION_ERROR';
    return error;
  }
};

/** Endpoint administrativo de leitura. */
function getTeacherConditionManagementData() {
  try {
    AccessControlService.requireAdministrator();
    return JSON.stringify({
      status: 'success',
      data: TeacherConditionsService.listManagementData()
    });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

/** Endpoint administrativo de gravação. */
function saveTeacherCondition(payload) {
  try {
    const actor = AccessControlService.requireAdministrator();
    return JSON.stringify({
      status: 'success',
      data: TeacherConditionsService.save(payload || {}, actor)
    });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

/** Endpoint administrativo de ativação/inativação. */
function setTeacherConditionActive(conditionId, active) {
  try {
    const actor = AccessControlService.requireAdministrator();
    return JSON.stringify({
      status: 'success',
      data: TeacherConditionsService.setActive(conditionId, active, actor)
    });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}
