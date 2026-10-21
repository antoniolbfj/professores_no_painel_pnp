/**
 * @file GeneralTeacherPdfReport.gs
 * @fileoverview Relatório geral administrativo de um ou mais docentes.
 * O servidor recompõe o recorte oficial, valida o perfil e evita dupla contagem
 * de docentes nos totais consolidados, mesmo quando há vários vínculos de área.
 * @version 10.0.9
 */

const GeneralTeacherPdfReportService = {
  MAX_TEACHERS: 150,
  MAX_DETAILS: 6000,
  SORT_OPTIONS: Object.freeze([
    'NAME_ASC',
    'NAME_DESC',
    'WORKLOAD_ASC',
    'WORKLOAD_DESC'
  ]),

  /** Gera um único PDF administrativo para os docentes selecionados. */
  generate: function(payload) {
    const request = GeneralTeacherPdfReportService._validateRequest(payload);
    const teachers = Dao.extractTeacherRegistry();
    const allPreparedRows = [];
    const studentsByYear = {};

    request.years.forEach(function(year) {
      Array.prototype.push.apply(
        allPreparedRows,
        DashboardRules.prepareRecords(Dao.extractDataFromYear(year))
      );
      studentsByYear[year] = Dao.extractStudentRowsForYear(year);
    });

    const fullAnalytics = AcademicAnalytics.buildFromSources(
      allPreparedRows,
      studentsByYear,
      teachers
    );
    const initiallyFilteredRows = GeneralTeacherPdfReportService._filterRows(
      fullAnalytics.rows,
      request
    );
    if (initiallyFilteredRows.length === 0) {
      throw new Error('Nenhuma oferta oficial corresponde aos professores e filtros selecionados.');
    }
    if (initiallyFilteredRows.length > GeneralTeacherPdfReportService.MAX_DETAILS) {
      throw new Error('O recorte excede o limite de ' + GeneralTeacherPdfReportService.MAX_DETAILS
        + ' linhas. Reduza os anos, filtros ou professores selecionados.');
    }

    const selectedOfferingKeys = {};
    initiallyFilteredRows.forEach(function(row) {
      const key = String(row.CHAVE_OFERTA_ANALITICA || '');
      if (key) selectedOfferingKeys[key] = true;
    });
    const scopedAnalytics = AcademicAnalytics.buildFromSources(
      allPreparedRows,
      studentsByYear,
      teachers,
      { metricOfferingKeys: selectedOfferingKeys }
    );
    const filteredRows = GeneralTeacherPdfReportService._filterRows(
      scopedAnalytics.rows,
      request
    );
    const groups = GeneralTeacherPdfReportService._groupRowsByTeacher(filteredRows);
    let models = Object.keys(groups).map(function(key) {
      const group = groups[key];
      const years = GeneralTeacherPdfReportService._uniqueValues(
        group.rows.map(function(row) { return String(row.ANO_LETIVO || ''); })
      ).sort();
      return TeacherPdfReportService._buildModel(
        {
          professorName: group.name,
          professorKey: AcademicAnalytics.normalizeText(group.name),
          years: years,
          filters: request.dashboardFilters
        },
        group.rows,
        scopedAnalytics.professorIndicators
      );
    });
    models = GeneralTeacherPdfReportService._sortModels(models, request.sort);
    if (models.length === 0) {
      throw new Error('Os professores selecionados não possuem carga horária no recorte informado.');
    }

    const model = GeneralTeacherPdfReportService._buildModel(request, models, filteredRows);
    const html = GeneralTeacherPdfReportService._buildHtml(model);
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
        teacherCount: model.summary.teacherCount,
        detailCount: model.summary.detailCount,
        years: request.years
      }
    };
  },

  /** Valida a seleção, filtros e ordenação recebidos do navegador. */
  _validateRequest: function(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const rawTeachers = Array.isArray(source.teachers) ? source.teachers : [];
    const teachers = [];
    const teacherKeys = {};
    rawTeachers.forEach(function(item) {
      const name = String(item && item.name || '').trim();
      const registration = String(item && item.registration || '').trim();
      if (!name || name.length > 240 || registration.length > 120) return;
      const key = GeneralTeacherPdfReportService._teacherSelectionKey(name, registration);
      if (teacherKeys[key]) return;
      teacherKeys[key] = true;
      teachers.push({ name: name, registration: registration, key: key });
    });
    if (teachers.length === 0) throw new Error('Selecione pelo menos um professor.');
    if (teachers.length > GeneralTeacherPdfReportService.MAX_TEACHERS) {
      throw new Error('Selecione no máximo ' + GeneralTeacherPdfReportService.MAX_TEACHERS
        + ' professores por relatório.');
    }

    const years = GeneralTeacherPdfReportService._normalizeList(source.years, 30)
      .filter(function(year) { return /^\d{4}$/.test(year); })
      .sort();
    if (years.length === 0) throw new Error('Informe ao menos um ano letivo válido.');

    const rawFilters = source.filters && typeof source.filters === 'object'
      ? source.filters
      : {};
    const dashboardFilters = TeacherPdfReportService._normalizeFilters(
      Object.assign({}, rawFilters, {
        year: years.length === 1 ? years[0] : 'ALL'
      })
    );
    const sort = GeneralTeacherPdfReportService.SORT_OPTIONS.indexOf(
      String(source.sort || '')
    ) >= 0 ? String(source.sort) : 'NAME_ASC';
    const filters = {
      forms: GeneralTeacherPdfReportService._normalizeList(rawFilters.forms, 80),
      courses: GeneralTeacherPdfReportService._normalizeList(rawFilters.courses, 120),
      ppcs: GeneralTeacherPdfReportService._normalizeList(rawFilters.ppcs, 120),
      periods: GeneralTeacherPdfReportService._normalizeList(rawFilters.periods, 40),
      areaIds: GeneralTeacherPdfReportService._normalizeList(rawFilters.areaIds, 120)
    };
    filters.formMap = GeneralTeacherPdfReportService._normalizedMap(filters.forms);
    filters.courseMap = GeneralTeacherPdfReportService._normalizedMap(filters.courses);
    filters.ppcMap = GeneralTeacherPdfReportService._normalizedMap(filters.ppcs);
    filters.periodMap = GeneralTeacherPdfReportService._normalizedMap(filters.periods);
    filters.areaMap = GeneralTeacherPdfReportService._textMap(filters.areaIds);

    return {
      teachers: teachers,
      teacherKeyMap: teacherKeys,
      years: years,
      filters: filters,
      dashboardFilters: dashboardFilters,
      sort: sort
    };
  },

  /** Aplica no servidor o mesmo recorte acadêmico apresentado no seletor. */
  _filterRows: function(rows, request) {
    const filters = request.filters;
    const semester = request.dashboardFilters.semester;
    return (Array.isArray(rows) ? rows : []).filter(function(row) {
      if (!GeneralTeacherPdfReportService._isSelectedTeacher(row, request.teacherKeyMap)) {
        return false;
      }
      if (semester !== 'ALL'
          && Number(row['FATOR_SEMESTRE_' + semester] || 0) <= 0) {
        return false;
      }
      if (!GeneralTeacherPdfReportService._matchesNormalizedFilter(
        row.FORMA,
        filters.formMap
      )) return false;
      if (!GeneralTeacherPdfReportService._matchesNormalizedFilter(
        row.CURSO,
        filters.courseMap
      )) return false;
      if (!GeneralTeacherPdfReportService._matchesNormalizedFilter(
        row.PPC,
        filters.ppcMap
      )) return false;
      if (!GeneralTeacherPdfReportService._matchesNormalizedFilter(
        AcademicAnalytics._firstText(row, ['PERÍODO', 'PERIODO']),
        filters.periodMap
      )) return false;
      if (Object.keys(filters.areaMap).length > 0) {
        const assignments = Array.isArray(row.AREAS_DOCENTE) ? row.AREAS_DOCENTE : [];
        const matchesArea = assignments.some(function(assignment) {
          return filters.areaMap[String(assignment.areaId || '').trim()]
            || filters.areaMap[String(assignment.parentAreaId || '').trim()];
        });
        if (!matchesArea) return false;
      }
      return true;
    });
  },

  _isSelectedTeacher: function(row, teacherKeyMap) {
    const name = AcademicAnalytics._firstText(row, ['PROFESSOR', 'DOCENTE', 'NOME']);
    const registration = String(row.MATRICULA_DOCENTE || '').trim();
    return teacherKeyMap[GeneralTeacherPdfReportService._teacherSelectionKey(
      name,
      registration
    )] === true;
  },

  _teacherSelectionKey: function(name, registration) {
    const normalizedRegistration = AcademicAnalytics.normalizeText(registration);
    return normalizedRegistration
      ? 'REG:' + normalizedRegistration
      : 'NAME:' + AcademicAnalytics.normalizeText(name);
  },

  _matchesNormalizedFilter: function(value, filterMap) {
    return Object.keys(filterMap).length === 0
      || filterMap[AcademicAnalytics.normalizeText(value)] === true;
  },

  _normalizeList: function(values, maximum) {
    const result = [];
    const seen = {};
    (Array.isArray(values) ? values : []).forEach(function(value) {
      const text = String(value === null || value === undefined ? '' : value).trim();
      if (!text || text.length > 300 || seen[text] || result.length >= maximum) return;
      seen[text] = true;
      result.push(text);
    });
    return result;
  },

  _normalizedMap: function(values) {
    const map = {};
    (values || []).forEach(function(value) {
      map[AcademicAnalytics.normalizeText(value)] = true;
    });
    return map;
  },

  _textMap: function(values) {
    const map = {};
    (values || []).forEach(function(value) { map[String(value || '').trim()] = true; });
    return map;
  },

  _groupRowsByTeacher: function(rows) {
    const groups = {};
    (rows || []).forEach(function(row) {
      const name = AcademicAnalytics._firstText(row, ['PROFESSOR', 'DOCENTE', 'NOME']);
      const key = GeneralTeacherPdfReportService._teacherSelectionKey(
        name,
        row.MATRICULA_DOCENTE
      );
      if (!groups[key]) groups[key] = { name: name, rows: [] };
      groups[key].rows.push(row);
    });
    return groups;
  },

  _sortModels: function(models, sort) {
    const source = (models || []).slice();
    return source.sort(function(first, second) {
      const nameComparison = String(first.professor.name || '').localeCompare(
        String(second.professor.name || ''),
        'pt-BR',
        { sensitivity: 'base', numeric: true }
      );
      if (sort === 'NAME_DESC') return -nameComparison;
      if (sort === 'WORKLOAD_ASC') {
        return Number(first.workload.totalClockHours || 0)
          - Number(second.workload.totalClockHours || 0) || nameComparison;
      }
      if (sort === 'WORKLOAD_DESC') {
        return Number(second.workload.totalClockHours || 0)
          - Number(first.workload.totalClockHours || 0) || nameComparison;
      }
      return nameComparison;
    });
  },

  _buildModel: function(request, teachers, rows) {
    const totalClockHours = teachers.reduce(function(total, teacher) {
      return total + Number(teacher.workload.totalClockHours || 0);
    }, 0);
    const totalStudentLinks = teachers.reduce(function(total, teacher) {
      return total + (teacher.students && teacher.students.available
        ? Number(teacher.students.uniqueStudents || 0)
        : 0);
    }, 0);
    const areaGroups = GeneralTeacherPdfReportService._buildAreaGroups(teachers, rows);
    const generatedAt = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm'
    );
    const yearPart = request.years.length === 1
      ? request.years[0]
      : request.years[0] + '-' + request.years[request.years.length - 1];
    return {
      fileName: 'Relatorio_Geral_Carga_Horaria_Docente_' + yearPart
        + '_v' + APP_INFO.version + '.pdf',
      generatedAt: generatedAt,
      generatedBy: Session.getActiveUser().getEmail() || 'Administrador autenticado',
      version: APP_INFO.version,
      years: request.years,
      semester: request.dashboardFilters.semester === 'ALL'
        ? 'Ano completo'
        : request.dashboardFilters.semester + 'º semestre',
      sortLabel: GeneralTeacherPdfReportService._sortLabel(request.sort),
      filterSummary: GeneralTeacherPdfReportService._buildFilterSummary(request, rows),
      summary: {
        teacherCount: teachers.length,
        detailCount: rows.length,
        totalClockHours: totalClockHours,
        totalClassHours: DashboardRules.clockHoursToClassHours(
          totalClockHours,
          request.dashboardFilters.duracaoAula
        ),
        totalStudentLinks: totalStudentLinks
      },
      areaGroups: areaGroups,
      teachers: teachers
    };
  },

  _buildAreaGroups: function(teachers, rows) {
    const workloadByTeacher = {};
    teachers.forEach(function(teacher) {
      workloadByTeacher[GeneralTeacherPdfReportService._teacherSelectionKey(
        teacher.professor.name,
        teacher.professor.registration
      )] = Number(teacher.workload.totalClockHours || 0);
    });
    const groups = {};
    (rows || []).forEach(function(row) {
      const teacherKey = GeneralTeacherPdfReportService._teacherSelectionKey(
        AcademicAnalytics._firstText(row, ['PROFESSOR', 'DOCENTE', 'NOME']),
        row.MATRICULA_DOCENTE
      );
      (Array.isArray(row.AREAS_DOCENTE) ? row.AREAS_DOCENTE : []).forEach(function(assignment) {
        const historicalSuffix = assignment.areaActive === false
          ? ' — histórica (inativa atualmente)'
          : '';
        const candidates = [{
          id: String(assignment.areaId || ''),
          label: String(assignment.path || assignment.areaName || '') + historicalSuffix
        }];
        if (assignment.parentAreaId) {
          const parentHistoricalSuffix = assignment.parentAreaActive === false
            ? ' — histórica (inativa atualmente)'
            : '';
          candidates.push({
            id: String(assignment.parentAreaId),
            label: String(assignment.parentAreaName || '').trim() + parentHistoricalSuffix
          });
        }
        candidates.forEach(function(area) {
          if (!area.id || !area.label) return;
          if (!groups[area.id]) groups[area.id] = { id: area.id, label: area.label, teachers: {} };
          groups[area.id].teachers[teacherKey] = true;
        });
      });
    });
    return Object.keys(groups).map(function(areaId) {
      const group = groups[areaId];
      const teacherKeys = Object.keys(group.teachers);
      return {
        id: group.id,
        label: group.label,
        teacherCount: teacherKeys.length,
        totalClockHours: teacherKeys.reduce(function(total, key) {
          return total + Number(workloadByTeacher[key] || 0);
        }, 0)
      };
    }).sort(function(first, second) {
      return first.label.localeCompare(second.label, 'pt-BR', { sensitivity: 'base' });
    });
  },

  _buildFilterSummary: function(request, rows) {
    const labels = [];
    const add = function(name, values) {
      if (values && values.length > 0) labels.push(name + ': ' + values.join(', '));
    };
    add('FORMA', request.filters.forms);
    add('CURSO', request.filters.courses);
    add('PPC', request.filters.ppcs);
    add('PERÍODO', request.filters.periods);
    if (request.filters.areaIds.length > 0) {
      const areaLabels = {};
      (rows || []).forEach(function(row) {
        (Array.isArray(row.AREAS_DOCENTE) ? row.AREAS_DOCENTE : []).forEach(function(area) {
          if (request.filters.areaMap[String(area.areaId || '')]
              || request.filters.areaMap[String(area.parentAreaId || '')]) {
            const baseLabel = String(area.path || area.areaName || '').trim();
            const label = baseLabel && area.areaActive === false
              ? baseLabel + ' — histórica (inativa atualmente)'
              : baseLabel;
            if (label) areaLabels[label] = true;
          }
        });
      });
      add('ÁREA', Object.keys(areaLabels).sort());
    }
    return labels.length > 0 ? labels : ['Sem filtros acadêmicos adicionais'];
  },

  _sortLabel: function(sort) {
    return {
      NAME_ASC: 'Nome A–Z',
      NAME_DESC: 'Nome Z–A',
      WORKLOAD_ASC: 'Carga horária crescente',
      WORKLOAD_DESC: 'Carga horária decrescente'
    }[sort] || 'Nome A–Z';
  },

  _uniqueValues: function(values) {
    const seen = {};
    return (values || []).filter(function(value) {
      const text = String(value || '').trim();
      if (!text || seen[text]) return false;
      seen[text] = true;
      return true;
    });
  },

  /** Monta o PDF geral com resumo único e uma seção paginada por docente. */
  _buildHtml: function(model) {
    const escape = TeacherPdfReportService._escapeHtml;
    const number = TeacherPdfReportService._formatNumber;
    const areaRows = model.areaGroups.length > 0
      ? model.areaGroups.map(function(area) {
        return '<tr><td>' + escape(area.label) + '</td><td class="num">'
          + number(area.teacherCount, 0) + '</td><td class="num">'
          + number(area.totalClockHours, 1) + ' h</td></tr>';
      }).join('')
      : '<tr><td colspan="3">Nenhuma área vinculada no recorte.</td></tr>';
    const teacherSections = model.teachers.map(function(teacher, teacherIndex) {
      const areas = teacher.professor.areas.length > 0
        ? teacher.professor.areas.join(' · ')
        : 'Sem área atribuída';
      const students = teacher.students && teacher.students.available
        ? number(teacher.students.uniqueStudents, 0) + ' alunos atendidos (aprox.) · '
          + number(teacher.students.averageStudentsPerOffering, 1) + ' por oferta'
        : 'Indicadores de alunos indisponíveis';
      const professorConditions = Array.isArray(teacher.professor.conditions)
        ? teacher.professor.conditions
        : [];
      const conditions = professorConditions.length > 0
        ? professorConditions.map(function(condition) {
          return [condition.description, condition.reason].filter(Boolean).join(' — ');
        }).join(' · ')
        : 'Nenhuma condição especial confirmada';
      const details = teacher.details.map(function(row) {
        const group = [row.form, row.course, row.ppc,
          row.period ? row.period + 'º período' : '',
          row.turma ? 'Turma ' + row.turma : ''].filter(Boolean).join(' / ');
        return '<tr><td>' + escape(row.year + ' · ' + row.semester) + '</td><td>'
          + escape(group) + '</td><td>' + escape(row.discipline) + '</td><td class="num">'
          + number(row.clockHours, 1) + ' h<br><small>' + number(row.classHours, 1)
          + ' h/a</small></td><td>' + escape(row.students) + '</td></tr>';
      }).join('');
      return '<section class="teacher ' + (teacherIndex > 0 ? 'new-page' : '') + '">'
        + '<h2>' + escape(teacher.professor.name) + '</h2><div class="identity">'
        + 'Vínculo: ' + escape(teacher.professor.employment)
        + ' · Matrícula: ' + escape(teacher.professor.registration)
        + ' · Situação: ' + escape(teacher.professor.situation)
        + ' · Regime: ' + escape(teacher.professor.workRegime)
        + '<br>Função importada: ' + escape(teacher.professor.officialFunction || 'Não informada')
        + ' · Jornada reduzida: ' + escape(teacher.professor.reducedWorkload ? 'Sim' : 'Não')
        + '<br>Condições confirmadas: ' + escape(conditions)
        + '<br>Áreas: ' + escape(areas) + '</div><div class="teacher-summary">'
        + '<strong>' + number(teacher.workload.totalClockHours, 1) + ' h</strong> de carga total · '
        + '<strong>' + number(teacher.workload.weeklyAverage, 1) + ' h/semana</strong> · '
        + '<strong>' + escape(teacher.workload.weeklyStatus) + '</strong> · '
        + escape(students) + '</div><table><thead><tr><th>Ano / semestre</th>'
        + '<th>Forma / curso / PPC / período / turma</th><th>Disciplina</th><th>Carga</th>'
        + '<th>Alunos</th></tr></thead><tbody>' + details + '</tbody></table></section>';
    }).join('');

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
      + '@page{size:A4 landscape;margin:14mm 10mm 16mm 10mm}*{box-sizing:border-box}'
      + 'body{font-family:Arial,sans-serif;color:#17211b;font-size:9px;margin:0}'
      + 'h1{font-size:20px;color:#166534;margin:0 0 4px}h2{font-size:14px;color:#166534;margin:10px 0 5px}'
      + '.meta,.scope,.method{color:#526057;margin:4px 0 8px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:9px 0}'
      + '.card{border:1px solid #d7e2da;border-radius:5px;padding:7px}.card span{display:block;color:#647067;font-size:7.5px}.card strong{font-size:12px}'
      + '.identity{border:1px solid #bfd7c7;background:#f3faf5;padding:6px 8px;border-radius:5px}.teacher-summary{margin:6px 0}'
      + 'table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:8px}thead{display:table-header-group}tr{page-break-inside:avoid}'
      + 'th{background:#166534;color:#fff;padding:5px 4px;text-align:left;font-size:7.5px}td{border:1px solid #dce4de;padding:4px;vertical-align:top}'
      + '.num{text-align:right}.new-page{page-break-before:always}.footer{position:fixed;bottom:-11mm;left:0;right:0;border-top:1px solid #cbd7ce;padding-top:3px;color:#58655c;font-size:7px;text-align:center}'
      + 'small{color:#657168;font-size:7px}</style></head><body><div class="footer">'
      + 'Relatório gerado a partir do Dashboard de Carga Horária Docente '
      + escape(model.version) + '</div><h1>Relatório Geral de Carga Horária Docente</h1>'
      + '<div class="meta">Gerado em ' + escape(model.generatedAt) + ' por '
      + escape(model.generatedBy) + ' · versão ' + escape(model.version) + '</div>'
      + '<div class="scope">Anos: ' + escape(model.years.join(', '))
      + ' · Período: ' + escape(model.semester) + ' · Ordenação: '
      + escape(model.sortLabel) + '<br>' + escape(model.filterSummary.join(' · ')) + '</div>'
      + '<div class="cards"><div class="card"><span>Professores</span><strong>'
      + number(model.summary.teacherCount, 0) + '</strong></div><div class="card"><span>Carga total sem duplicar docentes</span><strong>'
      + number(model.summary.totalClockHours, 1) + ' h</strong></div><div class="card"><span>Equivalente em hora-aula</span><strong>'
      + number(model.summary.totalClassHours, 1) + ' h/a</strong></div><div class="card"><span>Vínculos aluno-docente aproximados</span><strong>'
      + number(model.summary.totalStudentLinks, 0) + '</strong></div></div>'
      + '<div class="method">' + escape(AcademicAnalytics.STUDENT_APPROXIMATION_EXPLANATION)
      + ' Os totais gerais contabilizam cada docente uma única vez; nos grupos de área ele aparece em todos os vínculos aplicáveis.</div>'
      + '<h2>Distribuição por áreas e subáreas</h2><table><thead><tr><th>Área ou subárea</th><th>Docentes</th><th>Carga do grupo</th></tr></thead><tbody>'
      + areaRows + '</tbody></table>' + teacherSections + '</body></html>';
  }
};

/** Endpoint restrito a administradores e super usuários. */
function generateGeneralTeacherPdfReport(payload) {
  try {
    AccessControlService.requireAdministrator();
    return JSON.stringify(GeneralTeacherPdfReportService.generate(payload));
  } catch (error) {
    Logger.log('Erro em generateGeneralTeacherPdfReport: ' + error.message);
    return JSON.stringify({
      status: 'error',
      message: 'Não foi possível gerar o relatório geral: ' + error.message
    });
  }
}
