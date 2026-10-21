/**
 * @file TeacherPdfReport.gs
 * @fileoverview Relatório individual em PDF a partir do recorte do dashboard.
 * O servidor recompõe os dados oficiais e nunca recebe indicadores prontos do navegador.
 * @version 10.0.9
 */

const TeacherPdfReportService = {
  MAX_OFFERING_KEYS: 1500,

  /**
   * Gera o PDF individual a partir de chaves de ofertas exibidas no modal.
   *
   * @param {Object} payload Professor, chaves das ofertas e parâmetros da sessão.
   * @returns {Object} Arquivo PDF serializado em Base64.
   */
  generate: function(payload) {
    const request = TeacherPdfReportService._validateRequest(payload);
    const teachers = Dao.extractTeacherRegistry();
    const selectedKeyMap = {};
    request.offeringKeys.forEach(function(key) { selectedKeyMap[key] = true; });
    const allPreparedRows = [];
    const preparedRows = [];
    const studentsByYear = {};

    request.years.forEach(function(year) {
      const annualRows = DashboardRules.prepareRecords(Dao.extractDataFromYear(year));
      const annualStudents = Dao.extractStudentRowsForYear(year);
      Array.prototype.push.apply(allPreparedRows, annualRows);
      studentsByYear[year] = annualStudents;
    });

    const refreshed = AcademicAnalytics.buildFromSources(
      allPreparedRows,
      studentsByYear,
      teachers,
      {
        metricOfferingKeys: selectedKeyMap,
        metricProfessorKey: request.professorKey
      }
    );
    refreshed.rows.forEach(function(row) {
      const professor = AcademicAnalytics.normalizeText(
        AcademicAnalytics._firstText(row, ['PROFESSOR', 'DOCENTE', 'NOME'])
      );
      if (professor !== request.professorKey) return;
      if (!selectedKeyMap[String(row.CHAVE_OFERTA_ANALITICA || '')]) return;
      preparedRows.push(row);
    });

    if (preparedRows.length === 0) {
      throw new Error('Nenhuma oferta oficial foi localizada para o professor e o recorte informados.');
    }

    const model = TeacherPdfReportService._buildModel(
      request,
      preparedRows,
      refreshed.professorIndicators
    );
    const html = TeacherPdfReportService._buildHtml(model);
    const htmlBlob = Utilities.newBlob(
      html,
      MimeType.HTML,
      model.fileName.replace(/\.pdf$/i, '.html')
    );
    const pdfBlob = htmlBlob.getAs(MimeType.PDF).setName(model.fileName);

    return {
      status: 'success',
      fileName: model.fileName,
      mimeType: MimeType.PDF,
      base64: Utilities.base64Encode(pdfBlob.getBytes()),
      meta: {
        app: APP_INFO.name,
        version: APP_INFO.version,
        professor: model.professor.name,
        years: model.scope.years,
        recordCount: model.details.length
      }
    };
  },

  /** @private */
  _validateRequest: function(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const professorName = String(source.professorName || '').trim();
    if (!professorName) throw new Error('Professor não informado.');
    if (professorName.length > 240) throw new Error('Nome do professor inválido.');

    const offeringKeys = Array.isArray(source.offeringKeys)
      ? source.offeringKeys.map(function(key) { return String(key || '').trim(); })
        .filter(Boolean)
      : [];
    const uniqueKeys = [];
    const seen = {};
    offeringKeys.forEach(function(key) {
      if (key.length > 1200 || seen[key]) return;
      seen[key] = true;
      uniqueKeys.push(key);
    });
    if (uniqueKeys.length === 0) throw new Error('O recorte não possui ofertas para gerar o relatório.');
    if (uniqueKeys.length > TeacherPdfReportService.MAX_OFFERING_KEYS) {
      throw new Error('O recorte excede o limite de ofertas permitido para um único PDF.');
    }

    const years = {};
    uniqueKeys.forEach(function(key) {
      const year = String(key.split(AcademicAnalytics.KEY_SEPARATOR)[0] || '').trim();
      if (!/^\d{4}$/.test(year)) throw new Error('Chave de oferta inválida.');
      years[year] = true;
    });
    const filters = TeacherPdfReportService._normalizeFilters(source.filters || {});

    return {
      professorName: professorName,
      professorKey: AcademicAnalytics.normalizeText(professorName),
      offeringKeys: uniqueKeys,
      years: Object.keys(years).sort(),
      filters: filters
    };
  },

  /** @private */
  _normalizeFilters: function(filters) {
    const numberOr = function(value, fallback, minimum, maximum) {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum
        ? numeric
        : fallback;
    };
    const semester = ['ALL', '1', '2'].indexOf(String(filters.semester || 'ALL')) >= 0
      ? String(filters.semester || 'ALL')
      : 'ALL';
    return {
      year: /^\d{4}$/.test(String(filters.year || '')) ? String(filters.year) : 'ALL',
      semester: semester,
      duracaoAula: numberOr(filters.duracaoAula, 50, 1, 180),
      weeksSemester1: numberOr(filters.weeksSemester1, 20, 1, 60),
      weeksSemester2: numberOr(filters.weeksSemester2, 20, 1, 60),
      minIntegral: numberOr(filters.minIntegral, 10, 0, 80),
      maxIntegral: numberOr(filters.maxIntegral, 20, 0, 80),
      minPartial: numberOr(filters.minPartial, 8, 0, 80),
      maxPartial: numberOr(filters.maxPartial, 12, 0, 80),
      considerTcc: filters.considerTcc !== false,
      considerInternship: filters.considerInternship !== false,
      considerComplementary: filters.considerComplementary !== false,
      considerJustifiedTeachers: filters.considerJustifiedTeachers !== false
    };
  },

  /** @private */
  _buildModel: function(request, rows, professorIndicators) {
    const first = rows[0];
    const filters = request.filters;
    const years = request.years.slice();
    const areas = {};
    const conditionsById = {};
    let totalClockHours = 0;
    let theoreticalClockHours = 0;
    let practicalClockHours = 0;
    let extensionClockHours = 0;

    const details = rows.map(function(row) {
      const allocationFactor = filters.year !== 'ALL' && filters.semester !== 'ALL'
        ? Number(row['FATOR_SEMESTRE_' + filters.semester] || 0)
        : 1;
      const componentCode = String(row.GRUPO_COMPONENTE_ESPECIAL || '');
      const included = TeacherPdfReportService._isComponentIncluded(componentCode, filters);
      const workloadFactor = included ? allocationFactor : 0;
      const clockHours = TeacherPdfReportService._numberByKeys(
        row, ['CARGA HORÁRIA', 'CARGA HORARIA', 'CH']
      ) * workloadFactor;
      const theoretical = TeacherPdfReportService._numberByKeys(
        row, ['CARGA HORÁRIA TEÓRICA', 'CARGA HORARIA TEORICA', 'TEORICA', 'TEÓRICA']
      ) * workloadFactor;
      const practical = TeacherPdfReportService._numberByKeys(
        row, ['CARGA HORÁRIA PRÁTICA', 'CARGA HORARIA PRATICA', 'PRATICA', 'PRÁTICA']
      ) * workloadFactor;
      const extension = TeacherPdfReportService._numberByKeys(
        row, ['CARGA HORÁRIA EXTENSÃO', 'CARGA HORARIA EXTENSAO', 'EXTENSAO', 'EXTENSÃO']
      ) * workloadFactor;
      totalClockHours += clockHours;
      theoreticalClockHours += theoretical;
      practicalClockHours += practical;
      extensionClockHours += extension;

      (Array.isArray(row.AREAS_DOCENTE) ? row.AREAS_DOCENTE : []).forEach(function(area) {
        const baseLabel = String(area.path || area.areaName || '').trim();
        const label = baseLabel && area.areaActive === false
          ? baseLabel + ' — histórica (inativa atualmente)'
          : baseLabel;
        if (label) areas[label] = true;
      });
      (Array.isArray(row.CONDICOES_DOCENTE) ? row.CONDICOES_DOCENTE : [])
        .forEach(function(condition) {
          const key = String(condition.id || [
            condition.description || '',
            condition.startYear || '',
            condition.endYear || ''
          ].join('|'));
          if (key && !conditionsById[key]) conditionsById[key] = condition;
        });

      const dependency = row.OFERTA_DEPENDENCIA_ALUNOS === true;
      const special = row.OFERTA_ESPECIAL_ALUNOS === true;
      let students = 'Não associado';
      if (dependency) {
        students = 'Não contabilizado - turma de dependência';
      } else if (special) {
        students = 'Não contabilizado - turma especial';
      } else if (row.ALUNOS_GRUPO !== null && row.ALUNOS_GRUPO !== undefined) {
        students = TeacherPdfReportService._formatNumber(row.ALUNOS_GRUPO, 0)
          + ' alunos (aprox.)';
      }
      return {
        year: String(row.ANO_LETIVO || ''),
        semester: String(row.SEMESTRE_OFERTA || '') || 'Anual',
        form: TeacherPdfReportService._firstText(row, ['FORMA']),
        course: TeacherPdfReportService._firstText(row, ['CURSO']),
        ppc: TeacherPdfReportService._firstText(row, ['PPC']),
        period: TeacherPdfReportService._firstText(row, ['PERÍODO', 'PERIODO']),
        turma: TeacherPdfReportService._firstText(row, ['TURMA']),
        discipline: TeacherPdfReportService._firstText(row, ['DISCIPLINA']),
        clockHours: clockHours,
        classHours: DashboardRules.clockHoursToClassHours(clockHours, filters.duracaoAula),
        theoretical: theoretical,
        practical: practical,
        extension: extension,
        students: students,
        workloadNote: included ? '' : 'Desconsiderado na simulação atual'
      };
    });

    details.sort(function(a, b) {
      return [a.year, a.semester, a.course, a.period, a.turma, a.discipline].join('|')
        .localeCompare(
          [b.year, b.semester, b.course, b.period, b.turma, b.discipline].join('|'),
          'pt-BR',
          { numeric: true, sensitivity: 'base' }
        );
    });

    const professorKey = AcademicAnalytics.normalizeText(request.professorName);
    const indicator = professorIndicators[professorKey] || null;
    const studentMetric = TeacherPdfReportService._resolveStudentMetric(
      indicator,
      filters,
      years
    );
    const contractHours = first.CARGA_SEMANAL_CONTRATUAL_DOCENTE === null
      || first.CARGA_SEMANAL_CONTRATUAL_DOCENTE === undefined
      ? null
      : Number(first.CARGA_SEMANAL_CONTRATUAL_DOCENTE);
    const totalWeeks = TeacherPdfReportService._resolveTotalWeeks(filters, years.length);
    const weeklyAverage = totalWeeks > 0 ? totalClockHours / totalWeeks : null;
    let conditions = Object.keys(conditionsById).map(function(key) {
      return conditionsById[key];
    }).sort(function(firstCondition, secondCondition) {
      return String(firstCondition.description || '').localeCompare(
        String(secondCondition.description || ''),
        'pt-BR',
        { sensitivity: 'base', numeric: true }
      );
    });
    if (filters.year !== 'ALL' && filters.semester !== 'ALL'
        && typeof TeacherConditionsService !== 'undefined') {
      conditions = TeacherConditionsService.filterForPeriod(
        conditions,
        filters.year,
        filters.semester
      );
    }
    const weeklyStatus = TeacherPdfReportReportStatus.resolve(
      weeklyAverage,
      contractHours,
      filters,
      conditions
    );
    const safeName = TeacherPdfReportService._safeFilePart(request.professorName).slice(0, 90);
    const yearPart = years.length === 1 ? years[0] : years[0] + '-' + years[years.length - 1];

    return {
      fileName: 'Carga_Horaria_Docente_' + safeName + '_' + yearPart
        + '_v' + APP_INFO.version + '.pdf',
      generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
      generatedBy: Session.getActiveUser().getEmail() || 'Usuário institucional autenticado',
      professor: {
        name: request.professorName,
        employment: TeacherPdfReportService._employmentLabel(first.VINCULO_DOCENTE),
        registration: String(first.MATRICULA_DOCENTE || 'Não informada'),
        situation: first.DOCENTE_ATIVO === false ? 'Inativo' : 'Ativo',
        workRegime: String(first.ROTULO_REGIME_TRABALHO_DOCENTE || 'Regime não identificado'),
        officialFunction: String(first.FUNCAO_OFICIAL_DOCENTE || '').trim(),
        reducedWorkload: first.JORNADA_REDUZIDA_DOCENTE === true,
        conditions: conditions,
        areas: Object.keys(areas).sort(function(a, b) {
          return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
        })
      },
      scope: {
        years: years,
        semester: filters.semester === 'ALL' ? 'Ano completo' : filters.semester + 'º semestre',
        classDuration: filters.duracaoAula,
        simulation: TeacherPdfReportService._simulationSummary(filters)
      },
      workload: {
        totalClockHours: totalClockHours,
        totalClassHours: DashboardRules.clockHoursToClassHours(
          totalClockHours,
          filters.duracaoAula
        ),
        theoreticalClockHours: theoreticalClockHours,
        practicalClockHours: practicalClockHours,
        extensionClockHours: extensionClockHours,
        weeklyAverage: weeklyAverage,
        weeklyStatus: weeklyStatus,
        totalWeeks: totalWeeks
      },
      students: studentMetric,
      details: details
    };
  },

  /** @private */
  _resolveStudentMetric: function(indicator, filters, years) {
    if (!indicator) return null;
    if (years.length === 1 && indicator.years && indicator.years[years[0]]) {
      const scope = filters.semester === 'ALL' ? 'ALL' : filters.semester;
      return indicator.years[years[0]][scope] || null;
    }
    return indicator.allYears || null;
  },

  /** @private */
  _resolveTotalWeeks: function(filters, yearCount) {
    if (filters.year !== 'ALL' && filters.semester === '1') return filters.weeksSemester1;
    if (filters.year !== 'ALL' && filters.semester === '2') return filters.weeksSemester2;
    return (filters.weeksSemester1 + filters.weeksSemester2) * Math.max(yearCount, 1);
  },

  /** @private */
  _isComponentIncluded: function(code, filters) {
    if (code === 'TCC') return filters.considerTcc;
    if (code === 'ESTAGIO_SUPERVISIONADO') return filters.considerInternship;
    if (code === 'ATIVIDADES_COMPLEMENTARES') return filters.considerComplementary;
    return true;
  },

  /** @private */
  _simulationSummary: function(filters) {
    const ignored = [];
    if (!filters.considerTcc) ignored.push('TCC');
    if (!filters.considerInternship) ignored.push('estágio supervisionado');
    if (!filters.considerComplementary) ignored.push('atividades complementares');
    const components = ignored.length > 0
      ? 'Desconsiderados: ' + ignored.join(', ') + '.'
      : 'Todos os componentes especiais considerados.';
    const justified = filters.considerJustifiedTeachers !== false
      ? 'Docentes abaixo do mínimo com justificativa permanecem no indicador de situação.'
      : 'Docentes abaixo do mínimo com justificativa são separados do total geral de abaixo do mínimo.';
    return components + ' ' + justified;
  },

  /** @private */
  _numberByKeys: function(row, keys) {
    for (let index = 0; index < keys.length; index += 1) {
      const value = Number(row[keys[index]]);
      if (Number.isFinite(value)) return value;
    }
    return 0;
  },

  /** @private */
  _firstText: function(row, keys) {
    for (let index = 0; index < keys.length; index += 1) {
      const value = row[keys[index]];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }
    return '';
  },

  /** @private */
  _employmentLabel: function(value) {
    if (value === 'EFETIVO') return 'Efetivo';
    if (value === 'SUBSTITUTO') return 'Substituto';
    return 'Não identificado';
  },

  /** @private */
  _safeFilePart: function(value) {
    return String(value || 'Professor')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Professor';
  },

  /** @private */
  _formatNumber: function(value, decimals) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return numeric.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  /** @private */
  _escapeHtml: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /** @private */
  _buildHtml: function(model) {
    const escape = TeacherPdfReportService._escapeHtml;
    const number = TeacherPdfReportService._formatNumber;
    const students = model.students;
    const studentCards = students && students.available
      ? [
        ['Alunos atendidos (aprox.)', number(students.uniqueStudents, 0)],
        ['Ofertas contabilizadas', number(students.matchedOfferings, 0)],
        ['Média por oferta', number(students.averageStudentsPerOffering, 1)],
        ['Cobertura de associação', number(students.coveragePercent, 1) + '%']
      ]
      : [['Indicadores de alunos', 'Indisponíveis para o recorte']];
    const workloadCards = [
      ['Carga total', number(model.workload.totalClockHours, 1) + ' h'],
      ['Equivalente em hora-aula', number(model.workload.totalClassHours, 1) + ' h/a'],
      ['Média semanal', model.workload.weeklyAverage === null
        ? 'Não avaliada'
        : number(model.workload.weeklyAverage, 1) + ' h/semana'],
      ['Situação semanal', model.workload.weeklyStatus]
    ];
    const cards = workloadCards.concat(studentCards).map(function(item) {
      return '<div class="card"><span>' + escape(item[0]) + '</span><strong>'
        + escape(item[1]) + '</strong></div>';
    }).join('');
    const detailRows = model.details.map(function(row) {
      const group = [row.form, row.course, row.ppc,
        row.period ? row.period + 'º período' : '', row.turma ? 'Turma ' + row.turma : '']
        .filter(Boolean).join(' / ');
      const workload = number(row.clockHours, 1) + ' h<br><small>'
        + number(row.classHours, 1) + ' h/a</small>'
        + (row.workloadNote ? '<br><small class="warning">' + escape(row.workloadNote) + '</small>' : '');
      return '<tr><td>' + escape(row.year + ' · ' + row.semester) + '</td>'
        + '<td>' + escape(group) + '</td>'
        + '<td>' + escape(row.discipline) + '</td>'
        + '<td class="num">' + workload + '</td>'
        + '<td class="num">' + number(row.theoretical, 1) + ' h</td>'
        + '<td class="num">' + number(row.practical, 1) + ' h</td>'
        + '<td class="num">' + number(row.extension, 1) + ' h</td>'
        + '<td>' + escape(row.students) + '</td></tr>';
    }).join('');
    const areas = model.professor.areas.length > 0
      ? model.professor.areas.join(' · ')
      : 'Sem área atribuída no recorte';
    const professorConditions = Array.isArray(model.professor.conditions)
      ? model.professor.conditions
      : [];
    const conditions = professorConditions.length > 0
      ? professorConditions.map(function(condition) {
        const description = String(condition.description || 'Condição especial');
        const reason = String(condition.reason || '').trim();
        const range = condition.exemption === true
          ? 'dispensa de aulas'
          : condition.minimum !== null && condition.minimum !== undefined
            && condition.maximum !== null && condition.maximum !== undefined
            ? number(condition.minimum, 1) + '–' + number(condition.maximum, 1) + ' h/semana'
            : '';
        return [description, reason, range].filter(Boolean).join(' — ');
      }).join(' · ')
      : 'Nenhuma condição especial confirmada no recorte';

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
      + '@page{size:A4 landscape;margin:14mm 10mm 16mm 10mm}'
      + '*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17211b;font-size:9px;margin:0}'
      + 'h1{font-size:19px;color:#166534;margin:0 0 3px}h2{font-size:12px;color:#166534;margin:14px 0 6px}'
      + '.meta{color:#526057;margin-bottom:10px}.identity{border:1px solid #bfd7c7;background:#f3faf5;padding:8px 10px;border-radius:6px}'
      + '.identity strong{font-size:13px}.line{margin-top:4px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:9px 0}'
      + '.card{border:1px solid #d7e2da;border-radius:5px;padding:6px;background:#fff}.card span{display:block;color:#647067;font-size:7.5px}'
      + '.card strong{display:block;font-size:11px;margin-top:3px}.scope{font-size:8px;color:#4d5b52;margin:5px 0 9px}'
      + 'table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{page-break-inside:avoid}'
      + 'th{background:#166534;color:#fff;font-size:7px;padding:5px 4px;text-align:left}td{border:1px solid #dce4de;padding:4px;vertical-align:top;line-height:1.25}'
      + 'th:nth-child(1){width:8%}th:nth-child(2){width:25%}th:nth-child(3){width:22%}th:nth-child(4){width:9%}'
      + 'th:nth-child(5),th:nth-child(6),th:nth-child(7){width:7%}th:nth-child(8){width:15%}.num{text-align:right}'
      + 'small{color:#657168;font-size:7px}.warning{color:#9a3412}.footer{position:fixed;bottom:-11mm;left:0;right:0;border-top:1px solid #cbd7ce;padding-top:3px;color:#58655c;font-size:7px;text-align:center}'
      + '</style></head><body>'
      + '<div class="footer">Relatório gerado a partir do Dashboard de Carga Horária Docente '
      + escape(APP_INFO.version) + '</div>'
      + '<h1>Relatório Individual de Carga Horária Docente</h1>'
      + '<div class="meta">Gerado em ' + escape(model.generatedAt) + ' por ' + escape(model.generatedBy)
      + ' · versão ' + escape(APP_INFO.version) + '</div>'
      + '<div class="identity"><strong>' + escape(model.professor.name) + '</strong>'
      + '<div class="line">Ano letivo: ' + escape(model.scope.years.join(', '))
      + ' · Período: ' + escape(model.scope.semester)
      + ' · Vínculo: ' + escape(model.professor.employment)
      + ' · Matrícula: ' + escape(model.professor.registration)
      + ' · Situação: ' + escape(model.professor.situation)
      + ' · Regime: ' + escape(model.professor.workRegime) + '</div>'
      + '<div class="line">Função importada: '
      + escape(model.professor.officialFunction || 'Não informada')
      + ' · Jornada reduzida: ' + escape(model.professor.reducedWorkload ? 'Sim' : 'Não')
      + '</div><div class="line">Condições confirmadas: ' + escape(conditions)
      + '</div><div class="line">Áreas: ' + escape(areas) + '</div></div>'
      + '<div class="cards">' + cards + '</div>'
      + '<div class="scope">Hora-aula de ' + escape(model.scope.classDuration)
      + ' minutos · ' + escape(model.scope.simulation)
      + ' · Base semanal: ' + escape(model.workload.totalWeeks) + ' semana(s). '
      + 'Turmas especiais e ofertas de dependência mantêm a carga horária, mas não participam dos indicadores de alunos. '
      + escape(AcademicAnalytics.STUDENT_APPROXIMATION_EXPLANATION) + '</div>'
      + '<h2>Ofertas que compõem o recorte</h2><table><thead><tr>'
      + '<th>Ano / semestre</th><th>Forma / curso / PPC / período / turma</th><th>Disciplina</th>'
      + '<th>Carga</th><th>Teórica</th><th>Prática</th><th>Extensão</th><th>Alunos</th>'
      + '</tr></thead><tbody>' + detailRows + '</tbody></table></body></html>';
  }
};

/** Resolução isolada do rótulo semanal para facilitar testes. */
const TeacherPdfReportReportStatus = {
  resolve: function(weeklyAverage, contractHours, filters, conditions) {
    if (!Number.isFinite(Number(weeklyAverage))) return 'Não avaliada';
    const contract = Number(contractHours);
    const minimum = contract === 40 ? Number(filters.minIntegral)
      : contract === 20 ? Number(filters.minPartial) : null;
    const maximum = contract === 40 ? Number(filters.maxIntegral)
      : contract === 20 ? Number(filters.maxPartial) : null;
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return 'Não avaliada';
    if (weeklyAverage < minimum) {
      const justified = (Array.isArray(conditions) ? conditions : [])
        .some(function(condition) {
          return condition
            && condition.active !== false
            && condition.justifiesBelowMinimum === true;
        });
      return justified ? 'Abaixo do Mínimo Justificado' : 'Abaixo da referência';
    }
    if (weeklyAverage > maximum) return 'Acima da referência';
    return 'Dentro da referência';
  }
};

/** Endpoint público institucional para geração do relatório individual. */
function generateTeacherPdfReport(payload) {
  try {
    AccessControlService.requireInstitutionalUser();
    return JSON.stringify(TeacherPdfReportService.generate(payload));
  } catch (error) {
    Logger.log('Erro em generateTeacherPdfReport: ' + error.message);
    return JSON.stringify({
      status: 'error',
      message: 'Não foi possível gerar o relatório: ' + error.message
    });
  }
}
