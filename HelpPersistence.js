/**
 * @file HelpPersistence.gs
 * @fileoverview Preferências e progresso da Ema por usuário cadastrado.
 * @version 10.0.9
 */

const HELP_PERSISTENCE_CONFIG = Object.freeze({
  schemaVersion: 1,
  tutorialVersion: '10.0.9',
  propertyKey: 'EMA_HELP_STATE_V10',
  maximumSerializedLength: 50000
});

const HelpPersistenceService = Object.freeze({
  /** Estado inicial seguro. */
  createDefaultState: function() {
    return {
      schemaVersion: HELP_PERSISTENCE_CONFIG.schemaVersion,
      tutorialVersion: HELP_PERSISTENCE_CONFIG.tutorialVersion,
      welcomeDismissed: false,
      completed: {},
      dismissed: {},
      seenTips: {},
      active: null,
      updatedAt: ''
    };
  },

  /** Somente usuários administrativos ativos possuem persistência duradoura. */
  canPersist: function(context) {
    return Boolean(context && context.registeredActive
      && (context.profile === 'ADMINISTRADOR' || context.profile === 'SUPER_USUARIO'));
  },

  /** Lê e normaliza as preferências do usuário atual. */
  load: function(context) {
    if (!HelpPersistenceService.canPersist(context)) {
      return HelpPersistenceService.createDefaultState();
    }
    const properties = PropertiesService.getUserProperties();
    const raw = properties.getProperty(HELP_PERSISTENCE_CONFIG.propertyKey);
    if (!raw) return HelpPersistenceService.createDefaultState();
    try {
      return HelpPersistenceService.normalizeState(JSON.parse(raw));
    } catch (error) {
      HelpPersistenceService._log('WARNING', 'help_state_parse_failed', {
        message: error.message
      });
      return HelpPersistenceService.createDefaultState();
    }
  },

  /** Mescla somente campos reconhecidos e grava de forma serializada. */
  update: function(context, patch) {
    if (!HelpPersistenceService.canPersist(context)) {
      return {
        persisted: false,
        state: HelpPersistenceService.applyPatch(
          HelpPersistenceService.createDefaultState(),
          patch
        )
      };
    }
    const lock = LockService.getUserLock();
    if (!lock.tryLock(5000)) {
      throw new Error('Não foi possível salvar o progresso da ajuda agora. Tente novamente.');
    }
    try {
      const state = HelpPersistenceService.applyPatch(
        HelpPersistenceService.load(context),
        patch
      );
      state.updatedAt = new Date().toISOString();
      const serialized = JSON.stringify(state);
      if (serialized.length > HELP_PERSISTENCE_CONFIG.maximumSerializedLength) {
        throw new Error('O estado do módulo de ajuda excedeu o limite seguro.');
      }
      PropertiesService.getUserProperties().setProperty(
        HELP_PERSISTENCE_CONFIG.propertyKey,
        serialized
      );
      return { persisted: true, state: state };
    } finally {
      lock.releaseLock();
    }
  },

  /** Remove a conclusão de um tutorial para revisão manual. */
  resetTutorial: function(context, tutorialId) {
    const id = HelpPersistenceService.normalizeIdentifier(tutorialId);
    const state = HelpPersistenceService.load(context);
    delete state.completed[id];
    delete state.dismissed[id];
    if (state.active && state.active.tutorialId === id) state.active = null;
    return HelpPersistenceService.update(context, state);
  },

  /** Aplica um patch serializável sem compartilhar referências externas. */
  applyPatch: function(currentState, patch) {
    const state = HelpPersistenceService.normalizeState(currentState);
    const source = patch && typeof patch === 'object' ? patch : {};

    if (typeof source.welcomeDismissed === 'boolean') {
      state.welcomeDismissed = source.welcomeDismissed;
    }
    ['completed', 'dismissed', 'seenTips'].forEach(function(field) {
      if (!source[field] || typeof source[field] !== 'object') return;
      Object.keys(source[field]).forEach(function(key) {
        const id = HelpPersistenceService.normalizeIdentifier(key);
        if (!id) return;
        if (source[field][key]) state[field][id] = true;
        else delete state[field][id];
      });
    });
    if (Object.prototype.hasOwnProperty.call(source, 'active')) {
      state.active = HelpPersistenceService.normalizeActive(source.active);
    }
    state.schemaVersion = HELP_PERSISTENCE_CONFIG.schemaVersion;
    state.tutorialVersion = HELP_PERSISTENCE_CONFIG.tutorialVersion;
    return state;
  },

  /** Garante que estados antigos ou adulterados não entrem na aplicação. */
  normalizeState: function(value) {
    const source = value && typeof value === 'object' ? value : {};
    const state = HelpPersistenceService.createDefaultState();
    state.welcomeDismissed = source.welcomeDismissed === true;
    ['completed', 'dismissed', 'seenTips'].forEach(function(field) {
      const values = source[field] && typeof source[field] === 'object'
        ? source[field]
        : {};
      Object.keys(values).slice(0, 200).forEach(function(key) {
        const id = HelpPersistenceService.normalizeIdentifier(key);
        if (id && values[key] === true) state[field][id] = true;
      });
    });
    state.active = HelpPersistenceService.normalizeActive(source.active);
    state.updatedAt = String(source.updatedAt || '').slice(0, 40);
    return state;
  },

  normalizeActive: function(value) {
    if (!value || typeof value !== 'object') return null;
    const tutorialId = HelpPersistenceService.normalizeIdentifier(value.tutorialId);
    const stepId = HelpPersistenceService.normalizeIdentifier(value.stepId);
    const state = String(value.state || '').trim().toUpperCase();
    if (!tutorialId || !stepId) return null;
    if (['WAITING_FOR_ELEMENT', 'WAITING_FOR_CLICK', 'SHOWING_MESSAGE', 'PAUSED']
        .indexOf(state) < 0) return null;
    return { tutorialId: tutorialId, stepId: stepId, state: state };
  },

  normalizeIdentifier: function(value) {
    const normalized = String(value || '').trim();
    return /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(normalized) ? normalized : '';
  },

  _log: function(level, event, metadata) {
    Logger.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level,
      event: event,
      appVersion: HELP_PERSISTENCE_CONFIG.tutorialVersion,
      origemExecucao: 'ema_help',
      metadata: metadata || {}
    }));
  }
});
