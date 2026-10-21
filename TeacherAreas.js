/**
 * @file TeacherAreas.gs
 * @fileoverview Gestão das associações entre docentes e Áreas de Conhecimento.
 * @version 10.0.9
 *
 * O cadastro oficial de docentes continua sendo alimentado exclusivamente pelo
 * relatório DOCENTES. Este módulo mantém apenas dados internos que não podem ser
 * sobrescritos pela importação: situação administrativa e associações com áreas.
 */

/**
 * Contratos persistentes da versão 9.8.
 *
 * @const {Object}
 */
const TEACHER_AREAS_CONFIG = Object.freeze({
  version: '10.0.9',
  associationSheetName: 'DOCENTES_AREAS',
  controlSheetName: 'DOCENTES_CONTROLE',
  associationHeaders: Object.freeze([
    'ID_Associacao',
    'Matricula_Docente',
    'ID_Area',
    'Ano_Inicio',
    'Ano_Fim',
    'Ativa',
    'Criado_Em',
    'Atualizado_Em',
    'Semestre_Fim'
  ]),
  controlHeaders: Object.freeze([
    'Matricula_Docente',
    'Ativo',
    'Motivo_Inativacao',
    'Data_Inativacao',
    'Criado_Em',
    'Atualizado_Em'
  ]),
  lockTimeoutMilliseconds: 30000
});

/** Logger estruturado do módulo. */
const TeacherAreasLog = Object.freeze({
  /**
   * @param {'INFO'|'WARNING'|'ERROR'} level Nível.
   * @param {string} event Evento estável.
   * @param {Object=} metadata Metadados.
   */
  write: function(level, event, metadata) {
    Logger.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level,
      event: event,
      appVersion: TEACHER_AREAS_CONFIG.version,
      origemExecucao: 'aplicacao',
      metadata: metadata || {}
    }));
  }
});

/**
 * Serviço de domínio das relações docente-área.
 *
 * @const {Object}
 */
const TeacherAreasService = {
  /**
   * Enriquece o cadastro mínimo de docentes com situação e associações.
   * A leitura é tolerante: a ausência das novas abas representa nenhuma
   * associação e não impede o dashboard de funcionar.
   *
   * @param {Array<Object>} teachers Cadastro oficial mínimo.
   * @returns {Array<Object>} Docentes enriquecidos.
   */
  enrichTeacherRegistry: function(teachers) {
    const source = Array.isArray(teachers) ? teachers : [];
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) return source.map(TeacherAreasService._withDefaultTeacherState);

    const controls = TeacherAreasService._readControlsSafely(spreadsheet);
    const areaResult = TeacherAreasService._readAreaCatalogSafely();
    const assignments = TeacherAreasService._readAssignmentsSafely(spreadsheet);
    const areasById = {};
    areaResult.areas.forEach(function(area) { areasById[area.id] = area; });
    const assignmentsByRegistration = {};

    assignments.forEach(function(assignment) {
      const publicAssignment = TeacherAreasService._toPublicAssignment(
        assignment,
        areasById
      );
      if (!publicAssignment) return;
      if (!assignmentsByRegistration[assignment.registration]) {
        assignmentsByRegistration[assignment.registration] = [];
      }
      assignmentsByRegistration[assignment.registration].push(publicAssignment);
    });

    return source.map(function(teacher) {
      const registration = TeacherAreasService.normalizeRegistration(teacher.registration);
      const control = controls[registration] || null;
      return Object.assign({}, teacher, {
        registration: registration,
        active: control ? control.active : true,
        inactiveReason: control ? control.inactiveReason : '',
        inactiveDate: control ? TeacherAreasService._formatDate(control.inactiveDate) : '',
        areaAssignments: (assignmentsByRegistration[registration] || [])
          .slice()
          .sort(TeacherAreasService._comparePublicAssignments)
      });
    });
  },

  /**
   * Dados leves usados pelo carregamento inicial do dashboard.
   *
   * @returns {{areas:Array<Object>,summary:Object,health:Object}}
   */
  getDashboardReferenceData: function() {
    const areaResult = TeacherAreasService._readAreaCatalogSafely();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const assignments = spreadsheet
      ? TeacherAreasService._readAssignmentsSafely(spreadsheet)
      : [];
    const controls = spreadsheet
      ? TeacherAreasService._readControlsSafely(spreadsheet)
      : {};

    return {
      areas: areaResult.areas,
      summary: {
        areaCount: areaResult.areas.length,
        activeAreaCount: areaResult.areas.filter(function(area) { return area.active; }).length,
        assignmentCount: assignments.length,
        activeAssignmentCount: assignments.filter(function(item) { return item.active; }).length,
        controlledTeacherCount: Object.keys(controls).length
      },
      health: {
        areasAvailable: areaResult.available,
        associationsAvailable: Boolean(
          spreadsheet && spreadsheet.getSheetByName(TEACHER_AREAS_CONFIG.associationSheetName)
        ),
        controlsAvailable: Boolean(
          spreadsheet && spreadsheet.getSheetByName(TEACHER_AREAS_CONFIG.controlSheetName)
        )
      }
    };
  },

  /**
   * Retorna todos os dados necessários ao modal de associação.
   *
   * @param {string=} selectedAreaId Área selecionada opcional.
   * @returns {Object} Cadastro gerencial.
   */
  listManagementData: function(selectedAreaId) {
    const spreadsheet = TeacherAreasService._getSpreadsheetOrThrow();
    const associationSheet = TeacherAreasService._getSheetOrThrow(
      spreadsheet,
      TEACHER_AREAS_CONFIG.associationSheetName
    );
    const controlSheet = TeacherAreasService._getSheetOrThrow(
      spreadsheet,
      TEACHER_AREAS_CONFIG.controlSheetName
    );
    TeacherAreasService._assertHeaders(
      associationSheet,
      TEACHER_AREAS_CONFIG.associationHeaders
    );
    TeacherAreasService._assertHeaders(
      controlSheet,
      TEACHER_AREAS_CONFIG.controlHeaders
    );

    const areaResult = KnowledgeAreasService.list();
    if (!areaResult.health.ok) {
      throw new Error(
        'O cadastro de Áreas de Conhecimento possui inconsistências: '
        + areaResult.health.problems.join(' | ')
      );
    }

    const rawTeachers = Dao.extractTeacherRegistryRaw();
    const controls = TeacherAreasService._readControls(controlSheet);
    const assignments = TeacherAreasService._readAssignments(associationSheet);
    const areasById = {};
    areaResult.areas.forEach(function(area) { areasById[area.id] = area; });
    const teacherByRegistration = {};

    const teachers = rawTeachers.map(function(teacher) {
      const registration = TeacherAreasService.normalizeRegistration(teacher.registration);
      const control = controls[registration] || null;
      const publicTeacher = {
        registration: registration,
        name: String(teacher.name || '').trim(),
        employmentType: teacher.employmentType || 'NAO_IDENTIFICADO',
        jobTitle: String(teacher.jobTitle || ''),
        workloadCode: String(teacher.workloadCode || ''),
        workRegimeCode: teacher.workRegimeCode || 'NAO_IDENTIFICADO',
        workRegimeLabel: teacher.workRegimeLabel || 'Regime não identificado',
        weeklyContractHours: teacher.weeklyContractHours !== null
          && teacher.weeklyContractHours !== ''
          && Number.isFinite(Number(teacher.weeklyContractHours))
          ? Number(teacher.weeklyContractHours)
          : null,
        active: control ? control.active : true,
        inactiveReason: control ? control.inactiveReason : '',
        inactiveDate: control ? TeacherAreasService._formatDate(control.inactiveDate) : '',
        assignments: []
      };
      teacherByRegistration[registration] = publicTeacher;
      return publicTeacher;
    });

    const orphanAssignments = [];
    assignments.forEach(function(assignment) {
      const publicAssignment = TeacherAreasService._toPublicAssignment(
        assignment,
        areasById
      );
      if (!publicAssignment) {
        orphanAssignments.push({
          id: assignment.id,
          registration: assignment.registration,
          areaId: assignment.areaId,
          reason: 'Área inexistente.'
        });
        return;
      }
      const teacher = teacherByRegistration[assignment.registration];
      if (!teacher) {
        orphanAssignments.push({
          id: assignment.id,
          registration: assignment.registration,
          areaId: assignment.areaId,
          reason: 'Matrícula não encontrada em DOCENTES.'
        });
        return;
      }
      teacher.assignments.push(publicAssignment);
    });

    teachers.forEach(function(teacher) {
      teacher.assignments.sort(TeacherAreasService._comparePublicAssignments);
    });
    teachers.sort(function(first, second) {
      return String(first.name || '').localeCompare(
        String(second.name || ''),
        'pt-BR',
        { sensitivity: 'base', numeric: true }
      );
    });

    const normalizedSelectedAreaId = String(selectedAreaId || '').trim();
    const selectedArea = normalizedSelectedAreaId
      ? (areasById[normalizedSelectedAreaId] || null)
      : null;
    const selectedAreaIds = TeacherAreasService.resolveAreaScopeIds(
      areaResult.areas,
      selectedArea
    );

    return {
      teachers: teachers,
      areas: areaResult.areas,
      hierarchy: areaResult.hierarchy,
      selectedArea: selectedArea,
      selectedAreaScope: {
        areaIds: selectedAreaIds,
        includesSubareas: Boolean(selectedArea && !selectedArea.parentId),
        label: selectedArea && !selectedArea.parentId
          ? 'Área principal e subáreas'
          : 'Subárea selecionada'
      },
      selectedAreaAssignments: selectedArea
        ? assignments.filter(function(item) {
          return selectedAreaIds.indexOf(item.areaId) >= 0;
        })
          .map(function(item) {
            return TeacherAreasService._toPublicAssignment(item, areasById);
          })
          .filter(Boolean)
          .sort(TeacherAreasService._comparePublicAssignments)
        : [],
      summary: {
        teacherCount: teachers.length,
        activeTeacherCount: teachers.filter(function(teacher) { return teacher.active; }).length,
        inactiveTeacherCount: teachers.filter(function(teacher) { return !teacher.active; }).length,
        assignmentCount: assignments.length,
        activeAssignmentCount: assignments.filter(function(item) { return item.active; }).length,
        orphanAssignmentCount: orphanAssignments.length
      },
      orphanAssignments: orphanAssignments,
      health: {
        ok: orphanAssignments.length === 0,
        problems: orphanAssignments.map(function(item) {
          return 'Associação ' + item.id + ': ' + item.reason;
        })
      }
    };
  },

  /**
   * Resolve a área selecionada para o modal gerencial. Uma subárea mantém
   * escopo direto; uma área principal inclui também todas as suas subáreas.
   *
   * @param {Array<Object>} areas Catálogo público.
   * @param {Object|null} selectedArea Área selecionada.
   * @returns {Array<string>} IDs pertencentes ao escopo.
   */
  resolveAreaScopeIds: function(areas, selectedArea) {
    if (!selectedArea || !selectedArea.id) return [];
    const ids = [String(selectedArea.id)];
    if (selectedArea.parentId) return ids;
    (Array.isArray(areas) ? areas : []).forEach(function(area) {
      if (String(area.parentId || '') === String(selectedArea.id)) ids.push(String(area.id));
    });
    return ids;
  },

  /**
   * Associa uma área a um ou mais docentes em uma única operação.
   * Registros existentes são preservados e nunca sobrescritos silenciosamente.
   *
   * @param {Object} payload Dados da operação.
   * @returns {Object} Resultado e cadastro atualizado.
   */
  addAssignments: function(payload) {
    const source = payload || {};
    const areaId = String(source.areaId || '').trim();
    const registrations = (Array.isArray(source.registrations) ? source.registrations : [])
      .map(TeacherAreasService.normalizeRegistration)
      .filter(Boolean)
      .filter(function(value, index, list) { return list.indexOf(value) === index; });
    const startYear = TeacherAreasService._normalizeOptionalYear(source.startYear, 'Ano inicial');
    const endYear = TeacherAreasService._normalizeOptionalYear(source.endYear, 'Ano final');
    const endSemester = TeacherAreasService._normalizeOptionalSemester(
      source.endSemester,
      'Semestre final'
    );

    if (!areaId) throw TeacherAreasService._validationError('Selecione uma área de conhecimento.');
    if (registrations.length === 0) {
      throw TeacherAreasService._validationError('Selecione pelo menos um docente.');
    }
    if (startYear && endYear && Number(startYear) > Number(endYear)) {
      throw TeacherAreasService._validationError(
        'O ano inicial não pode ser posterior ao ano final.'
      );
    }
    if (endSemester && !endYear) {
      throw TeacherAreasService._validationError(
        'Informe o ano final quando selecionar o semestre final.'
      );
    }

    return TeacherAreasService._withLock(function() {
      const spreadsheet = TeacherAreasService._getSpreadsheetOrThrow();
      const sheet = TeacherAreasService._getSheetOrThrow(
        spreadsheet,
        TEACHER_AREAS_CONFIG.associationSheetName
      );
      TeacherAreasService._assertHeaders(sheet, TEACHER_AREAS_CONFIG.associationHeaders);
      const areaResult = KnowledgeAreasService.list();
      const area = areaResult.areas.find(function(item) { return item.id === areaId; });
      if (!area) throw TeacherAreasService._validationError('A área selecionada não foi encontrada.');
      if (!area.active) {
        throw TeacherAreasService._validationError(
          'Não é possível criar novas associações para uma área inativa.'
        );
      }

      const teachers = Dao.extractTeacherRegistryRaw();
      const availableRegistrations = {};
      teachers.forEach(function(teacher) {
        availableRegistrations[TeacherAreasService.normalizeRegistration(teacher.registration)] = true;
      });
      registrations.forEach(function(registration) {
        if (!availableRegistrations[registration]) {
          throw TeacherAreasService._validationError(
            'A matrícula ' + registration + ' não foi encontrada no cadastro DOCENTES.'
          );
        }
      });

      const controlSheet = TeacherAreasService._getSheetOrThrow(
        spreadsheet,
        TEACHER_AREAS_CONFIG.controlSheetName
      );
      TeacherAreasService._assertHeaders(controlSheet, TEACHER_AREAS_CONFIG.controlHeaders);
      const controls = TeacherAreasService._readControls(controlSheet);
      registrations.forEach(function(registration) {
        if (controls[registration] && controls[registration].active === false) {
          throw TeacherAreasService._validationError(
            'O docente de matrícula ' + registration
            + ' está inativo. Reative o docente antes de criar uma associação.'
          );
        }
      });

      const current = TeacherAreasService._readAssignments(sheet);
      const created = [];
      const preserved = [];
      const reactivated = [];
      const now = new Date();

      registrations.forEach(function(registration) {
        const sameScope = current.filter(function(item) {
          return item.registration === registration
            && item.areaId === areaId
            && TeacherAreasService._periodsOverlap(
              item.startYear,
              item.endYear,
              startYear,
              endYear
            );
        });
        const activeConflict = sameScope.find(function(item) { return item.active; });
        if (activeConflict) {
          preserved.push(activeConflict.id);
          return;
        }

        const exactInactive = sameScope.find(function(item) {
          return !item.active
            && String(item.startYear || '') === String(startYear || '')
            && String(item.endYear || '') === String(endYear || '')
            && String(item.endSemester || '') === String(endSemester || '');
        });
        if (exactInactive) {
          const updated = Object.assign({}, exactInactive, {
            endYear: endYear,
            endSemester: endSemester,
            active: true,
            updatedAt: now
          });
          TeacherAreasService._writeAssignmentAtRow(sheet, exactInactive.sourceRow, updated);
          current[current.indexOf(exactInactive)] = updated;
          reactivated.push(updated.id);
          return;
        }

        const assignment = {
          id: Utilities.getUuid(),
          registration: registration,
          areaId: areaId,
          startYear: startYear,
          endYear: endYear,
          endSemester: endSemester,
          active: true,
          createdAt: now,
          updatedAt: now,
          sourceRow: null
        };
        current.push(assignment);
        created.push(assignment);
      });

      if (created.length > 0) {
        const startRow = TeacherAreasService._findAppendRow(
          sheet,
          TEACHER_AREAS_CONFIG.associationHeaders.length,
          TeacherAreasService._associationRowHasMeaningfulData
        );
        TeacherAreasService._ensureRows(sheet, startRow + created.length - 1);
        const values = created.map(function(item, index) {
          item.sourceRow = startRow + index;
          return TeacherAreasService._assignmentToRow(item);
        });
        sheet.getRange(
          startRow,
          1,
          values.length,
          TEACHER_AREAS_CONFIG.associationHeaders.length
        ).setValues(values);
      }

      SpreadsheetApp.flush();
      const persisted = TeacherAreasService._readAssignments(sheet);
      const integrity = TeacherAreasService.validateAssignments(
        persisted,
        areaResult.areas,
        teachers
      );
      if (!integrity.ok) {
        throw new Error(
          'A associação foi gravada, mas a validação encontrou inconsistências: '
          + integrity.problems.join(' | ')
        );
      }

      TeacherAreasLog.write('INFO', 'teacher_area_assignments_added', {
        areaId: areaId,
        requestedTeachers: registrations.length,
        created: created.length,
        reactivated: reactivated.length,
        preserved: preserved.length,
        startYear: startYear || null,
        endYear: endYear || null
      });

      return {
        createdCount: created.length,
        reactivatedCount: reactivated.length,
        preservedCount: preserved.length,
        management: TeacherAreasService.listManagementData(areaId)
      };
    });
  },

  /**
   * Encerra uma associação sem excluir seu histórico.
   *
   * @param {string} assignmentId ID da associação.
   * @param {string|number} endYear Último ano de vigência.
   * @param {string|number=} endSemester Último semestre de vigência; vazio encerra no fim do ano.
   * @returns {Object} Cadastro atualizado.
   */
  endAssignment: function(assignmentId, endYear, endSemester) {
    const id = String(assignmentId || '').trim();
    const normalizedEndYear = TeacherAreasService._normalizeOptionalYear(endYear, 'Ano final');
    const normalizedEndSemester = TeacherAreasService._normalizeOptionalSemester(
      endSemester,
      'Semestre final'
    );
    if (!id) throw TeacherAreasService._validationError('Associação não informada.');
    if (!normalizedEndYear) {
      throw TeacherAreasService._validationError('Informe o último ano de vigência da associação.');
    }

    return TeacherAreasService._withLock(function() {
      const spreadsheet = TeacherAreasService._getSpreadsheetOrThrow();
      const sheet = TeacherAreasService._getSheetOrThrow(
        spreadsheet,
        TEACHER_AREAS_CONFIG.associationSheetName
      );
      TeacherAreasService._assertHeaders(sheet, TEACHER_AREAS_CONFIG.associationHeaders);
      const assignments = TeacherAreasService._readAssignments(sheet);
      const target = assignments.find(function(item) { return item.id === id; });
      if (!target) {
        throw TeacherAreasService._validationError(
          'A associação informada não foi encontrada. Atualize os dados e tente novamente.'
        );
      }
      if (target.startYear && Number(normalizedEndYear) < Number(target.startYear)) {
        throw TeacherAreasService._validationError(
          'O ano final não pode ser anterior ao ano inicial da associação.'
        );
      }

      const updated = Object.assign({}, target, {
        endYear: normalizedEndYear,
        endSemester: normalizedEndSemester,
        active: false,
        updatedAt: new Date()
      });
      TeacherAreasService._writeAssignmentAtRow(sheet, target.sourceRow, updated);
      SpreadsheetApp.flush();

      TeacherAreasLog.write('INFO', 'teacher_area_assignment_ended', {
        assignmentId: id,
        registration: target.registration,
        areaId: target.areaId,
        endYear: normalizedEndYear,
        endSemester: normalizedEndSemester
      });

      return {
        management: TeacherAreasService.listManagementData(target.areaId)
      };
    });
  },

  /**
   * Reativa uma associação encerrada, preservando o mesmo ID.
   * O ano final é limpo para indicar vigência aberta.
   *
   * @param {string} assignmentId ID da associação.
   * @returns {Object} Cadastro atualizado.
   */
  reactivateAssignment: function(assignmentId) {
    const id = String(assignmentId || '').trim();
    if (!id) throw TeacherAreasService._validationError('Associação não informada.');

    return TeacherAreasService._withLock(function() {
      const spreadsheet = TeacherAreasService._getSpreadsheetOrThrow();
      const sheet = TeacherAreasService._getSheetOrThrow(
        spreadsheet,
        TEACHER_AREAS_CONFIG.associationSheetName
      );
      TeacherAreasService._assertHeaders(sheet, TEACHER_AREAS_CONFIG.associationHeaders);
      const assignments = TeacherAreasService._readAssignments(sheet);
      const target = assignments.find(function(item) { return item.id === id; });
      if (!target) throw TeacherAreasService._validationError('Associação não encontrada.');
      const areaResult = KnowledgeAreasService.list();
      const area = areaResult.areas.find(function(item) { return item.id === target.areaId; });
      if (!area || !area.active) {
        throw TeacherAreasService._validationError(
          'A associação não pode ser reativada enquanto a área estiver inativa ou ausente.'
        );
      }
      const controlSheet = TeacherAreasService._getSheetOrThrow(
        spreadsheet,
        TEACHER_AREAS_CONFIG.controlSheetName
      );
      TeacherAreasService._assertHeaders(controlSheet, TEACHER_AREAS_CONFIG.controlHeaders);
      const controls = TeacherAreasService._readControls(controlSheet);
      if (controls[target.registration] && controls[target.registration].active === false) {
        throw TeacherAreasService._validationError(
          'O docente está inativo. Reative o docente antes de reativar esta associação.'
        );
      }
      const overlapping = assignments.find(function(item) {
        if (item.id === target.id || !item.active) return false;
        return item.registration === target.registration
          && item.areaId === target.areaId
          && TeacherAreasService._periodsOverlap(
            item.startYear,
            item.endYear,
            target.startYear,
            ''
          );
      });
      if (overlapping) {
        throw TeacherAreasService._validationError(
          'Já existe outra associação ativa sobreposta para este docente e área.'
        );
      }

      const updated = Object.assign({}, target, {
        endYear: '',
        endSemester: '',
        active: true,
        updatedAt: new Date()
      });
      TeacherAreasService._writeAssignmentAtRow(sheet, target.sourceRow, updated);
      SpreadsheetApp.flush();

      TeacherAreasLog.write('INFO', 'teacher_area_assignment_reactivated', {
        assignmentId: id,
        registration: target.registration,
        areaId: target.areaId
      });
      return {
        management: TeacherAreasService.listManagementData(target.areaId)
      };
    });
  },

  /**
   * Altera somente a situação administrativa interna do docente.
   * Nenhum campo do relatório DOCENTES é modificado.
   *
   * @param {string} registration Matrícula.
   * @param {boolean} active Situação desejada.
   * @param {string=} reason Motivo opcional.
   * @returns {Object} Cadastro atualizado.
   */
  setTeacherActive: function(registration, active, reason) {
    const normalizedRegistration = TeacherAreasService.normalizeRegistration(registration);
    if (!normalizedRegistration) {
      throw TeacherAreasService._validationError('Matrícula docente não informada.');
    }
    const desiredActive = TeacherAreasService._toBoolean(active, true);
    const cleanedReason = TeacherAreasService._cleanText(reason);

    return TeacherAreasService._withLock(function() {
      const rawTeachers = Dao.extractTeacherRegistryRaw();
      const teacherExists = rawTeachers.some(function(teacher) {
        return TeacherAreasService.normalizeRegistration(teacher.registration)
          === normalizedRegistration;
      });
      if (!teacherExists) {
        throw TeacherAreasService._validationError(
          'A matrícula ' + normalizedRegistration + ' não existe no cadastro DOCENTES.'
        );
      }

      const spreadsheet = TeacherAreasService._getSpreadsheetOrThrow();
      const sheet = TeacherAreasService._getSheetOrThrow(
        spreadsheet,
        TEACHER_AREAS_CONFIG.controlSheetName
      );
      TeacherAreasService._assertHeaders(sheet, TEACHER_AREAS_CONFIG.controlHeaders);
      const controls = TeacherAreasService._readControlRows(sheet);
      const existing = controls.find(function(item) {
        return item.registration === normalizedRegistration;
      });
      const now = new Date();
      const updated = {
        registration: normalizedRegistration,
        active: desiredActive,
        inactiveReason: desiredActive ? '' : cleanedReason,
        inactiveDate: desiredActive ? null : now,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
        sourceRow: existing ? existing.sourceRow : null
      };

      if (existing) {
        TeacherAreasService._writeControlAtRow(sheet, existing.sourceRow, updated);
      } else {
        const targetRow = TeacherAreasService._findAppendRow(
          sheet,
          TEACHER_AREAS_CONFIG.controlHeaders.length,
          TeacherAreasService._controlRowHasMeaningfulData
        );
        TeacherAreasService._ensureRows(sheet, targetRow);
        updated.sourceRow = targetRow;
        TeacherAreasService._writeControlAtRow(sheet, targetRow, updated);
      }
      SpreadsheetApp.flush();

      TeacherAreasLog.write('INFO', desiredActive
        ? 'teacher_reactivated'
        : 'teacher_deactivated', {
        registration: normalizedRegistration,
        reason: cleanedReason || null
      });

      return {
        management: TeacherAreasService.listManagementData('')
      };
    });
  },

  /**
   * Verifica a integridade das associações.
   *
   * @param {Array<Object>} assignments Associações internas.
   * @param {Array<Object>} areas Catálogo de áreas.
   * @param {Array<Object>} teachers Cadastro oficial.
   * @returns {{ok:boolean,problems:Array<string>,recordCount:number}}
   */
  validateAssignments: function(assignments, areas, teachers) {
    const source = Array.isArray(assignments) ? assignments : [];
    const areaIds = {};
    const teacherIds = {};
    const ids = {};
    const problems = [];
    (areas || []).forEach(function(area) { areaIds[String(area.id || '')] = true; });
    (teachers || []).forEach(function(teacher) {
      teacherIds[TeacherAreasService.normalizeRegistration(teacher.registration)] = true;
    });

    source.forEach(function(item) {
      if (!item.id) problems.push('Existe associação sem ID na linha ' + (item.sourceRow || '?') + '.');
      else if (ids[item.id]) problems.push('ID_Associacao duplicado: ' + item.id + '.');
      else ids[item.id] = true;
      if (!item.registration) problems.push('Existe associação sem matrícula na linha ' + (item.sourceRow || '?') + '.');
      if (item.registration && !teacherIds[item.registration]) {
        problems.push('Matrícula ' + item.registration + ' não encontrada em DOCENTES.');
      }
      if (!item.areaId || !areaIds[item.areaId]) {
        problems.push('Área ' + (item.areaId || '[vazia]') + ' não encontrada.');
      }
      if (item.startYear && !/^\d{4}$/.test(item.startYear)) {
        problems.push('Ano_Inicio inválido na associação ' + (item.id || '?') + '.');
      }
      if (item.endYear && !/^\d{4}$/.test(item.endYear)) {
        problems.push('Ano_Fim inválido na associação ' + (item.id || '?') + '.');
      }
      if (item.endSemester && ['1', '2'].indexOf(String(item.endSemester)) < 0) {
        problems.push('Semestre_Fim inválido na associação ' + (item.id || '?') + '.');
      }
      if (item.endSemester && !item.endYear) {
        problems.push('Semestre_Fim sem Ano_Fim na associação ' + (item.id || '?') + '.');
      }
      if (item.startYear && item.endYear && Number(item.startYear) > Number(item.endYear)) {
        problems.push('Vigência invertida na associação ' + (item.id || '?') + '.');
      }
    });

    source.forEach(function(first, firstIndex) {
      if (!first.active) return;
      for (let secondIndex = firstIndex + 1; secondIndex < source.length; secondIndex += 1) {
        const second = source[secondIndex];
        if (!second.active) continue;
        if (first.registration !== second.registration || first.areaId !== second.areaId) continue;
        if (TeacherAreasService._periodsOverlap(
          first.startYear,
          first.endYear,
          second.startYear,
          second.endYear
        )) {
          problems.push(
            'Associações ativas sobrepostas para a matrícula '
            + first.registration + ' e a área ' + first.areaId + '.'
          );
        }
      }
    });

    return {
      ok: problems.length === 0,
      problems: problems,
      recordCount: source.length
    };
  },

  /**
   * Confirma se uma associação se aplica ao período do dashboard.
   * Uma associação encerrada continua válida nos anos de sua vigência.
   *
   * @param {Object} assignment Associação pública ou interna.
   * @param {string|number} year Ano.
   * @param {string|number=} semester Semestre da oferta; vazio indica regime anual.
   * @returns {boolean} Aplicabilidade.
   */
  assignmentAppliesToYear: function(assignment, year, semester) {
    const normalizedYear = String(year === null || year === undefined ? '' : year).trim();
    if (!/^\d{4}$/.test(normalizedYear)) return Boolean(assignment && assignment.active);
    const start = String(assignment && (assignment.startYear || assignment.Ano_Inicio) || '').trim();
    const end = String(assignment && (assignment.endYear || assignment.Ano_Fim) || '').trim();
    const endSemester = TeacherAreasService._normalizeSemester(
      assignment && (assignment.endSemester || assignment.Semestre_Fim)
    );
    const rowSemester = TeacherAreasService._normalizeSemester(semester);
    if (start && Number(normalizedYear) < Number(start)) return false;
    if (end && Number(normalizedYear) > Number(end)) return false;
    if (end && normalizedYear === end && endSemester && rowSemester
        && Number(rowSemester) > Number(endSemester)) return false;
    if (!assignment.active && !end) return false;
    return true;
  },

  /**
   * Normaliza o período que encerra uma vigência. Quando o frontend não o
   * informa, usa o período civil corrente como proteção para chamadas antigas.
   *
   * @param {Object=} referencePeriod Ano e semestre de referência.
   * @returns {{year:string,semester:string,label:string}}
   */
  normalizeReferencePeriod: function(referencePeriod) {
    const source = referencePeriod || {};
    const now = new Date();
    const year = TeacherAreasService._normalizeOptionalYear(
      source.year || source.ano || now.getFullYear(),
      'Ano de referência'
    );
    let rawSemester;
    if (Object.prototype.hasOwnProperty.call(source, 'semester')) rawSemester = source.semester;
    else if (Object.prototype.hasOwnProperty.call(source, 'semestre')) rawSemester = source.semestre;
    else rawSemester = now.getMonth() < 6 ? '1' : '2';
    const semester = TeacherAreasService._normalizeOptionalSemester(
      rawSemester,
      'Semestre de referência'
    );
    return {
      year: year,
      semester: semester,
      label: semester ? semester + 'º semestre de ' + year : 'ano de ' + year
    };
  },

  /**
   * Conta docentes únicos com vínculo vigente em cada área no período civil
   * informado. Para a área principal, agrega também todas as suas subáreas.
   *
   * @param {Array<Object>} areas Catálogo público de áreas.
   * @param {Object=} referencePeriod Período opcional; por padrão usa o semestre atual.
   * @returns {{period:Object,byArea:Object}}
   */
  getAreaTeacherStatistics: function(areas, referencePeriod) {
    const sourceAreas = Array.isArray(areas) ? areas : [];
    const period = TeacherAreasService.normalizeReferencePeriod(referencePeriod);
    const spreadsheet = TeacherAreasService._getSpreadsheetOrThrow();
    const assignmentSheet = TeacherAreasService._getSheetOrThrow(
      spreadsheet,
      TEACHER_AREAS_CONFIG.associationSheetName
    );
    const controlSheet = TeacherAreasService._getSheetOrThrow(
      spreadsheet,
      TEACHER_AREAS_CONFIG.controlSheetName
    );
    TeacherAreasService._assertHeaders(
      assignmentSheet,
      TEACHER_AREAS_CONFIG.associationHeaders
    );
    TeacherAreasService._assertHeaders(controlSheet, TEACHER_AREAS_CONFIG.controlHeaders);

    const controls = TeacherAreasService._readControls(controlSheet);
    const activeTeachers = {};
    Dao.extractTeacherRegistryRaw().forEach(function(teacher) {
      const registration = TeacherAreasService.normalizeRegistration(teacher.registration);
      if (!controls[registration] || controls[registration].active !== false) {
        activeTeachers[registration] = true;
      }
    });
    return {
      period: period,
      byArea: TeacherAreasService.buildAreaTeacherCounts(
        sourceAreas,
        TeacherAreasService._readAssignments(assignmentSheet),
        activeTeachers,
        period
      )
    };
  },

  /**
   * Agrega matrículas únicas por área sem acessar planilhas. A função pura é
   * compartilhada com a suíte de testes da contagem exibida nos cartões.
   *
   * @param {Array<Object>} areas Catálogo de áreas.
   * @param {Array<Object>} assignments Associações já normalizadas.
   * @param {Object} activeTeachers Mapa de matrículas docentes ativas.
   * @param {{year:string,semester:string}} period Período da contagem.
   * @returns {Object} Contagens por ID de área.
   */
  buildAreaTeacherCounts: function(areas, assignments, activeTeachers, period) {
    const sourceAreas = Array.isArray(areas) ? areas : [];
    const sourceAssignments = Array.isArray(assignments) ? assignments : [];
    const eligibleTeachers = activeTeachers || {};
    const directSets = {};
    sourceAreas.forEach(function(area) { directSets[area.id] = {}; });

    sourceAssignments.forEach(function(assignment) {
      if (!directSets[assignment.areaId] || !eligibleTeachers[assignment.registration]) return;
      if (!TeacherAreasService.assignmentAppliesToYear(
        assignment,
        period.year,
        period.semester
      )) return;
      directSets[assignment.areaId][assignment.registration] = true;
    });

    const childrenByParent = {};
    sourceAreas.forEach(function(area) {
      if (!area.parentId) return;
      if (!childrenByParent[area.parentId]) childrenByParent[area.parentId] = [];
      childrenByParent[area.parentId].push(area.id);
    });
    const byArea = {};
    sourceAreas.forEach(function(area) {
      const direct = directSets[area.id] || {};
      const aggregated = {};
      Object.keys(direct).forEach(function(registration) { aggregated[registration] = true; });
      if (!area.parentId) {
        (childrenByParent[area.id] || []).forEach(function(childId) {
          Object.keys(directSets[childId] || {}).forEach(function(registration) {
            aggregated[registration] = true;
          });
        });
      }
      byArea[area.id] = {
        directTeacherCount: Object.keys(direct).length,
        teacherCount: Object.keys(aggregated).length
      };
    });
    return byArea;
  },

  /**
   * Resume as associações ativas que seriam encerradas por uma inativação.
   * Esta função não altera a planilha.
   *
   * @param {Spreadsheet} spreadsheet Planilha ativa.
   * @param {Array<string>} areaIds IDs afetados.
   * @returns {{assignmentCount:number,teacherCount:number,assignmentsByArea:Object}}
   */
  getInactivationImpactForAreaIds: function(spreadsheet, areaIds) {
    const ids = (Array.isArray(areaIds) ? areaIds : []).map(String);
    const sheet = TeacherAreasService._getSheetOrThrow(
      spreadsheet,
      TEACHER_AREAS_CONFIG.associationSheetName
    );
    TeacherAreasService._assertHeaders(sheet, TEACHER_AREAS_CONFIG.associationHeaders);
    const assignments = TeacherAreasService._readAssignments(sheet).filter(function(item) {
      return item.active && ids.indexOf(item.areaId) >= 0;
    });
    const teachers = {};
    const assignmentsByArea = {};
    assignments.forEach(function(item) {
      teachers[item.registration] = true;
      assignmentsByArea[item.areaId] = (assignmentsByArea[item.areaId] || 0) + 1;
    });
    return {
      assignmentCount: assignments.length,
      teacherCount: Object.keys(teachers).length,
      assignmentsByArea: assignmentsByArea
    };
  },

  /**
   * Encerra associações ativas sem adquirir um segundo bloqueio de script.
   * Deve ser chamado por uma operação que já possua o bloqueio global.
   *
   * @param {Spreadsheet} spreadsheet Planilha ativa.
   * @param {Array<string>} areaIds IDs afetados.
   * @param {Object} referencePeriod Último período válido.
   * @returns {{assignmentCount:number,teacherCount:number,period:Object}}
   */
  deactivateAssignmentsForAreaIdsUnlocked: function(spreadsheet, areaIds, referencePeriod) {
    const period = TeacherAreasService.normalizeReferencePeriod(referencePeriod);
    const ids = (Array.isArray(areaIds) ? areaIds : []).map(String);
    const sheet = TeacherAreasService._getSheetOrThrow(
      spreadsheet,
      TEACHER_AREAS_CONFIG.associationSheetName
    );
    TeacherAreasService._assertHeaders(sheet, TEACHER_AREAS_CONFIG.associationHeaders);
    const assignments = TeacherAreasService._readAssignments(sheet).filter(function(item) {
      return item.active && ids.indexOf(item.areaId) >= 0;
    });
    const teachers = {};
    const now = new Date();
    assignments.forEach(function(item) {
      teachers[item.registration] = true;
      TeacherAreasService._writeAssignmentAtRow(sheet, item.sourceRow, Object.assign({}, item, {
        endYear: period.year,
        endSemester: period.semester,
        active: false,
        updatedAt: now
      }));
    });
    return {
      assignmentCount: assignments.length,
      teacherCount: Object.keys(teachers).length,
      period: period
    };
  },

  /** @private */
  _readAreaCatalogSafely: function() {
    try {
      if (typeof KnowledgeAreasService === 'undefined') {
        return { available: false, areas: [] };
      }
      const result = KnowledgeAreasService.list();
      if (!result.health.ok) {
        TeacherAreasLog.write('WARNING', 'area_catalog_integrity_problem', {
          problems: result.health.problems
        });
        return { available: true, areas: [] };
      }
      return { available: true, areas: result.areas };
    } catch (error) {
      TeacherAreasLog.write('WARNING', 'area_catalog_unavailable_for_dashboard', {
        message: error && error.message ? error.message : String(error)
      });
      return { available: false, areas: [] };
    }
  },

  /** @private */
  _readAssignmentsSafely: function(spreadsheet) {
    try {
      const sheet = spreadsheet.getSheetByName(TEACHER_AREAS_CONFIG.associationSheetName);
      if (!sheet) return [];
      TeacherAreasService._assertHeaders(sheet, TEACHER_AREAS_CONFIG.associationHeaders);
      return TeacherAreasService._readAssignments(sheet);
    } catch (error) {
      TeacherAreasLog.write('WARNING', 'teacher_area_assignments_unavailable_for_dashboard', {
        message: error && error.message ? error.message : String(error)
      });
      return [];
    }
  },

  /** @private */
  _readControlsSafely: function(spreadsheet) {
    try {
      const sheet = spreadsheet.getSheetByName(TEACHER_AREAS_CONFIG.controlSheetName);
      if (!sheet) return {};
      TeacherAreasService._assertHeaders(sheet, TEACHER_AREAS_CONFIG.controlHeaders);
      return TeacherAreasService._readControls(sheet);
    } catch (error) {
      TeacherAreasLog.write('WARNING', 'teacher_controls_unavailable_for_dashboard', {
        message: error && error.message ? error.message : String(error)
      });
      return {};
    }
  },

  /** @private */
  _readAssignments: function(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    const values = sheet.getRange(
      2,
      1,
      lastRow - 1,
      TEACHER_AREAS_CONFIG.associationHeaders.length
    ).getValues();
    const result = [];
    values.forEach(function(row, index) {
      if (!TeacherAreasService._associationRowHasMeaningfulData(row)) return;
      result.push({
        id: String(row[0] || '').trim(),
        registration: TeacherAreasService.normalizeRegistration(row[1]),
        areaId: String(row[2] || '').trim(),
        startYear: TeacherAreasService._normalizeStoredYear(row[3]),
        endYear: TeacherAreasService._normalizeStoredYear(row[4]),
        active: TeacherAreasService._toBoolean(row[5], false),
        createdAt: TeacherAreasService._toDateOrNull(row[6]),
        updatedAt: TeacherAreasService._toDateOrNull(row[7]),
        endSemester: TeacherAreasService._normalizeSemester(row[8]),
        sourceRow: index + 2
      });
    });
    return result;
  },

  /** @private */
  _readControls: function(sheet) {
    const rows = TeacherAreasService._readControlRows(sheet);
    const map = {};
    rows.forEach(function(item) {
      if (map[item.registration]) {
        throw new Error('DOCENTES_CONTROLE possui matrícula duplicada: ' + item.registration + '.');
      }
      map[item.registration] = item;
    });
    return map;
  },

  /** @private */
  _readControlRows: function(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    const values = sheet.getRange(
      2,
      1,
      lastRow - 1,
      TEACHER_AREAS_CONFIG.controlHeaders.length
    ).getValues();
    const result = [];
    values.forEach(function(row, index) {
      if (!TeacherAreasService._controlRowHasMeaningfulData(row)) return;
      result.push({
        registration: TeacherAreasService.normalizeRegistration(row[0]),
        active: TeacherAreasService._toBoolean(row[1], true),
        inactiveReason: TeacherAreasService._cleanText(row[2]),
        inactiveDate: TeacherAreasService._toDateOrNull(row[3]),
        createdAt: TeacherAreasService._toDateOrNull(row[4]),
        updatedAt: TeacherAreasService._toDateOrNull(row[5]),
        sourceRow: index + 2
      });
    });
    return result;
  },

  /** @private */
  _toPublicAssignment: function(assignment, areasById) {
    const area = areasById[assignment.areaId];
    if (!area) return null;
    const parent = area.parentId ? areasById[area.parentId] : null;
    return {
      id: assignment.id,
      registration: assignment.registration,
      areaId: area.id,
      areaName: area.name,
      areaActive: Boolean(area.active),
      parentAreaId: parent ? parent.id : '',
      parentAreaName: parent ? parent.name : '',
      parentAreaActive: parent ? Boolean(parent.active) : true,
      level: parent ? 'SUBAREA' : 'MAIN',
      path: parent ? parent.name + ' › ' + area.name : area.name,
      startYear: assignment.startYear || '',
      endYear: assignment.endYear || '',
      endSemester: assignment.endSemester || '',
      active: Boolean(assignment.active),
      createdAt: TeacherAreasService._formatDate(assignment.createdAt),
      updatedAt: TeacherAreasService._formatDate(assignment.updatedAt)
    };
  },

  /** @private */
  _withDefaultTeacherState: function(teacher) {
    return Object.assign({}, teacher, {
      registration: TeacherAreasService.normalizeRegistration(teacher.registration),
      active: true,
      inactiveReason: '',
      inactiveDate: '',
      areaAssignments: []
    });
  },

  /** @private */
  _comparePublicAssignments: function(first, second) {
    const firstPath = String(first.path || first.areaName || '');
    const secondPath = String(second.path || second.areaName || '');
    const pathComparison = firstPath.localeCompare(
      secondPath,
      'pt-BR',
      { sensitivity: 'base', numeric: true }
    );
    if (pathComparison !== 0) return pathComparison;
    return String(first.startYear || '').localeCompare(
      String(second.startYear || ''),
      'pt-BR',
      { numeric: true }
    );
  },

  /** @private */
  _assignmentToRow: function(item) {
    return [
      item.id,
      item.registration,
      item.areaId,
      item.startYear || '',
      item.endYear || '',
      Boolean(item.active),
      item.createdAt || new Date(),
      item.updatedAt || new Date(),
      item.endSemester || ''
    ];
  },

  /** @private */
  _writeAssignmentAtRow: function(sheet, rowNumber, item) {
    sheet.getRange(
      rowNumber,
      1,
      1,
      TEACHER_AREAS_CONFIG.associationHeaders.length
    ).setValues([TeacherAreasService._assignmentToRow(item)]);
  },

  /** @private */
  _writeControlAtRow: function(sheet, rowNumber, item) {
    sheet.getRange(
      rowNumber,
      1,
      1,
      TEACHER_AREAS_CONFIG.controlHeaders.length
    ).setValues([[
      item.registration,
      Boolean(item.active),
      item.inactiveReason || '',
      item.inactiveDate || '',
      item.createdAt || new Date(),
      item.updatedAt || new Date()
    ]]);
  },

  /** @private */
  _associationRowHasMeaningfulData: function(row) {
    const source = Array.isArray(row) ? row : [];
    const structural = [0, 1, 2, 3, 4, 6, 7, 8].some(function(index) {
      const value = source[index];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
    return structural || source[5] === true;
  },

  /** @private */
  _controlRowHasMeaningfulData: function(row) {
    const source = Array.isArray(row) ? row : [];
    const structural = [0, 2, 3, 4, 5].some(function(index) {
      const value = source[index];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
    return structural || source[1] === true;
  },

  /** @private */
  _findAppendRow: function(sheet, width, meaningfulPredicate) {
    const dataRows = Math.max(sheet.getMaxRows() - 1, 0);
    if (dataRows === 0) return 2;
    const values = sheet.getRange(2, 1, dataRows, width).getValues();
    let last = -1;
    values.forEach(function(row, index) {
      if (meaningfulPredicate(row)) last = index;
    });
    return last < 0 ? 2 : last + 3;
  },

  /** @private */
  _ensureRows: function(sheet, requiredLastRow) {
    const missing = Number(requiredLastRow) - sheet.getMaxRows();
    if (missing > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missing);
  },

  /** @private */
  _periodsOverlap: function(firstStart, firstEnd, secondStart, secondEnd) {
    const minimum = 0;
    const maximum = 9999;
    const firstStartNumber = firstStart ? Number(firstStart) : minimum;
    const firstEndNumber = firstEnd ? Number(firstEnd) : maximum;
    const secondStartNumber = secondStart ? Number(secondStart) : minimum;
    const secondEndNumber = secondEnd ? Number(secondEnd) : maximum;
    return firstStartNumber <= secondEndNumber && secondStartNumber <= firstEndNumber;
  },

  /** @private */
  _normalizeOptionalYear: function(value, label) {
    const normalized = TeacherAreasService._normalizeStoredYear(value);
    if (!normalized) return '';
    if (!/^\d{4}$/.test(normalized)) {
      throw TeacherAreasService._validationError(
        (label || 'Ano') + ' deve possuir quatro dígitos.'
      );
    }
    return normalized;
  },

  /** @private */
  _normalizeOptionalSemester: function(value, label) {
    if (value === null || value === undefined || String(value).trim() === '') return '';
    const normalized = String(value).trim().replace(/\.0+$/, '');
    if (normalized !== '1' && normalized !== '2') {
      throw TeacherAreasService._validationError(
        (label || 'Semestre') + ' deve ser 1 ou 2.'
      );
    }
    return normalized;
  },

  /** @private */
  _normalizeStoredYear: function(value) {
    if (value === null || value === undefined || String(value).trim() === '') return '';
    let normalized = String(value).trim();
    if (/^\d{4}\.0+$/.test(normalized)) normalized = normalized.split('.')[0];
    return normalized;
  },

  /** @private */
  _normalizeSemester: function(value) {
    const normalized = String(value === null || value === undefined ? '' : value)
      .trim()
      .replace(/\.0+$/, '');
    return normalized === '1' || normalized === '2' ? normalized : '';
  },

  /**
   * Normaliza matrícula sem converter o valor em número.
   *
   * @param {*} value Valor bruto.
   * @returns {string} Matrícula canônica.
   */
  normalizeRegistration: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^0-9A-Z]/g, '');
  },

  /** @private */
  _getSpreadsheetOrThrow: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('Nenhuma planilha ativa foi encontrada.');
    return spreadsheet;
  },

  /** @private */
  _getSheetOrThrow: function(spreadsheet, sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(
        'A aba ' + sheetName + ' não existe. Execute o instalador da versão 9.8.'
      );
    }
    return sheet;
  },

  /** @private */
  _assertHeaders: function(sheet, expectedHeaders) {
    const actual = sheet.getRange(1, 1, 1, expectedHeaders.length)
      .getDisplayValues()[0];
    const problems = [];
    expectedHeaders.forEach(function(expected, index) {
      const received = String(actual[index] || '').trim();
      if (received !== expected) {
        problems.push(
          'coluna ' + (index + 1) + ': esperado "' + expected
          + '", encontrado "' + (received || '[vazio]') + '"'
        );
      }
    });
    if (problems.length > 0) {
      throw new Error(
        'A aba ' + sheet.getName() + ' possui cabeçalhos incompatíveis: '
        + problems.join(' | ') + '.'
      );
    }
  },

  /** @private */
  _withLock: function(callback) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(TEACHER_AREAS_CONFIG.lockTimeoutMilliseconds)) {
      throw TeacherAreasService._validationError(
        'Não foi possível obter acesso exclusivo. Tente novamente após a outra operação terminar.'
      );
    }
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  },

  /** @private */
  _cleanText: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .replace(/\s+/g, ' ');
  },

  /** @private */
  _toBoolean: function(value, defaultValue) {
    if (value === true || value === false) return value;
    if (value === 1 || String(value).trim() === '1') return true;
    if (value === 0 || String(value).trim() === '0') return false;
    const normalized = String(value === null || value === undefined ? '' : value)
      .trim()
      .toUpperCase();
    if (['TRUE', 'VERDADEIRO', 'SIM', 'S', 'ATIVO', 'ATIVA'].indexOf(normalized) >= 0) {
      return true;
    }
    if (['FALSE', 'FALSO', 'NAO', 'NÃO', 'N', 'INATIVO', 'INATIVA'].indexOf(normalized) >= 0) {
      return false;
    }
    return Boolean(defaultValue);
  },

  /** @private */
  _toDateOrNull: function(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return value;
    }
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  },

  /** @private */
  _formatDate: function(value) {
    const date = TeacherAreasService._toDateOrNull(value);
    return date ? date.toISOString() : '';
  },

  /** @private */
  _validationError: function(message) {
    const error = new Error(message);
    error.name = 'TeacherAreaValidationError';
    error.isBusinessValidation = true;
    return error;
  }
};

/** Retorna os dados do modal de associação. */
function getTeacherAreaManagementData(areaId) {
  try {
    AccessControlService.requireAdministrator();
    const result = TeacherAreasService.listManagementData(areaId || '');
    return JSON.stringify({
      status: 'success',
      management: result,
      data: result,
      meta: { version: TEACHER_AREAS_CONFIG.version }
    });
  } catch (error) {
    TeacherAreasLog.write('ERROR', 'teacher_area_management_load_failed', {
      areaId: String(areaId || ''),
      message: error && error.message ? error.message : String(error)
    });
    return JSON.stringify({
      status: 'error',
      message: error && error.message ? error.message : String(error)
    });
  }
}

/** Associa uma área a vários docentes. */
function addTeacherAreaAssignments(payload) {
  try {
    AccessControlService.requireAdministrator();
    const result = TeacherAreasService.addAssignments(payload || {});
    return JSON.stringify(Object.assign({ status: 'success' }, result));
  } catch (error) {
    const validation = Boolean(error && error.isBusinessValidation);
    TeacherAreasLog.write(validation ? 'WARNING' : 'ERROR', 'teacher_area_add_failed', {
      message: error && error.message ? error.message : String(error),
      falhaEsperada: validation,
      origemExecucao: 'aplicacao'
    });
    return JSON.stringify({
      status: 'error',
      message: error && error.message ? error.message : String(error),
      validation: validation
    });
  }
}

/** Encerra uma associação preservando o histórico. */
function endTeacherAreaAssignment(assignmentId, endYear, endSemester) {
  try {
    AccessControlService.requireAdministrator();
    const result = TeacherAreasService.endAssignment(assignmentId, endYear, endSemester);
    return JSON.stringify(Object.assign({ status: 'success' }, result));
  } catch (error) {
    const validation = Boolean(error && error.isBusinessValidation);
    TeacherAreasLog.write(validation ? 'WARNING' : 'ERROR', 'teacher_area_end_failed', {
      assignmentId: String(assignmentId || ''),
      endYear: String(endYear || ''),
      endSemester: String(endSemester || ''),
      message: error && error.message ? error.message : String(error),
      falhaEsperada: validation,
      origemExecucao: 'aplicacao'
    });
    return JSON.stringify({
      status: 'error',
      message: error && error.message ? error.message : String(error),
      validation: validation
    });
  }
}

/** Reativa uma associação encerrada. */
function reactivateTeacherAreaAssignment(assignmentId) {
  try {
    AccessControlService.requireAdministrator();
    const result = TeacherAreasService.reactivateAssignment(assignmentId);
    return JSON.stringify(Object.assign({ status: 'success' }, result));
  } catch (error) {
    const validation = Boolean(error && error.isBusinessValidation);
    TeacherAreasLog.write(validation ? 'WARNING' : 'ERROR', 'teacher_area_reactivate_failed', {
      assignmentId: String(assignmentId || ''),
      message: error && error.message ? error.message : String(error),
      falhaEsperada: validation,
      origemExecucao: 'aplicacao'
    });
    return JSON.stringify({
      status: 'error',
      message: error && error.message ? error.message : String(error),
      validation: validation
    });
  }
}

/** Altera a situação administrativa interna do docente. */
function setTeacherActive(registration, active, reason) {
  try {
    AccessControlService.requireAdministrator();
    const result = TeacherAreasService.setTeacherActive(registration, active, reason || '');
    return JSON.stringify(Object.assign({ status: 'success' }, result));
  } catch (error) {
    const validation = Boolean(error && error.isBusinessValidation);
    TeacherAreasLog.write(validation ? 'WARNING' : 'ERROR', 'teacher_status_change_failed', {
      registration: String(registration || ''),
      desiredActive: Boolean(active),
      message: error && error.message ? error.message : String(error),
      falhaEsperada: validation,
      origemExecucao: 'aplicacao'
    });
    return JSON.stringify({
      status: 'error',
      message: error && error.message ? error.message : String(error),
      validation: validation
    });
  }
}
