/**
 * @file AssistenteInstalacao.gs
 * @fileoverview Assistente e execução protegida da instalação do PNP.
 */

/** Abre o assistente somente para uma cópia válida e uma conta autorizada. */
function iniciarAssistenteInstalacao() {
  const ui = SpreadsheetApp.getUi();
  try {
    obterContextoAssistenteInstalacaoPnp();
  } catch (error) {
    ui.alert('Instalação não permitida', error.message, ui.ButtonSet.OK);
    return { status: 'blocked', message: error.message };
  }
  const html = HtmlService.createHtmlOutputFromFile('AssistenteInstalacaoView')
    .setWidth(580).setHeight(640);
  ui.showModalDialog(html, 'Professores no Painel (PNP) — Instalação');
  return { status: 'opened' };
}

/** Relê os requisitos no servidor a cada abertura/retomada do assistente. */
function obterContextoAssistenteInstalacaoPnp() {
  const context = validarRequisitosInstalacaoPnp_();
  const actor = AccessControlService.requireSetupPrivilege();
  const installation = context.record.installation;
  return {
    spreadsheetName: context.spreadsheet.getName(),
    email: actor.email,
    version: SETUP_V10_CONFIG.version,
    installed: Boolean(installation && installation.status === 'installed'),
    retry: Boolean(installation && installation.status !== 'installed'),
    firstSuperUser: actor.bootstrap ? ACCESS_CONTROL_CONFIG.firstSuperUser.email : '',
    sheets: [
      KNOWLEDGE_AREAS_CONFIG.sheetName,
      TEACHER_AREAS_CONFIG.associationSheetName,
      TEACHER_AREAS_CONFIG.controlSheetName,
      TEACHER_CONDITIONS_CONFIG.sheetName,
      ACCESS_CONTROL_CONFIG.userSheetName,
      ACCESS_CONTROL_CONFIG.auditSheetName
    ]
  };
}

/** Único endpoint de escrita usado pelo assistente HTML. */
function executarInstalacaoPnp() {
  return instalarVersao1009();
}

/**
 * Coordenador compartilhado por instalarVersao10() e todos os seus aliases.
 * Valida de novo no momento da escrita e serializa a instalação por documento.
 */
function executarInstalacaoProtegidaPnp_() {
  validarRequisitosInstalacaoPnp_();
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(5000)) {
    throw new Error('Outra operação está em andamento nesta planilha. Aguarde e tente novamente.');
  }
  let context = null;
  let started = false;
  try {
    context = validarRequisitosInstalacaoPnp_();
    const actor = AccessControlService.requireSetupPrivilege();
    if (context.record.installation && context.record.installation.status === 'installed') {
      return { status: 'already_installed', version: SETUP_V10_CONFIG.version };
    }
    context.record.installation = {
      status: 'installing',
      spreadsheetId: context.spreadsheet.getId(),
      startedAt: new Date().toISOString()
    };
    salvarRegistroInstaladoraPnp_(context.sheet, context.record);
    started = true;

    const plan = obterPlanoInstalacaoVersao10();
    const structures = criarEstruturasVersao10_();
    // A criação das estruturas continua sem dados de negócio. O assistente
    // cadastra à parte apenas a conta bootstrap já autorizada pelo sistema.
    let initialSuperUserCreated = false;
    if (actor.bootstrap) {
      AccessControlService.appendUser({
        name: ACCESS_CONTROL_CONFIG.firstSuperUser.name,
        email: ACCESS_CONTROL_CONFIG.firstSuperUser.email,
        profile: ACCESS_CONTROL_CONFIG.profiles.SUPER
      }, actor);
      initialSuperUserCreated = true;
    }
    const smoke = executarSmokeTestVersao10();
    context.record.installation.status = 'installed';
    context.record.installation.finishedAt = new Date().toISOString();
    salvarRegistroInstaladoraPnp_(context.sheet, context.record);
    SpreadsheetApp.flush();
    return {
      status: 'installed',
      version: SETUP_V10_CONFIG.version,
      installationPlan: plan,
      structures: structures,
      initialSuperUserCreated: initialSuperUserCreated,
      helpAssistant: smoke
    };
  } catch (error) {
    if (started) {
      context.record.installation.status = 'failed';
      try {
        salvarRegistroInstaladoraPnp_(context.sheet, context.record);
      } catch (recordError) {
        Logger.log('Não foi possível registrar a interrupção da instalação: ' + recordError.message);
      }
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}
