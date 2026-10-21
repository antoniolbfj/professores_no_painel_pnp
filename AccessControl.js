/**
 * @file AccessControl.gs
 * @fileoverview Autenticação institucional, perfis administrativos e auditoria.
 * @version 10.0.9
 *
 * O acesso público institucional é concedido automaticamente a contas
 * autenticadas do domínio @iftm.edu.br. Administradores e Super Usuários são
 * persistidos na aba USUARIOS. Todas as operações sensíveis devem chamar os
 * guardas deste módulo no backend.
 */

const ACCESS_CONTROL_CONFIG = Object.freeze({
  version: '10.0.9',
  domain: 'iftm.edu.br',
  userSheetName: 'USUARIOS',
  auditSheetName: 'AUDITORIA_SEGURANCA',
  firstSuperUser: Object.freeze({
    name: 'Antonio Barros',
    email: 'antoniobarros@iftm.edu.br'
  }),
  profiles: Object.freeze({
    PUBLIC: 'PUBLICO_INSTITUCIONAL',
    ADMIN: 'ADMINISTRADOR',
    SUPER: 'SUPER_USUARIO'
  }),
  userHeaders: Object.freeze([
    'ID_Usuario',
    'Nome_Completo',
    'Email',
    'Perfil',
    'Ativo',
    'Criado_Em',
    'Atualizado_Em',
    'Criado_Por',
    'Atualizado_Por'
  ]),
  auditHeaders: Object.freeze([
    'ID_Evento',
    'Data_Hora',
    'Usuario',
    'Perfil',
    'Acao',
    'Resultado',
    'Detalhes'
  ])
});

const AccessControlLog = Object.freeze({
  write: function(level, event, metadata) {
    Logger.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level,
      event: event,
      appVersion: typeof APP_INFO !== 'undefined' ? APP_INFO.version : ACCESS_CONTROL_CONFIG.version,
      origemExecucao: metadata && metadata.origemExecucao
        ? metadata.origemExecucao
        : 'aplicacao',
      metadata: metadata || {}
    }));
  }
});

const AccessControlService = {
  /** Retorna o e-mail autenticado ou falha com orientação de implantação. */
  getActiveEmail: function() {
    const email = AccessControlService.normalizeEmail(
      Session.getActiveUser().getEmail()
    );
    if (!email) {
      throw new Error(
        'Não foi possível identificar o usuário autenticado. Implante o app da Web '
        + 'para executar como o usuário que acessa e restrinja o acesso ao domínio IFTM.'
      );
    }
    return email;
  },

  normalizeEmail: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .toLowerCase();
  },

  normalizeText: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .replace(/\s+/g, ' ');
  },

  isInstitutionalEmail: function(email) {
    const normalized = AccessControlService.normalizeEmail(email);
    return normalized.endsWith('@' + ACCESS_CONTROL_CONFIG.domain)
      && normalized.length > ACCESS_CONTROL_CONFIG.domain.length + 1;
  },

  assertInstitutionalEmail: function(email) {
    const normalized = AccessControlService.normalizeEmail(email);
    if (!AccessControlService.isInstitutionalEmail(normalized)) {
      throw new Error('Informe um e-mail institucional válido do domínio @iftm.edu.br.');
    }
    return normalized;
  },

  getUserSheet: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet && spreadsheet.getSheetByName(ACCESS_CONTROL_CONFIG.userSheetName);
    if (!sheet) {
      throw new Error(
        'A estrutura de usuários ainda não foi instalada. Execute instalarVersao10().'
      );
    }
    AccessControlService.assertHeaders(
      sheet,
      ACCESS_CONTROL_CONFIG.userHeaders,
      ACCESS_CONTROL_CONFIG.userSheetName
    );
    return sheet;
  },

  getAuditSheet: function() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet && spreadsheet.getSheetByName(ACCESS_CONTROL_CONFIG.auditSheetName);
    if (!sheet) return null;
    AccessControlService.assertHeaders(
      sheet,
      ACCESS_CONTROL_CONFIG.auditHeaders,
      ACCESS_CONTROL_CONFIG.auditSheetName
    );
    return sheet;
  },

  assertHeaders: function(sheet, expectedHeaders, label) {
    const values = sheet.getRange(1, 1, 1, expectedHeaders.length)
      .getDisplayValues()[0];
    const problems = [];
    expectedHeaders.forEach(function(expected, index) {
      const actual = String(values[index] || '').trim();
      if (actual !== expected) {
        problems.push('coluna ' + (index + 1) + ': esperado “' + expected
          + '”, encontrado “' + (actual || '[vazio]') + '”');
      }
    });
    if (problems.length > 0) {
      throw new Error('Cabeçalhos incompatíveis em ' + label + ': ' + problems.join(' | ') + '.');
    }
  },

  readUsers: function() {
    const sheet = AccessControlService.getUserSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    const values = sheet.getRange(
      2,
      1,
      lastRow - 1,
      ACCESS_CONTROL_CONFIG.userHeaders.length
    ).getValues();
    const users = values.map(function(row, offset) {
      return AccessControlService.rowToUser(row, offset + 2);
    }).filter(function(user) {
      return Boolean(user.id || user.name || user.email || user.profile);
    });
    AccessControlService.assertUserRegistryIntegrity(users);
    return users;
  },

  /**
   * Bloqueia registros administrativos ambíguos ou corrompidos. A validação
   * ocorre antes da resolução do perfil para impedir que uma duplicidade seja
   * explorada para elevar privilégios.
   *
   * @param {Array<Object>} users Usuários lidos da planilha.
   */
  assertUserRegistryIntegrity: function(users) {
    const ids = {};
    const emails = {};
    const allowedProfiles = [
      ACCESS_CONTROL_CONFIG.profiles.ADMIN,
      ACCESS_CONTROL_CONFIG.profiles.SUPER
    ];
    (users || []).forEach(function(user) {
      const prefix = 'Linha ' + user.rowNumber + ' da aba '
        + ACCESS_CONTROL_CONFIG.userSheetName + ': ';
      if (!user.id) throw new Error(prefix + 'ID do usuário não informado.');
      if (!user.name) throw new Error(prefix + 'nome completo não informado.');
      AccessControlService.assertInstitutionalEmail(user.email);
      if (allowedProfiles.indexOf(user.profile) < 0) {
        throw new Error(prefix + 'perfil administrativo inválido.');
      }
      if (ids[user.id]) {
        throw new Error('ID de usuário duplicado nas linhas ' + ids[user.id]
          + ' e ' + user.rowNumber + '.');
      }
      if (emails[user.email]) {
        throw new Error('E-mail administrativo duplicado nas linhas ' + emails[user.email]
          + ' e ' + user.rowNumber + ': ' + user.email + '.');
      }
      ids[user.id] = user.rowNumber;
      emails[user.email] = user.rowNumber;
    });
  },

  rowToUser: function(row, rowNumber) {
    return {
      rowNumber: rowNumber,
      id: String(row[0] || '').trim(),
      name: AccessControlService.normalizeText(row[1]),
      email: AccessControlService.normalizeEmail(row[2]),
      profile: String(row[3] || '').trim(),
      active: AccessControlService.toBoolean(row[4], false),
      createdAt: AccessControlService.serializeDate(row[5]),
      updatedAt: AccessControlService.serializeDate(row[6]),
      createdBy: AccessControlService.normalizeEmail(row[7]),
      updatedBy: AccessControlService.normalizeEmail(row[8])
    };
  },

  serializeDate: function(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
    return value === null || value === undefined ? '' : String(value);
  },

  toBoolean: function(value, defaultValue) {
    if (value === true || value === false) return value;
    const normalized = String(value === null || value === undefined ? '' : value)
      .trim().toLowerCase();
    if (['true', 'verdadeiro', 'sim', '1'].indexOf(normalized) >= 0) return true;
    if (['false', 'falso', 'não', 'nao', '0', ''].indexOf(normalized) >= 0) return false;
    return Boolean(defaultValue);
  },

  findUserByEmail: function(email, users) {
    const normalized = AccessControlService.normalizeEmail(email);
    return (users || AccessControlService.readUsers()).filter(function(user) {
      return user.email === normalized;
    })[0] || null;
  },

  /** Constrói as permissões efetivas de forma pura e testável. */
  buildPermissions: function(profile) {
    const administrative = profile === ACCESS_CONTROL_CONFIG.profiles.ADMIN
      || profile === ACCESS_CONTROL_CONFIG.profiles.SUPER;
    return {
      viewDashboard: true,
      manageData: administrative,
      manageAreas: administrative,
      manageTeachers: administrative,
      manageUsers: administrative,
      generateGeneralReport: administrative,
      editUsers: profile === ACCESS_CONTROL_CONFIG.profiles.SUPER,
      resetDatabase: profile === ACCESS_CONTROL_CONFIG.profiles.SUPER
    };
  },

  getContext: function() {
    const email = AccessControlService.getActiveEmail();
    AccessControlService.assertInstitutionalEmail(email);
    const user = AccessControlService.findUserByEmail(email);
    const administrative = user && user.active
      && [ACCESS_CONTROL_CONFIG.profiles.ADMIN, ACCESS_CONTROL_CONFIG.profiles.SUPER]
        .indexOf(user.profile) >= 0;
    const profile = administrative
      ? user.profile
      : ACCESS_CONTROL_CONFIG.profiles.PUBLIC;
    return {
      email: email,
      name: administrative && user.name ? user.name : email.split('@')[0],
      profile: profile,
      registered: Boolean(user),
      registeredActive: Boolean(user && user.active),
      permissions: AccessControlService.buildPermissions(profile)
    };
  },

  requireInstitutionalUser: function() {
    return AccessControlService.getContext();
  },

  /**
   * Autoriza a primeira instalação somente para a conta bootstrap. Depois da
   * criação do primeiro cadastro, exige perfil Super Usuário ativo.
   * Uma aba USUARIOS ainda vazia permite retomar a instalação interrompida.
   */
  requireSetupPrivilege: function() {
    const email = AccessControlService.getActiveEmail();
    AccessControlService.assertInstitutionalEmail(email);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet && spreadsheet.getSheetByName(ACCESS_CONTROL_CONFIG.userSheetName);
    if (!sheet || AccessControlService.readUsers().length === 0) {
      if (email !== ACCESS_CONTROL_CONFIG.firstSuperUser.email) {
        throw new Error('Somente o primeiro Super Usuário pode executar a instalação inicial.');
      }
      return {
        email: email,
        profile: ACCESS_CONTROL_CONFIG.profiles.SUPER,
        bootstrap: true
      };
    }
    return AccessControlService.requireSuperUser();
  },

  requireRole: function(allowedProfiles) {
    const context = AccessControlService.getContext();
    if ((allowedProfiles || []).indexOf(context.profile) < 0) {
      AccessControlService.audit(
        'ACESSO_NEGADO',
        'NEGADO',
        { allowedProfiles: allowedProfiles || [], currentProfile: context.profile },
        context
      );
      throw new Error('Você não possui permissão para executar esta operação.');
    }
    return context;
  },

  requireAdministrator: function() {
    return AccessControlService.requireRole([
      ACCESS_CONTROL_CONFIG.profiles.ADMIN,
      ACCESS_CONTROL_CONFIG.profiles.SUPER
    ]);
  },

  requireSuperUser: function() {
    return AccessControlService.requireRole([
      ACCESS_CONTROL_CONFIG.profiles.SUPER
    ]);
  },

  validateProfileForCreation: function(profile, actor) {
    const normalized = String(profile || '').trim();
    const allowed = actor.profile === ACCESS_CONTROL_CONFIG.profiles.SUPER
      ? [ACCESS_CONTROL_CONFIG.profiles.ADMIN, ACCESS_CONTROL_CONFIG.profiles.SUPER]
      : [ACCESS_CONTROL_CONFIG.profiles.ADMIN];
    if (allowed.indexOf(normalized) < 0) {
      throw new Error('O perfil informado não pode ser atribuído pelo usuário atual.');
    }
    return normalized;
  },

  validateUserPayload: function(payload, actor, editing) {
    const source = payload || {};
    const name = AccessControlService.normalizeText(source.name);
    if (!name || name.length < 3) throw new Error('Informe o nome completo do usuário.');
    const email = AccessControlService.assertInstitutionalEmail(source.email);
    const profile = editing
      ? String(source.profile || '').trim()
      : AccessControlService.validateProfileForCreation(source.profile, actor);
    if (editing && actor.profile !== ACCESS_CONTROL_CONFIG.profiles.SUPER) {
      throw new Error('Somente o Super Usuário pode editar usuários.');
    }
    if ([ACCESS_CONTROL_CONFIG.profiles.ADMIN, ACCESS_CONTROL_CONFIG.profiles.SUPER]
      .indexOf(profile) < 0) {
      throw new Error('Perfil administrativo inválido.');
    }
    return { name: name, email: email, profile: profile };
  },

  countActiveSuperUsers: function(users) {
    return (users || AccessControlService.readUsers()).filter(function(user) {
      return user.active && user.profile === ACCESS_CONTROL_CONFIG.profiles.SUPER;
    }).length;
  },

  assertTargetCanBeChanged: function(target, actor, action) {
    if (!target) throw new Error('Usuário não encontrado.');
    if (target.email === actor.email
        && ['INATIVAR', 'EXCLUIR'].indexOf(String(action || '').toUpperCase()) >= 0) {
      throw new Error('Você não pode inativar ou excluir a própria conta.');
    }
    if (target.email === ACCESS_CONTROL_CONFIG.firstSuperUser.email
        && ['INATIVAR', 'EXCLUIR'].indexOf(String(action || '').toUpperCase()) >= 0) {
      throw new Error('O primeiro Super Usuário é protegido contra inativação ou exclusão.');
    }
    if (actor.profile !== ACCESS_CONTROL_CONFIG.profiles.SUPER
        && target.profile === ACCESS_CONTROL_CONFIG.profiles.SUPER) {
      throw new Error('Administradores não podem alterar Super Usuários.');
    }
    if (target.profile === ACCESS_CONTROL_CONFIG.profiles.SUPER
        && target.active
        && ['INATIVAR', 'EXCLUIR'].indexOf(String(action || '').toUpperCase()) >= 0
        && AccessControlService.countActiveSuperUsers() <= 1) {
      throw new Error('O último Super Usuário ativo não pode ser inativado ou excluído.');
    }
  },


  findAppendRow: function(sheet, width) {
    const lastRow = Math.max(sheet.getLastRow(), 1);
    if (lastRow <= 1) return 2;
    const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    let lastRealOffset = -1;
    values.forEach(function(row, offset) {
      const hasRealData = row.some(function(value, index) {
        if (index === 4 && value === false) return false;
        return value !== null && value !== undefined && String(value).trim() !== '';
      });
      if (hasRealData) lastRealOffset = offset;
    });
    return lastRealOffset < 0 ? 2 : lastRealOffset + 3;
  },

  appendUser: function(user, actor) {
    const sheet = AccessControlService.getUserSheet();
    const now = new Date();
    const row = [
      Utilities.getUuid(),
      user.name,
      user.email,
      user.profile,
      true,
      now,
      now,
      actor.email,
      actor.email
    ];
    sheet.getRange(AccessControlService.findAppendRow(sheet, row.length), 1, 1, row.length).setValues([row]);
    return AccessControlService.findUserByEmail(user.email);
  },

  updateUserRow: function(target, values) {
    const sheet = AccessControlService.getUserSheet();
    const current = sheet.getRange(
      target.rowNumber,
      1,
      1,
      ACCESS_CONTROL_CONFIG.userHeaders.length
    ).getValues()[0];
    Object.keys(values || {}).forEach(function(key) {
      const indexes = {
        name: 1,
        email: 2,
        profile: 3,
        active: 4,
        updatedAt: 6,
        updatedBy: 8
      };
      if (Object.prototype.hasOwnProperty.call(indexes, key)) {
        current[indexes[key]] = values[key];
      }
    });
    sheet.getRange(target.rowNumber, 1, 1, current.length).setValues([current]);
  },

  audit: function(action, result, details, actor) {
    try {
      const context = actor || AccessControlService.getContext();
      const sheet = AccessControlService.getAuditSheet();
      const metadata = details || {};
      AccessControlLog.write(result === 'SUCESSO' ? 'INFO' : 'WARNING', action, {
        usuario: context.email,
        perfil: context.profile,
        resultado: result,
        detalhes: metadata
      });
      if (!sheet) return;
      sheet.appendRow([
        Utilities.getUuid(),
        new Date(),
        context.email,
        context.profile,
        action,
        result,
        JSON.stringify(metadata)
      ]);
    } catch (auditError) {
      AccessControlLog.write('ERROR', 'audit_write_failed', {
        originalAction: action,
        message: auditError.message
      });
    }
  }
};

/** Retorna o usuário autenticado e as permissões efetivas. */
function getCurrentUserContext() {
  try {
    return JSON.stringify({
      status: 'success',
      user: AccessControlService.getContext(),
      profiles: ACCESS_CONTROL_CONFIG.profiles,
      version: ACCESS_CONTROL_CONFIG.version
    });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

/** Lista usuários administrativos. */
function getAdministrativeUsers() {
  try {
    const actor = AccessControlService.requireAdministrator();
    const users = AccessControlService.readUsers().map(function(user) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        createdBy: user.createdBy,
        updatedBy: user.updatedBy
      };
    });
    return JSON.stringify({ status: 'success', users: users, actor: actor });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

/** Cadastra Administrador ou Super Usuário conforme a permissão do ator. */
function createAdministrativeUser(payload) {
  try {
    const actor = AccessControlService.requireAdministrator();
    const normalized = AccessControlService.validateUserPayload(payload, actor, false);
    const users = AccessControlService.readUsers();
    if (AccessControlService.findUserByEmail(normalized.email, users)) {
      throw new Error('Já existe um usuário administrativo com esse e-mail.');
    }
    const created = AccessControlService.appendUser(normalized, actor);
    AccessControlService.audit('USUARIO_CADASTRADO', 'SUCESSO', {
      targetEmail: normalized.email,
      targetProfile: normalized.profile
    }, actor);
    return JSON.stringify({ status: 'success', user: created });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

/** Edita nome, e-mail e perfil. Exclusivo do Super Usuário. */
function updateAdministrativeUser(userId, payload) {
  try {
    const actor = AccessControlService.requireSuperUser();
    const users = AccessControlService.readUsers();
    const target = users.filter(function(user) { return user.id === String(userId || ''); })[0];
    if (!target) throw new Error('Usuário não encontrado.');
    const normalized = AccessControlService.validateUserPayload(payload, actor, true);
    if (target.email === actor.email
        && (normalized.email !== target.email || normalized.profile !== target.profile)) {
      throw new Error('Você pode editar o próprio nome, mas não pode alterar o próprio e-mail ou perfil.');
    }
    if (target.email === ACCESS_CONTROL_CONFIG.firstSuperUser.email
        && normalized.profile !== ACCESS_CONTROL_CONFIG.profiles.SUPER) {
      throw new Error('O primeiro Super Usuário deve permanecer com o perfil Super Usuário.');
    }
    const duplicate = users.filter(function(user) {
      return user.email === normalized.email && user.id !== target.id;
    })[0];
    if (duplicate) throw new Error('Já existe outro usuário com esse e-mail.');
    if (target.profile === ACCESS_CONTROL_CONFIG.profiles.SUPER
        && normalized.profile !== ACCESS_CONTROL_CONFIG.profiles.SUPER
        && target.active
        && AccessControlService.countActiveSuperUsers(users) <= 1) {
      throw new Error('O perfil do último Super Usuário ativo não pode ser removido.');
    }
    AccessControlService.updateUserRow(target, {
      name: normalized.name,
      email: normalized.email,
      profile: normalized.profile,
      updatedAt: new Date(),
      updatedBy: actor.email
    });
    AccessControlService.audit('USUARIO_EDITADO', 'SUCESSO', {
      targetId: target.id,
      previousEmail: target.email,
      targetEmail: normalized.email,
      targetProfile: normalized.profile
    }, actor);
    return JSON.stringify({ status: 'success' });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

/** Inativa usuário. Administrador e Super Usuário, respeitando proteções. */
function inactivateAdministrativeUser(userId) {
  try {
    const actor = AccessControlService.requireAdministrator();
    const users = AccessControlService.readUsers();
    const target = users.filter(function(user) { return user.id === String(userId || ''); })[0];
    AccessControlService.assertTargetCanBeChanged(target, actor, 'INATIVAR');
    if (!target.active) return JSON.stringify({ status: 'success', unchanged: true });
    AccessControlService.updateUserRow(target, {
      active: false,
      updatedAt: new Date(),
      updatedBy: actor.email
    });
    AccessControlService.audit('USUARIO_INATIVADO', 'SUCESSO', {
      targetId: target.id,
      targetEmail: target.email
    }, actor);
    return JSON.stringify({ status: 'success' });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

/** Reativa usuário. Exclusivo do Super Usuário. */
function reactivateAdministrativeUser(userId) {
  try {
    const actor = AccessControlService.requireSuperUser();
    const users = AccessControlService.readUsers();
    const target = users.filter(function(user) { return user.id === String(userId || ''); })[0];
    if (!target) throw new Error('Usuário não encontrado.');
    if (target.active) return JSON.stringify({ status: 'success', unchanged: true });
    AccessControlService.updateUserRow(target, {
      active: true,
      updatedAt: new Date(),
      updatedBy: actor.email
    });
    AccessControlService.audit('USUARIO_REATIVADO', 'SUCESSO', {
      targetId: target.id,
      targetEmail: target.email
    }, actor);
    return JSON.stringify({ status: 'success' });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

/** Exclui fisicamente usuário. Exclusivo do Super Usuário. */
function deleteAdministrativeUser(userId) {
  try {
    const actor = AccessControlService.requireSuperUser();
    const users = AccessControlService.readUsers();
    const target = users.filter(function(user) { return user.id === String(userId || ''); })[0];
    AccessControlService.assertTargetCanBeChanged(target, actor, 'EXCLUIR');
    AccessControlService.getUserSheet().deleteRow(target.rowNumber);
    AccessControlService.audit('USUARIO_EXCLUIDO', 'SUCESSO', {
      targetId: target.id,
      targetEmail: target.email,
      targetProfile: target.profile
    }, actor);
    return JSON.stringify({ status: 'success' });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message });
  }
}
