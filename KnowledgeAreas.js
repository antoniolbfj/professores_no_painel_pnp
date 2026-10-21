/**
 * @file KnowledgeAreas.gs
 * @fileoverview Cadastro hierárquico de Áreas de Conhecimento da versão 9.8.
 * @version 10.0.9
 *
 * A interface trabalha com dois níveis: área principal e subárea. Os registros
 * recebem IDs estáveis usados pela associação muitos-para-muitos entre
 * docentes e áreas, sem depender dos nomes exibidos.
 */

/**
 * Contrato persistente do cadastro.
 *
 * @const {Object}
 */
const KNOWLEDGE_AREAS_CONFIG = Object.freeze({
  version: '10.0.9',
  sheetName: 'AREAS_CONHECIMENTO',
  headers: Object.freeze([
    'ID_Area',
    'Nome_Area',
    'ID_Area_Pai',
    'Descricao',
    'Ativa',
    'Ordem_Exibicao',
    'Criado_Em',
    'Atualizado_Em'
  ]),
  lockTimeoutMilliseconds: 30000,
  defaultOrderStep: 10
});

/**
 * Logger estruturado do módulo.
 *
 * @const {Object}
 */
const KnowledgeAreasLog = Object.freeze({
  /**
   * @param {'INFO'|'WARNING'|'ERROR'} level Nível do evento.
   * @param {string} event Identificador estável.
   * @param {Object=} metadata Metadados adicionais.
   */
  write: function(level, event, metadata) {
    Logger.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level,
      event: event,
      appVersion: KNOWLEDGE_AREAS_CONFIG.version,
      origemExecucao: 'aplicacao',
      metadata: metadata || {}
    }));
  }
});

/**
 * Serviço de domínio e persistência das Áreas de Conhecimento.
 *
 * @const {Object}
 */
const KnowledgeAreasService = {
  /**
   * Lista os registros e monta a hierarquia usada pelo frontend.
   *
   * @returns {{areas:Array<Object>,hierarchy:Array<Object>,summary:Object,health:Object}}
   */
  list: function() {
    const sheet = KnowledgeAreasService._getSheetOrThrow();
    KnowledgeAreasService._assertHeaders(sheet);
    const areas = KnowledgeAreasService._readAreas(sheet);
    const health = KnowledgeAreasService.validateCollection(areas);

    return {
      areas: areas.map(KnowledgeAreasService._toPublicArea),
      hierarchy: KnowledgeAreasService.buildHierarchy(areas),
      summary: KnowledgeAreasService._buildSummary(areas),
      health: health
    };
  },

  /**
   * Cria ou edita uma área.
   *
   * @param {Object} payload Dados enviados pela interface.
   * @returns {{saved:Object,areas:Array<Object>,hierarchy:Array<Object>,summary:Object}}
   */
  save: function(payload) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(KNOWLEDGE_AREAS_CONFIG.lockTimeoutMilliseconds)) {
      throw KnowledgeAreasService._validationError(
        'Não foi possível obter acesso exclusivo ao cadastro. Tente novamente após a outra operação terminar.'
      );
    }

    try {
      const sheet = KnowledgeAreasService._getSheetOrThrow();
      KnowledgeAreasService._assertHeaders(sheet);
      const areas = KnowledgeAreasService._readAreas(sheet);
      KnowledgeAreasService._assertCollectionIntegrityBeforeMutation(areas);
      const candidate = KnowledgeAreasService._normalizePayload(payload);
      const existingIndex = candidate.id
        ? areas.findIndex(function(area) { return area.id === candidate.id; })
        : -1;
      const existing = existingIndex >= 0 ? areas[existingIndex] : null;

      if (candidate.id && !existing) {
        throw KnowledgeAreasService._validationError(
          'A área informada não foi encontrada. Atualize a listagem e tente novamente.'
        );
      }

      KnowledgeAreasService._validateCandidate(candidate, existing, areas);

      const deactivating = Boolean(existing && existing.active && !candidate.active);
      const cascadeTargets = deactivating
        ? KnowledgeAreasService._resolveCascadeTargets(areas, existing.id)
        : [];
      const cascadeIds = cascadeTargets.map(function(area) { return area.id; });
      const referencePeriod = deactivating
        ? TeacherAreasService.normalizeReferencePeriod(payload && payload.referencePeriod)
        : null;
      const cascadeImpact = deactivating
        ? TeacherAreasService.getInactivationImpactForAreaIds(sheet.getParent(), cascadeIds)
        : null;

      const now = new Date();
      const saved = {
        id: existing ? existing.id : Utilities.getUuid(),
        name: candidate.name,
        parentId: candidate.parentId,
        description: candidate.description,
        active: candidate.active,
        order: candidate.order === null
          ? KnowledgeAreasService._nextOrder(areas, candidate.parentId)
          : candidate.order,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
        sourceRow: existing ? existing.sourceRow : null
      };

      if (existing) {
        KnowledgeAreasService._writeAreaAtRow(sheet, existing.sourceRow, saved);
      } else {
        const targetRow = KnowledgeAreasService._findAppendRow(sheet);
        saved.sourceRow = targetRow;
        KnowledgeAreasService._ensureRowAvailable(sheet, targetRow);
        KnowledgeAreasService._writeAreaAtRow(sheet, targetRow, saved);
      }

      if (deactivating) {
        cascadeTargets.forEach(function(area) {
          if (area.id === saved.id || !area.active) return;
          KnowledgeAreasService._writeAreaAtRow(sheet, area.sourceRow, Object.assign({}, area, {
            active: false,
            updatedAt: now
          }));
        });
        const assignmentImpact = TeacherAreasService.deactivateAssignmentsForAreaIdsUnlocked(
          sheet.getParent(),
          cascadeIds,
          referencePeriod
        );
        cascadeImpact.assignmentCount = assignmentImpact.assignmentCount;
        cascadeImpact.teacherCount = assignmentImpact.teacherCount;
        cascadeImpact.period = assignmentImpact.period;
        cascadeImpact.areaCount = cascadeTargets.length;
        cascadeImpact.subareaCount = cascadeTargets.filter(function(area) {
          return Boolean(area.parentId);
        }).length;
      }

      SpreadsheetApp.flush();
      const persisted = KnowledgeAreasService._readAreas(sheet);
      const persistedArea = persisted.find(function(area) { return area.id === saved.id; });
      if (!persistedArea) {
        throw new Error('A gravação foi concluída, mas o registro não pôde ser confirmado na planilha.');
      }

      const integrity = KnowledgeAreasService.validateCollection(persisted);
      if (!integrity.ok) {
        throw new Error(
          'A gravação gerou uma inconsistência de integridade: ' + integrity.problems.join(' | ')
        );
      }

      KnowledgeAreasLog.write('INFO', existing
        ? 'knowledge_area_updated'
        : 'knowledge_area_created', {
        areaId: persistedArea.id,
        parentId: persistedArea.parentId || null,
        active: persistedArea.active,
        order: persistedArea.order
      });

      return {
        saved: KnowledgeAreasService._toPublicArea(persistedArea),
        areas: persisted.map(KnowledgeAreasService._toPublicArea),
        hierarchy: KnowledgeAreasService.buildHierarchy(persisted),
        summary: KnowledgeAreasService._buildSummary(persisted),
        cascade: cascadeImpact
      };
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Ativa ou inativa um registro sem excluí-lo.
   *
   * @param {string} areaId ID estável da área.
   * @param {boolean} active Situação desejada.
   * @param {Object=} referencePeriod Último período válido quando houver inativação.
   * @returns {{saved:Object,areas:Array<Object>,hierarchy:Array<Object>,summary:Object,cascade:Object}}
   */
  setActive: function(areaId, active, referencePeriod) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(KNOWLEDGE_AREAS_CONFIG.lockTimeoutMilliseconds)) {
      throw KnowledgeAreasService._validationError(
        'Não foi possível obter acesso exclusivo ao cadastro. Tente novamente após a outra operação terminar.'
      );
    }

    try {
      const sheet = KnowledgeAreasService._getSheetOrThrow();
      KnowledgeAreasService._assertHeaders(sheet);
      const areas = KnowledgeAreasService._readAreas(sheet);
      KnowledgeAreasService._assertCollectionIntegrityBeforeMutation(areas);
      const id = String(areaId || '').trim();
      const target = areas.find(function(area) { return area.id === id; });

      if (!target) {
        throw KnowledgeAreasService._validationError(
          'A área informada não foi encontrada. Atualize a listagem e tente novamente.'
        );
      }

      const desiredActive = KnowledgeAreasService._toBoolean(active, false);
      if (target.active === desiredActive) {
        return {
          saved: KnowledgeAreasService._toPublicArea(target),
          areas: areas.map(KnowledgeAreasService._toPublicArea),
          hierarchy: KnowledgeAreasService.buildHierarchy(areas),
          summary: KnowledgeAreasService._buildSummary(areas)
        };
      }

      if (desiredActive && target.parentId) {
        const parent = areas.find(function(area) { return area.id === target.parentId; });
        if (!parent || !parent.active) {
          throw KnowledgeAreasService._validationError(
            'A subárea não pode ser reativada enquanto sua área principal estiver inativa.'
          );
        }
      }

      const cascadeTargets = !desiredActive
        ? KnowledgeAreasService._resolveCascadeTargets(areas, target.id)
        : [target];
      const cascadeIds = cascadeTargets.map(function(area) { return area.id; });
      const normalizedPeriod = !desiredActive
        ? TeacherAreasService.normalizeReferencePeriod(referencePeriod)
        : null;
      const cascadeImpact = !desiredActive
        ? TeacherAreasService.getInactivationImpactForAreaIds(sheet.getParent(), cascadeIds)
        : null;
      const now = new Date();
      const updated = Object.assign({}, target, {
        active: desiredActive,
        updatedAt: now
      });
      KnowledgeAreasService._writeAreaAtRow(sheet, target.sourceRow, updated);
      if (!desiredActive) {
        cascadeTargets.forEach(function(area) {
          if (area.id === target.id || !area.active) return;
          KnowledgeAreasService._writeAreaAtRow(sheet, area.sourceRow, Object.assign({}, area, {
            active: false,
            updatedAt: now
          }));
        });
        const assignmentImpact = TeacherAreasService.deactivateAssignmentsForAreaIdsUnlocked(
          sheet.getParent(),
          cascadeIds,
          normalizedPeriod
        );
        cascadeImpact.assignmentCount = assignmentImpact.assignmentCount;
        cascadeImpact.teacherCount = assignmentImpact.teacherCount;
        cascadeImpact.period = assignmentImpact.period;
        cascadeImpact.areaCount = cascadeTargets.length;
        cascadeImpact.subareaCount = cascadeTargets.filter(function(area) {
          return Boolean(area.parentId);
        }).length;
      }
      SpreadsheetApp.flush();

      const persisted = KnowledgeAreasService._readAreas(sheet);
      const persistedArea = persisted.find(function(area) { return area.id === target.id; });
      const integrity = KnowledgeAreasService.validateCollection(persisted);
      if (!persistedArea || !integrity.ok) {
        throw new Error('A mudança de situação não pôde ser confirmada com integridade.');
      }

      KnowledgeAreasLog.write('INFO', desiredActive
        ? 'knowledge_area_activated'
        : 'knowledge_area_deactivated', {
        areaId: persistedArea.id,
        parentId: persistedArea.parentId || null
      });

      return {
        saved: KnowledgeAreasService._toPublicArea(persistedArea),
        areas: persisted.map(KnowledgeAreasService._toPublicArea),
        hierarchy: KnowledgeAreasService.buildHierarchy(persisted),
        summary: KnowledgeAreasService._buildSummary(persisted),
        cascade: cascadeImpact
      };
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Monta uma árvore com dois níveis, preservando áreas principais sem filhos.
   *
   * @param {Array<Object>} areas Registros internos.
   * @returns {Array<Object>} Áreas principais com a propriedade children.
   */
  buildHierarchy: function(areas) {
    const source = Array.isArray(areas) ? areas : [];
    const parents = source.filter(function(area) { return !area.parentId; })
      .slice()
      .sort(KnowledgeAreasService._compareAreas);
    const childrenByParent = {};

    source.filter(function(area) { return Boolean(area.parentId); })
      .forEach(function(area) {
        if (!childrenByParent[area.parentId]) childrenByParent[area.parentId] = [];
        childrenByParent[area.parentId].push(area);
      });

    return parents.map(function(parent) {
      const publicParent = KnowledgeAreasService._toPublicArea(parent);
      publicParent.children = (childrenByParent[parent.id] || [])
        .slice()
        .sort(KnowledgeAreasService._compareAreas)
        .map(KnowledgeAreasService._toPublicArea);
      publicParent.childCount = publicParent.children.length;
      publicParent.activeChildCount = publicParent.children.filter(function(child) {
        return child.active;
      }).length;
      return publicParent;
    });
  },

  /**
   * Retorna o impacto de uma inativação sem alterar dados.
   *
   * @param {string} areaId ID da área.
   * @param {Object=} referencePeriod Período proposto.
   * @returns {Object} Resumo para confirmação da interface.
   */
  getInactivationImpact: function(areaId, referencePeriod) {
    const sheet = KnowledgeAreasService._getSheetOrThrow();
    KnowledgeAreasService._assertHeaders(sheet);
    const areas = KnowledgeAreasService._readAreas(sheet);
    const id = String(areaId || '').trim();
    const target = areas.find(function(area) { return area.id === id; });
    if (!target) {
      throw KnowledgeAreasService._validationError('A área informada não foi encontrada.');
    }
    const targets = KnowledgeAreasService._resolveCascadeTargets(areas, id);
    const ids = targets.map(function(area) { return area.id; });
    const period = TeacherAreasService.normalizeReferencePeriod(referencePeriod);
    const impact = TeacherAreasService.getInactivationImpactForAreaIds(sheet.getParent(), ids);
    return {
      areaId: target.id,
      areaName: target.name,
      areaCount: targets.length,
      subareaCount: targets.filter(function(area) { return Boolean(area.parentId); }).length,
      activeSubareaCount: targets.filter(function(area) {
        return Boolean(area.parentId) && area.active;
      }).length,
      assignmentCount: impact.assignmentCount,
      teacherCount: impact.teacherCount,
      assignmentsByArea: impact.assignmentsByArea,
      period: period,
      affectedAreas: targets.map(function(area) {
        return {
          id: area.id,
          name: area.name,
          parentId: area.parentId || '',
          active: area.active,
          assignmentCount: impact.assignmentsByArea[area.id] || 0
        };
      })
    };
  },

  /** @private */
  _resolveCascadeTargets: function(areas, areaId) {
    const source = Array.isArray(areas) ? areas : [];
    const found = {};
    const queue = [String(areaId || '').trim()];
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id || found[id]) continue;
      const area = source.find(function(item) { return item.id === id; });
      if (!area) continue;
      found[id] = area;
      source.forEach(function(item) {
        if (item.parentId === id && !found[item.id]) queue.push(item.id);
      });
    }
    return Object.keys(found).map(function(id) { return found[id]; });
  },

  /**
   * Valida a coleção completa sem gravar dados.
   * Adequado para health check e testes unitários.
   *
   * @param {Array<Object>} areas Registros internos.
   * @returns {{ok:boolean,problems:Array<string>,recordCount:number}}
   */
  validateCollection: function(areas) {
    const source = Array.isArray(areas) ? areas : [];
    const problems = [];
    const byId = {};
    const duplicateKeys = {};

    source.forEach(function(area) {
      if (!area.id) {
        problems.push('Existe registro sem ID_Area na linha ' + (area.sourceRow || '?') + '.');
      } else if (byId[area.id]) {
        problems.push('ID_Area duplicado: ' + area.id + '.');
      } else {
        byId[area.id] = area;
      }

      if (!area.name) {
        problems.push('Existe registro sem Nome_Area na linha ' + (area.sourceRow || '?') + '.');
      }

      if (!Number.isInteger(area.order) || area.order < 1) {
        problems.push('Ordem_Exibicao inválida para "' + (area.name || area.id || '?') + '".');
      }

      const duplicateKey = KnowledgeAreasService._duplicateKey(area.name, area.parentId);
      if (duplicateKeys[duplicateKey]) {
        problems.push(
          'Nome duplicado no mesmo nível: "' + area.name + '".'
        );
      } else {
        duplicateKeys[duplicateKey] = true;
      }
    });

    source.forEach(function(area) {
      if (!area.parentId) return;
      const parent = byId[area.parentId];
      if (!parent) {
        problems.push('Área-pai inexistente para "' + area.name + '".');
        return;
      }
      if (parent.parentId) {
        problems.push('A área "' + area.name + '" está vinculada a outra subárea.');
      }
      if (area.id === area.parentId) {
        problems.push('A área "' + area.name + '" aponta para si mesma.');
      }
      if (area.active && !parent.active) {
        problems.push('A subárea ativa "' + area.name + '" possui área principal inativa.');
      }
    });

    return {
      ok: problems.length === 0,
      problems: problems,
      recordCount: source.length
    };
  },

  /**
   * Impede novas mutações quando a base já possui inconsistências manuais.
   * A proteção evita que uma gravação válida aparente corrigir ou agravar uma
   * estrutura que precisa primeiro ser diagnosticada.
   *
   * @param {Array<Object>} areas Coleção atual.
   * @private
   */
  _assertCollectionIntegrityBeforeMutation: function(areas) {
    const integrity = KnowledgeAreasService.validateCollection(areas);
    if (!integrity.ok) {
      throw new Error(
        'O cadastro de Áreas de Conhecimento possui inconsistências e foi bloqueado para gravação: '
        + integrity.problems.join(' | ')
      );
    }
  },

  /** @private */
  _normalizePayload: function(payload) {
    const source = payload || {};
    const orderText = source.order === null || source.order === undefined
      ? ''
      : String(source.order).trim();
    let order = null;
    if (orderText !== '') {
      order = Number(orderText);
      if (!Number.isInteger(order) || order < 1) {
        throw KnowledgeAreasService._validationError(
          'A ordem de exibição deve ser um número inteiro maior que zero.'
        );
      }
    }

    return {
      id: String(source.id || '').trim(),
      name: KnowledgeAreasService._cleanText(source.name),
      parentId: String(source.parentId || '').trim(),
      description: KnowledgeAreasService._cleanMultilineText(source.description),
      active: KnowledgeAreasService._toBoolean(source.active, true),
      order: order
    };
  },

  /** @private */
  _validateCandidate: function(candidate, existing, areas) {
    if (!candidate.name) {
      throw KnowledgeAreasService._validationError('Informe o nome da área de conhecimento.');
    }
    if (candidate.name.length > 180) {
      throw KnowledgeAreasService._validationError('O nome deve possuir no máximo 180 caracteres.');
    }
    if (candidate.description.length > 4000) {
      throw KnowledgeAreasService._validationError('A descrição deve possuir no máximo 4.000 caracteres.');
    }

    if (existing) {
      const existingIsChild = Boolean(existing.parentId);
      const candidateIsChild = Boolean(candidate.parentId);
      if (existingIsChild !== candidateIsChild) {
        throw KnowledgeAreasService._validationError(
          'O tipo do registro não pode ser alterado durante a edição. Crie um novo registro no nível desejado.'
        );
      }
    }

    if (candidate.parentId) {
      if (candidate.id && candidate.id === candidate.parentId) {
        throw KnowledgeAreasService._validationError('Uma área não pode ser sua própria área principal.');
      }
      const parent = areas.find(function(area) { return area.id === candidate.parentId; });
      if (!parent) {
        throw KnowledgeAreasService._validationError('A área principal selecionada não foi encontrada.');
      }
      if (parent.parentId) {
        throw KnowledgeAreasService._validationError(
          'Uma subárea só pode ser vinculada diretamente a uma área principal.'
        );
      }
      if (candidate.active && !parent.active) {
        throw KnowledgeAreasService._validationError(
          'Uma subárea ativa não pode ser vinculada a uma área principal inativa.'
        );
      }
    }

    const duplicate = areas.find(function(area) {
      if (existing && area.id === existing.id) return false;
      return KnowledgeAreasService._duplicateKey(area.name, area.parentId)
        === KnowledgeAreasService._duplicateKey(candidate.name, candidate.parentId);
    });
    if (duplicate) {
      throw KnowledgeAreasService._validationError(
        candidate.parentId
          ? 'Já existe uma subárea com esse nome dentro da área principal selecionada.'
          : 'Já existe uma área principal com esse nome.'
      );
    }

  },

  /** @private */
  _getSheetOrThrow: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error('Nenhuma planilha ativa foi encontrada.');
    }
    const sheet = spreadsheet.getSheetByName(KNOWLEDGE_AREAS_CONFIG.sheetName);
    if (!sheet) {
      throw new Error(
        'A aba ' + KNOWLEDGE_AREAS_CONFIG.sheetName
        + ' não existe. Execute o instalador da versão 9.8 antes de usar o cadastro.'
      );
    }
    return sheet;
  },

  /** @private */
  _assertHeaders: function(sheet) {
    const actual = sheet.getRange(1, 1, 1, KNOWLEDGE_AREAS_CONFIG.headers.length)
      .getDisplayValues()[0];
    const problems = [];
    KNOWLEDGE_AREAS_CONFIG.headers.forEach(function(expected, index) {
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
        'A aba ' + KNOWLEDGE_AREAS_CONFIG.sheetName
        + ' possui cabeçalhos incompatíveis: ' + problems.join(' | ') + '.'
      );
    }
  },

  /** @private */
  _readAreas: function(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    const values = sheet.getRange(
      2,
      1,
      lastRow - 1,
      KNOWLEDGE_AREAS_CONFIG.headers.length
    ).getValues();
    const result = [];

    values.forEach(function(row, index) {
      // A validação de checkbox aplicada pelo instalador faz uma célula vazia
      // da coluna Ativa ser lida como false. Esse false isolado não representa
      // um registro e deve ser ignorado. Qualquer outro dado preenchido mantém
      // a linha no diagnóstico, inclusive cadastros manuais incompletos.
      if (!KnowledgeAreasService._rowHasMeaningfulData(row)) return;

      result.push({
        id: String(row[0] || '').trim(),
        name: KnowledgeAreasService._cleanText(row[1]),
        parentId: String(row[2] || '').trim(),
        description: KnowledgeAreasService._cleanMultilineText(row[3]),
        active: KnowledgeAreasService._toBoolean(row[4], false),
        order: Number(row[5]),
        createdAt: KnowledgeAreasService._toDateOrNull(row[6]),
        updatedAt: KnowledgeAreasService._toDateOrNull(row[7]),
        sourceRow: index + 2
      });
    });

    return result;
  },


  /**
   * Indica se uma linha contém dados que caracterizam uma área.
   *
   * A coluna Ativa é tratada de forma especial: false sozinho é o estado
   * visual de um checkbox vazio preparado pelo instalador; true sozinho é
   * considerado dado para que uma linha manual incompleta seja diagnosticada.
   *
   * @param {Array<*>} row Valores das oito colunas do cadastro.
   * @returns {boolean} true quando a linha deve ser tratada como registro.
   * @private
   */
  _rowHasMeaningfulData: function(row) {
    const source = Array.isArray(row) ? row : [];
    const hasTextualOrStructuralData = [0, 1, 2, 3, 5, 6, 7].some(function(index) {
      const value = source[index];
      return value !== null
        && value !== undefined
        && String(value).trim() !== '';
    });

    if (hasTextualOrStructuralData) return true;
    return source[4] === true;
  },

  /**
   * Localiza a primeira linha livre após o último registro real.
   * Não usa getLastRow() como posição de gravação porque os checkboxes
   * preparados na coluna Ativa podem fazer linhas visualmente vazias serem
   * percebidas pelo Google Sheets como parte da região utilizada.
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Aba do cadastro.
   * @returns {number} Linha segura para inserir o próximo registro.
   * @private
   */
  _findAppendRow: function(sheet) {
    const dataRowCount = Math.max(sheet.getMaxRows() - 1, 0);
    if (dataRowCount === 0) return 2;

    const values = sheet.getRange(
      2,
      1,
      dataRowCount,
      KNOWLEDGE_AREAS_CONFIG.headers.length
    ).getValues();
    let lastMeaningfulOffset = -1;

    values.forEach(function(row, index) {
      if (KnowledgeAreasService._rowHasMeaningfulData(row)) {
        lastMeaningfulOffset = index;
      }
    });

    return lastMeaningfulOffset < 0 ? 2 : lastMeaningfulOffset + 3;
  },

  /**
   * Garante que a linha de destino exista antes da gravação.
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Aba do cadastro.
   * @param {number} rowNumber Linha necessária.
   * @private
   */
  _ensureRowAvailable: function(sheet, rowNumber) {
    const missingRows = Number(rowNumber) - sheet.getMaxRows();
    if (missingRows > 0) {
      sheet.insertRowsAfter(sheet.getMaxRows(), missingRows);
    }
  },

  /** @private */
  _writeAreaAtRow: function(sheet, rowNumber, area) {
    sheet.getRange(rowNumber, 1, 1, KNOWLEDGE_AREAS_CONFIG.headers.length).setValues([[
      area.id,
      area.name,
      area.parentId || '',
      area.description || '',
      Boolean(area.active),
      Number(area.order),
      area.createdAt || new Date(),
      area.updatedAt || new Date()
    ]]);
  },

  /** @private */
  _nextOrder: function(areas, parentId) {
    const maximum = (areas || []).filter(function(area) {
      return String(area.parentId || '') === String(parentId || '');
    }).reduce(function(current, area) {
      return Math.max(current, Number(area.order) || 0);
    }, 0);
    return maximum + KNOWLEDGE_AREAS_CONFIG.defaultOrderStep;
  },

  /** @private */
  _buildSummary: function(areas) {
    const source = Array.isArray(areas) ? areas : [];
    const parents = source.filter(function(area) { return !area.parentId; });
    const children = source.filter(function(area) { return Boolean(area.parentId); });
    return {
      total: source.length,
      active: source.filter(function(area) { return area.active; }).length,
      inactive: source.filter(function(area) { return !area.active; }).length,
      mainAreas: parents.length,
      subareas: children.length
    };
  },

  /** @private */
  _toPublicArea: function(area) {
    return {
      id: area.id,
      name: area.name,
      parentId: area.parentId || '',
      description: area.description || '',
      active: Boolean(area.active),
      order: Number(area.order) || 0,
      createdAt: KnowledgeAreasService._formatDate(area.createdAt),
      updatedAt: KnowledgeAreasService._formatDate(area.updatedAt)
    };
  },

  /** @private */
  _compareAreas: function(first, second) {
    const orderDifference = Number(first.order || 0) - Number(second.order || 0);
    if (orderDifference !== 0) return orderDifference;
    return String(first.name || '').localeCompare(
      String(second.name || ''),
      'pt-BR',
      { sensitivity: 'base', numeric: true }
    );
  },

  /** @private */
  _duplicateKey: function(name, parentId) {
    return KnowledgeAreasService.normalizeName(name)
      + '\u001f'
      + String(parentId || '').trim();
  },

  /**
   * Normaliza o nome apenas para comparação de duplicidade.
   *
   * @param {*} value Valor bruto.
   * @returns {string} Nome canônico.
   */
  normalizeName: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  },

  /** @private */
  _cleanText: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .replace(/\s+/g, ' ');
  },

  /** @private */
  _cleanMultilineText: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .trim();
  },

  /** @private */
  _toBoolean: function(value, defaultValue) {
    if (value === true || value === false) return value;
    if (value === 1 || String(value).trim() === '1') return true;
    if (value === 0 || String(value).trim() === '0') return false;
    const normalized = String(value === null || value === undefined ? '' : value)
      .trim()
      .toUpperCase();
    if (['TRUE', 'VERDADEIRO', 'SIM', 'S', 'ATIVA', 'ATIVO'].indexOf(normalized) >= 0) {
      return true;
    }
    if (['FALSE', 'FALSO', 'NAO', 'NÃO', 'N', 'INATIVA', 'INATIVO'].indexOf(normalized) >= 0) {
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
    const date = KnowledgeAreasService._toDateOrNull(value);
    return date ? date.toISOString() : '';
  },

  /** @private */
  _validationError: function(message) {
    const error = new Error(message);
    error.name = 'KnowledgeAreaValidationError';
    error.isBusinessValidation = true;
    return error;
  }
};

/**
 * Retorna a listagem completa do cadastro.
 *
 * @returns {string} Resposta JSON para o frontend.
 */
function getKnowledgeAreas() {
  try {
    AccessControlService.requireInstitutionalUser();
    const result = KnowledgeAreasService.list();
    let teacherStatistics = { period: null, byArea: {} };
    try {
      teacherStatistics = TeacherAreasService.getAreaTeacherStatistics(result.areas);
    } catch (statisticsError) {
      KnowledgeAreasLog.write('WARNING', 'knowledge_area_teacher_counts_unavailable', {
        message: statisticsError && statisticsError.message
          ? statisticsError.message
          : String(statisticsError)
      });
    }
    const decorateArea = function(area) {
      const counts = teacherStatistics.byArea[area.id] || {};
      return Object.assign({}, area, {
        directTeacherCount: Number(counts.directTeacherCount || 0),
        teacherCount: Number(counts.teacherCount || 0)
      });
    };
    const areasWithCounts = result.areas.map(decorateArea);
    const hierarchyWithCounts = result.hierarchy.map(function(parent) {
      const decorated = decorateArea(parent);
      decorated.children = (parent.children || []).map(decorateArea);
      return decorated;
    });
    return JSON.stringify({
      status: 'success',
      areas: areasWithCounts,
      hierarchy: hierarchyWithCounts,
      summary: result.summary,
      health: result.health,
      meta: {
        version: KNOWLEDGE_AREAS_CONFIG.version,
        sheetName: KNOWLEDGE_AREAS_CONFIG.sheetName,
        teacherCountPeriod: teacherStatistics.period
      }
    });
  } catch (error) {
    KnowledgeAreasLog.write('ERROR', 'knowledge_areas_list_failed', {
      message: error && error.message ? error.message : String(error)
    });
    return JSON.stringify({
      status: 'error',
      message: 'Falha ao carregar as Áreas de Conhecimento: '
        + (error && error.message ? error.message : String(error))
    });
  }
}

/**
 * Cria ou edita uma área.
 *
 * @param {Object} payload Dados do formulário.
 * @returns {string} Resposta JSON para o frontend.
 */
function saveKnowledgeArea(payload) {
  try {
    AccessControlService.requireAdministrator();
    const result = KnowledgeAreasService.save(payload || {});
    return JSON.stringify(Object.assign({ status: 'success' }, result));
  } catch (error) {
    const validation = Boolean(error && error.isBusinessValidation);
    KnowledgeAreasLog.write(validation ? 'WARNING' : 'ERROR', 'knowledge_area_save_failed', {
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

/**
 * Altera a situação ativa de uma área.
 *
 * @param {string} areaId ID estável.
 * @param {boolean} active Situação desejada.
 * @returns {string} Resposta JSON para o frontend.
 */
function setKnowledgeAreaActive(areaId, active, referencePeriod) {
  try {
    AccessControlService.requireAdministrator();
    const result = KnowledgeAreasService.setActive(areaId, active, referencePeriod || {});
    return JSON.stringify(Object.assign({ status: 'success' }, result));
  } catch (error) {
    const validation = Boolean(error && error.isBusinessValidation);
    KnowledgeAreasLog.write(validation ? 'WARNING' : 'ERROR', 'knowledge_area_status_failed', {
      areaId: String(areaId || ''),
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

/** Retorna o impacto da inativação para a confirmação administrativa. */
function getKnowledgeAreaInactivationImpact(areaId, referencePeriod) {
  try {
    AccessControlService.requireAdministrator();
    return JSON.stringify({
      status: 'success',
      impact: KnowledgeAreasService.getInactivationImpact(areaId, referencePeriod || {})
    });
  } catch (error) {
    const validation = Boolean(error && error.isBusinessValidation);
    KnowledgeAreasLog.write(validation ? 'WARNING' : 'ERROR', 'knowledge_area_impact_failed', {
      areaId: String(areaId || ''),
      message: error && error.message ? error.message : String(error),
      falhaEsperada: validation
    });
    return JSON.stringify({
      status: 'error',
      message: error && error.message ? error.message : String(error),
      validation: validation
    });
  }
}

/**
 * Health check somente leitura do novo cadastro.
 *
 * @returns {string} Estado da estrutura e dos registros.
 */
function getKnowledgeAreasHealth() {
  try {
    AccessControlService.requireAdministrator();
    const result = KnowledgeAreasService.list();
    return JSON.stringify({
      status: result.health.ok ? 'success' : 'error',
      message: result.health.ok
        ? 'Cadastro de Áreas de Conhecimento íntegro.'
        : result.health.problems.join(' | '),
      health: result.health,
      summary: result.summary,
      meta: {
        version: KNOWLEDGE_AREAS_CONFIG.version,
        sheetName: KNOWLEDGE_AREAS_CONFIG.sheetName
      }
    });
  } catch (error) {
    KnowledgeAreasLog.write('ERROR', 'knowledge_areas_health_failed', {
      message: error && error.message ? error.message : String(error)
    });
    return JSON.stringify({
      status: 'error',
      message: error && error.message ? error.message : String(error)
    });
  }
}
