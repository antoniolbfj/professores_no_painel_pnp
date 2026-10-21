/**
 * @file HelpAssistant.gs
 * @fileoverview Orquestração, regras de perfil e prontidão da Ema.
 * @version 10.0.9
 */

const HELP_ASSISTANT_CONFIG = Object.freeze({
  version: '10.0.9',
  states: Object.freeze([
    'IDLE',
    'WELCOME',
    'PREPARING',
    'WAITING_FOR_ELEMENT',
    'WAITING_FOR_CLICK',
    'SHOWING_MESSAGE',
    'PAUSED',
    'COMPLETED',
    'DISMISSED'
  ])
});

const HelpAssistantService = Object.freeze({
  /** Monta o contrato inicial consumido pelo add-on frontend. */
  buildBootstrap: function(context) {
    const safeContext = context || AccessControlService.getContext();
    const readiness = HelpAssistantService.getBaseReadiness(safeContext);
    const progress = HelpPersistenceService.load(safeContext);
    const tutorials = HelpTutorialCatalog.getAvailable(safeContext);
    const tips = HelpTutorialCatalog.getContextTips(safeContext);
    const releaseNotes = HelpTutorialCatalog.getReleaseNotes(safeContext);
    const registered = HelpPersistenceService.canPersist(safeContext);
    const baseTutorial = tutorials.filter(function(item) {
      return item.id === 'base-preparation';
    })[0];
    const dashboardTutorial = tutorials.filter(function(item) {
      return item.id === 'dashboard';
    })[0];
    const emptyTutorial = tutorials.filter(function(item) {
      return item.id === 'empty-state';
    })[0];

    let autoStartTutorialId = '';
    if (!readiness.baseReady && safeContext.permissions
        && safeContext.permissions.manageData && baseTutorial) {
      autoStartTutorialId = 'base-preparation';
    } else if (!readiness.baseReady && emptyTutorial) {
      autoStartTutorialId = 'empty-state';
    } else if (dashboardTutorial) {
      const publicProfile = safeContext.profile === 'PUBLICO_INSTITUCIONAL';
      const alreadyHandled = Boolean(progress.completed.dashboard
        || progress.dismissed.dashboard);
      if (publicProfile || !alreadyHandled) autoStartTutorialId = 'dashboard';
    }
    const welcomePolicy = HelpAssistantService.getWelcomePolicy(
      autoStartTutorialId,
      safeContext,
      progress
    );

    return {
      version: HELP_ASSISTANT_CONFIG.version,
      states: HELP_ASSISTANT_CONFIG.states.slice(),
      user: {
        name: safeContext.name,
        profile: safeContext.profile,
        registered: Boolean(safeContext.registered),
        registeredActive: Boolean(safeContext.registeredActive),
        permissions: safeContext.permissions || {}
      },
      persistenceEnabled: registered,
      initialSetupRequired: welcomePolicy.initialSetupRequired,
      showWelcome: welcomePolicy.showWelcome,
      autoStartTutorialId: autoStartTutorialId,
      readiness: readiness,
      progress: progress,
      tutorials: tutorials,
      contextTips: tips,
      releaseNotes: releaseNotes
    };
  },

  /** Define quando a apresentação precisa reaparecer, inclusive após reset. */
  getWelcomePolicy: function(autoStartTutorialId, context, progress) {
    const initialSetupRequired = autoStartTutorialId === 'base-preparation';
    return {
      initialSetupRequired: initialSetupRequired,
      showWelcome: initialSetupRequired
        || Boolean(context && context.profile === 'PUBLICO_INSTITUCIONAL')
        || !Boolean(progress && progress.welcomeDismissed)
    };
  },

  /**
   * Avalia a preparação real da base. Visitar uma tela não satisfaz o gate:
   * os dados, áreas e associações precisam existir de fato.
   */
  getBaseReadiness: function(context) {
    const result = {
      checked: false,
      annualDataReady: false,
      teachersReady: false,
      areasReady: false,
      assignmentsReady: false,
      usersReady: false,
      baseReady: false,
      nextRequiredStage: 'DATA',
      details: {
        years: 0,
        disciplineRows: 0,
        studentRows: 0,
        teacherRows: 0,
        activeAreas: 0,
        activeAssignments: 0,
        activeAdministrativeUsers: 0
      },
      warnings: []
    };
    try {
      const plan = Dao.getDashboardLoadPlan();
      const years = Array.isArray(plan.years) ? plan.years : [];
      const completeYears = years.filter(function(item) {
        return Number(item.disciplineRows || 0) > 0
          && item.studentsAvailable === true
          && Number(item.studentRows || 0) > 0;
      });
      result.details.years = completeYears.length;
      result.details.disciplineRows = Number(plan.totalDisciplineRows || 0);
      result.details.studentRows = completeYears.reduce(function(total, item) {
        return total + Number(item.studentRows || 0);
      }, 0);
      result.details.teacherRows = Number(plan.teacherRegistryRows || 0);
      result.annualDataReady = completeYears.length > 0
        && result.details.disciplineRows > 0
        && result.details.studentRows > 0;
      result.teachersReady = result.details.teacherRows > 0;

      if (typeof TeacherAreasService !== 'undefined') {
        const reference = TeacherAreasService.getDashboardReferenceData();
        const summary = reference.summary || {};
        result.details.activeAreas = Number(summary.activeAreaCount || 0);
        result.details.activeAssignments = Number(summary.activeAssignmentCount || 0);
        result.areasReady = result.details.activeAreas > 0;
        result.assignmentsReady = result.details.activeAssignments > 0;
      } else {
        result.warnings.push('Serviço de áreas indisponível.');
      }

      if (context && context.permissions && context.permissions.manageUsers) {
        const users = AccessControlService.readUsers();
        result.details.activeAdministrativeUsers = users.filter(function(user) {
          return user.active === true;
        }).length;
        result.usersReady = result.details.activeAdministrativeUsers > 0;
      } else {
        result.usersReady = true;
      }

      result.baseReady = result.annualDataReady
        && result.teachersReady
        && result.areasReady
        && result.assignmentsReady
        && result.usersReady;
      if (!result.annualDataReady || !result.teachersReady) {
        result.nextRequiredStage = 'DATA';
      } else if (!result.areasReady || !result.assignmentsReady) {
        result.nextRequiredStage = 'AREAS';
      } else if (!result.usersReady) {
        result.nextRequiredStage = 'USERS';
      } else {
        result.nextRequiredStage = 'DASHBOARD';
      }
      result.checked = true;
    } catch (error) {
      result.warnings.push(error.message || String(error));
      HelpAssistantService._log('WARNING', 'help_readiness_failed', {
        message: error.message || String(error)
      });
    }
    return result;
  },

  /** Persiste um patch validado do frontend. */
  saveProgress: function(context, patch) {
    const source = patch && typeof patch === 'object' ? patch : {};
    if (source.active && HELP_ASSISTANT_CONFIG.states.indexOf(
      String(source.active.state || '').toUpperCase()
    ) < 0) {
      throw new Error('Estado inválido do módulo de ajuda.');
    }
    return HelpPersistenceService.update(context, source);
  },

  _log: function(level, event, metadata) {
    Logger.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level,
      event: event,
      appVersion: HELP_ASSISTANT_CONFIG.version,
      origemExecucao: 'ema_help',
      metadata: metadata || {}
    }));
  }
});

/** Retorna contexto, tutoriais, preferências e prontidão para a Ema. */
function getHelpBootstrapContext() {
  try {
    const context = AccessControlService.requireInstitutionalUser();
    return JSON.stringify({
      status: 'success',
      help: HelpAssistantService.buildBootstrap(context)
    });
  } catch (error) {
    HelpAssistantService._log('ERROR', 'help_bootstrap_failed', {
      message: error.message || String(error)
    });
    return JSON.stringify({ status: 'error', message: error.message || String(error) });
  }
}

/** Atualiza preferências e progresso. */
function saveHelpProgress(payload) {
  try {
    const context = AccessControlService.requireInstitutionalUser();
    const result = HelpAssistantService.saveProgress(context, payload);
    return JSON.stringify({
      status: 'success',
      persisted: result.persisted,
      state: result.state
    });
  } catch (error) {
    HelpAssistantService._log('ERROR', 'help_progress_save_failed', {
      message: error.message || String(error)
    });
    return JSON.stringify({ status: 'error', message: error.message || String(error) });
  }
}

/** Reabre um tutorial concluído ou dispensado. */
function resetHelpTutorial(tutorialId) {
  try {
    const context = AccessControlService.requireInstitutionalUser();
    const tutorial = HelpTutorialCatalog.getById(tutorialId);
    if (!tutorial) throw new Error('Tutorial não encontrado.');
    const result = HelpPersistenceService.resetTutorial(context, tutorial.id);
    return JSON.stringify({
      status: 'success',
      persisted: result.persisted,
      state: result.state,
      tutorial: tutorial
    });
  } catch (error) {
    return JSON.stringify({ status: 'error', message: error.message || String(error) });
  }
}
