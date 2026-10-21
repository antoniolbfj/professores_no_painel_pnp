/**
 * @file Dao.gs
 * @fileoverview Camada de acesso às bases do dashboard.
 * Somente este módulo lê diretamente as abas de dados da planilha ativa.
 * @version 10.0.9
 */

const Dao = {
  ANNUAL_SHEET_PATTERN: /^\d{4}$/,
  STUDENT_SHEET_PATTERN: /^ALUNOXCAMPUSX(\d{4})$/,
  TEACHER_SHEET_NAME: 'DOCENTES',

  /**
   * Extrai os registros das abas anuais de docentes por disciplina.
   * As cargas M–P permanecem em hora-relógio.
   *
   * @returns {Array<Object>} Registros acadêmicos das abas 2026, 2027 etc.
   */
  extractDataFromSheets: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const aggregatedData = [];

    spreadsheet.getSheets().forEach(function(sheet) {
      const sheetName = sheet.getName();
      if (!Dao.ANNUAL_SHEET_PATTERN.test(sheetName)) return;
      Array.prototype.push.apply(aggregatedData, Dao._extractDisciplineRowsFromSheet(sheet, sheetName));
    });

    return aggregatedData;
  },

  /**
   * Extrai os registros de uma única aba anual.
   *
   * @param {string|number} year Ano letivo.
   * @returns {Array<Object>} Registros acadêmicos do ano.
   */
  extractDataFromYear: function(year) {
    const normalizedYear = String(year === null || year === undefined ? '' : year).trim();
    if (!Dao.ANNUAL_SHEET_PATTERN.test(normalizedYear)) {
      throw new Error('Ano letivo inválido: "' + normalizedYear + '".');
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(normalizedYear);
    if (!sheet) throw new Error('A aba anual ' + normalizedYear + ' não foi encontrada.');
    return Dao._extractDisciplineRowsFromSheet(sheet, normalizedYear);
  },

  /**
   * Retorna metadados leves para o carregamento progressivo.
   *
   * @returns {{years:Array<Object>, totalDisciplineRows:number, teacherRegistryRows:number}}
   */
  getDashboardLoadPlan: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const years = [];
    let totalDisciplineRows = 0;

    spreadsheet.getSheets().forEach(function(sheet) {
      const name = sheet.getName();
      if (!Dao.ANNUAL_SHEET_PATTERN.test(name)) return;
      const disciplineRows = Dao._countUsefulDisciplineRows(sheet);
      const studentSheet = spreadsheet.getSheetByName('ALUNOXCAMPUSX' + name);
      let studentRows = 0;
      if (studentSheet) {
        studentRows = Dao._countRowsByFirstColumnAfterHeader(
          studentSheet,
          'Contador',
          15
        );
      }
      years.push({
        year: name,
        disciplineRows: disciplineRows,
        studentRows: studentRows,
        studentsAvailable: Boolean(studentSheet)
      });
      totalDisciplineRows += disciplineRows;
    });

    years.sort(function(a, b) {
      return String(a.year).localeCompare(String(b.year), 'pt-BR', { numeric: true });
    });

    const teacherSheet = spreadsheet.getSheetByName(Dao.TEACHER_SHEET_NAME);
    let teacherRegistryRows = 0;
    if (teacherSheet) {
      teacherRegistryRows = Dao._countRowsByFirstColumnAfterHeader(
        teacherSheet,
        'Nome do servidor',
        10
      );
    }

    return {
      years: years,
      totalDisciplineRows: totalDisciplineRows,
      teacherRegistryRows: teacherRegistryRows
    };
  },

  /**
   * Extrai apenas os campos necessários das bases anuais de alunos.
   * Dados pessoais não utilizados no cálculo não saem da camada DAO.
   *
   * @returns {Object<string, Array<Object>>} Registros mínimos agrupados por ano.
   */
  extractStudentRowsByYear: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const result = {};

    spreadsheet.getSheets().forEach(function(sheet) {
      const match = sheet.getName().match(Dao.STUDENT_SHEET_PATTERN);
      if (!match) return;
      result[match[1]] = Dao._extractStudentRowsFromSheet(sheet);
    });

    return result;
  },

  /**
   * Extrai os alunos mínimos de uma única base anual.
   *
   * @param {string|number} year Ano letivo.
   * @returns {Array<Object>} Registros mínimos de alunos.
   */
  extractStudentRowsForYear: function(year) {
    const normalizedYear = String(year === null || year === undefined ? '' : year).trim();
    if (!Dao.ANNUAL_SHEET_PATTERN.test(normalizedYear)) {
      throw new Error('Ano letivo inválido: "' + normalizedYear + '".');
    }
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName('ALUNOXCAMPUSX' + normalizedYear);
    return sheet ? Dao._extractStudentRowsFromSheet(sheet) : [];
  },

  /** @private */
  _extractStudentRowsFromSheet: function(sheet) {
    const values = sheet.getDataRange().getValues();
    const headerRowIndex = Dao._findHeaderRow(values, 'Contador', 15);
    if (headerRowIndex < 0 || values.length <= headerRowIndex + 1) return [];

    const headerMap = Dao._createHeaderMap(values[headerRowIndex]);
    const requiredHeaders = [
      'Matrícula (RA)', 'CPF', 'ID Pessoa', 'Curso', 'PPC', 'Período',
      'Classificação', 'Turma preferencial', 'Movimento Atual',
      'Movimento Período Letivo'
    ];
    Dao._assertHeaderMapHas(headerMap, requiredHeaders, sheet.getName());

    const rows = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex];
      if (Dao._isEmptyRow(row)) continue;
      rows.push({
        studentKey: Dao._firstNonEmpty([
          Dao._valueByHeader(row, headerMap, 'ID Pessoa'),
          Dao._valueByHeader(row, headerMap, 'CPF'),
          Dao._valueByHeader(row, headerMap, 'Matrícula (RA)')
        ]),
        form: Dao._valueByHeader(row, headerMap, 'Classificação'),
        course: Dao._valueByHeader(row, headerMap, 'Curso'),
        ppc: Dao._valueByHeader(row, headerMap, 'PPC'),
        period: Dao._valueByHeader(row, headerMap, 'Período'),
        preferredClass: Dao._valueByHeader(row, headerMap, 'Turma preferencial'),
        currentMovement: Dao._valueByHeader(row, headerMap, 'Movimento Atual'),
        periodMovement: Dao._valueByHeader(row, headerMap, 'Movimento Período Letivo')
      });
    }
    return rows;
  },

  /**
   * Extrai o cadastro acumulado de docentes e o enriquece com os dados
   * administrativos internos da versão 9.8. A importação do relatório continua
   * sendo a única fonte dos campos oficiais de DOCENTES.
   *
   * @returns {Array<Object>} Cadastro mínimo de docentes enriquecido.
   */
  extractTeacherRegistry: function() {
    const rawTeachers = Dao.extractTeacherRegistryRaw();
    const withAreas = typeof TeacherAreasService === 'undefined'
      ? rawTeachers
      : TeacherAreasService.enrichTeacherRegistry(rawTeachers);
    return typeof TeacherConditionsService === 'undefined'
      ? withAreas
      : TeacherConditionsService.enrichTeacherRegistry(withAreas);
  },

  /**
   * Extrai somente os campos oficiais do relatório DOCENTES, sem consultar as
   * abas internas DOCENTES_AREAS ou DOCENTES_CONTROLE. Este método evita
   * dependência circular nas telas administrativas.
   *
   * @returns {Array<Object>} Cadastro oficial mínimo.
   */
  extractTeacherRegistryRaw: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(Dao.TEACHER_SHEET_NAME);
    if (!sheet) return [];

    const values = sheet.getDataRange().getValues();
    const headerRowIndex = Dao._findHeaderRow(values, 'Nome do servidor', 10);
    if (headerRowIndex < 0 || values.length <= headerRowIndex + 1) return [];

    const headerMap = Dao._createHeaderMap(values[headerRowIndex]);
    Dao._assertHeaderMapHas(headerMap, [
      'Nome do servidor', 'Matrícula', 'CPF', 'Cargo', 'Carga Horária',
      'Tipo de ingresso', 'Função'
    ], sheet.getName());

    const rows = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex];
      if (Dao._isEmptyRow(row)) continue;

      const cargo = Dao._valueByHeader(row, headerMap, 'Cargo');
      const workloadCode = Dao._valueByHeader(row, headerMap, 'Carga Horária');
      const admissionType = Dao._valueByHeader(row, headerMap, 'Tipo de ingresso');
      const officialFunction = Dao._valueByHeader(row, headerMap, 'Função');
      const workRegime = Dao._resolveTeacherWorkRegime(cargo, workloadCode);
      rows.push({
        name: Dao._valueByHeader(row, headerMap, 'Nome do servidor'),
        registration: Dao._valueByHeader(row, headerMap, 'Matrícula'),
        cpf: Dao._valueByHeader(row, headerMap, 'CPF'),
        jobTitle: cargo,
        workloadCode: workloadCode === null || workloadCode === undefined
          ? ''
          : String(workloadCode).trim(),
        workRegimeCode: workRegime.code,
        workRegimeLabel: workRegime.label,
        weeklyContractHours: workRegime.weeklyHours,
        reducedWorkload: workRegime.weeklyHours !== null
          && Number(workRegime.weeklyHours) < 40,
        officialFunction: String(officialFunction || '').trim(),
        exclusiveDedication: workRegime.exclusiveDedication,
        workRegimeIdentified: workRegime.identified,
        employmentType: Dao._classifyEmploymentType(cargo, admissionType)
      });
    }

    return rows;
  },

  /** @private */
  _countUsefulDisciplineRows: function(sheet) {
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow <= 1 || lastColumn <= 0) return 0;

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const headerMap = Dao._createHeaderMap(headers);
    const professorIndex = headerMap[Dao._normalizeText('PROFESSOR')];
    if (professorIndex === undefined) return 0;

    return sheet.getRange(2, professorIndex + 1, lastRow - 1, 1)
      .getValues()
      .filter(function(row) {
        const value = row[0];
        return value !== null
          && value !== undefined
          && String(value).trim() !== '';
      }).length;
  },

  /**
   * Conta registros por uma coluna-chave sem carregar a largura completa da aba.
   * Os relatórios oficiais possuem a primeira coluna preenchida em todas as linhas úteis.
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Aba avaliada.
   * @param {string} firstHeader Cabeçalho esperado na primeira coluna.
   * @param {number} maxHeaderRows Limite de busca do cabeçalho.
   * @returns {number} Quantidade de linhas úteis após o cabeçalho.
   * @private
   */
  _countRowsByFirstColumnAfterHeader: function(sheet, firstHeader, maxHeaderRows) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 0) return 0;

    const searchRows = Math.min(lastRow, Number(maxHeaderRows) || lastRow);
    const firstColumn = sheet.getRange(1, 1, searchRows, 1).getValues();
    const headerRowIndex = Dao._findHeaderRow(firstColumn, firstHeader, searchRows);
    if (headerRowIndex < 0 || lastRow <= headerRowIndex + 1) return 0;

    return sheet.getRange(headerRowIndex + 2, 1, lastRow - headerRowIndex - 1, 1)
      .getValues()
      .filter(function(row) {
        const value = row[0];
        return value !== null
          && value !== undefined
          && String(value).trim() !== '';
      }).length;
  },

  /** @private */
  _extractDisciplineRowsFromSheet: function(sheet, sheetName) {
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    const headers = values[0];
    const rows = [];
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const rowData = Dao._mapDisciplineRow(
        headers,
        values[rowIndex],
        sheetName,
        rowIndex + 1
      );
      if (rowData) rows.push(rowData);
    }
    return rows;
  },

  /**
   * Mapeia uma linha de docentes por disciplina para objeto normalizado.
   *
   * @param {Array<*>} rawHeaders Cabeçalhos.
   * @param {Array<*>} row Linha.
   * @param {string} sheetName Ano letivo.
   * @param {number} sourceRowNumber Número da linha original na aba.
   * @returns {Object|null} Registro ou null para linha vazia/inválida.
   * @private
   */
  _mapDisciplineRow: function(rawHeaders, row, sheetName, sourceRowNumber) {
    const rowData = {
      ANO_LETIVO: sheetName,
      LINHA_ORIGEM: Number(sourceRowNumber) || null
    };
    let hasValidData = false;

    rawHeaders.forEach(function(rawHeader, index) {
      if (rawHeader === null || rawHeader === undefined || String(rawHeader).trim() === '') {
        return;
      }

      const headerUpper = String(rawHeader).trim().toUpperCase();
      let cellValue = row[index];
      if (cellValue === '' || cellValue === undefined || cellValue === null) {
        cellValue = null;
      } else {
        hasValidData = true;
      }

      rowData[headerUpper] = cellValue;
      rowData[Dao._normalizeHeader(headerUpper)] = cellValue;
    });

    if (!rowData.PROFESSOR && rowData.DOCENTE) rowData.PROFESSOR = rowData.DOCENTE;
    if (!rowData.PROFESSOR && rowData.NOME) rowData.PROFESSOR = rowData.NOME;

    if (rowData['CARGA HORARIA'] !== undefined && rowData['CARGA HORÁRIA'] === undefined) {
      rowData['CARGA HORÁRIA'] = rowData['CARGA HORARIA'];
    }
    if (rowData['CARGA HORARIA TEORICA'] !== undefined
        && rowData['CARGA HORÁRIA TEÓRICA'] === undefined) {
      rowData['CARGA HORÁRIA TEÓRICA'] = rowData['CARGA HORARIA TEORICA'];
      rowData['CARGA HORÁRIA TEORICA'] = rowData['CARGA HORARIA TEORICA'];
    }
    if (rowData['CARGA HORARIA PRATICA'] !== undefined
        && rowData['CARGA HORÁRIA PRÁTICA'] === undefined) {
      rowData['CARGA HORÁRIA PRÁTICA'] = rowData['CARGA HORARIA PRATICA'];
      rowData['CARGA HORÁRIA PRATICA'] = rowData['CARGA HORARIA PRATICA'];
    }
    if (rowData['CARGA HORARIA EXTENSAO'] !== undefined
        && rowData['CARGA HORÁRIA EXTENSÃO'] === undefined) {
      rowData['CARGA HORÁRIA EXTENSÃO'] = rowData['CARGA HORARIA EXTENSAO'];
      rowData['CARGA HORÁRIA EXTENSAO'] = rowData['CARGA HORARIA EXTENSAO'];
    }

    return hasValidData && rowData.PROFESSOR ? rowData : null;
  },

  /** @private */
  _normalizeHeader: function(value) {
    return String(value || '').toUpperCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  },

  /** @private */
  _normalizeText: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  },

  /** @private */
  _createHeaderMap: function(headers) {
    const map = {};
    headers.forEach(function(header, index) {
      if (header === null || header === undefined || String(header).trim() === '') return;
      map[Dao._normalizeText(header)] = index;
    });
    return map;
  },

  /** @private */
  _valueByHeader: function(row, headerMap, header) {
    const index = headerMap[Dao._normalizeText(header)];
    return index === undefined ? null : row[index];
  },

  /** @private */
  _assertHeaderMapHas: function(headerMap, requiredHeaders, sheetName) {
    const missing = requiredHeaders.filter(function(header) {
      return headerMap[Dao._normalizeText(header)] === undefined;
    });
    if (missing.length > 0) {
      throw new Error('A aba ' + sheetName + ' não contém as colunas obrigatórias: '
        + missing.join(', ') + '.');
    }
  },

  /** @private */
  _findHeaderRow: function(values, firstHeader, maxRows) {
    const expected = Dao._normalizeText(firstHeader);
    const limit = Math.min(values.length, Number(maxRows) || values.length);
    for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
      if (Dao._normalizeText(values[rowIndex][0]) === expected) return rowIndex;
    }
    return -1;
  },

  /** @private */
  _isEmptyRow: function(row) {
    return row.every(function(value) {
      return value === null || value === undefined || String(value).trim() === '';
    });
  },

  /** @private */
  _firstNonEmpty: function(values) {
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return null;
  },

  /**
   * Interpreta o regime de trabalho a partir da coluna J do relatório DOCENTES.
   * A ausência de valor somente representa 40 horas quando o cargo identifica
   * professor substituto. Outros valores permanecem não identificados.
   *
   * @param {*} cargo Cargo funcional da coluna D.
   * @param {*} workloadCode Valor da coluna J "Carga Horária".
   * @returns {{code:string,label:string,weeklyHours:number|null,exclusiveDedication:boolean,identified:boolean}}
   * @private
   */
  _resolveTeacherWorkRegime: function(cargo, workloadCode) {
    const normalizedCargo = Dao._normalizeText(cargo);
    const rawCode = workloadCode === null || workloadCode === undefined
      ? ''
      : String(workloadCode).trim();
    const numericCode = rawCode === '' ? null : Number(rawCode);

    if (numericCode === 99) {
      return {
        code: '40_DE',
        label: '40 h com dedicação exclusiva',
        weeklyHours: 40,
        exclusiveDedication: true,
        identified: true
      };
    }
    if (numericCode === 40) {
      return {
        code: '40',
        label: '40 h sem dedicação exclusiva',
        weeklyHours: 40,
        exclusiveDedication: false,
        identified: true
      };
    }
    if (numericCode === 20) {
      return {
        code: '20',
        label: '20 h sem dedicação exclusiva',
        weeklyHours: 20,
        exclusiveDedication: false,
        identified: true
      };
    }
    if (Number.isFinite(numericCode) && numericCode > 0 && numericCode < 40) {
      return {
        code: 'REDUZIDA_' + numericCode,
        label: numericCode + ' h — jornada reduzida',
        weeklyHours: numericCode,
        exclusiveDedication: false,
        identified: true
      };
    }
    if (rawCode === '' && normalizedCargo.indexOf('SUBSTITUTO') >= 0) {
      return {
        code: '40_SUBSTITUTO',
        label: '40 h — professor substituto',
        weeklyHours: 40,
        exclusiveDedication: false,
        identified: true
      };
    }
    return {
      code: 'NAO_IDENTIFICADO',
      label: 'Regime não identificado',
      weeklyHours: null,
      exclusiveDedication: false,
      identified: false
    };
  },

  /** @private */
  _classifyEmploymentType: function(cargo, admissionType) {
    const normalizedCargo = Dao._normalizeText(cargo);
    const normalizedAdmission = Dao._normalizeText(admissionType);
    if (normalizedCargo.indexOf('SUBSTITUTO') >= 0
        || normalizedAdmission.indexOf('CONTRATO TEMPORARIO') >= 0) {
      return 'SUBSTITUTO';
    }
    return 'EFETIVO';
  }
};
