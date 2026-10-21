/**
 * @file SystemReset.gs
 * @fileoverview Reset completo e irreversível das bases que alimentam o dashboard.
 * Usuários, perfis, segurança e auditoria são preservados.
 * @version 10.0.9
 */

const SYSTEM_RESET_CONFIG = Object.freeze({
  version: '10.0.9',
  propertyPrefix: 'RESET_V99_',
  confirmationPhrase: 'APAGAR TUDO DO DASHBOARD',
  codeLength: 8,
  validityMilliseconds: 10 * 60 * 1000,
  maxAttempts: 5,
  dataSheetNames: Object.freeze([
    'DOCENTES',
    'AREAS_CONHECIMENTO',
    'DOCENTES_AREAS',
    'DOCENTES_CONTROLE',
    'DOCENTES_CONDICOES'
  ]),
  annualPattern: /^\d{4}$/,
  studentPattern: /^ALUNOS?XCAMPUSX?\d{4}$/,
  backupPattern: /^_BACKUP_/,
  temporaryPattern: /^_TMP_DM_/,
  placeholderName: '_SISTEMA_SEM_DADOS'
});

const SystemResetService = {
  /** Somente bases importadas ano a ano podem ter suas abas removidas. */
  isAnnualDataSheetName: function(sheetName) {
    const normalized = String(sheetName || '').trim().toUpperCase();
    return SYSTEM_RESET_CONFIG.annualPattern.test(normalized)
      || SYSTEM_RESET_CONFIG.studentPattern.test(normalized);
  },

  /** Retorna uma cópia estável das abas anuais que precisam ser removidas. */
  listAnnualDataSheets: function(spreadsheet) {
    return spreadsheet.getSheets().filter(function(sheet) {
      return SystemResetService.isAnnualDataSheetName(sheet.getName());
    });
  },

  /**
   * Exclui as duas bases anuais, inclusive aliases produzidos por versões antigas.
   * A segunda varredura impede que o reset seja declarado concluído com uma aba
   * ainda visível para a importação.
   */
  deleteAnnualDataSheets: function(spreadsheet, report) {
    SystemResetService.listAnnualDataSheets(spreadsheet).forEach(function(sheet) {
      report.deletedAnnualSheets.push({
        name: sheet.getName(),
        rows: Math.max(sheet.getLastRow() - 1, 0)
      });
      spreadsheet.deleteSheet(sheet);
    });
    SpreadsheetApp.flush();

    const remaining = SystemResetService.listAnnualDataSheets(spreadsheet)
      .map(function(sheet) { return sheet.getName(); });
    if (remaining.length > 0) {
      throw new Error('Não foi possível excluir as abas anuais: ' + remaining.join(', ') + '.');
    }
  },

  hashCode: function(salt, code) {
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(salt || '') + '|' + String(code || ''),
      Utilities.Charset.UTF_8
    );
    return digest.map(function(byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ('0' + value.toString(16)).slice(-2);
    }).join('');
  },

  generateCode: function() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seed = Utilities.getUuid().replace(/-/g, '').toUpperCase();
    let code = '';
    for (let index = 0; index < SYSTEM_RESET_CONFIG.codeLength; index += 1) {
      const source = seed.charCodeAt(index % seed.length) + Math.floor(Math.random() * 997);
      code += alphabet.charAt(source % alphabet.length);
    }
    return code;
  },

  saveRequest: function(request) {
    PropertiesService.getScriptProperties().setProperty(
      SYSTEM_RESET_CONFIG.propertyPrefix + request.id,
      JSON.stringify(request)
    );
  },

  getRequest: function(requestId) {
    const raw = PropertiesService.getScriptProperties().getProperty(
      SYSTEM_RESET_CONFIG.propertyPrefix + String(requestId || '')
    );
    if (!raw) throw new Error('Solicitação de reset não encontrada ou expirada.');
    return JSON.parse(raw);
  },

  deleteRequest: function(requestId) {
    PropertiesService.getScriptProperties().deleteProperty(
      SYSTEM_RESET_CONFIG.propertyPrefix + String(requestId || '')
    );
  },

  invalidateRequestsForEmail: function(email) {
    const properties = PropertiesService.getScriptProperties();
    const all = properties.getProperties();
    Object.keys(all).forEach(function(key) {
      if (key.indexOf(SYSTEM_RESET_CONFIG.propertyPrefix) !== 0) return;
      try {
        const request = JSON.parse(all[key]);
        if (request.email === email) properties.deleteProperty(key);
      } catch (ignoredInvalidRequest) {
        properties.deleteProperty(key);
      }
    });
  },

  requestReset: function(confirmation) {
    const actor = AccessControlService.requireSuperUser();
    if (String(confirmation || '').trim() !== SYSTEM_RESET_CONFIG.confirmationPhrase) {
      throw new Error('A frase de confirmação do reset está incorreta.');
    }
    if (MailApp.getRemainingDailyQuota() < 1) {
      throw new Error('A cota de envio de e-mail está esgotada. O reset não foi autorizado.');
    }

    SystemResetService.invalidateRequestsForEmail(actor.email);
    const code = SystemResetService.generateCode();
    const salt = Utilities.getUuid();
    const now = Date.now();
    const request = {
      id: Utilities.getUuid().replace(/-/g, '').slice(0, 24),
      email: actor.email,
      profile: actor.profile,
      codeHash: SystemResetService.hashCode(salt, code),
      salt: salt,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SYSTEM_RESET_CONFIG.validityMilliseconds).toISOString(),
      attemptsRemaining: SYSTEM_RESET_CONFIG.maxAttempts,
      used: false,
      confirmationPhrase: SYSTEM_RESET_CONFIG.confirmationPhrase
    };
    SystemResetService.saveRequest(request);

    MailApp.sendEmail({
      to: actor.email,
      subject: '[Carga Horária Docente] Código para reset completo da base',
      body: [
        'Foi solicitado um reset completo e irreversível da base do dashboard.',
        '',
        'Código de confirmação: ' + code,
        'Validade: 10 minutos.',
        'Tentativas permitidas: ' + SYSTEM_RESET_CONFIG.maxAttempts + '.',
        '',
        'A operação apagará dados acadêmicos, áreas, associações, diagnósticos e backups.',
        'Usuários, perfis, permissões e auditoria serão preservados.',
        '',
        'Caso você não tenha solicitado esta operação, não informe o código e comunique a equipe responsável.'
      ].join('\n'),
      name: 'Carga Horária Docente'
    });

    AccessControlService.audit('RESET_CODIGO_ENVIADO', 'SUCESSO', {
      requestId: request.id,
      expiresAt: request.expiresAt
    }, actor);

    return {
      requestId: request.id,
      expiresAt: request.expiresAt,
      attemptsRemaining: request.attemptsRemaining,
      email: actor.email
    };
  },

  validateRequest: function(requestId, code, actor) {
    const request = SystemResetService.getRequest(requestId);
    if (request.used) throw new Error('Este código já foi utilizado.');
    if (request.email !== actor.email) throw new Error('A solicitação pertence a outro usuário.');
    if (Date.now() > new Date(request.expiresAt).getTime()) {
      SystemResetService.deleteRequest(request.id);
      throw new Error('O código expirou. Solicite um novo código.');
    }
    if (request.attemptsRemaining <= 0) {
      SystemResetService.deleteRequest(request.id);
      throw new Error('O limite de tentativas foi atingido. Solicite um novo código.');
    }
    const receivedHash = SystemResetService.hashCode(request.salt, String(code || '').trim().toUpperCase());
    if (receivedHash !== request.codeHash) {
      request.attemptsRemaining -= 1;
      SystemResetService.saveRequest(request);
      AccessControlService.audit('RESET_CODIGO_INVALIDO', 'NEGADO', {
        requestId: request.id,
        attemptsRemaining: request.attemptsRemaining
      }, actor);
      throw new Error('Código inválido. Tentativas restantes: ' + request.attemptsRemaining + '.');
    }
    request.used = true;
    SystemResetService.saveRequest(request);
    return request;
  },

  clearSheetDataPreservingHeader: function(sheet) {
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    let removed = 0;
    if (lastRow > 1 && lastColumn > 0) {
      const range = sheet.getRange(2, 1, lastRow - 1, lastColumn);
      const values = range.getValues();
      removed = values.filter(function(row) {
        return row.some(function(value) {
          if (value === false) return false;
          return value !== null && value !== undefined && String(value).trim() !== '';
        });
      }).length;
      range.clearContent();
    }
    return removed;
  },

  clearDataProperties: function() {
    const properties = PropertiesService.getScriptProperties();
    const all = properties.getProperties();
    const prefixes = [
      'DM_OPERATION_',
      'DM_DATASET_META_'
    ];
    let removed = 0;
    Object.keys(all).forEach(function(key) {
      if (prefixes.some(function(prefix) { return key.indexOf(prefix) === 0; })) {
        properties.deleteProperty(key);
        removed += 1;
      }
    });
    return removed;
  },

  executeReset: function(requestId, code) {
    const actor = AccessControlService.requireSuperUser();
    const request = SystemResetService.validateRequest(requestId, code, actor);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      request.used = false;
      SystemResetService.saveRequest(request);
      throw new Error('Outra operação crítica está em andamento. Tente novamente mais tarde.');
    }

    const startedAt = new Date();
    const report = {
      requestId: request.id,
      executedBy: actor.email,
      startedAt: startedAt.toISOString(),
      completedAt: null,
      durationMilliseconds: 0,
      status: 'EM_ANDAMENTO',
      clearedSheets: [],
      deletedAnnualSheets: [],
      deletedBackups: [],
      deletedTemporarySheets: [],
      removedProperties: 0,
      preserved: [
        ACCESS_CONTROL_CONFIG.userSheetName,
        ACCESS_CONTROL_CONFIG.auditSheetName,
        'Todas as abas fixas, estruturais e de controle',
        'Perfis, permissões e configurações de segurança'
      ],
      errors: []
    };

    try {
      AccessControlService.audit('RESET_INICIADO', 'SUCESSO', {
        requestId: request.id
      }, actor);
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = spreadsheet.getSheets().slice();
      sheets.forEach(function(sheet) {
        const name = sheet.getName();
        if (name === ACCESS_CONTROL_CONFIG.userSheetName
            || name === ACCESS_CONTROL_CONFIG.auditSheetName) return;

        if (SYSTEM_RESET_CONFIG.backupPattern.test(name)) {
          report.deletedBackups.push({ name: name, rows: Math.max(sheet.getLastRow() - 1, 0) });
          spreadsheet.deleteSheet(sheet);
          return;
        }
        if (SYSTEM_RESET_CONFIG.temporaryPattern.test(name)
            || name === SYSTEM_RESET_CONFIG.placeholderName) {
          report.deletedTemporarySheets.push(name);
          spreadsheet.deleteSheet(sheet);
          return;
        }
        if (SystemResetService.isAnnualDataSheetName(name)) return;
        if (SYSTEM_RESET_CONFIG.dataSheetNames.indexOf(name) >= 0) {
          const removed = SystemResetService.clearSheetDataPreservingHeader(sheet);
          report.clearedSheets.push({ name: name, rowsRemoved: removed });
        }
      });

      SystemResetService.deleteAnnualDataSheets(spreadsheet, report);

      report.removedProperties = SystemResetService.clearDataProperties();
      SpreadsheetApp.flush();
      report.status = 'CONCLUIDO';
    } catch (resetError) {
      report.status = 'FALHOU';
      report.errors.push(resetError.message || String(resetError));
    } finally {
      report.completedAt = new Date().toISOString();
      report.durationMilliseconds = new Date().getTime() - startedAt.getTime();
      try {
        AccessControlService.audit('RESET_FINALIZADO',
          report.status === 'CONCLUIDO' ? 'SUCESSO' : 'FALHA', report, actor);
      } catch (ignoredAuditError) {
        report.errors.push('Falha ao registrar auditoria: ' + ignoredAuditError.message);
        if (report.status === 'CONCLUIDO') report.status = 'CONCLUIDO_COM_RESSALVAS';
      }
      try {
        SystemResetService.sendFinalReport(actor.email, report);
      } catch (mailError) {
        report.errors.push('Falha ao enviar o relatório por e-mail: ' + mailError.message);
        if (report.status === 'CONCLUIDO') report.status = 'CONCLUIDO_COM_RESSALVAS';
        AccessControlService.audit('RESET_RELATORIO_EMAIL_FALHOU', 'FALHA', {
          requestId: request.id,
          message: mailError.message
        }, actor);
      }
      SystemResetService.deleteRequest(request.id);
      lock.releaseLock();
    }

    if (report.status === 'FALHOU') {
      throw new Error('O reset falhou. Consulte o relatório enviado por e-mail e os logs de auditoria.');
    }
    return report;
  },

  sendFinalReport: function(email, report) {
    const lines = [
      'RELATÓRIO DE RESET COMPLETO — CARGA HORÁRIA DOCENTE',
      '',
      'Resultado: ' + report.status,
      'Executado por: ' + report.executedBy,
      'Início: ' + report.startedAt,
      'Fim: ' + report.completedAt,
      'Duração: ' + report.durationMilliseconds + ' ms',
      '',
      'ESTRUTURAS LIMPAS'
    ];
    if (report.clearedSheets.length === 0) lines.push('- Nenhuma aba de dados continha registros.');
    report.clearedSheets.forEach(function(item) {
      lines.push('- ' + item.name + ': ' + item.rowsRemoved + ' registros removidos');
    });
    lines.push('', 'ABAS ANUAIS EXCLUÍDAS');
    const deletedAnnualSheets = Array.isArray(report.deletedAnnualSheets)
      ? report.deletedAnnualSheets
      : [];
    if (deletedAnnualSheets.length === 0) {
      lines.push('- Nenhuma aba anual encontrada.');
    }
    deletedAnnualSheets.forEach(function(item) {
      lines.push('- ' + item.name + ': ' + item.rows + ' registros');
    });
    lines.push('', 'BACKUPS EXCLUÍDOS');
    if (report.deletedBackups.length === 0) lines.push('- Nenhum backup encontrado.');
    report.deletedBackups.forEach(function(item) {
      lines.push('- ' + item.name + ': ' + item.rows + ' registros');
    });
    lines.push('', 'ARTEFATOS TEMPORÁRIOS EXCLUÍDOS');
    if (report.deletedTemporarySheets.length === 0) lines.push('- Nenhum artefato temporário encontrado.');
    report.deletedTemporarySheets.forEach(function(name) { lines.push('- ' + name); });
    lines.push('', 'PROPRIEDADES DE DADOS REMOVIDAS: ' + report.removedProperties);
    lines.push('', 'ITENS PRESERVADOS');
    report.preserved.forEach(function(item) { lines.push('- ' + item); });
    if (report.errors.length > 0) {
      lines.push('', 'RESSALVAS OU FALHAS');
      report.errors.forEach(function(error) { lines.push('- ' + error); });
    }
    lines.push('', 'Este relatório é comprobatório e não constitui backup restaurável.');

    MailApp.sendEmail({
      to: email,
      subject: '[Carga Horária Docente] Relatório do reset completo — ' + report.status,
      body: lines.join('\n'),
      name: 'Carga Horária Docente'
    });
  }
};

/** Solicita código alfanumérico para o reset completo. */
function requestFullDatabaseReset(confirmation) {
  try {
    return JSON.stringify({
      status: 'success',
      request: SystemResetService.requestReset(confirmation)
    });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

/** Valida o código e executa o reset completo. */
function executeFullDatabaseReset(requestId, code) {
  try {
    return JSON.stringify({
      status: 'success',
      report: SystemResetService.executeReset(requestId, code)
    });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}
