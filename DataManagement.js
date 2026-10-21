/**
 * @file DataManagement.gs
 * @fileoverview Gestão transacional das bases DOCENTESXDISCIPLINA,
 * ALUNOXCAMPUSX[ANO] e DOCENTES, com importação em lotes, progresso real,
 * backups ocultos, restauração e preservação histórica.
 * @version 10.0.9
 */

const DATA_MANAGEMENT_CONFIG = Object.freeze({
  reportContracts: Object.freeze({
  "disciplines": {
    "type": "disciplines",
    "label": "DOCENTESXDISCIPLINA",
    "headerSearchRows": 15,
    "headers": [
      "PROFESSOR",
      "ANO",
      "SEMESTRE",
      "CAMPUS",
      "CATEGORIA",
      "FORMA",
      "CURSO",
      "PPC",
      "DISCIPLINA",
      "TURMA",
      "TURNO",
      "PERÍODO",
      "CARGA HORÁRIA",
      "CARGA HORÁRIA TEORICA",
      "CARGA HORÁRIA PRÁTICA",
      "CARGA HORÁRIA EXTENSÃO",
      "TIPO DISCIPLINA",
      "MODALIDADE",
      "NÚCLEO",
      "DURAÇÃO DE CADA AULA EM MINUTOS"
    ]
  },
  "students": {
    "type": "students",
    "label": "ALUNOXCAMPUS",
    "headerSearchRows": 15,
    "headers": [
      "Contador",
      "Matrícula (RA)",
      "CPF",
      "Nome",
      "Nome Social",
      "Data de nascimento",
      "Idade",
      "Sexo",
      "RG",
      "Órgão Expedidor RG",
      "Data de expedição RG",
      "CIN",
      "Órgão Expedidor CIN",
      "Data de expedição CIN",
      "Data de validade CIN",
      "Nome da mãe",
      "Nome do Pai",
      "Estado Civil",
      "Nacionalidade",
      "Naturalidade cidade",
      "Naturalidade estado",
      "Etnia",
      "PNE",
      "ID Pessoa",
      "Curso",
      "PPC",
      "Período",
      "Turma de ingresso",
      "Turma atual",
      "Turma preferencial",
      "Semestre/Ano de Ingresso",
      "Movimento Atual",
      "Movimento Período Letivo",
      "Unidade",
      "Ano de possível conclusão",
      "Classificação",
      "Campus",
      "Tipo de ingresso",
      "Data de validade da carteirinha",
      "Tipo de Escola que Concluiu Ensino Médio",
      "Número SISTEC Aluno",
      "Data último movimento",
      "Instituição de ensino (escolaridade)",
      "Curso (escolaridade)",
      "Forma (escolaridade)",
      "Início (escolaridade)",
      "Término (escolaridade)",
      "Carga horária (escolaridade)",
      "Cidade (escolaridade)",
      "Estado (escolaridade)",
      "E-mail",
      "Tel. residencial",
      "Tel. celular",
      "Logradouro",
      "Número",
      "Bairro",
      "CEP",
      "Cidade",
      "Estado",
      "Nome Responsável",
      "Telefone Responsável",
      "E-mail Responsável",
      "Nota Processo Seletivo",
      "Classificação Processo Seletivo",
      "Processo Seletivo/Vestibular",
      "Edital",
      "Grupo concorrência",
      "Data da primeira matrícula",
      "Data da última matrícula",
      "Data término do curso",
      "Data da colação de grau",
      "Data expedição histórico escolar",
      "Título TCC",
      "Observações estágio",
      "Texto histórico"
    ]
  },
  "teachers": {
    "type": "teachers",
    "label": "DOCENTES",
    "headerSearchRows": 10,
    "headers": [
      "Nome do servidor",
      "Matrícula",
      "CPF",
      "Cargo",
      "Campus",
      "Nível",
      "Classe/Padrão",
      "Ingresso no Serviço Público",
      "Exercício",
      "Carga Horária",
      "E-mail Institucional",
      "E-mail Pessoal",
      "Telefone Residencial",
      "Telefone Celular",
      "Sexo",
      "Data de Nascimento",
      "Tipo de ingresso",
      "Localização de Exercício",
      "Função"
    ]
  }
}),
  expectedHeaders: Object.freeze([
  "PROFESSOR",
  "ANO",
  "SEMESTRE",
  "CAMPUS",
  "CATEGORIA",
  "FORMA",
  "CURSO",
  "PPC",
  "DISCIPLINA",
  "TURMA",
  "TURNO",
  "PERÍODO",
  "CARGA HORÁRIA",
  "CARGA HORÁRIA TEORICA",
  "CARGA HORÁRIA PRÁTICA",
  "CARGA HORÁRIA EXTENSÃO",
  "TIPO DISCIPLINA",
  "MODALIDADE",
  "NÚCLEO",
  "DURAÇÃO DE CADA AULA EM MINUTOS"
]),
  annualSheetPattern: /^\d{4}$/,
  studentSheetPattern: /^ALUNOXCAMPUSX(\d{4})$/,
  teacherSheetName: 'DOCENTES',
  backupNamePattern: /^_BACKUP_(DISCIPLINAS|ALUNOS)_(\d{4})_(\d{8}_\d{6})(?:_(\d+))?$|^_BACKUP_(DOCENTES)_(\d{8}_\d{6})(?:_(\d+))?$/,
  operationPropertyPrefix: 'DM_OPERATION_',
  metadataPropertyPrefix: 'DM_DATASET_META_',
  temporarySheetPrefix: '_TMP_DM_',
  systemPlaceholderSheet: '_SISTEMA_SEM_DADOS',
  maxBackupsPerDataset: 3,
  maxBackupsPerYear: 3,
  maxBatchRows: 250,
  staleOperationMilliseconds: 24 * 60 * 60 * 1000
});


const DATA_IMPORT_FLEX_CONFIG = Object.freeze({
  disciplines: Object.freeze({
    requiredHeaders: Object.freeze([
      'PROFESSOR', 'ANO', 'SEMESTRE', 'FORMA', 'CURSO', 'PPC', 'DISCIPLINA',
      'PERÍODO', 'CARGA HORÁRIA', 'CARGA HORÁRIA TEORICA',
      'CARGA HORÁRIA PRÁTICA', 'CARGA HORÁRIA EXTENSÃO',
      'DURAÇÃO DE CADA AULA EM MINUTOS'
    ]),
    aliases: Object.freeze({
      'PROFESSOR': Object.freeze(['DOCENTE', 'NOME DO PROFESSOR']),
      'ANO': Object.freeze(['ANO LETIVO']),
      'SEMESTRE': Object.freeze(['SEMESTRE LETIVO']),
      'PERÍODO': Object.freeze(['PERIODO']),
      'CARGA HORÁRIA': Object.freeze(['CARGA HORARIA', 'CH TOTAL']),
      'CARGA HORÁRIA TEORICA': Object.freeze(['CARGA HORÁRIA TEÓRICA', 'CH TEÓRICA', 'CH TEORICA']),
      'CARGA HORÁRIA PRÁTICA': Object.freeze(['CARGA HORARIA PRATICA', 'CH PRÁTICA', 'CH PRATICA']),
      'CARGA HORÁRIA EXTENSÃO': Object.freeze(['CARGA HORARIA EXTENSAO', 'CH EXTENSÃO', 'CH EXTENSAO']),
      'DURAÇÃO DE CADA AULA EM MINUTOS': Object.freeze(['DURAÇÃO DA AULA', 'DURACAO DA AULA', 'MINUTOS POR AULA'])
    })
  }),
  students: Object.freeze({
    requiredHeaders: Object.freeze([
      'Matrícula (RA)', 'CPF', 'ID Pessoa', 'Curso', 'PPC', 'Período',
      'Classificação', 'Movimento Atual', 'Movimento Período Letivo'
    ]),
    aliases: Object.freeze({
      'Matrícula (RA)': Object.freeze(['RA', 'MATRÍCULA', 'MATRICULA']),
      'ID Pessoa': Object.freeze(['ID_PESSOA', 'CÓDIGO PESSOA', 'CODIGO PESSOA']),
      'Período': Object.freeze(['PERIODO']),
      'Classificação': Object.freeze(['CLASSIFICACAO', 'FORMA']),
      'Movimento Atual': Object.freeze(['SITUAÇÃO ATUAL', 'SITUACAO ATUAL']),
      'Movimento Período Letivo': Object.freeze(['MOVIMENTO DO PERÍODO LETIVO', 'MOVIMENTO PERIODO LETIVO'])
    })
  }),
  teachers: Object.freeze({
    requiredHeaders: Object.freeze([
      'Nome do servidor', 'Matrícula', 'CPF', 'Cargo', 'Carga Horária', 'Tipo de ingresso'
    ]),
    aliases: Object.freeze({
      'Nome do servidor': Object.freeze(['SERVIDOR', 'NOME', 'NOME DO SERVIDOR(A)']),
      'Matrícula': Object.freeze(['SIAPE', 'MATRICULA', 'MATRÍCULA SIAPE']),
      'Cargo': Object.freeze(['DENOMINAÇÃO DO CARGO', 'DENOMINACAO DO CARGO', 'CARGO/EMPREGO']),
      'Carga Horária': Object.freeze(['JORNADA', 'CARGA HORARIA', 'REGIME DE TRABALHO']),
      'Tipo de ingresso': Object.freeze(['TIPO DE INGRESSO', 'VÍNCULO', 'VINCULO'])
    })
  })
});

const DataManagementLog = {
  write: function(level, event, metadata) {
    Logger.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level,
      event: event,
      appVersion: typeof APP_INFO !== 'undefined' ? APP_INFO.version : 'unknown',
      metadata: metadata || {}
    }));
  }
};

const DataManagementOperationStore = {
  create: function(operation) {
    const now = new Date().toISOString();
    const state = Object.assign({
      id: Utilities.getUuid().replace(/-/g, '').slice(0, 20),
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      stage: 'created',
      percent: 0,
      message: 'Operação criada.',
      history: []
    }, operation || {});
    DataManagementOperationStore._appendHistory(state, state.message);
    return DataManagementOperationStore.save(state);
  },

  get: function(operationId) {
    const key = DATA_MANAGEMENT_CONFIG.operationPropertyPrefix + String(operationId || '');
    const raw = PropertiesService.getScriptProperties().getProperty(key);
    if (!raw) throw new Error('Operação não encontrada ou expirada.');
    return JSON.parse(raw);
  },

  save: function(state) {
    state.updatedAt = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty(
      DATA_MANAGEMENT_CONFIG.operationPropertyPrefix + state.id,
      JSON.stringify(state)
    );
    return state;
  },

  update: function(operationId, patch, historyMessage) {
    const state = DataManagementOperationStore.get(operationId);
    Object.assign(state, patch || {});
    if (historyMessage) DataManagementOperationStore._appendHistory(state, historyMessage);
    return DataManagementOperationStore.save(state);
  },

  remove: function(operationId) {
    PropertiesService.getScriptProperties().deleteProperty(
      DATA_MANAGEMENT_CONFIG.operationPropertyPrefix + String(operationId || '')
    );
  },

  _appendHistory: function(state, message) {
    if (!Array.isArray(state.history)) state.history = [];
    state.history.push({ timestamp: new Date().toISOString(), message: String(message || '') });
    if (state.history.length > 30) state.history = state.history.slice(-30);
  }
};

/** Retorna panorama, contratos e opções de restauração. */
function getDataManagementOverview() {
  try {
    AccessControlService.requireAdministrator();
    DataManagementService.cleanupStaleArtifacts();
    const annualSets = DataManagementService.listAnnualSets();
    const backups = DataManagementService.listBackups();
    return DataManagementService.success({
      reportContracts: DataManagementService.cloneContracts(),
      expectedHeaders: DATA_MANAGEMENT_CONFIG.expectedHeaders.slice(),
      maxBatchRows: DATA_MANAGEMENT_CONFIG.maxBatchRows,
      annualSets: annualSets,
      annualSheets: annualSets.filter(function(item) { return item.disciplines.exists; }).map(function(item) {
        return {
          year: item.year,
          name: item.year,
          rowCount: item.disciplines.rowCount,
          totalClockHours: item.disciplines.totalClockHours
        };
      }),
      teacherRegistry: DataManagementService.describeTeacherRegistry(),
      backups: backups,
      restoreOptions: DataManagementService.buildRestoreOptions(backups, annualSets),
      version: APP_INFO.version
    });
  } catch (error) {
    return DataManagementService.failure('getDataManagementOverview', error);
  }
}

/**
 * Inicia importação de um novo conjunto anual, atualização parcial/conjunta
 * ou mesclagem do cadastro DOCENTES.
 */
function startDataImportOperation(metadata) {
  try {
    AccessControlService.requireAdministrator();
    const normalized = DataManagementService.normalizeImportMetadata(metadata || {});
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    DataManagementService.assertImportPreconditions(spreadsheet, normalized);

    const operation = DataManagementOperationStore.create({
      type: 'data_import',
      mode: normalized.mode,
      year: normalized.year || null,
      status: 'running',
      stage: 'preparing',
      percent: 1,
      message: 'Preparando áreas temporárias.',
      components: normalized.components,
      totalWorkRows: normalized.components.reduce(function(total, component) {
        return total + component.totalRows * 2;
      }, 0),
      completedWorkRows: 0
    });

    const lock = DataManagementService.getDocumentLock();
    lock.waitLock(30000);
    try {
      operation.components.forEach(function(component) {
        const temporarySheet = spreadsheet.insertSheet(
          DATA_MANAGEMENT_CONFIG.temporarySheetPrefix + operation.id + '_' + component.type
        );
        DataManagementService.ensureSheetSize(
          temporarySheet,
          component.totalRows + 1,
          component.headers.length
        );
        temporarySheet.getRange(1, 1, 1, component.headers.length).setValues([component.headers]);
        temporarySheet.hideSheet();
        component.stagingSheetId = temporarySheet.getSheetId();
        component.receivedRows = 0;
        component.verifiedRows = 0;
        component.status = 'receiving';
        component.yearsFound = [];
      });
      operation.stage = 'receiving';
      operation.percent = 3;
      operation.message = 'Áreas temporárias prontas. Enviando registros em lotes.';
      DataManagementOperationStore._appendHistory(operation, 'Áreas temporárias criadas.');
      DataManagementOperationStore.save(operation);
    } finally {
      SpreadsheetApp.flush();
      lock.releaseLock();
    }

    DataManagementLog.write('INFO', 'data_import_started', {
      operationId: operation.id,
      mode: operation.mode,
      year: operation.year,
      components: operation.components.map(function(item) { return item.type; })
    });

    return DataManagementService.success({
      operation: DataManagementService.publicOperation(operation),
      maxBatchRows: DATA_MANAGEMENT_CONFIG.maxBatchRows
    });
  } catch (error) {
    return DataManagementService.failure('startDataImportOperation', error);
  }
}

/** Grava um lote de um dos componentes da operação. */
function appendDataImportBatch(operationId, componentType, startIndex, rows) {
  try {
    AccessControlService.requireAdministrator();
    const state = DataManagementOperationStore.get(operationId);
    DataManagementService.assertOperation(state, 'data_import', ['receiving']);
    const component = DataManagementService.getOperationComponent(state, componentType);
    const start = Number(startIndex);
    const batch = Array.isArray(rows) ? rows : [];

    if (component.status !== 'receiving') throw new Error('Este relatório não aceita novos lotes.');
    if (!Number.isInteger(start) || start !== component.receivedRows) {
      throw new Error('Lote recebido fora da sequência esperada.');
    }
    if (batch.length === 0 || batch.length > DATA_MANAGEMENT_CONFIG.maxBatchRows) {
      throw new Error('Tamanho de lote inválido.');
    }
    if (component.receivedRows + batch.length > component.totalRows) {
      throw new Error('O lote ultrapassa a quantidade declarada de registros.');
    }

    const normalizedRows = batch.map(function(row, offset) {
      return DataManagementService.normalizeImportedRowForType(
        component.type,
        row,
        start + offset + 2
      );
    });
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const staging = DataManagementService.getSheetById(spreadsheet, component.stagingSheetId);
    if (!staging) throw new Error('Área temporária não encontrada.');

    staging.getRange(start + 2, 1, normalizedRows.length, component.headers.length)
      .setValues(normalizedRows);
    component.receivedRows += normalizedRows.length;
    state.completedWorkRows += normalizedRows.length;

    if (component.receivedRows === component.totalRows) {
      component.status = 'received';
      DataManagementOperationStore._appendHistory(
        state,
        DataManagementService.componentLabel(component.type)
          + ': todos os registros recebidos.'
      );
    }
    state.percent = DataManagementService.calculateTransferPercent(state);
    state.message = DataManagementService.componentLabel(component.type)
      + ': recebendo registro ' + component.receivedRows + ' de ' + component.totalRows + '.';
    DataManagementOperationStore.save(state);

    return DataManagementService.success({ operation: DataManagementService.publicOperation(state) });
  } catch (error) {
    DataManagementService.markOperationFailed(operationId, error);
    return DataManagementService.failure('appendDataImportBatch', error);
  }
}

/** Revalida no servidor um lote já armazenado. */
function verifyDataImportBatch(operationId, componentType, startIndex, requestedBatchSize) {
  try {
    AccessControlService.requireAdministrator();
    const state = DataManagementOperationStore.get(operationId);
    DataManagementService.assertOperation(state, 'data_import', ['receiving', 'verifying']);
    const component = DataManagementService.getOperationComponent(state, componentType);
    if (component.receivedRows !== component.totalRows) {
      throw new Error('O relatório ainda não foi recebido integralmente.');
    }
    if (component.status !== 'received' && component.status !== 'verifying') {
      throw new Error('Este relatório não está disponível para validação.');
    }

    const start = Number(startIndex);
    if (!Number.isInteger(start) || start !== component.verifiedRows) {
      throw new Error('Validação solicitada fora da sequência esperada.');
    }
    const remaining = component.totalRows - start;
    const batchSize = Math.min(
      Math.max(Number(requestedBatchSize) || DATA_MANAGEMENT_CONFIG.maxBatchRows, 1),
      DATA_MANAGEMENT_CONFIG.maxBatchRows,
      remaining
    );
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const staging = DataManagementService.getSheetById(spreadsheet, component.stagingSheetId);
    if (!staging) throw new Error('Área temporária não encontrada.');

    DataManagementService.assertHeadersForType(
      component.type,
      staging.getRange(1, 1, 1, component.headers.length).getValues()[0]
    );
    const values = staging.getRange(start + 2, 1, batchSize, component.headers.length)
      .getValues();
    DataManagementService.verifyComponentRows(state, component, values, start);

    component.verifiedRows += values.length;
    component.status = component.verifiedRows === component.totalRows ? 'verified' : 'verifying';
    state.completedWorkRows += values.length;
    state.stage = 'verifying';
    state.percent = DataManagementService.calculateTransferPercent(state);
    state.message = DataManagementService.componentLabel(component.type)
      + ': validando registro ' + component.verifiedRows + ' de ' + component.totalRows + '.';

    if (component.status === 'verified') {
      DataManagementService.finalizeComponentVerification(state, component);
      DataManagementOperationStore._appendHistory(
        state,
        DataManagementService.componentLabel(component.type) + ': validação concluída.'
      );
    }
    if (state.components.every(function(item) { return item.status === 'verified'; })) {
      state.stage = 'ready_to_commit';
      state.percent = 72;
      state.message = 'Todos os relatórios foram validados. A operação pode ser confirmada.';
      DataManagementOperationStore._appendHistory(state, 'Validação completa.');
    }
    DataManagementOperationStore.save(state);
    return DataManagementService.success({ operation: DataManagementService.publicOperation(state) });
  } catch (error) {
    DataManagementService.markOperationFailed(operationId, error);
    return DataManagementService.failure('verifyDataImportBatch', error);
  }
}

/** Confirma a operação de importação/mesclagem. */
function commitDataImportOperation(operationId) {
  try {
    AccessControlService.requireAdministrator();
    const state = DataManagementOperationStore.get(operationId);
    DataManagementService.assertOperation(state, 'data_import', ['ready_to_commit']);
    if (!state.components.every(function(item) { return item.status === 'verified'; })) {
      throw new Error('Nem todos os relatórios foram validados.');
    }

    DataManagementOperationStore.update(operationId, {
      stage: 'waiting_lock',
      percent: 74,
      message: 'Aguardando acesso exclusivo à planilha.'
    }, 'Aguardando bloqueio exclusivo.');

    const lock = DataManagementService.getDocumentLock();
    lock.waitLock(30000);
    const rollbackContext = [];
    try {
      const current = DataManagementOperationStore.get(operationId);
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      DataManagementService.assertImportPreconditions(spreadsheet, current);
      const timestamp = DataManagementService.createTimestamp();

      DataManagementOperationStore.update(operationId, {
        stage: 'backing_up',
        message: 'Criando backups das bases que serão alteradas.'
      }, 'Criação de backups iniciada.');

      current.components.forEach(function(component) {
        const target = DataManagementService.findTargetSheet(spreadsheet, component.type, current.year);
        const context = {
          type: component.type,
          targetSheetId: target ? target.getSheetId() : null,
          targetName: DataManagementService.targetSheetName(component.type, current.year),
          targetExisted: Boolean(target),
          backupSheetId: null,
          stagingSheetId: component.stagingSheetId
        };
        if (target) {
          const backup = DataManagementService.createBackup(
            target,
            component.type,
            current.year,
            timestamp
          );
          context.backupSheetId = backup.getSheetId();
        }
        rollbackContext.push(context);
      });

      DataManagementOperationStore.update(operationId, {
        stage: current.mode === 'merge-teachers' ? 'merging' : 'writing',
        message: current.mode === 'merge-teachers'
          ? 'Mesclando o cadastro acumulado de docentes.'
          : 'Gravando as bases validadas.'
      }, current.mode === 'merge-teachers' ? 'Mesclagem iniciada.' : 'Gravação iniciada.');

      if (current.mode === 'merge-teachers') {
        DataManagementService.commitTeacherMerge(spreadsheet, current, rollbackContext[0]);
      } else {
        DataManagementService.commitAnnualComponents(spreadsheet, current, rollbackContext);
      }

      DataManagementOperationStore.update(operationId, {
        stage: 'checking_integrity',
        message: 'Verificando a integridade das bases gravadas.'
      }, 'Verificação final iniciada.');
      DataManagementService.assertCommittedOperationIntegrity(spreadsheet, current);

      current.components.forEach(function(component) {
        DataManagementService.saveDatasetMetadata(component.type, current.year, {
          operationId: current.id,
          mode: current.mode,
          fileName: component.fileName,
          rowCount: component.totalRows,
          importedAt: new Date().toISOString()
        });
        DataManagementService.pruneBackups(component.type, current.year);
      });
      DataManagementService.removeSystemPlaceholder(spreadsheet);
      SpreadsheetApp.flush();

      DataManagementOperationStore.update(operationId, {
        status: 'completed',
        stage: 'completed',
        percent: 100,
        message: current.mode === 'merge-teachers'
          ? 'Cadastro de docentes atualizado por mesclagem.'
          : 'Bases anuais atualizadas com sucesso.'
      }, 'Operação concluída com sucesso.');
      DataManagementService.deleteStagingSheets(current);

      DataManagementLog.write('INFO', 'data_import_completed', {
        operationId: current.id,
        mode: current.mode,
        year: current.year
      });
      return DataManagementService.success({
        operation: DataManagementService.publicOperation(
          DataManagementOperationStore.get(operationId)
        )
      });
    } catch (commitError) {
      DataManagementService.rollbackCommit(operationId, rollbackContext);
      throw commitError;
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    DataManagementService.markOperationFailed(operationId, error);
    return DataManagementService.failure('commitDataImportOperation', error);
  }
}

/** Inicia exclusão conjunta das bases anuais. */
function startDeleteYearOperation(year, confirmation) {
  try {
    AccessControlService.requireAdministrator();
    const normalizedYear = DataManagementService.normalizeYear(year);
    if (String(confirmation || '').trim() !== 'EXCLUIR ANO ' + normalizedYear) {
      throw new Error('Confirmação de exclusão inválida.');
    }
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const disciplines = spreadsheet.getSheetByName(normalizedYear);
    const students = spreadsheet.getSheetByName('ALUNOXCAMPUSX' + normalizedYear);
    if (!disciplines && !students) throw new Error('Não há bases do ano ' + normalizedYear + '.');

    const operation = DataManagementOperationStore.create({
      type: 'delete_year',
      year: normalizedYear,
      status: 'running',
      stage: 'ready_to_commit',
      percent: 20,
      message: 'Exclusão conjunta confirmada. Preparando backups.'
    });
    return DataManagementService.success({ operation: DataManagementService.publicOperation(operation) });
  } catch (error) {
    return DataManagementService.failure('startDeleteYearOperation', error);
  }
}

/** Executa exclusão conjunta com backup obrigatório. */
function commitDeleteYearOperation(operationId) {
  try {
    AccessControlService.requireAdministrator();
    const state = DataManagementOperationStore.get(operationId);
    DataManagementService.assertOperation(state, 'delete_year', ['ready_to_commit']);
    DataManagementOperationStore.update(operationId, {
      stage: 'waiting_lock', message: 'Aguardando acesso exclusivo à planilha.'
    });
    const lock = DataManagementService.getDocumentLock();
    lock.waitLock(30000);
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const disciplines = spreadsheet.getSheetByName(state.year);
      const students = spreadsheet.getSheetByName('ALUNOXCAMPUSX' + state.year);
      if (!disciplines && !students) throw new Error('As bases do ano já foram excluídas.');
      const timestamp = DataManagementService.createTimestamp();

      DataManagementOperationStore.update(operationId, {
        stage: 'backing_up', message: 'Criando backups das bases do ano ' + state.year + '.'
      }, 'Backups da exclusão iniciados.');
      if (disciplines) DataManagementService.createBackup(disciplines, 'disciplines', state.year, timestamp);
      if (students) DataManagementService.createBackup(students, 'students', state.year, timestamp);
      SpreadsheetApp.flush();

      DataManagementOperationStore.update(operationId, {
        stage: 'deleting', message: 'Excluindo conjuntamente as bases do ano ' + state.year + '.'
      }, 'Exclusão iniciada.');
      if (disciplines) DataManagementService.ensureVisibleSheetAfterDeletion(spreadsheet, disciplines);
      if (disciplines) spreadsheet.deleteSheet(disciplines);
      if (students) {
        DataManagementService.ensureVisibleSheetAfterDeletion(spreadsheet, students);
        spreadsheet.deleteSheet(students);
      }
      DataManagementService.deleteDatasetMetadata('disciplines', state.year);
      DataManagementService.deleteDatasetMetadata('students', state.year);
      DataManagementService.pruneBackups('disciplines', state.year);
      DataManagementService.pruneBackups('students', state.year);
      SpreadsheetApp.flush();

      DataManagementOperationStore.update(operationId, {
        status: 'completed', stage: 'completed', percent: 100,
        message: 'Bases do ano ' + state.year + ' excluídas com sucesso.'
      }, 'Exclusão concluída.');
      return DataManagementService.success({
        operation: DataManagementService.publicOperation(
          DataManagementOperationStore.get(operationId)
        )
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    DataManagementService.markOperationFailed(operationId, error);
    return DataManagementService.failure('commitDeleteYearOperation', error);
  }
}

/** Inicia restauração de uma opção segura retornada pelo overview. */
function startRestoreBackupOperation(optionId, confirmation) {
  try {
    AccessControlService.requireAdministrator();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const annualSets = DataManagementService.listAnnualSets();
    const backups = DataManagementService.listBackups();
    const option = DataManagementService.buildRestoreOptions(backups, annualSets)
      .filter(function(item) { return item.id === String(optionId || ''); })[0];
    if (!option) throw new Error('Opção de restauração não encontrada ou expirada.');
    if (String(confirmation || '').trim() !== option.confirmation) {
      throw new Error('Confirmação de restauração inválida.');
    }

    option.items.forEach(function(item) {
      const backup = DataManagementService.getSheetById(spreadsheet, item.sheetId);
      if (!backup || !DataManagementService.parseBackupName(backup.getName())) {
        throw new Error('Um dos backups selecionados não está mais disponível.');
      }
    });

    const operation = DataManagementOperationStore.create({
      type: 'restore',
      restoreOption: option,
      status: 'running',
      stage: 'ready_to_commit',
      percent: 20,
      message: 'Restauração confirmada. Preparando proteção do estado atual.'
    });
    return DataManagementService.success({ operation: DataManagementService.publicOperation(operation) });
  } catch (error) {
    return DataManagementService.failure('startRestoreBackupOperation', error);
  }
}

/** Executa restauração individual ou conjunta. */
function commitRestoreBackupOperation(operationId) {
  try {
    AccessControlService.requireAdministrator();
    const state = DataManagementOperationStore.get(operationId);
    DataManagementService.assertOperation(state, 'restore', ['ready_to_commit']);
    const lock = DataManagementService.getDocumentLock();
    DataManagementOperationStore.update(operationId, {
      stage: 'waiting_lock', message: 'Aguardando acesso exclusivo à planilha.'
    });
    lock.waitLock(30000);
    const rollbackContext = [];
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const timestamp = DataManagementService.createTimestamp();
      DataManagementOperationStore.update(operationId, {
        stage: 'backing_up', message: 'Criando backup do estado atual antes da restauração.'
      }, 'Proteção do estado atual iniciada.');

      state.restoreOption.items.forEach(function(item) {
        const target = DataManagementService.findTargetSheet(spreadsheet, item.type, item.year);
        const context = {
          type: item.type,
          targetName: DataManagementService.targetSheetName(item.type, item.year),
          targetExisted: Boolean(target),
          targetSheetId: target ? target.getSheetId() : null,
          backupSheetId: null
        };
        if (target) {
          const currentBackup = DataManagementService.createBackup(
            target, item.type, item.year, timestamp
          );
          context.backupSheetId = currentBackup.getSheetId();
        }
        rollbackContext.push(context);
      });

      DataManagementOperationStore.update(operationId, {
        stage: 'restoring', message: 'Restaurando as bases selecionadas.'
      }, 'Restauração iniciada.');
      state.restoreOption.items.forEach(function(item) {
        const backup = DataManagementService.getSheetById(spreadsheet, item.sheetId);
        if (!backup) throw new Error('Backup indisponível durante a restauração.');
        let target = DataManagementService.findTargetSheet(spreadsheet, item.type, item.year);
        if (!target) target = spreadsheet.insertSheet(DataManagementService.targetSheetName(item.type, item.year));
        DataManagementService.replaceSheetValues(target, backup.getDataRange().getValues());
        DataManagementService.applySheetPresentation(target, item.type);
      });
      SpreadsheetApp.flush();

      state.restoreOption.items.forEach(function(item) {
        DataManagementService.assertDatasetIntegrity(
          DataManagementService.findTargetSheet(spreadsheet, item.type, item.year),
          item.type,
          item.year,
          null
        );
        DataManagementService.saveDatasetMetadata(item.type, item.year, {
          operationId: state.id,
          mode: 'restore',
          fileName: 'Backup ' + item.backupName,
          rowCount: item.rowCount,
          importedAt: new Date().toISOString()
        });
        DataManagementService.pruneBackups(item.type, item.year);
      });
      DataManagementService.removeSystemPlaceholder(spreadsheet);
      DataManagementOperationStore.update(operationId, {
        status: 'completed', stage: 'completed', percent: 100,
        message: 'Backup restaurado com sucesso.'
      }, 'Restauração concluída.');
      return DataManagementService.success({
        operation: DataManagementService.publicOperation(
          DataManagementOperationStore.get(operationId)
        )
      });
    } catch (restoreError) {
      DataManagementService.rollbackRestore(rollbackContext);
      throw restoreError;
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    DataManagementService.markOperationFailed(operationId, error);
    return DataManagementService.failure('commitRestoreBackupOperation', error);
  }
}

function getDataOperationProgress(operationId) {
  try {
    AccessControlService.requireAdministrator();
    return DataManagementService.success({
      operation: DataManagementService.publicOperation(
        DataManagementOperationStore.get(operationId)
      )
    });
  } catch (error) {
    return DataManagementService.failure('getDataOperationProgress', error);
  }
}

function cancelDataOperation(operationId) {
  try {
    AccessControlService.requireAdministrator();
    const state = DataManagementOperationStore.get(operationId);
    if (['completed', 'failed', 'cancelled'].indexOf(state.status) >= 0) {
      return DataManagementService.success({ operation: DataManagementService.publicOperation(state) });
    }
    if (['waiting_lock', 'backing_up', 'writing', 'merging', 'checking_integrity', 'deleting', 'restoring']
      .indexOf(state.stage) >= 0) {
      throw new Error('A operação já entrou em uma etapa crítica e não pode ser cancelada.');
    }
    DataManagementService.deleteStagingSheets(state);
    const updated = DataManagementOperationStore.update(operationId, {
      status: 'cancelled', stage: 'cancelled', message: 'Operação cancelada pelo usuário.'
    }, 'Operação cancelada.');
    return DataManagementService.success({ operation: DataManagementService.publicOperation(updated) });
  } catch (error) {
    return DataManagementService.failure('cancelDataOperation', error);
  }
}

const DataManagementService = {
  getDocumentLock: function() {
    return LockService.getDocumentLock();
  },

  success: function(payload) {
    return JSON.stringify(Object.assign({ status: 'success' }, payload || {}));
  },

  failure: function(context, error) {
    DataManagementLog.write('ERROR', context, { message: error && error.message ? error.message : String(error) });
    return JSON.stringify({
      status: 'error',
      message: error && error.message ? error.message : String(error)
    });
  },

  cloneContracts: function() {
    const result = {};
    Object.keys(DATA_MANAGEMENT_CONFIG.reportContracts).forEach(function(type) {
      const contract = DATA_MANAGEMENT_CONFIG.reportContracts[type];
      result[type] = {
        type: contract.type,
        label: contract.label,
        headerSearchRows: contract.headerSearchRows,
        headers: contract.headers.slice(),
        requiredHeaders: (DATA_IMPORT_FLEX_CONFIG[type].requiredHeaders || []).slice(),
        optionalHeaders: contract.headers.filter(function(header) {
          return DATA_IMPORT_FLEX_CONFIG[type].requiredHeaders.indexOf(header) < 0;
        }),
        aliases: JSON.parse(JSON.stringify(DATA_IMPORT_FLEX_CONFIG[type].aliases || {}))
      };
    });
    return result;
  },

  publicOperation: function(state) {
    return {
      id: state.id,
      type: state.type,
      mode: state.mode || null,
      year: state.year || (state.restoreOption ? state.restoreOption.year : null),
      status: state.status,
      stage: state.stage,
      percent: state.percent,
      message: state.message,
      history: Array.isArray(state.history) ? state.history.slice() : [],
      components: Array.isArray(state.components) ? state.components.map(function(component) {
        return {
          type: component.type,
          label: DataManagementService.componentLabel(component.type),
          totalRows: component.totalRows,
          receivedRows: component.receivedRows || 0,
          verifiedRows: component.verifiedRows || 0,
          status: component.status
        };
      }) : []
    };
  },

  assertOperation: function(state, expectedType, allowedStages) {
    if (!state || state.type !== expectedType) throw new Error('Tipo de operação inválido.');
    if (state.status !== 'running') throw new Error('A operação não está ativa.');
    if (allowedStages.indexOf(state.stage) < 0) {
      throw new Error('A operação não está na etapa esperada.');
    }
  },

  markOperationFailed: function(operationId, error) {
    if (!operationId) return;
    try {
      const state = DataManagementOperationStore.get(operationId);
      if (state.status === 'completed' || state.status === 'cancelled') return;
      DataManagementOperationStore.update(operationId, {
        status: 'failed',
        stage: 'failed',
        message: error && error.message ? error.message : String(error)
      }, 'Falha: ' + (error && error.message ? error.message : String(error)));
    } catch (ignored) {
      DataManagementLog.write('WARNING', 'operation_failure_state_unavailable', {
        operationId: operationId,
        originalMessage: error && error.message ? error.message : String(error)
      });
    }
  },

  normalizeImportMetadata: function(metadata) {
    const mode = String(metadata.mode || '');
    if (['add-year', 'update-year', 'merge-teachers'].indexOf(mode) < 0) {
      throw new Error('Modo de importação inválido.');
    }
    const year = mode === 'merge-teachers' ? null : DataManagementService.normalizeYear(metadata.year);
    const inputComponents = Array.isArray(metadata.components) ? metadata.components : [];
    const components = inputComponents.map(function(component) {
      const type = String(component.type || '');
      if (!DATA_MANAGEMENT_CONFIG.reportContracts[type]) {
        throw new Error('Tipo de relatório inválido: ' + type + '.');
      }
      const headers = Array.isArray(component.headers) ? component.headers.slice() : [];
      DataManagementService.assertHeadersForType(type, headers);
      const totalRows = Number(component.rowCount);
      if (!Number.isInteger(totalRows) || totalRows <= 0) {
        throw new Error(DataManagementService.componentLabel(type) + ' não contém registros.');
      }
      return {
        type: type,
        headers: headers,
        totalRows: totalRows,
        fileName: String(component.fileName || '')
      };
    });
    const uniqueTypes = {};
    components.forEach(function(component) {
      if (uniqueTypes[component.type]) throw new Error('Relatório duplicado na mesma operação.');
      uniqueTypes[component.type] = true;
    });
    if (mode === 'add-year') {
      if (components.length !== 2 || !uniqueTypes.disciplines || !uniqueTypes.students) {
        throw new Error('Um novo ano exige os relatórios DOCENTESXDISCIPLINA e ALUNOXCAMPUS em conjunto.');
      }
    }
    if (mode === 'update-year') {
      if (components.length < 1 || components.length > 2 || uniqueTypes.teachers) {
        throw new Error('Atualização anual aceita um ou os dois relatórios anuais.');
      }
    }
    if (mode === 'merge-teachers') {
      if (components.length !== 1 || !uniqueTypes.teachers) {
        throw new Error('A mesclagem de docentes exige exclusivamente o relatório DOCENTES.');
      }
    }
    return { mode: mode, year: year, components: components };
  },

  assertImportPreconditions: function(spreadsheet, metadata) {
    const state = metadata;
    if (state.mode === 'merge-teachers') return;
    const disciplines = spreadsheet.getSheetByName(state.year);
    const students = spreadsheet.getSheetByName('ALUNOXCAMPUSX' + state.year);
    if (state.mode === 'add-year' && (disciplines || students)) {
      const disciplinesHasData = disciplines && disciplines.getLastRow() > 1;
      const studentsHasData = students && students.getLastRow() > 1;
      if (disciplinesHasData || studentsHasData) {
        throw new Error('O ano ' + state.year + ' já possui dados. Use a atualização.');
      }
    }
    if (state.mode === 'update-year' && (!disciplines || !students)) {
      throw new Error('O ano ' + state.year + ' está incompleto. Restaure ou importe o conjunto anual antes de atualizar separadamente.');
    }
  },

  normalizeYear: function(value) {
    let normalized;
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized = String(Math.trunc(value));
    } else {
      normalized = String(value === null || value === undefined ? '' : value).trim();
      if (/^\d{4}\.0+$/.test(normalized)) normalized = normalized.split('.')[0];
    }
    if (!/^\d{4}$/.test(normalized)) throw new Error('Ano inválido: “' + normalized + '”.');
    return normalized;
  },

  assertHeaders: function(headers) {
    DataManagementService.assertHeadersForType('disciplines', headers);
  },

  assertHeadersForType: function(type, headers) {
    const contract = DATA_MANAGEMENT_CONFIG.reportContracts[type];
    if (!contract) throw new Error('Contrato de relatório desconhecido.');
    if (!Array.isArray(headers) || headers.length !== contract.headers.length) {
      throw new Error(contract.label + ' deve possuir exatamente ' + contract.headers.length + ' colunas.');
    }
    const differences = [];
    contract.headers.forEach(function(expected, index) {
      const actual = String(headers[index] === null || headers[index] === undefined ? '' : headers[index]).trim();
      if (actual !== expected) differences.push('Coluna ' + (index + 1) + ': esperado “' + expected + '”, recebido “' + actual + '”.');
    });
    if (differences.length > 0) throw new Error('Estrutura divergente em ' + contract.label + ': ' + differences.slice(0, 5).join(' '));
  },

  normalizeImportedRow: function(row, sourceRowNumber) {
    return DataManagementService.normalizeImportedRowForType('disciplines', row, sourceRowNumber);
  },

  normalizeImportedRowForType: function(type, row, sourceRowNumber) {
    const contract = DATA_MANAGEMENT_CONFIG.reportContracts[type];
    if (!Array.isArray(row) || row.length !== contract.headers.length) {
      throw new Error('Linha ' + sourceRowNumber + ' de ' + contract.label + ' não possui ' + contract.headers.length + ' colunas.');
    }
    return row.map(function(value) {
      return value === undefined || value === '' ? null : value;
    });
  },

  verifyComponentRows: function(state, component, values, startIndex) {
    if (component.type === 'disciplines') {
      const years = {};
      (component.yearsFound || []).forEach(function(year) { years[year] = true; });
      values.forEach(function(row, offset) {
        if (!DataManagementService.isEmptyValue(row[1])) {
          const year = DataManagementService.normalizeYear(row[1]);
          years[year] = true;
          if (year !== state.year) {
            throw new Error('Linha ' + (startIndex + offset + 2) + ': ano ' + year + ' diverge do ano informado ' + state.year + '.');
          }
        }
      });
      component.yearsFound = Object.keys(years);
    }
  },

  finalizeComponentVerification: function(state, component) {
    if (component.type === 'disciplines') {
      if (component.yearsFound.length !== 1 || component.yearsFound[0] !== state.year) {
        throw new Error('DOCENTESXDISCIPLINA deve conter exatamente o ano ' + state.year + '.');
      }
    }
    if (component.type === 'teachers') {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const staging = DataManagementService.getSheetById(spreadsheet, component.stagingSheetId);
      DataManagementService.validateTeacherMergeRows(staging.getDataRange().getValues());
    }
  },

  validateTeacherMergeRows: function(values) {
    DataManagementService.assertHeadersForType('teachers', values[0]);
    const registrationIndex = DATA_MANAGEMENT_CONFIG.reportContracts.teachers.headers.indexOf('Matrícula');
    const cpfIndex = DATA_MANAGEMENT_CONFIG.reportContracts.teachers.headers.indexOf('CPF');
    const cargoIndex = DATA_MANAGEMENT_CONFIG.reportContracts.teachers.headers.indexOf('Cargo');
    const seenRegistration = {};
    const seenCpf = {};
    for (let index = 1; index < values.length; index += 1) {
      const row = values[index];
      if (DataManagementService.isEmptyRow(row)) continue;
      const registration = DataManagementService.normalizeIdentity(row[registrationIndex]);
      const cpf = DataManagementService.normalizeIdentity(row[cpfIndex]);
      const cargo = DataManagementService.normalizeHeaderText(row[cargoIndex]);
      if (cargo.indexOf('PROFESSOR') < 0) {
        throw new Error('Linha ' + (index + 1) + ': o registro não possui cargo docente.');
      }
      if (!registration) throw new Error('Linha ' + (index + 1) + ': matrícula do docente não informada.');
      if (seenRegistration[registration]) throw new Error('Matrícula duplicada no relatório DOCENTES: ' + registration + '.');
      seenRegistration[registration] = true;
      if (cpf) {
        if (seenCpf[cpf] && seenCpf[cpf] !== registration) throw new Error('CPF duplicado em matrículas diferentes no relatório DOCENTES.');
        seenCpf[cpf] = registration;
      }
    }
  },

  calculateTransferPercent: function(state) {
    if (!state.totalWorkRows) return 5;
    return Math.min(70, Math.round(5 + (state.completedWorkRows / state.totalWorkRows) * 65));
  },

  getOperationComponent: function(state, componentType) {
    const type = String(componentType || '');
    const component = state.components.filter(function(item) { return item.type === type; })[0];
    if (!component) throw new Error('Relatório não pertence a esta operação.');
    return component;
  },

  componentLabel: function(type) {
    return DATA_MANAGEMENT_CONFIG.reportContracts[type]
      ? DATA_MANAGEMENT_CONFIG.reportContracts[type].label
      : String(type || 'Relatório');
  },

  targetSheetName: function(type, year) {
    if (type === 'disciplines') return String(year);
    if (type === 'students') return 'ALUNOXCAMPUSX' + String(year);
    if (type === 'teachers') return DATA_MANAGEMENT_CONFIG.teacherSheetName;
    throw new Error('Tipo de base inválido.');
  },

  findTargetSheet: function(spreadsheet, type, year) {
    return spreadsheet.getSheetByName(DataManagementService.targetSheetName(type, year));
  },

  commitAnnualComponents: function(spreadsheet, state, rollbackContext) {
    state.components.forEach(function(component) {
      const staging = DataManagementService.getSheetById(spreadsheet, component.stagingSheetId);
      if (!staging) throw new Error('Área temporária de ' + component.type + ' não encontrada.');
      let target = DataManagementService.findTargetSheet(spreadsheet, component.type, state.year);
      if (state.mode === 'add-year') {
        if (target && target.getLastRow() > 1) {
          throw new Error('A base de destino foi criada por outra operação.');
        }
        if (target) {
          DataManagementService.replaceSheetValues(target, staging.getDataRange().getValues());
        } else {
          staging.setName(DataManagementService.targetSheetName(component.type, state.year));
          staging.showSheet();
          target = staging;
          component.stagingSheetId = null;
        }
      } else {
        if (!target) throw new Error('A base de destino não está mais disponível.');
        DataManagementService.replaceSheetValues(target, staging.getDataRange().getValues());
      }
      DataManagementService.applySheetPresentation(target, component.type);
    });
    SpreadsheetApp.flush();
  },

  commitTeacherMerge: function(spreadsheet, state, rollbackContext) {
    const component = state.components[0];
    const staging = DataManagementService.getSheetById(spreadsheet, component.stagingSheetId);
    if (!staging) throw new Error('Área temporária de DOCENTES não encontrada.');
    const incoming = staging.getDataRange().getValues();
    DataManagementService.validateTeacherMergeRows(incoming);
    let target = spreadsheet.getSheetByName(DATA_MANAGEMENT_CONFIG.teacherSheetName);
    const contract = DATA_MANAGEMENT_CONFIG.reportContracts.teachers.headers;
    let existing = [contract.slice()];
    if (target) {
      existing = target.getDataRange().getValues();
      DataManagementService.assertHeadersForType('teachers', existing[0]);
    }
    const merged = DataManagementService.mergeTeacherValues(existing, incoming);
    if (!target) target = spreadsheet.insertSheet(DATA_MANAGEMENT_CONFIG.teacherSheetName);
    DataManagementService.replaceSheetValues(target, merged);
    DataManagementService.applySheetPresentation(target, 'teachers');
    SpreadsheetApp.flush();
  },

  mergeTeacherValues: function(existingValues, incomingValues) {
    const headers = DATA_MANAGEMENT_CONFIG.reportContracts.teachers.headers;
    DataManagementService.assertHeadersForType('teachers', existingValues[0]);
    DataManagementService.assertHeadersForType('teachers', incomingValues[0]);
    const registrationIndex = headers.indexOf('Matrícula');
    const cpfIndex = headers.indexOf('CPF');
    const existingRows = existingValues.slice(1).filter(function(row) { return !DataManagementService.isEmptyRow(row); });
    const incomingRows = incomingValues.slice(1).filter(function(row) { return !DataManagementService.isEmptyRow(row); });
    const existingByRegistration = {};
    const registrationByCpf = {};
    existingRows.forEach(function(row, index) {
      const registration = DataManagementService.normalizeIdentity(row[registrationIndex]);
      const cpf = DataManagementService.normalizeIdentity(row[cpfIndex]);
      if (!registration) throw new Error('A base DOCENTES existente contém matrícula vazia.');
      if (existingByRegistration[registration] !== undefined) throw new Error('A base DOCENTES existente contém matrícula duplicada: ' + registration + '.');
      existingByRegistration[registration] = index;
      if (cpf) {
        if (registrationByCpf[cpf] && registrationByCpf[cpf] !== registration) throw new Error('A base DOCENTES existente contém CPF ligado a matrículas diferentes.');
        registrationByCpf[cpf] = registration;
      }
    });
    incomingRows.forEach(function(row) {
      const registration = DataManagementService.normalizeIdentity(row[registrationIndex]);
      const cpf = DataManagementService.normalizeIdentity(row[cpfIndex]);
      const existingIndex = existingByRegistration[registration];
      if (existingIndex !== undefined) {
        const oldCpf = DataManagementService.normalizeIdentity(existingRows[existingIndex][cpfIndex]);
        if (oldCpf && cpf && oldCpf !== cpf) throw new Error('A matrícula ' + registration + ' já está vinculada a outro CPF.');
        existingRows[existingIndex] = row.slice();
      } else {
        if (cpf && registrationByCpf[cpf] && registrationByCpf[cpf] !== registration) {
          throw new Error('O CPF informado já pertence à matrícula ' + registrationByCpf[cpf] + '.');
        }
        existingByRegistration[registration] = existingRows.length;
        existingRows.push(row.slice());
      }
      if (cpf) registrationByCpf[cpf] = registration;
    });
    return [headers.slice()].concat(existingRows);
  },

  assertCommittedOperationIntegrity: function(spreadsheet, state) {
    state.components.forEach(function(component) {
      const target = DataManagementService.findTargetSheet(spreadsheet, component.type, state.year);
      const expectedRows = component.type === 'teachers' ? null : component.totalRows;
      DataManagementService.assertDatasetIntegrity(target, component.type, state.year, expectedRows);
    });
  },

  assertDatasetIntegrity: function(sheet, type, year, expectedRowCount) {
    if (!sheet) throw new Error('Base de destino ausente após a gravação.');
    const contract = DATA_MANAGEMENT_CONFIG.reportContracts[type];
    const values = sheet.getDataRange().getValues();
    if (values.length < 1) throw new Error('Base gravada sem cabeçalho.');
    DataManagementService.assertHeadersForType(type, values[0]);
    if (sheet.getLastColumn() !== contract.headers.length) {
      throw new Error('A base ' + contract.label + ' não possui exatamente ' + contract.headers.length + ' colunas.');
    }
    if (expectedRowCount !== null && expectedRowCount !== undefined
        && Math.max(values.length - 1, 0) !== expectedRowCount) {
      throw new Error('Quantidade de registros divergente em ' + contract.label + '.');
    }
    if (type === 'disciplines') {
      const years = {};
      values.slice(1).forEach(function(row) {
        if (!DataManagementService.isEmptyValue(row[1])) years[DataManagementService.normalizeYear(row[1])] = true;
      });
      const yearList = Object.keys(years);
      if (yearList.length !== 1 || yearList[0] !== year) throw new Error('Ano divergente na base DOCENTESXDISCIPLINA.');
    }
    if (type === 'teachers') DataManagementService.validateTeacherMergeRows(values);
  },

  replaceSheetValues: function(sheet, values) {
    if (!Array.isArray(values) || values.length === 0) throw new Error('Não há dados para gravação.');
    const width = values[0].length;
    DataManagementService.ensureSheetSize(sheet, values.length, width);
    sheet.clear();
    sheet.getRange(1, 1, values.length, width).setValues(values);
  },

  applySheetPresentation: function(sheet, type) {
    const width = DATA_MANAGEMENT_CONFIG.reportContracts[type].headers.length;
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#dcfce7');
  },

  ensureSheetSize: function(sheet, requiredRows, requiredColumns) {
    if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
    if (sheet.getMaxColumns() < requiredColumns) sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  },

  createTimestamp: function() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  },

  createBackup: function(source, type, year, timestamp) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const prefix = type === 'teachers'
      ? '_BACKUP_DOCENTES_' + timestamp
      : '_BACKUP_' + (type === 'disciplines' ? 'DISCIPLINAS' : 'ALUNOS') + '_' + year + '_' + timestamp;
    let name = prefix;
    let sequence = 1;
    while (spreadsheet.getSheetByName(name)) {
      name = prefix + '_' + sequence;
      sequence += 1;
    }
    const backup = source.copyTo(spreadsheet).setName(name);
    backup.hideSheet();
    return backup;
  },

  parseBackupName: function(name) {
    const value = String(name || '');
    let match = value.match(/^_BACKUP_(DISCIPLINAS|ALUNOS)_(\d{4})_(\d{8}_\d{6})(?:_(\d+))?$/);
    if (match) {
      return {
        type: match[1] === 'DISCIPLINAS' ? 'disciplines' : 'students',
        year: match[2],
        timestamp: match[3],
        sequence: match[4] ? Number(match[4]) : 0
      };
    }
    match = value.match(/^_BACKUP_DOCENTES_(\d{8}_\d{6})(?:_(\d+))?$/);
    if (match) {
      return { type: 'teachers', year: null, timestamp: match[1], sequence: match[2] ? Number(match[2]) : 0 };
    }
    return null;
  },

  listBackups: function() {
    return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function(sheet) {
      const metadata = DataManagementService.parseBackupName(sheet.getName());
      if (!metadata) return null;
      return {
        sheetId: sheet.getSheetId(),
        name: sheet.getName(),
        type: metadata.type,
        year: metadata.year,
        timestamp: metadata.timestamp,
        sequence: metadata.sequence,
        rowCount: Math.max(sheet.getLastRow() - 1, 0),
        hidden: sheet.isSheetHidden()
      };
    }).filter(function(item) { return item !== null; }).sort(function(a, b) {
      return b.name.localeCompare(a.name, 'pt-BR', { numeric: true });
    });
  },

  pruneBackups: function(type, year) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const backups = spreadsheet.getSheets().filter(function(sheet) {
      const metadata = DataManagementService.parseBackupName(sheet.getName());
      return metadata && metadata.type === type && metadata.year === (type === 'teachers' ? null : year);
    }).sort(function(a, b) {
      return b.getName().localeCompare(a.getName(), 'pt-BR', { numeric: true });
    });
    backups.slice(DATA_MANAGEMENT_CONFIG.maxBackupsPerDataset).forEach(function(sheet) {
      spreadsheet.deleteSheet(sheet);
    });
  },

  listAnnualSets: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const years = {};
    spreadsheet.getSheets().forEach(function(sheet) {
      if (/^\d{4}$/.test(sheet.getName())) years[sheet.getName()] = true;
      const match = sheet.getName().match(/^ALUNOXCAMPUSX(\d{4})$/);
      if (match) years[match[1]] = true;
    });
    return Object.keys(years).sort().map(function(year) {
      const disciplines = spreadsheet.getSheetByName(year);
      const students = spreadsheet.getSheetByName('ALUNOXCAMPUSX' + year);
      const disciplineMeta = DataManagementService.getDatasetMetadata('disciplines', year);
      const studentMeta = DataManagementService.getDatasetMetadata('students', year);
      let syncStatus = 'incomplete';
      if (disciplines && students) {
        syncStatus = disciplineMeta && studentMeta && disciplineMeta.operationId === studentMeta.operationId
          ? 'synchronized'
          : 'separate_updates';
      }
      return {
        year: year,
        status: disciplines && students ? 'complete' : 'incomplete',
        syncStatus: syncStatus,
        disciplines: {
          exists: Boolean(disciplines),
          rowCount: disciplines ? Math.max(disciplines.getLastRow() - 1, 0) : 0,
          totalClockHours: disciplines ? DataManagementService.sumClockHours(disciplines) : 0,
          metadata: disciplineMeta
        },
        students: {
          exists: Boolean(students),
          rowCount: students ? Math.max(students.getLastRow() - 1, 0) : 0,
          metadata: studentMeta
        }
      };
    });
  },

  sumClockHours: function(sheet) {
    if (sheet.getLastRow() <= 1 || sheet.getLastColumn() < 13) return 0;
    return sheet.getRange(2, 13, sheet.getLastRow() - 1, 1).getValues().reduce(function(total, row) {
      const value = Number(row[0]);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);
  },

  describeTeacherRegistry: function() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_MANAGEMENT_CONFIG.teacherSheetName);
    return {
      exists: Boolean(sheet),
      rowCount: sheet ? Math.max(sheet.getLastRow() - 1, 0) : 0,
      metadata: DataManagementService.getDatasetMetadata('teachers', null)
    };
  },

  buildRestoreOptions: function(backups, annualSets) {
    const options = [];
    const existingByYear = {};
    annualSets.forEach(function(item) { existingByYear[item.year] = item; });
    const grouped = {};
    backups.forEach(function(backup) {
      if (backup.type === 'teachers') {
        options.push({
          id: 'SINGLE|teachers||' + backup.sheetId,
          label: 'DOCENTES — ' + backup.timestamp,
          kind: 'single',
          year: null,
          confirmation: 'RESTAURAR DOCENTES',
          items: [{
            type: 'teachers', year: null, sheetId: backup.sheetId,
            backupName: backup.name, rowCount: backup.rowCount
          }]
        });
        return;
      }
      const key = backup.year + '|' + backup.timestamp;
      if (!grouped[key]) grouped[key] = {};
      grouped[key][backup.type] = backup;
    });
    Object.keys(grouped).forEach(function(key) {
      const parts = key.split('|');
      const year = parts[0];
      const timestamp = parts[1];
      const pair = grouped[key];
      const annualSet = existingByYear[year] || null;
      if (pair.disciplines && pair.students) {
        options.push({
          id: 'PAIR|' + year + '|' + timestamp + '|' + pair.disciplines.sheetId + '|' + pair.students.sheetId,
          label: 'Conjunto anual ' + year + ' — ' + timestamp,
          kind: 'annual_pair',
          year: year,
          confirmation: 'RESTAURAR ' + year,
          items: [
            { type: 'disciplines', year: year, sheetId: pair.disciplines.sheetId, backupName: pair.disciplines.name, rowCount: pair.disciplines.rowCount },
            { type: 'students', year: year, sheetId: pair.students.sheetId, backupName: pair.students.name, rowCount: pair.students.rowCount }
          ]
        });
      }
      if (annualSet && annualSet.status === 'complete') {
        ['disciplines', 'students'].forEach(function(type) {
          const backup = pair[type];
          if (!backup) return;
          options.push({
            id: 'SINGLE|' + type + '|' + year + '|' + backup.sheetId,
            label: (type === 'disciplines' ? 'Docentes e disciplinas ' : 'Alunos ') + year + ' — ' + timestamp,
            kind: 'single',
            year: year,
            confirmation: 'RESTAURAR ' + year,
            items: [{ type: type, year: year, sheetId: backup.sheetId, backupName: backup.name, rowCount: backup.rowCount }]
          });
        });
      }
    });
    return options.sort(function(a, b) { return b.label.localeCompare(a.label, 'pt-BR', { numeric: true }); });
  },

  metadataKey: function(type, year) {
    return DATA_MANAGEMENT_CONFIG.metadataPropertyPrefix + type.toUpperCase()
      + (year ? '_' + year : '');
  },

  saveDatasetMetadata: function(type, year, metadata) {
    PropertiesService.getScriptProperties().setProperty(
      DataManagementService.metadataKey(type, year), JSON.stringify(metadata || {})
    );
  },

  getDatasetMetadata: function(type, year) {
    const raw = PropertiesService.getScriptProperties().getProperty(
      DataManagementService.metadataKey(type, year)
    );
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (error) { return null; }
  },

  deleteDatasetMetadata: function(type, year) {
    PropertiesService.getScriptProperties().deleteProperty(
      DataManagementService.metadataKey(type, year)
    );
  },

  rollbackCommit: function(operationId, contexts) {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      (contexts || []).forEach(function(context) {
        let target = spreadsheet.getSheetByName(context.targetName);
        if (context.targetExisted && context.backupSheetId) {
          const backup = DataManagementService.getSheetById(spreadsheet, context.backupSheetId);
          if (backup) {
            if (!target) target = spreadsheet.insertSheet(context.targetName);
            DataManagementService.replaceSheetValues(target, backup.getDataRange().getValues());
            DataManagementService.applySheetPresentation(target, context.type);
          }
        } else if (!context.targetExisted && target) {
          DataManagementService.ensureVisibleSheetAfterDeletion(spreadsheet, target);
          spreadsheet.deleteSheet(target);
        }
      });
      SpreadsheetApp.flush();
      DataManagementLog.write('WARNING', 'data_import_rollback_executed', { operationId: operationId });
    } catch (rollbackError) {
      DataManagementLog.write('ERROR', 'data_import_rollback_failed', {
        operationId: operationId, message: rollbackError.message
      });
    }
  },

  rollbackRestore: function(contexts) {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      (contexts || []).forEach(function(context) {
        let target = spreadsheet.getSheetByName(context.targetName);
        if (context.targetExisted && context.backupSheetId) {
          const backup = DataManagementService.getSheetById(spreadsheet, context.backupSheetId);
          if (backup) {
            if (!target) target = spreadsheet.insertSheet(context.targetName);
            DataManagementService.replaceSheetValues(target, backup.getDataRange().getValues());
            DataManagementService.applySheetPresentation(target, context.type);
          }
        } else if (!context.targetExisted && target) {
          DataManagementService.ensureVisibleSheetAfterDeletion(spreadsheet, target);
          spreadsheet.deleteSheet(target);
        }
      });
      SpreadsheetApp.flush();
    } catch (error) {
      DataManagementLog.write('ERROR', 'restore_rollback_failed', { message: error.message });
    }
  },

  deleteStagingSheets: function(state) {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      (state.components || []).forEach(function(component) {
        if (!component.stagingSheetId) return;
        const sheet = DataManagementService.getSheetById(spreadsheet, component.stagingSheetId);
        if (sheet && sheet.getName().indexOf(DATA_MANAGEMENT_CONFIG.temporarySheetPrefix) === 0) {
          spreadsheet.deleteSheet(sheet);
        }
      });
    } catch (error) {
      DataManagementLog.write('WARNING', 'staging_cleanup_failed', { message: error.message });
    }
  },

  getSheetById: function(spreadsheet, sheetId) {
    const numericId = Number(sheetId);
    const sheets = spreadsheet.getSheets();
    for (let index = 0; index < sheets.length; index += 1) {
      if (sheets[index].getSheetId() === numericId) return sheets[index];
    }
    return null;
  },

  ensureVisibleSheetAfterDeletion: function(spreadsheet, target) {
    const otherVisible = spreadsheet.getSheets().some(function(sheet) {
      return sheet.getSheetId() !== target.getSheetId() && !sheet.isSheetHidden();
    });
    if (!otherVisible) {
      let placeholder = spreadsheet.getSheetByName(DATA_MANAGEMENT_CONFIG.systemPlaceholderSheet);
      if (!placeholder) {
        placeholder = spreadsheet.insertSheet(DATA_MANAGEMENT_CONFIG.systemPlaceholderSheet);
        placeholder.getRange('A1').setValue('Nenhuma base ativa. Use o dashboard para importar ou restaurar dados.');
      }
      placeholder.showSheet();
    }
  },

  removeSystemPlaceholder: function(spreadsheet) {
    const placeholder = spreadsheet.getSheetByName(DATA_MANAGEMENT_CONFIG.systemPlaceholderSheet);
    const hasOperationalSheet = spreadsheet.getSheets().some(function(sheet) {
      return /^\d{4}$/.test(sheet.getName()) || /^ALUNOXCAMPUSX\d{4}$/.test(sheet.getName()) || sheet.getName() === 'DOCENTES';
    });
    if (placeholder && hasOperationalSheet && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(placeholder);
  },

  cleanupStaleArtifacts: function() {
    const properties = PropertiesService.getScriptProperties();
    const all = properties.getProperties();
    const now = Date.now();
    const activeSheetIds = {};
    Object.keys(all).forEach(function(key) {
      if (key.indexOf(DATA_MANAGEMENT_CONFIG.operationPropertyPrefix) !== 0) return;
      try {
        const state = JSON.parse(all[key]);
        const updatedAt = new Date(state.updatedAt || state.createdAt).getTime();
        const stale = !Number.isFinite(updatedAt)
          || now - updatedAt > DATA_MANAGEMENT_CONFIG.staleOperationMilliseconds;
        if (stale) {
          properties.deleteProperty(key);
        } else {
          (state.components || []).forEach(function(component) {
            if (component.stagingSheetId) activeSheetIds[Number(component.stagingSheetId)] = true;
          });
        }
      } catch (error) {
        properties.deleteProperty(key);
      }
    });
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    spreadsheet.getSheets().forEach(function(sheet) {
      if (sheet.getName().indexOf(DATA_MANAGEMENT_CONFIG.temporarySheetPrefix) !== 0) return;
      if (!activeSheetIds[sheet.getSheetId()]) spreadsheet.deleteSheet(sheet);
    });
  },

  normalizeHeaderText: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  },

  normalizeIdentity: function(value) {
    return String(value === null || value === undefined ? '' : value).replace(/\D/g, '');
  },

  isEmptyValue: function(value) {
    return value === null || value === undefined || String(value).trim() === '';
  },

  isEmptyRow: function(row) {
    return row.every(DataManagementService.isEmptyValue);
  }
};
