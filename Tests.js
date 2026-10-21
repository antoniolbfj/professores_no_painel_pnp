/**
 * @file Tests.gs
 * @fileoverview Suíte de testes unitários e de integração das regras críticas do dashboard.
 * @version 10.0.9
 */

/**
 * Utilitários mínimos de asserção para execução no Google Apps Script.
 *
 * @const {Object}
 */
const Assert = {
  /**
   * Compara valores com igualdade estrita.
   *
   * @param {*} expected Valor esperado.
   * @param {*} actual Valor obtido.
   * @param {string} testName Identificação do teste.
   */
  equals: function(expected, actual, testName) {
    if (expected === actual) {
      Logger.log('✅ PASS: ' + testName);
      return;
    }

    const message = '❌ FAIL: ' + testName
      + ' | Esperado: ' + expected
      + ', Obtido: ' + actual;
    Logger.log(message);
    throw new Error(message);
  },

  /**
   * Compara números considerando uma tolerância.
   *
   * @param {number} expected Valor esperado.
   * @param {number} actual Valor obtido.
   * @param {number} tolerance Diferença máxima aceita.
   * @param {string} testName Identificação do teste.
   */
  approximatelyEquals: function(expected, actual, tolerance, testName) {
    const difference = Math.abs(Number(expected) - Number(actual));

    if (difference <= tolerance) {
      Logger.log('✅ PASS: ' + testName);
      return;
    }

    const message = '❌ FAIL: ' + testName
      + ' | Esperado: ' + expected
      + ', Obtido: ' + actual
      + ', Diferença: ' + difference;
    Logger.log(message);
    throw new Error(message);
  },

  /**
   * Confirma a existência de uma propriedade.
   *
   * @param {Object} obj Objeto avaliado.
   * @param {string} prop Propriedade esperada.
   * @param {string} testName Identificação do teste.
   */
  hasProperty: function(obj, prop, testName) {
    if (obj && typeof obj === 'object' && prop in obj) {
      Logger.log('✅ PASS: ' + testName);
      return;
    }

    const message = '❌ FAIL: ' + testName
      + ' | Propriedade "' + prop + '" ausente.';
    Logger.log(message);
    throw new Error(message);
  },

  /**
   * Confirma que um texto contém o fragmento informado.
   *
   * @param {*} text Texto avaliado.
   * @param {string} fragment Fragmento esperado.
   * @param {string} testName Identificação do teste.
   */
  contains: function(text, fragment, testName) {
    Assert.equals(true, String(text).includes(fragment), testName);
  },

  /**
   * Confirma que um texto não contém o fragmento informado.
   *
   * @param {*} text Texto avaliado.
   * @param {string} fragment Fragmento proibido.
   * @param {string} testName Identificação do teste.
   */
  notContains: function(text, fragment, testName) {
    Assert.equals(false, String(text).includes(fragment), testName);
  },

  /**
   * Confirma que uma função lança uma exceção.
   *
   * @param {Function} callback Função avaliada.
   * @param {string} testName Identificação do teste.
   */
  throws: function(callback, testName) {
    let thrown = false;
    let capturedMessage = '';

    try {
      callback();
    } catch (error) {
      thrown = true;
      capturedMessage = error && error.message ? error.message : String(error);
      Logger.log('ℹ️ EXPECTED_FAILURE: ' + testName
        + ' | falhaEsperada=true | origemExecucao=teste'
        + ' | mensagem=' + capturedMessage);
    }

    Assert.equals(true, thrown, testName);
  }
};

/**
 * Executa toda a suíte de testes.
 */
function runAllTests() {
  AccessControlService.requireSuperUser();
  Logger.log('⚙️ Iniciando Suíte de Testes da Arquitetura MVC...');
  const startTime = new Date().getTime();
  let passed = true;

  try {
    test_DashboardRules_normalizeSemester();
    test_DashboardRules_annualAllocation();
    test_DashboardRules_semesterAllocation();
    test_DashboardRules_periodDoesNotAffectSemester();
    test_DashboardRules_invalidSemesterFailsExplicitly();

    test_DashboardRules_clockHoursToClassHours();
    test_DashboardRules_clockHoursToClassHoursAtSixtyMinutes();
    test_DashboardRules_invalidClassDurationFailsExplicitly();
    test_DashboardRules_prepareRecordPreservesClockHourLoad();

    test_TeachingLoadReference_defaultsAndWeeklyClassification();
    test_Dao_teacherWorkRegimeMapping();
    test_TeacherConditions_contract();
    test_AcademicAnalytics_teacherConditionPropagation();
    test_AcademicAnalytics_teacherRegimePropagation();
    test_AcademicAnalytics_specialCurricularComponentClassification();
    test_SpecialComponents_deborahToggleTotals();

    test_DataManagement_expectedHeadersContract();
    test_DataManagement_normalizeYear();
    test_DataManagement_invalidYearFailsExpectedly();
    test_DataManagement_normalizeImportedRowPreservesValues();
    test_DataManagement_backupNameContract();
    test_DataManagement_getOverviewReadOnly();
    test_DataManagement_annualPairContract();
    test_DataManagement_teacherMergePreservesHistoricalRows();

    test_AcademicAnalytics_groupKeyContract();
    test_AcademicAnalytics_uniqueStudentsAndOfferingDeduplication();
    test_AcademicAnalytics_equalDistributionAcrossRegularOffers();
    test_AcademicAnalytics_remainderStartsAtLastClass();
    test_AcademicAnalytics_eligibleMovementContract();
    test_AcademicAnalytics_dependencyOffersDoNotCountStudents();
    test_AcademicAnalytics_scopedReportPreservesFullDistribution();
    test_AcademicAnalytics_semesterAwareOfferingIdentity();
    test_AcademicAnalytics_semesterScopedDistribution();
    test_TeacherPdfReport_contract();
    test_GeneralTeacherPdfReport_contract();
    test_AcademicAnalytics_excludedStudentCount();
    test_AcademicAnalytics_employmentClassification();
    test_AcademicAnalytics_unmatchedReasonDiagnostics();
    test_AcademicAnalytics_periodFallbackUsesLargestAvailable();

    test_KnowledgeAreas_normalizationAndHierarchy();
    test_KnowledgeAreas_integrityRules();
    test_KnowledgeAreas_cascadeTargetContract();
    test_KnowledgeAreas_preparedBlankRowsAreIgnored();
    test_KnowledgeAreas_readOnlyIntegration();

    test_TeacherAreas_contractAndEmptyState();
    test_TeacherAreas_vigencyAndOverlap();
    test_TeacherAreas_semesterVigencyContract();
    test_TeacherAreas_optionalEndSemesterContract();
    test_TeacherAreas_areaTeacherCountAggregationContract();
    test_TeacherAreas_readOnlyIntegration();

    test_Dao_extractDataFromSheets();
    test_Dao_auxiliaryBases();
    test_Dao_realAnnualPreferredClassAssociation();
    test_Dao_realAgronomySemesterStudentDistribution();
  test_TeachingLoadReference_defaultsAndWeeklyClassification();
  test_Dao_teacherWorkRegimeMapping();
    test_Dao_onlyReadsCanonicalAnnualSheets();
    test_Dao_realDataSemesterAllocationInvariant();
    test_Dao_realClockHourTotalRecomposition();
    test_Dao_realClockHourComponentsRecomposition();
    test_Dao_courseAggregationSumsEveryTeacherRow();
    test_Dao_courseAggregationSeparatesSameNameByForm();
    test_Dao_realCourseTotalsMatchDashboardTotal();
    test_Dao_realCourseFormsRemainSeparated();

    test_Controller_getDashboardData();
    test_Controller_progressiveLoadEndpoints();
    test_Controller_getAppHealth();
    test_Frontend_clockHourIsPrimaryUnit();
    test_Frontend_chartsExposeBothUnits();
    test_Frontend_courseChartLayoutContract();
    test_Frontend_multipleYearScopeContract();
    test_Frontend_courseAggregationContract();
    test_Frontend_stickyAnalyticalHeader();
    test_Frontend_compactProfessorRanking();
    test_Frontend_safeRenderingAndCourseClassDetail();
    test_Frontend_dataManagementSingleWorkspace();
    test_Frontend_xlsxFirstSheetContract();
    test_Frontend_realProgressAndBatchContract();
    test_Frontend_nonIntrusiveManagementFeedback();
    test_Frontend_studentIndicatorsAndEmploymentBadge();
    test_Frontend_studentMethodologyTooltipContract();
    test_Frontend_generalTeacherReportContract();
    test_Frontend_initialLoadingProgressContract();
    test_Frontend_annualYearValidationAndResetContract();
    test_Frontend_coverageDiagnosticsContract();
    test_Frontend_professorModalResponsiveWidth();
    test_Frontend_studentRankingContract();
    test_Frontend_fiveKpiContract();
    test_Frontend_knowledgeAreasCrudContract();
    test_Frontend_teacherAreaManagementContract();
    test_Frontend_v1007AreaLifecycleContract();
    test_Frontend_v1008KnowledgeAreaContract();
    test_Frontend_v1009TeacherConditionsContract();
    test_Frontend_areaIndicatorsAndEmptyStateContract();
    test_Frontend_singleColumnSortingContract();
    test_Frontend_professorAreaTableContract();
    test_Frontend_portariaSimulationContract();
    test_Frontend_clickableCardsAndChartsContract();
    test_Frontend_restoreTableContract();
    test_Frontend_filterAlignmentContract();
    test_Frontend_nullableRegimeContract();
    test_AccessControl_profileAndDomainContract();
    test_AccessControl_areaPermissionMatrix();
    test_DataManagement_flexibleImportContract();
    test_SystemReset_securityContract();
    test_Frontend_v99UsersImportResetAndSectionsContract();
    test_Frontend_v992SpecialComponentsContract();
    test_HelpTutorials_catalogContract();
    test_HelpTutorials_visualOrderContract();
    test_HelpPersistence_stateContract();
    test_HelpAssistant_stateMachineContract();
    test_HelpAssistant_firstAccessScreenContract();
    test_HelpAssistant_exitRespondsBeforePersistenceContract();
    test_HelpAssistant_menuStaysWithinViewportContract();
    test_HelpAssistant_releaseNotesContract();
    test_HelpAssistant_minimizationContract();
    test_HelpAssistant_resetWelcomeContract();
    test_SetupVersao10_structureOnlyContract();
    test_Frontend_emaHelpContract();
    test_Frontend_criticalRulesContract();
  } catch (error) {
    passed = false;
    Logger.log('🚨 TESTES ABORTADOS DEVIDO A FALHA CRÍTICA: ' + error.message);
  } finally {
    const endTime = new Date().getTime();

    if (passed) {
      Logger.log('🎉 TODOS OS TESTES PASSARAM! (Tempo: '
        + (endTime - startTime) + 'ms)');
    } else {
      Logger.log('⚠️ REVISAR FALHAS ACIMA.');
    }
  }
}

/**
 * Executa apenas os testes essenciais de integração e contrato.
 * Útil como smoke test após uma implantação.
 */
function runSmokeTests() {
  AccessControlService.requireSuperUser();
  Logger.log('⚙️ Iniciando smoke tests da versão 10.0.9...');
  test_Dao_extractDataFromSheets();
  test_Controller_getDashboardData();
  test_Controller_progressiveLoadEndpoints();
  test_Controller_getAppHealth();
  test_DataManagement_getOverviewReadOnly();
  test_AcademicAnalytics_groupKeyContract();
  test_AcademicAnalytics_equalDistributionAcrossRegularOffers();
  test_AcademicAnalytics_remainderStartsAtLastClass();
  test_AcademicAnalytics_eligibleMovementContract();
  test_AcademicAnalytics_dependencyOffersDoNotCountStudents();
  test_AcademicAnalytics_scopedReportPreservesFullDistribution();
  test_AcademicAnalytics_semesterScopedDistribution();
  test_Dao_realAnnualPreferredClassAssociation();
  test_Dao_realAgronomySemesterStudentDistribution();
  test_TeacherPdfReport_contract();
  test_GeneralTeacherPdfReport_contract();
  test_AcademicAnalytics_periodFallbackUsesLargestAvailable();
  test_AcademicAnalytics_teacherRegimePropagation();
  test_TeacherConditions_contract();
  test_AcademicAnalytics_teacherConditionPropagation();
  test_AcademicAnalytics_specialCurricularComponentClassification();
  test_SpecialComponents_deborahToggleTotals();
  test_Dao_auxiliaryBases();
  test_KnowledgeAreas_preparedBlankRowsAreIgnored();
  test_KnowledgeAreas_readOnlyIntegration();
  test_TeacherAreas_contractAndEmptyState();
  test_TeacherAreas_vigencyAndOverlap();
  test_TeacherAreas_semesterVigencyContract();
  test_TeacherAreas_optionalEndSemesterContract();
  test_TeacherAreas_areaTeacherCountAggregationContract();
  test_TeacherAreas_readOnlyIntegration();
  test_Frontend_studentIndicatorsAndEmploymentBadge();
  test_Frontend_studentMethodologyTooltipContract();
  test_Frontend_generalTeacherReportContract();
  test_Frontend_clockHourIsPrimaryUnit();
  test_Frontend_courseAggregationContract();
  test_Frontend_chartsExposeBothUnits();
  test_Frontend_courseChartLayoutContract();
  test_Frontend_stickyAnalyticalHeader();
  test_Frontend_xlsxFirstSheetContract();
  test_Frontend_realProgressAndBatchContract();
  test_Frontend_initialLoadingProgressContract();
  test_Frontend_coverageDiagnosticsContract();
  test_Frontend_studentRankingContract();
  test_Frontend_fiveKpiContract();
  test_Frontend_knowledgeAreasCrudContract();
  test_Frontend_teacherAreaManagementContract();
  test_Frontend_v1007AreaLifecycleContract();
  test_Frontend_v1008KnowledgeAreaContract();
  test_Frontend_v1009TeacherConditionsContract();
  test_Frontend_areaIndicatorsAndEmptyStateContract();
  test_Frontend_singleColumnSortingContract();
  test_Frontend_professorAreaTableContract();
  test_Frontend_portariaSimulationContract();
  test_Frontend_clickableCardsAndChartsContract();
  test_Frontend_restoreTableContract();
  test_Frontend_nullableRegimeContract();
  test_AccessControl_profileAndDomainContract();
  test_AccessControl_areaPermissionMatrix();
  test_DataManagement_flexibleImportContract();
  test_SystemReset_securityContract();
  test_Frontend_v99UsersImportResetAndSectionsContract();
  test_Frontend_v992SpecialComponentsContract();
  test_HelpTutorials_catalogContract();
  test_HelpTutorials_visualOrderContract();
  test_HelpPersistence_stateContract();
  test_HelpAssistant_stateMachineContract();
  test_HelpAssistant_firstAccessScreenContract();
  test_HelpAssistant_exitRespondsBeforePersistenceContract();
  test_HelpAssistant_menuStaysWithinViewportContract();
  test_HelpAssistant_releaseNotesContract();
  test_HelpAssistant_minimizationContract();
  test_HelpAssistant_resetWelcomeContract();
  test_SetupVersao10_structureOnlyContract();
  test_Frontend_emaHelpContract();
  Logger.log('🎉 SMOKE TESTS CONCLUÍDOS COM SUCESSO.');
}

/**
 * Valida a normalização do campo SEMESTRE.
 */
function test_DashboardRules_normalizeSemester() {
  Logger.log('--- Rodando: test_DashboardRules_normalizeSemester ---');

  Assert.equals('', DashboardRules.normalizeSemester(null),
    'Semestre nulo deve representar oferta anual.');
  Assert.equals('', DashboardRules.normalizeSemester('  '),
    'Semestre vazio deve representar oferta anual.');
  Assert.equals('1', DashboardRules.normalizeSemester(1),
    'Semestre numérico 1 deve ser normalizado como texto.');
  Assert.equals('2', DashboardRules.normalizeSemester(' 2 '),
    'Semestre 2 deve ser normalizado sem espaços.');
}

/**
 * Valida a divisão igualitária da disciplina anual entre os semestres.
 */
function test_DashboardRules_annualAllocation() {
  Logger.log('--- Rodando: test_DashboardRules_annualAllocation ---');

  const record = DashboardRules.prepareRecord({
    PROFESSOR: 'Docente Teste',
    SEMESTRE: null,
    'PERÍODO': 3,
    'CARGA HORÁRIA': 120
  });

  Assert.equals('', record['SEMESTRE_OFERTA'],
    'Disciplina com SEMESTRE vazio deve ser anual.');
  Assert.approximatelyEquals(0.5, record['FATOR_SEMESTRE_1'], 0.000001,
    'Metade da disciplina anual deve pertencer ao 1º semestre.');
  Assert.approximatelyEquals(0.5, record['FATOR_SEMESTRE_2'], 0.000001,
    'Metade da disciplina anual deve pertencer ao 2º semestre.');
}

/**
 * Valida a alocação integral das disciplinas semestrais.
 */
function test_DashboardRules_semesterAllocation() {
  Logger.log('--- Rodando: test_DashboardRules_semesterAllocation ---');

  const firstSemester = DashboardRules.prepareRecord({ SEMESTRE: 1 });
  const secondSemester = DashboardRules.prepareRecord({ SEMESTRE: 2 });

  Assert.equals(1, firstSemester['FATOR_SEMESTRE_1'],
    'Disciplina do 1º semestre deve ser integral no 1º semestre.');
  Assert.equals(0, firstSemester['FATOR_SEMESTRE_2'],
    'Disciplina do 1º semestre não deve entrar no 2º semestre.');
  Assert.equals(0, secondSemester['FATOR_SEMESTRE_1'],
    'Disciplina do 2º semestre não deve entrar no 1º semestre.');
  Assert.equals(1, secondSemester['FATOR_SEMESTRE_2'],
    'Disciplina do 2º semestre deve ser integral no 2º semestre.');
}

/**
 * Garante que PERÍODO curricular não interfere na classificação semestral.
 */
function test_DashboardRules_periodDoesNotAffectSemester() {
  Logger.log('--- Rodando: test_DashboardRules_periodDoesNotAffectSemester ---');

  const periodOne = DashboardRules.prepareRecord({ SEMESTRE: '', 'PERÍODO': 1 });
  const periodTwo = DashboardRules.prepareRecord({ SEMESTRE: '', 'PERÍODO': 2 });
  const periodNinetyNine = DashboardRules.prepareRecord({ SEMESTRE: '', 'PERÍODO': 99 });

  Assert.equals('', periodOne['SEMESTRE_OFERTA'],
    'PERÍODO 1 não deve transformar disciplina anual em semestral.');
  Assert.equals('', periodTwo['SEMESTRE_OFERTA'],
    'PERÍODO 2 não deve transformar disciplina anual em semestral.');
  Assert.equals('', periodNinetyNine['SEMESTRE_OFERTA'],
    'PERÍODO 99 não deve transformar disciplina anual em semestral.');
}

/**
 * Garante falha explícita para semestre fora da regra conhecida.
 */
function test_DashboardRules_invalidSemesterFailsExplicitly() {
  Logger.log('--- Rodando: test_DashboardRules_invalidSemesterFailsExplicitly ---');

  Assert.throws(
    function() {
      DashboardRules.normalizeSemester(3);
    },
    'Semestre diferente de vazio, 1 ou 2 deve gerar erro explícito.'
  );
}

/**
 * Valida a conversão da unidade-base para a unidade secundária.
 */
function test_DashboardRules_clockHoursToClassHours() {
  Logger.log('--- Rodando: test_DashboardRules_clockHoursToClassHours ---');

  const classHours = DashboardRules.clockHoursToClassHours(100, 50);

  Assert.approximatelyEquals(120, classHours, 0.000001,
    '100 horas-relógio devem equivaler a 120 horas-aula de 50 minutos.');
}

/**
 * Valida que uma hora-aula configurada com 60 minutos não altera o valor.
 */
function test_DashboardRules_clockHoursToClassHoursAtSixtyMinutes() {
  Logger.log('--- Rodando: test_DashboardRules_clockHoursToClassHoursAtSixtyMinutes ---');

  const classHours = DashboardRules.clockHoursToClassHours(100, 60);

  Assert.approximatelyEquals(100, classHours, 0.000001,
    '100 horas-relógio devem equivaler a 100 horas-aula de 60 minutos.');
}

/**
 * Garante falha explícita para duração inválida.
 */
function test_DashboardRules_invalidClassDurationFailsExplicitly() {
  Logger.log('--- Rodando: test_DashboardRules_invalidClassDurationFailsExplicitly ---');

  Assert.throws(
    function() {
      DashboardRules.clockHoursToClassHours(100, 0);
    },
    'Duração igual a zero deve gerar erro explícito.'
  );
}

/**
 * Garante que a preparação do registro não converte a carga da base.
 */
function test_DashboardRules_prepareRecordPreservesClockHourLoad() {
  Logger.log('--- Rodando: test_DashboardRules_prepareRecordPreservesClockHourLoad ---');

  const prepared = DashboardRules.prepareRecord({
    SEMESTRE: '',
    'CARGA HORÁRIA': 100,
    'CARGA HORÁRIA TEÓRICA': 80,
    'CARGA HORÁRIA PRÁTICA': 20,
    'CARGA HORÁRIA EXTENSÃO': 0
  });

  Assert.equals(100, prepared['CARGA HORÁRIA'],
    'Carga total deve permanecer em hora-relógio.');
  Assert.equals(80, prepared['CARGA HORÁRIA TEÓRICA'],
    'Carga teórica deve permanecer em hora-relógio.');
  Assert.equals(20, prepared['CARGA HORÁRIA PRÁTICA'],
    'Carga prática deve permanecer em hora-relógio.');
  Assert.equals(0, prepared['CARGA HORÁRIA EXTENSÃO'],
    'Carga de extensão deve permanecer em hora-relógio.');
}

/**
 * Confirma os valores oficiais pré-preenchidos e a classificação semanal.
 */
function test_TeachingLoadReference_defaultsAndWeeklyClassification() {
  Logger.log('--- Rodando: test_TeachingLoadReference_defaultsAndWeeklyClassification ---');

  const reference = DashboardRules.getTeachingLoadReference();
  Assert.equals(100, reference.calendar.daysSemester1,
    'Primeiro semestre deve iniciar com 100 dias letivos.');
  Assert.equals(20, reference.calendar.weeksSemester1,
    'Primeiro semestre deve iniciar com 20 semanas.');
  Assert.equals(100, reference.calendar.daysSemester2,
    'Segundo semestre deve iniciar com 100 dias letivos.');
  Assert.equals(20, reference.calendar.weeksSemester2,
    'Segundo semestre deve iniciar com 20 semanas.');
  Assert.equals(10, reference.weeklyRanges.integral.minimum,
    'Docente integral deve iniciar com mínimo de 10 horas semanais de aula.');
  Assert.equals(20, reference.weeklyRanges.integral.maximum,
    'Docente integral deve iniciar com máximo de 20 horas semanais de aula.');
  Assert.equals(8, reference.weeklyRanges.partial.minimum,
    'Docente parcial deve iniciar com mínimo de 8 horas semanais de aula.');
  Assert.equals(12, reference.weeklyRanges.partial.maximum,
    'Docente parcial deve iniciar com máximo de 12 horas semanais de aula.');
  Assert.contains(reference.source.title, 'Portaria MEC nº 750',
    'Referência deve identificar a origem normativa dos parâmetros.');

  Assert.equals('BELOW', DashboardRules.classifyWeeklyTeachingLoad(9.5, 40),
    '9,5 h semanais devem ficar abaixo do mínimo integral.');
  Assert.equals('WITHIN', DashboardRules.classifyWeeklyTeachingLoad(10, 40),
    'O limite mínimo integral deve pertencer à faixa.');
  Assert.equals('WITHIN', DashboardRules.classifyWeeklyTeachingLoad(20, 40),
    'O limite máximo integral deve pertencer à faixa.');
  Assert.equals('ABOVE', DashboardRules.classifyWeeklyTeachingLoad(20.5, 40),
    'Carga superior a 20 h deve ficar acima do máximo integral.');
  Assert.equals('WITHIN', DashboardRules.classifyWeeklyTeachingLoad(8, 20),
    'O limite mínimo parcial deve pertencer à faixa.');
  Assert.equals('ABOVE', DashboardRules.classifyWeeklyTeachingLoad(12.5, 20),
    'Carga superior a 12 h deve ficar acima do máximo parcial.');
  Assert.equals('UNASSESSED', DashboardRules.classifyWeeklyTeachingLoad(10, null),
    'Regime ausente não deve ser adivinhado.');

  const simulatedRanges = {
    integral: { minimum: 12, maximum: 18 },
    partial: { minimum: 6, maximum: 10 }
  };
  Assert.equals('BELOW', DashboardRules.classifyWeeklyTeachingLoad(11, 40, simulatedRanges),
    'Classificação deve aceitar parâmetros temporários de simulação.');
}

/**
 * Confirma o mapeamento da coluna J e do cargo de professor substituto.
 */
function test_Dao_teacherWorkRegimeMapping() {
  Logger.log('--- Rodando: test_Dao_teacherWorkRegimeMapping ---');

  const exclusive = Dao._resolveTeacherWorkRegime('Professor EBTT', 99);
  Assert.equals('40_DE', exclusive.code,
    'Código 99 deve representar 40 horas com dedicação exclusiva.');
  Assert.equals(40, exclusive.weeklyHours,
    'Código 99 deve resultar em jornada semanal de 40 horas.');
  Assert.equals(true, exclusive.exclusiveDedication,
    'Código 99 deve identificar dedicação exclusiva.');

  const integral = Dao._resolveTeacherWorkRegime('Professor EBTT', 40);
  Assert.equals('40', integral.code,
    'Código 40 deve representar jornada integral sem dedicação exclusiva.');
  Assert.equals(40, integral.weeklyHours,
    'Código 40 deve resultar em 40 horas semanais.');

  const partial = Dao._resolveTeacherWorkRegime('Professor EBTT', 20);
  Assert.equals('20', partial.code,
    'Código 20 deve representar jornada parcial.');
  Assert.equals(20, partial.weeklyHours,
    'Código 20 deve resultar em 20 horas semanais.');

  const reducedThirty = Dao._resolveTeacherWorkRegime('Professor EBTT', 30);
  Assert.equals('REDUZIDA_30', reducedThirty.code,
    'Qualquer jornada numérica positiva menor que 40 deve ser reduzida.');
  Assert.equals(30, reducedThirty.weeklyHours,
    'Jornada reduzida deve preservar exatamente o valor importado da coluna J.');

  const substitute = Dao._resolveTeacherWorkRegime('Professor Substituto', '');
  Assert.equals('40_SUBSTITUTO', substitute.code,
    'Coluna J vazia com cargo substituto deve representar 40 horas.');
  Assert.equals(40, substitute.weeklyHours,
    'Professor substituto deve receber a faixa do regime de 40 horas.');

  const unknown = Dao._resolveTeacherWorkRegime('Professor EBTT', '');
  Assert.equals(false, unknown.identified,
    'Campo vazio sem cargo substituto deve permanecer não identificado.');
  Assert.equals(null, unknown.weeklyHours,
    'Regime desconhecido não deve ser convertido em zero.');
}

/** Valida cadastro complementar, vigência, sugestões e justificativa semanal. */
function test_TeacherConditions_contract() {
  Logger.log('--- Rodando: test_TeacherConditions_contract ---');
  Assert.equals('10.0.9', TEACHER_CONDITIONS_CONFIG.version,
    'Cadastro complementar deve identificar a versão 10.0.9.');
  Assert.equals('DOCENTES_CONDICOES', TEACHER_CONDITIONS_CONFIG.sheetName,
    'Condições devem usar uma aba separada do espelho DOCENTES.');
  Assert.equals(18, TEACHER_CONDITIONS_CONFIG.headers.length,
    'Aba de condições deve possuir contrato completo de auditoria e vigência.');
  Assert.equals(true,
    TEACHER_CONDITIONS_CONFIG.headers.indexOf('Justifica_Abaixo_Minimo') >= 0,
    'Contrato deve armazenar explicitamente a justificativa abaixo do mínimo.');

  const openEnded = {
    active: true, startYear: '2026', startSemester: '',
    endYear: '', endSemester: ''
  };
  Assert.equals(false,
    TeacherConditionsService.conditionAppliesToPeriod(openEnded, '2025', '2'),
    'Condição não pode alcançar período anterior ao início.');
  Assert.equals(true,
    TeacherConditionsService.conditionAppliesToPeriod(openEnded, '2026', '1'),
    'Vigência anual deve alcançar o primeiro semestre do ano inicial.');
  Assert.equals(true,
    TeacherConditionsService.conditionAppliesToPeriod(openEnded, '2030', '2'),
    'Ausência de término deve representar vigência sem prazo final.');

  const bounded = {
    active: true, startYear: '2026', startSemester: '2',
    endYear: '2027', endSemester: '1'
  };
  Assert.equals(false,
    TeacherConditionsService.conditionAppliesToPeriod(bounded, '2026', '1'),
    'Vigência iniciada no segundo semestre não alcança o primeiro.');
  Assert.equals(true,
    TeacherConditionsService.conditionAppliesToPeriod(bounded, '2026', '2'),
    'Vigência deve alcançar seu semestre inicial.');
  Assert.equals(true,
    TeacherConditionsService.conditionAppliesToPeriod(bounded, '2027', '1'),
    'Vigência deve alcançar seu semestre final.');
  Assert.equals(false,
    TeacherConditionsService.conditionAppliesToPeriod(bounded, '2027', '2'),
    'Vigência não pode ultrapassar o semestre final.');

  const director = TeacherConditionsService._suggestFunction(
    'DIRETOR(A) GERAL', '2026'
  );
  Assert.equals('Direção Geral', director.description,
    'Diretor-Geral deve ser tratado como direção geral de campus.');
  Assert.equals(true, director.exemption,
    'Direção Geral deve sugerir possibilidade de dispensa de aulas.');
  const coordination = TeacherConditionsService._suggestFunction(
    'COORDENADOR(A) GERAL', '2026'
  );
  Assert.equals('Coordenação Geral', coordination.description,
    'Coordenação Geral deve possuir rótulo público sem código da função.');
  Assert.equals(4, coordination.minimum,
    'Coordenação Geral deve sugerir mínimo semanal de 4 horas.');
  Assert.equals(12, coordination.maximum,
    'Coordenação Geral deve sugerir máximo semanal de 12 horas.');
  Assert.notContains(coordination.description, 'CD-',
    'Etiqueta pública não deve exibir código CD.');

  const suggestions = TeacherConditionsService._buildSuggestions({
    officialFunction: '', reducedWorkload: true,
    weeklyContractHours: 20
  }, []);
  Assert.equals(1, suggestions.length,
    'Jornada menor que 40 deve gerar uma sugestão administrativa.');
  Assert.equals('Jornada reduzida', suggestions[0].description,
    'Sugestão da coluna J deve usar rótulo natural.');
  Assert.equals('BELOW_JUSTIFIED', DashboardRules.classifyWeeklyTeachingLoad(
    6, 40, null, [{ active: true, justifiesBelowMinimum: true }]
  ), 'Condição ativa deve distinguir carga abaixo do mínimo justificada.');
  Assert.equals('BELOW', DashboardRules.classifyWeeklyTeachingLoad(
    6, 40, null, [{ active: false, justifiesBelowMinimum: true }]
  ), 'Condição inativa não pode justificar o indicador semanal.');
}

/** Garante que função, redução e condições cheguem às ofertas analíticas. */
function test_AcademicAnalytics_teacherConditionPropagation() {
  Logger.log('--- Rodando: test_AcademicAnalytics_teacherConditionPropagation ---');
  const condition = {
    id: 'COND-1', description: 'Coordenação de Curso',
    reason: 'Função confirmada.', minimum: 4, maximum: 12,
    exemption: false, justifiesBelowMinimum: true,
    startYear: '2026', startSemester: '', endYear: '', endSemester: '',
    active: true
  };
  const rows = [DashboardRules.prepareRecord({
    PROFESSOR: 'Docente Condição', ANO_LETIVO: '2026', SEMESTRE: 1,
    FORMA: 'BACHARELADO', CURSO: 'CURSO', PPC: 'PPC',
    'PERÍODO': 1, DISCIPLINA: 'DISCIPLINA', TURMA: 'A',
    'CARGA HORÁRIA': 40
  })];
  const result = AcademicAnalytics.buildFromSources(rows, { '2026': [] }, [{
    name: 'Docente Condição', registration: '1001', employmentType: 'EFETIVO',
    active: true, areaAssignments: [], weeklyContractHours: 20,
    workRegimeCode: '20', workRegimeLabel: '20 horas',
    reducedWorkload: true, officialFunction: 'COORDENADOR(A) DO CURSO',
    conditions: [condition]
  }]);
  Assert.equals(true, result.rows[0].JORNADA_REDUZIDA_DOCENTE,
    'Oferta deve herdar a jornada reduzida do espelho DOCENTES.');
  Assert.equals('COORDENADOR(A) DO CURSO', result.rows[0].FUNCAO_OFICIAL_DOCENTE,
    'Oferta deve herdar a função importada da coluna S.');
  Assert.equals(1, result.rows[0].CONDICOES_DOCENTE.length,
    'Oferta deve receber somente as condições vigentes no período.');
  Assert.equals('Coordenação de Curso',
    result.rows[0].CONDICOES_DOCENTE[0].description,
    'Condição pública deve permanecer identificável no dashboard e no relatório.');
}

/**
 * Garante que o regime resolvido pelo DAO sobreviva ao índice analítico e
 * chegue ao frontend com uma jornada semanal avaliável.
 *
 * Este teste cobre a regressão da versão 9.9.1 na qual _buildTeacherIndex()
 * descartava os campos de regime, fazendo todos os docentes aparecerem como
 * "Não avaliado" mesmo quando DOCENTES possuía os códigos 99, 40 ou 20.
 */
function test_AcademicAnalytics_teacherRegimePropagation() {
  Logger.log('--- Rodando: test_AcademicAnalytics_teacherRegimePropagation ---');

  function createTeacher(name, jobTitle, workloadCode, registration) {
    const regime = Dao._resolveTeacherWorkRegime(jobTitle, workloadCode);
    return {
      name: name,
      registration: registration,
      employmentType: jobTitle.toUpperCase().indexOf('SUBSTITUTO') >= 0
        ? 'SUBSTITUTO'
        : 'EFETIVO',
      jobTitle: jobTitle,
      workloadCode: workloadCode === null || workloadCode === undefined
        ? ''
        : String(workloadCode),
      workRegimeCode: regime.code,
      workRegimeLabel: regime.label,
      weeklyContractHours: regime.weeklyHours,
      exclusiveDedication: regime.exclusiveDedication,
      workRegimeIdentified: regime.identified,
      active: true,
      areaAssignments: []
    };
  }

  function createDisciplineRow(name, sourceLine) {
    return {
      PROFESSOR: name,
      ANO_LETIVO: '2026',
      SEMESTRE_OFERTA: '1',
      FORMA: 'Bacharelado',
      CURSO: 'Curso de Teste',
      PPC: 'PPC 2026',
      DISCIPLINA: 'Disciplina ' + sourceLine,
      'PERÍODO': 1,
      LINHA_ORIGEM: sourceLine
    };
  }

  const teachers = [
    createTeacher('Docente DE', 'Professor EBTT', 99, '1001'),
    createTeacher('Docente 40h', 'Professor EBTT', 40, '1002'),
    createTeacher('Docente 20h', 'Professor EBTT', 20, '1003'),
    createTeacher('Docente Substituto', 'Professor Substituto', '', '1004'),
    createTeacher('Docente Sem Regime', 'Professor EBTT', '', '1005')
  ];
  const rows = teachers.map(function(teacher, index) {
    return createDisciplineRow(teacher.name, index + 2);
  });
  const result = AcademicAnalytics.buildFromSources(rows, {}, teachers);
  const rowsByProfessor = {};
  result.rows.forEach(function(row) {
    rowsByProfessor[row.PROFESSOR] = row;
  });

  const exclusive = rowsByProfessor['Docente DE'];
  const integral = rowsByProfessor['Docente 40h'];
  const partial = rowsByProfessor['Docente 20h'];
  const substitute = rowsByProfessor['Docente Substituto'];
  const unknown = rowsByProfessor['Docente Sem Regime'];

  Assert.equals(40, exclusive.CARGA_SEMANAL_CONTRATUAL_DOCENTE,
    'Código 99 deve chegar ao resultado analítico com jornada de 40 horas.');
  Assert.equals('40_DE', exclusive.REGIME_TRABALHO_DOCENTE,
    'Código 99 deve preservar o regime 40_DE no resultado analítico.');
  Assert.equals(true, exclusive.DEDICACAO_EXCLUSIVA_DOCENTE,
    'Código 99 deve preservar a dedicação exclusiva.');
  Assert.equals(true, exclusive.REGIME_TRABALHO_IDENTIFICADO,
    'Código 99 deve permanecer identificado após o índice analítico.');

  Assert.equals(40, integral.CARGA_SEMANAL_CONTRATUAL_DOCENTE,
    'Código 40 deve chegar ao resultado analítico com jornada de 40 horas.');
  Assert.equals(20, partial.CARGA_SEMANAL_CONTRATUAL_DOCENTE,
    'Código 20 deve chegar ao resultado analítico com jornada de 20 horas.');
  Assert.equals(40, substitute.CARGA_SEMANAL_CONTRATUAL_DOCENTE,
    'Professor substituto deve chegar com jornada de 40 horas.');
  Assert.equals('40_SUBSTITUTO', substitute.REGIME_TRABALHO_DOCENTE,
    'Professor substituto deve preservar o código de regime específico.');

  [exclusive, integral, partial, substitute].forEach(function(row) {
    Assert.equals(false,
      DashboardRules.classifyWeeklyTeachingLoad(
        10,
        row.CARGA_SEMANAL_CONTRATUAL_DOCENTE
      ) === 'UNASSESSED',
      'Docente com regime conhecido não pode chegar como Não avaliado: '
        + row.PROFESSOR + '.');
  });

  Assert.equals(null, unknown.CARGA_SEMANAL_CONTRATUAL_DOCENTE,
    'Regime realmente desconhecido deve continuar com jornada nula.');
  Assert.equals('UNASSESSED', DashboardRules.classifyWeeklyTeachingLoad(
    10,
    unknown.CARGA_SEMANAL_CONTRATUAL_DOCENTE
  ), 'Somente docente sem regime identificável deve permanecer Não avaliado.');
}

/**
 * Confirma o contrato exato das 20 colunas do relatório do IFTM.
 */
/**
 * Valida o catálogo controlado de componentes curriculares especiais e protege
 * o cálculo contra falsos positivos em disciplinas regulares.
 */
function test_AcademicAnalytics_specialCurricularComponentClassification() {
  Logger.log('--- Rodando: test_AcademicAnalytics_specialCurricularComponentClassification ---');

  const cases = [
    ['TCC', 'TCC'],
    ['TCC I', 'TCC'],
    ['TCC 2', 'TCC'],
    ['TCC 4', 'TCC'],
    ['Trabalho de Conclusão de Curso 1', 'TCC'],
    ['Trabalho de Conclusão de Curso II', 'TCC'],
    ['Estágio', 'ESTAGIO_SUPERVISIONADO'],
    ['Estágio II', 'ESTAGIO_SUPERVISIONADO'],
    ['Estágio Curricular', 'ESTAGIO_SUPERVISIONADO'],
    ['Estágio Obrigatório', 'ESTAGIO_SUPERVISIONADO'],
    ['Estágio Supervisionado 1', 'ESTAGIO_SUPERVISIONADO'],
    ['Estágio Curricular Obrigatório', 'ESTAGIO_SUPERVISIONADO'],
    ['Atividades Complementares', 'ATIVIDADES_COMPLEMENTARES'],
    ['Atividades Complementares II', 'ATIVIDADES_COMPLEMENTARES'],
    ['Atividade Complementar I', 'ATIVIDADES_COMPLEMENTARES'],
    ['Atividades Acadêmico-Científico-Culturais', 'ATIVIDADES_COMPLEMENTARES'],
    ['AACC II', 'ATIVIDADES_COMPLEMENTARES']
  ];

  cases.forEach(function(item) {
    const classification = AcademicAnalytics.classifySpecialCurricularComponent(item[0]);
    Assert.equals(true, Boolean(classification),
      'Componente deve ser reconhecido: ' + item[0]);
    Assert.equals(item[1], classification.code,
      'Grupo correto para: ' + item[0]);
  });

  [
    'Metodologia Científica',
    'Estágio de germinação de sementes',
    'Atividades de Extensão Rural',
    'Técnicas de Construção Civil',
    'Trabalho de Campo'
  ].forEach(function(name) {
    Assert.equals(null,
      AcademicAnalytics.classifySpecialCurricularComponent(name),
      'Disciplina regular não pode ser classificada por engano: ' + name);
  });

  const result = AcademicAnalytics.buildFromSources([{
    PROFESSOR: 'Docente Teste',
    ANO_LETIVO: '2026',
    SEMESTRE_OFERTA: '1',
    FORMA: 'Bacharelado',
    CURSO: 'Curso de Teste',
    PPC: '2026',
    DISCIPLINA: 'Trabalho de Conclusão de Curso I',
    'PERÍODO': 8
  }], {}, []);
  Assert.equals('TCC', result.rows[0].GRUPO_COMPONENTE_ESPECIAL,
    'Resultado analítico deve transportar o grupo especial ao frontend.');
  Assert.equals('Trabalho de Conclusão de Curso',
    result.rows[0].ROTULO_GRUPO_COMPONENTE_ESPECIAL,
    'Resultado analítico deve transportar o rótulo auditável.');
}

/**
 * Reproduz a carga real consolidada de Deborah e prova que os toggles de TCC,
 * estágio e atividades complementares recompõem os totais anual e semestrais.
 */
function test_SpecialComponents_deborahToggleTotals() {
  Logger.log('--- Rodando: test_SpecialComponents_deborahToggleTotals ---');
  const rows = [
    { semester: '1', group: '', hours: 195 },
    { semester: '2', group: '', hours: 510 },
    { semester: '', group: '', hours: 332 },
    { semester: '1', group: 'TCC', hours: 200 },
    { semester: '2', group: 'TCC', hours: 200 },
    { semester: '', group: 'ESTAGIO_SUPERVISIONADO', hours: 120 }
  ];
  const totalFor = function(filters, semester) {
    return rows.reduce(function(total, row) {
      const included = TeacherPdfReportService._isComponentIncluded(
        row.group,
        filters
      );
      const factor = semester
        ? DashboardRules.getSemesterAllocationFactor(row.semester, semester)
        : 1;
      return total + row.hours * (included ? factor : 0);
    }, 0);
  };
  const cases = [
    { tcc: true, internship: true, complementary: true, annual: 1557, first: 621, second: 936 },
    { tcc: true, internship: true, complementary: false, annual: 1557, first: 621, second: 936 },
    { tcc: true, internship: false, complementary: true, annual: 1437, first: 561, second: 876 },
    { tcc: true, internship: false, complementary: false, annual: 1437, first: 561, second: 876 },
    { tcc: false, internship: true, complementary: true, annual: 1157, first: 421, second: 736 },
    { tcc: false, internship: true, complementary: false, annual: 1157, first: 421, second: 736 },
    { tcc: false, internship: false, complementary: true, annual: 1037, first: 361, second: 676 },
    { tcc: false, internship: false, complementary: false, annual: 1037, first: 361, second: 676 }
  ];

  cases.forEach(function(testCase, index) {
    const filters = {
      considerTcc: testCase.tcc,
      considerInternship: testCase.internship,
      considerComplementary: testCase.complementary
    };
    Assert.equals(testCase.annual, totalFor(filters, ''),
      'Cenário ' + (index + 1) + ' deve recompor a carga anual de Deborah.');
    Assert.equals(testCase.first, totalFor(filters, '1'),
      'Cenário ' + (index + 1) + ' deve recompor o 1º semestre de Deborah.');
    Assert.equals(testCase.second, totalFor(filters, '2'),
      'Cenário ' + (index + 1) + ' deve recompor o 2º semestre de Deborah.');
  });
}

function test_DataManagement_expectedHeadersContract() {
  Logger.log('--- Rodando: test_DataManagement_expectedHeadersContract ---');

  Assert.equals(20, DATA_MANAGEMENT_CONFIG.expectedHeaders.length,
    'Contrato deve possuir exatamente 20 colunas.');
  Assert.equals('PROFESSOR', DATA_MANAGEMENT_CONFIG.expectedHeaders[0],
    'Primeira coluna deve ser PROFESSOR.');
  Assert.equals('ANO', DATA_MANAGEMENT_CONFIG.expectedHeaders[1],
    'Ano deve ser identificado na segunda coluna.');
  Assert.equals('DURAÇÃO DE CADA AULA EM MINUTOS',
    DATA_MANAGEMENT_CONFIG.expectedHeaders[19],
    'Última coluna deve permanecer igual ao relatório oficial.');

  DataManagementService.assertHeaders(
    DATA_MANAGEMENT_CONFIG.expectedHeaders.slice()
  );
}

/**
 * Valida a normalização segura do ano.
 */
function test_DataManagement_normalizeYear() {
  Logger.log('--- Rodando: test_DataManagement_normalizeYear ---');

  Assert.equals('2026', DataManagementService.normalizeYear(2026),
    'Ano numérico deve ser convertido para nome canônico.');
  Assert.equals('2027', DataManagementService.normalizeYear(' 2027 '),
    'Espaços laterais devem ser removidos durante a análise.');
  Assert.equals('2028', DataManagementService.normalizeYear('2028.0'),
    'Representação decimal inteira deve ser reconhecida como ano.');
}

/**
 * Garante falha esperada para ano que não pode nomear uma aba anual.
 */
function test_DataManagement_invalidYearFailsExpectedly() {
  Logger.log('--- Rodando: test_DataManagement_invalidYearFailsExpectedly ---');

  Assert.throws(function() {
    DataManagementService.normalizeYear('2026/2027');
  }, 'Relatório com valor não canônico de ano deve ser bloqueado.');
}

/**
 * Confirma que o importador não corrige ou interpreta valores acadêmicos.
 */
function test_DataManagement_normalizeImportedRowPreservesValues() {
  Logger.log('--- Rodando: test_DataManagement_normalizeImportedRowPreservesValues ---');

  const row = [
    '', 2026, '', 'CAMPUS', 'CATEGORIA', 'FORMA', 'CURSO', 'PPC',
    'DISCIPLINA', 'TURMA', 'TURNO', 99, 'texto permitido', 30, 30,
    null, 'TIPO', 'MODALIDADE', null, 50
  ];
  const normalized = DataManagementService.normalizeImportedRow(row, 2);

  Assert.equals(20, normalized.length,
    'Linha importada deve manter exatamente 20 posições.');
  Assert.equals(null, normalized[0],
    'Valor vazio deve ser preservado como célula vazia, sem rejeitar a linha.');
  Assert.equals('', normalized[2] === null ? '' : normalized[2],
    'Semestre vazio deve continuar vazio.');
  Assert.equals(99, normalized[11],
    'Período modular deve ser preservado sem interpretação.');
  Assert.equals('texto permitido', normalized[12],
    'Importador não deve corrigir valores do relatório.');
}

/**
 * Valida nomenclatura e política de retenção dos backups.
 */
function test_DataManagement_backupNameContract() {
  Logger.log('--- Rodando: test_DataManagement_backupNameContract ---');

  const parsed = DataManagementService.parseBackupName(
    '_BACKUP_DISCIPLINAS_2026_20260805_071500'
  );
  Assert.equals('disciplines', parsed.type,
    'Nome de backup deve identificar o tipo de base.');
  Assert.equals('2026', parsed.year,
    'Nome de backup deve identificar o ano.');
  Assert.equals('20260805_071500', parsed.timestamp,
    'Nome de backup deve identificar o timestamp.');
  Assert.equals(3, DATA_MANAGEMENT_CONFIG.maxBackupsPerDataset,
    'Devem ser mantidos três backups por tipo e ano.');
}

/**
 * Valida o endpoint somente de leitura usado ao abrir a área administrativa.
 */
function test_DataManagement_getOverviewReadOnly() {
  Logger.log('--- Rodando: test_DataManagement_getOverviewReadOnly ---');
  const response = JSON.parse(getDataManagementOverview());

  Assert.equals('success', response.status,
    'Panorama da gestão deve ser carregado com sucesso.');
  Assert.equals(20, response.expectedHeaders.length,
    'Frontend deve receber o contrato de 20 colunas do backend.');
  Assert.equals(true, Array.isArray(response.annualSheets),
    'Panorama deve listar abas anuais.');
  Assert.equals(true, Array.isArray(response.backups),
    'Panorama deve listar backups disponíveis.');
  Assert.hasProperty(response, 'reportContracts',
    'Panorama deve fornecer os três contratos de relatório.');
  Assert.equals(75, response.reportContracts.students.headers.length,
    'Contrato ALUNOXCAMPUS deve possuir 75 colunas.');
  Assert.equals(19, response.reportContracts.teachers.headers.length,
    'Contrato DOCENTES deve possuir 19 colunas.');
  Assert.equals(true, Array.isArray(response.annualSets),
    'Panorama deve listar conjuntos anuais.');
}

/**
 * Confirma que novos anos exigem o par de relatórios e que atualizações
 * de anos completos podem substituir apenas um dos componentes.
 */
function test_DataManagement_annualPairContract() {
  Logger.log('--- Rodando: test_DataManagement_annualPairContract ---');

  const disciplineHeaders = DATA_MANAGEMENT_CONFIG.reportContracts.disciplines.headers.slice();
  const studentHeaders = DATA_MANAGEMENT_CONFIG.reportContracts.students.headers.slice();

  Assert.throws(function() {
    DataManagementService.normalizeImportMetadata({
      mode: 'add-year',
      year: 2027,
      components: [{
        type: 'disciplines', headers: disciplineHeaders, rowCount: 10,
        fileName: 'disciplinas.xlsx'
      }]
    });
  }, 'Inclusão de novo ano com somente um relatório deve ser bloqueada.');

  const addition = DataManagementService.normalizeImportMetadata({
    mode: 'add-year',
    year: 2027,
    components: [
      { type: 'disciplines', headers: disciplineHeaders, rowCount: 10, fileName: 'disciplinas.xlsx' },
      { type: 'students', headers: studentHeaders, rowCount: 100, fileName: 'alunos.xlsx' }
    ]
  });
  Assert.equals(2, addition.components.length,
    'Inclusão de novo ano deve aceitar exatamente os dois relatórios anuais.');
  Assert.equals('ALUNOXCAMPUSX2027', DataManagementService.targetSheetName('students', '2027'),
    'Base anual de alunos deve usar o nome ALUNOXCAMPUSX[ANO].');

  const partialUpdate = DataManagementService.normalizeImportMetadata({
    mode: 'update-year',
    year: 2027,
    components: [{
      type: 'students', headers: studentHeaders, rowCount: 101,
      fileName: 'alunos_atualizados.xlsx'
    }]
  });
  Assert.equals(1, partialUpdate.components.length,
    'Atualização de ano existente deve aceitar somente uma das bases anuais.');
}

/**
 * Confirma que a mesclagem de DOCENTES atualiza e acrescenta registros sem
 * remover docentes históricos ausentes do relatório mais recente.
 */
function test_DataManagement_teacherMergePreservesHistoricalRows() {
  Logger.log('--- Rodando: test_DataManagement_teacherMergePreservesHistoricalRows ---');

  const headers = DATA_MANAGEMENT_CONFIG.reportContracts.teachers.headers.slice();
  const nameIndex = headers.indexOf('Nome do servidor');
  const registrationIndex = headers.indexOf('Matrícula');
  const cpfIndex = headers.indexOf('CPF');
  const functionIndex = headers.indexOf('Função');

  const makeRow = function(name, registration, cpf, role) {
    const row = new Array(headers.length).fill(null);
    row[nameIndex] = name;
    row[registrationIndex] = registration;
    row[cpfIndex] = cpf;
    row[functionIndex] = role;
    return row;
  };

  const existing = [headers].concat([
    makeRow('Docente A', '1001', '11111111111', 'Função antiga'),
    makeRow('Docente Histórico', '1002', '22222222222', 'Preservar')
  ]);
  const incoming = [headers].concat([
    makeRow('Docente A', '1001', '11111111111', 'Função atualizada'),
    makeRow('Docente Novo', '1003', '33333333333', 'Novo')
  ]);

  const merged = DataManagementService.mergeTeacherValues(existing, incoming);
  const byRegistration = {};
  merged.slice(1).forEach(function(row) {
    byRegistration[String(row[registrationIndex])] = row;
  });

  Assert.equals(4, merged.length,
    'Mesclagem deve manter cabeçalho e três docentes distintos.');
  Assert.equals('Função atualizada', byRegistration['1001'][functionIndex],
    'Docente existente deve receber os dados mais recentes.');
  Assert.equals('Preservar', byRegistration['1002'][functionIndex],
    'Docente ausente no novo relatório deve permanecer para o histórico.');
  Assert.equals('Docente Novo', byRegistration['1003'][nameIndex],
    'Nova matrícula deve ser acrescentada ao cadastro acumulado.');
}

/**
 * Confirma as chaves acadêmicas com turma preferencial, semestre e turma.
 */
function test_AcademicAnalytics_groupKeyContract() {
  Logger.log('--- Rodando: test_AcademicAnalytics_groupKeyContract ---');

  const first = AcademicAnalytics.buildStudentGroupKey(
    ' Bacharelado ', 'Engenharia Agronômica', 'PPC 2021/01', 2, 'E'
  );
  const normalized = AcademicAnalytics.buildStudentGroupKey(
    'BACHARELADO', 'ENGENHARIA AGRONOMICA', 'PPC 2021/01', '2', 'e'
  );
  Assert.equals(first, normalized,
    'Chave de alunos deve normalizar caixa, espaços e acentuação.');

  const offerA = AcademicAnalytics.buildOfferingKey(
    2026, '', 'Bacharelado', 'Engenharia Agronômica', 'PPC 2021/01',
    'Cálculo I', 2, '2 E'
  );
  const offerB = AcademicAnalytics.buildOfferingKey(
    2026, '', 'Bacharelado', 'Engenharia Agronômica', 'PPC 2021/01',
    'Física I', 2, '2 E'
  );
  Assert.equals(false, offerA === offerB,
    'Disciplinas diferentes devem gerar ofertas lógicas diferentes.');
  Assert.equals(5, first.split(AcademicAnalytics.KEY_SEPARATOR).length,
    'Chave de alunos deve incluir TURMA PREFERENCIAL e não deve incluir DISCIPLINA.');
  Assert.equals('E', AcademicAnalytics.normalizePreferredClass('2º período - Turma E'),
    'Representações equivalentes da turma devem produzir o mesmo código canônico.');
}

/**
 * Confirma deduplicação de alunos e de linhas repetidas da mesma oferta.
 */
function test_AcademicAnalytics_uniqueStudentsAndOfferingDeduplication() {
  Logger.log('--- Rodando: test_AcademicAnalytics_uniqueStudentsAndOfferingDeduplication ---');

  const base = {
    PROFESSOR: 'Docente Teste',
    ANO_LETIVO: '2026',
    SEMESTRE_OFERTA: '',
    FORMA: 'Bacharelado',
    CURSO: 'Engenharia Agronômica',
    PPC: 'PPC 2021/01',
    'PERÍODO': 2
  };
  const rows = [
    Object.assign({}, base, { DISCIPLINA: 'Cálculo I' }),
    Object.assign({}, base, { DISCIPLINA: 'Cálculo I' }),
    Object.assign({}, base, { DISCIPLINA: 'Física I' })
  ];
  const students = {
    '2026': [
      { studentKey: 'A1', form: 'Bacharelado', course: 'Engenharia Agronômica', ppc: 'PPC 2021/01', period: 2, currentMovement: 'MATRICULADO', periodMovement: 'MATRICULADO' },
      { studentKey: 'A2', form: 'Bacharelado', course: 'Engenharia Agronômica', ppc: 'PPC 2021/01', period: 2, currentMovement: 'MATRICULADO', periodMovement: 'MATRICULADO' },
      { studentKey: 'A2', form: 'Bacharelado', course: 'Engenharia Agronômica', ppc: 'PPC 2021/01', period: 2, currentMovement: 'MATRICULADO', periodMovement: 'MATRICULADO' },
      { studentKey: 'A3', form: 'Bacharelado', course: 'Engenharia Agronômica', ppc: 'PPC 2021/01', period: 2, currentMovement: 'CANCELADO', periodMovement: 'CANCELADO' }
    ]
  };
  const result = AcademicAnalytics.buildFromSources(rows, students, [{
    name: 'Docente Teste', registration: '1001', employmentType: 'EFETIVO'
  }]);
  const professorKey = AcademicAnalytics.normalizeText('Docente Teste');
  const metric = result.professorIndicators[professorKey].years['2026'].ALL;

  Assert.equals(2, metric.uniqueStudents,
    'Aluno repetido em mais de uma linha ou disciplina deve ser contado uma vez por professor e ano.');
  Assert.equals(2, metric.matchedOfferings,
    'Linhas repetidas da mesma oferta lógica não devem duplicar o denominador.');
  Assert.approximatelyEquals(2, metric.averageStudentsPerOffering, 0.000001,
    'Média por oferta deve usar as ofertas lógicas deduplicadas.');
  Assert.equals(2, result.rows[0].ALUNOS_GRUPO,
    'Cada oferta deve receber a quantidade de alunos ativos do grupo acadêmico.');
}

/**
 * Reproduz o caso anual com duas turmas: o total elegível de 65 alunos é
 * dividido igualmente e o excedente permanece na última turma.
 */
function test_AcademicAnalytics_equalDistributionAcrossRegularOffers() {
  Logger.log('--- Rodando: test_AcademicAnalytics_equalDistributionAcrossRegularOffers ---');
  const base = {
    PROFESSOR: 'DEBORAH SANTESSO BONNAS',
    ANO_LETIVO: '2026',
    SEMESTRE_OFERTA: '',
    FORMA: 'FORMA INTEGRADA',
    CURSO: 'TÉCNICO EM ALIMENTOS',
    PPC: 'TÉCNICO EM ALIMENTOS 2021/01',
    DISCIPLINA: 'ANÁLISE FÍSICO-QUÍMICA E SENSORIAL DE ALIMENTOS',
    'PERÍODO': 2
  };
  const rows = [
    Object.assign({}, base, { TURMA: '2 E' }),
    Object.assign({}, base, { TURMA: '2 F' })
  ];
  const students = { '2026': [] };
  for (let index = 1; index <= 34; index += 1) {
    students['2026'].push({
      studentKey: 'E' + index,
      form: base.FORMA,
      course: base.CURSO,
      ppc: base.PPC,
      period: 2,
      preferredClass: '2º período E',
      currentMovement: 'MATRICULADO',
      periodMovement: 'MATRICULADO'
    });
  }
  for (let index = 1; index <= 31; index += 1) {
    students['2026'].push({
      studentKey: 'F' + index,
      form: base.FORMA,
      course: base.CURSO,
      ppc: base.PPC,
      period: 2,
      preferredClass: 'F',
      currentMovement: 'MATRICULADO',
      periodMovement: 'MATRICULADO'
    });
  }

  const result = AcademicAnalytics.buildFromSources(rows, students, []);
  const professorKey = AcademicAnalytics.normalizeText(base.PROFESSOR);
  const metric = result.professorIndicators[professorKey].years['2026'].ALL;

  Assert.equals(32, result.rows[0].ALUNOS_GRUPO,
    'A primeira oferta deve receber a parte inteira da divisão de 65 por 2.');
  Assert.equals(33, result.rows[1].ALUNOS_GRUPO,
    'A última turma deve receber o aluno excedente.');
  Assert.equals(65, metric.uniqueStudents,
    'A soma aproximada do professor deve preservar os 65 alunos elegíveis.');
  Assert.equals(2, metric.matchedOfferings,
    'Turmas anuais diferentes devem permanecer como ofertas distintas.');
  Assert.approximatelyEquals(32.5, metric.averageStudentsPerOffering, 0.000001,
    'A média deve ser calculada sobre 32 e 33, e não sobre 65 duas vezes.');
  Assert.equals('DIVISAO_IGUAL_ENTRE_OFERTAS', result.rows[0].METODOLOGIA_ALUNOS,
    'A linha deve identificar explicitamente a metodologia aproximada.');
  Assert.equals(2, result.rows[0].QUANTIDADE_OFERTAS_REGULARES_GRUPO,
    'A auditoria deve informar o divisor usado na aproximação.');
  Assert.equals(65, result.rows[1].TOTAL_ALUNOS_GRUPO_ACADEMICO,
    'A auditoria deve preservar o total elegível antes da divisão.');
}

/** Confirma a distribuição do resto de trás para frente em três ou mais ofertas. */
function test_AcademicAnalytics_remainderStartsAtLastClass() {
  Logger.log('--- Rodando: test_AcademicAnalytics_remainderStartsAtLastClass ---');
  const base = {
    PROFESSOR: 'Docente Distribuição', ANO_LETIVO: '2026', SEMESTRE_OFERTA: '',
    FORMA: 'FORMA INTEGRADA', CURSO: 'Curso', PPC: 'PPC', 'PERÍODO': 2,
    DISCIPLINA: 'Disciplina com três ofertas'
  };
  const rows = ['E', 'F', 'G'].map(function(turma) {
    return Object.assign({}, base, { TURMA: turma });
  });
  const students = { '2026': [] };
  for (let index = 1; index <= 68; index += 1) {
    students['2026'].push({
      studentKey: 'A' + index,
      form: base.FORMA,
      course: base.CURSO,
      ppc: base.PPC,
      period: 2,
      preferredClass: index <= 23 ? 'E' : (index <= 46 ? 'F' : 'G'),
      currentMovement: 'MATRICULADO',
      periodMovement: 'MATRICULADO'
    });
  }
  const result = AcademicAnalytics.buildFromSources(rows, students, []);
  Assert.equals('22,23,23', result.rows.map(function(row) {
    return row.ALUNOS_GRUPO;
  }).join(','),
  '68 alunos em três ofertas devem produzir 22, 23 e 23, começando o resto pela última turma.');
  Assert.equals(68, result.rows.reduce(function(total, row) {
    return total + row.ALUNOS_GRUPO;
  }, 0), 'A distribuição inteira nunca pode perder nem criar alunos.');
}

/** Confirma os cinco movimentos elegíveis e exclui qualquer outro movimento. */
function test_AcademicAnalytics_eligibleMovementContract() {
  Logger.log('--- Rodando: test_AcademicAnalytics_eligibleMovementContract ---');
  const eligibleMovements = [
    'Matriculado', 'Trancado', 'Mobilidade', 'Provável formando', 'Integralizada'
  ];
  const rows = [{
    PROFESSOR: 'Docente Movimento', ANO_LETIVO: '2026', SEMESTRE_OFERTA: '',
    FORMA: 'Bacharelado', CURSO: 'Curso', PPC: 'PPC', 'PERÍODO': 1,
    DISCIPLINA: 'Disciplina', TURMA: 'A'
  }];
  const students = { '2026': [] };
  eligibleMovements.forEach(function(movement, index) {
    students['2026'].push({
      studentKey: 'E' + index, form: 'Bacharelado', course: 'Curso', ppc: 'PPC',
      period: 1, preferredClass: 'A', currentMovement: movement, periodMovement: movement
    });
  });
  ['Cancelado', 'Desistente', 'Transferido'].forEach(function(movement, index) {
    students['2026'].push({
      studentKey: 'X' + index, form: 'Bacharelado', course: 'Curso', ppc: 'PPC',
      period: 1, preferredClass: 'A', currentMovement: movement, periodMovement: movement
    });
  });
  students['2026'].push({
    studentKey: 'MISTO', form: 'Bacharelado', course: 'Curso', ppc: 'PPC',
    period: 1, preferredClass: 'A', currentMovement: 'Matriculado', periodMovement: 'Cancelado'
  });

  const result = AcademicAnalytics.buildFromSources(rows, students, []);
  Assert.equals(5, result.rows[0].ALUNOS_GRUPO,
    'Somente os cinco movimentos autorizados em ambos os campos devem ser contabilizados.');
  Assert.equals(5, result.diagnostics.byYear['2026'].activeStudentRecords,
    'Diagnóstico deve registrar cinco movimentos elegíveis.');
  Assert.equals(4, result.diagnostics.byYear['2026'].excludedStudentRecords,
    'Demais movimentos e combinações mistas devem ser ignorados.');
  Assert.equals('MATRICULADO,TRANCADO,MOBILIDADE,PROVAVEL FORMANDO,INTEGRALIZADA',
    AcademicAnalytics.ELIGIBLE_STUDENT_MOVEMENTS.join(','),
    'Contrato deve preservar exatamente a lista de movimentos informada.');
}

/** Confirma que dependências e turmas especiais preservam carga, mas não participam dos alunos. */
function test_AcademicAnalytics_dependencyOffersDoNotCountStudents() {
  Logger.log('--- Rodando: test_AcademicAnalytics_dependencyOffersDoNotCountStudents ---');
  const base = {
    PROFESSOR: 'Docente Dependência', ANO_LETIVO: '2026', SEMESTRE_OFERTA: '',
    FORMA: 'FORMA INTEGRADA', CURSO: 'Curso', PPC: 'PPC', 'PERÍODO': 2
  };
  const rows = [
    Object.assign({}, base, { DISCIPLINA: 'Disciplina regular', TURMA: '2 E', 'CARGA HORÁRIA': 60 }),
    Object.assign({}, base, { DISCIPLINA: 'Disciplina regular', TURMA: '2 F', 'CARGA HORÁRIA': 60 }),
    Object.assign({}, base, { DISCIPLINA: 'Disciplina regular', TURMA: 'DEP', 'CARGA HORÁRIA': 40 }),
    Object.assign({}, base, { DISCIPLINA: 'Disciplina regular', TURMA: 'ESPECIAL', 'CARGA HORÁRIA': 20 })
  ];
  const students = { '2026': [] };
  for (let index = 1; index <= 65; index += 1) {
    students['2026'].push({
      studentKey: 'A' + index, form: base.FORMA, course: base.CURSO, ppc: base.PPC,
      period: 2, preferredClass: index <= 34 ? 'E' : 'F',
      currentMovement: 'MATRICULADO', periodMovement: 'MATRICULADO'
    });
  }
  const result = AcademicAnalytics.buildFromSources(rows, students, []);
  const metric = result.professorIndicators[
    AcademicAnalytics.normalizeText(base.PROFESSOR)
  ].years['2026'].ALL;
  const dependency = result.rows[2];
  const special = result.rows[3];
  const diagnostic = result.diagnostics.byYear['2026'];

  Assert.equals('EXCLUIDA_DEPENDENCIA', dependency.STATUS_ASSOCIACAO_ALUNOS,
    'Oferta DEP deve possuir estado explícito de exclusão dos indicadores de alunos.');
  Assert.equals(null, dependency.ALUNOS_GRUPO,
    'A quantidade de alunos da dependência não deve ser inferida.');
  Assert.equals(false, dependency.ALUNOS_CONTABILIZADOS,
    'A linha deve declarar que não participa dos indicadores de alunos.');
  Assert.equals(40, dependency['CARGA HORÁRIA'],
    'A carga horária da dependência deve permanecer integralmente preservada.');
  Assert.equals('EXCLUIDA_TURMA_ESPECIAL', special.STATUS_ASSOCIACAO_ALUNOS,
    'Turma ESPECIAL deve possuir estado explícito de exclusão dos indicadores de alunos.');
  Assert.equals(null, special.ALUNOS_GRUPO,
    'A quantidade de alunos da turma especial não deve ser inferida.');
  Assert.equals(false, special.ALUNOS_CONTABILIZADOS,
    'Turma especial deve declarar que não participa dos indicadores de alunos.');
  Assert.equals(20, special['CARGA HORÁRIA'],
    'A carga horária da turma especial deve permanecer integralmente preservada.');
  Assert.equals(2, metric.totalOfferings,
    'Dependência não deve entrar no denominador de ofertas com alunos.');
  Assert.equals(65, metric.uniqueStudents,
    'Somente os alunos da oferta regular devem ser contabilizados.');
  Assert.equals('32,33', result.rows.slice(0, 2).map(function(row) {
    return row.ALUNOS_GRUPO;
  }).join(','), 'Dependência não pode aumentar o divisor das duas ofertas regulares.');
  Assert.equals(1, diagnostic.excludedDependencyRows,
    'Diagnóstico deve informar quantas linhas foram excluídas por dependência.');
  Assert.equals(1, diagnostic.excludedSpecialRows,
    'Diagnóstico deve informar quantas linhas foram excluídas por turma especial.');
  Assert.equals(2, diagnostic.excludedNonRegularRows,
    'Diagnóstico deve consolidar todas as turmas não regulares excluídas.');
  Assert.equals(0, diagnostic.unmatchedRows,
    'Dependência não deve ser tratada como falha de associação.');
  Assert.approximatelyEquals(100, diagnostic.matchedPercent, 0.000001,
    'Cobertura deve considerar somente as ofertas elegíveis para alunos.');
}

/**
 * Reproduz a geração do PDF de apenas um professor sem remover do universo a
 * outra oferta usada no divisor acadêmico.
 */
function test_AcademicAnalytics_scopedReportPreservesFullDistribution() {
  Logger.log('--- Rodando: test_AcademicAnalytics_scopedReportPreservesFullDistribution ---');
  const base = {
    ANO_LETIVO: '2026', SEMESTRE_OFERTA: '', FORMA: 'FORMA INTEGRADA',
    CURSO: 'TÉCNICO EM ALIMENTOS', PPC: 'PPC 2021/01', 'PERÍODO': 2,
    DISCIPLINA: 'Análise de Alimentos'
  };
  const rows = [
    Object.assign({}, base, { PROFESSOR: 'Docente E', TURMA: 'E' }),
    Object.assign({}, base, { PROFESSOR: 'Docente F', TURMA: 'F' })
  ];
  const students = { '2026': [] };
  for (let index = 1; index <= 65; index += 1) {
    students['2026'].push({
      studentKey: 'A' + index,
      form: base.FORMA,
      course: base.CURSO,
      ppc: base.PPC,
      period: 2,
      preferredClass: index <= 33 ? 'E' : 'F',
      currentMovement: 'MATRICULADO',
      periodMovement: 'MATRICULADO'
    });
  }
  const selectedOfferingKey = AcademicAnalytics.buildOfferingKey(
    2026, '', base.FORMA, base.CURSO, base.PPC, base.DISCIPLINA, 2, 'E'
  );
  const selectedOfferingKeys = {};
  selectedOfferingKeys[selectedOfferingKey] = true;
  const result = AcademicAnalytics.buildFromSources(rows, students, [], {
    metricOfferingKeys: selectedOfferingKeys,
    metricProfessorKey: AcademicAnalytics.normalizeText('Docente E')
  });
  const metric = result.professorIndicators[AcademicAnalytics.normalizeText('Docente E')]
    .years['2026'].ALL;

  Assert.equals(32, result.rows[0].ALUNOS_GRUPO,
    'Relatório de uma oferta deve manter o divisor calculado com as duas ofertas oficiais.');
  Assert.equals(33, result.rows[1].ALUNOS_GRUPO,
    'Oferta fora do PDF deve continuar recebendo sua parte na recomposição oficial.');
  Assert.equals(32, metric.uniqueStudents,
    'Indicador do professor selecionado deve refletir somente seus alunos aproximados.');
  Assert.equals(1, metric.matchedOfferings,
    'Indicador recortado deve possuir uma única oferta selecionada.');
}

/** Confirma a identidade anual única e a separação das ofertas semestrais. */
function test_AcademicAnalytics_semesterAwareOfferingIdentity() {
  Logger.log('--- Rodando: test_AcademicAnalytics_semesterAwareOfferingIdentity ---');
  const common = [
    2026, 'FORMA INTEGRADA', 'Curso', 'PPC', 'Disciplina', 2, '2 E'
  ];
  const annual = AcademicAnalytics.buildOfferingKey(
    common[0], '', common[1], common[2], common[3], common[4], common[5], common[6]
  );
  const firstSemester = AcademicAnalytics.buildOfferingKey(
    common[0], '1', common[1], common[2], common[3], common[4], common[5], common[6]
  );
  const secondSemester = AcademicAnalytics.buildOfferingKey(
    common[0], '2', common[1], common[2], common[3], common[4], common[5], common[6]
  );

  Assert.equals(false, annual === firstSemester,
    'Oferta anual deve possuir identidade diferente da oferta semestral.');
  Assert.equals(false, firstSemester === secondSemester,
    'Primeiro e segundo semestres devem produzir ofertas distintas.');
  Assert.equals(annual, AcademicAnalytics.buildOfferingKey(
    2026, '', 'FORMA INTEGRADA', 'Curso', 'PPC', 'Disciplina', 2, '2 E'
  ), 'Linhas repetidas da mesma oferta anual devem produzir a mesma identidade.');

  const annualAllocation = AcademicAnalytics.buildStudentAllocationKey(
    2026, '', 'FORMA INTEGRADA', 'Curso', 'PPC', 2, 'Disciplina'
  );
  const firstSemesterAllocation = AcademicAnalytics.buildStudentAllocationKey(
    2026, '1', 'FORMA INTEGRADA', 'Curso', 'PPC', 2, 'Disciplina'
  );
  const secondSemesterAllocation = AcademicAnalytics.buildStudentAllocationKey(
    2026, '2', 'FORMA INTEGRADA', 'Curso', 'PPC', 2, 'Disciplina'
  );
  Assert.equals(false, annualAllocation === firstSemesterAllocation,
    'Regime anual e primeiro semestre devem possuir planos de distribuição distintos.');
  Assert.equals(false, firstSemesterAllocation === secondSemesterAllocation,
    'Cada semestre deve possuir seu próprio divisor de ofertas.');
}

/**
 * Reproduz o erro em que ofertas dos dois semestres eram somadas no mesmo
 * divisor. Cada semestre deve redistribuir integralmente o grupo acadêmico.
 */
function test_AcademicAnalytics_semesterScopedDistribution() {
  Logger.log('--- Rodando: test_AcademicAnalytics_semesterScopedDistribution ---');
  const base = {
    ANO_LETIVO: '2026',
    FORMA: 'BACHARELADO',
    CURSO: 'ENGENHARIA AGRONÔMICA',
    PPC: 'ENGENHARIA AGRONÔMICA 2021/01',
    'PERÍODO': 3,
    DISCIPLINA: 'BIOQUÍMICA'
  };
  const rows = [
    Object.assign({}, base, { PROFESSOR: 'Docente', SEMESTRE_OFERTA: '1', TURMA: 'A' }),
    Object.assign({}, base, { PROFESSOR: 'Docente', SEMESTRE_OFERTA: '1', TURMA: 'B' }),
    Object.assign({}, base, { PROFESSOR: 'Docente', SEMESTRE_OFERTA: '1', TURMA: 'ESPECIAL' }),
    Object.assign({}, base, { PROFESSOR: 'Docente', SEMESTRE_OFERTA: '2', TURMA: 'A' }),
    Object.assign({}, base, { PROFESSOR: 'Docente', SEMESTRE_OFERTA: '2', TURMA: 'B' })
  ];
  const students = { '2026': [] };
  for (let index = 1; index <= 22; index += 1) {
    students['2026'].push({
      studentKey: 'BIO' + index,
      form: base.FORMA,
      course: base.CURSO,
      ppc: base.PPC,
      period: 3,
      preferredClass: index <= 17 ? 'A' : 'B',
      currentMovement: 'MATRICULADO',
      periodMovement: 'MATRICULADO'
    });
  }

  const result = AcademicAnalytics.buildFromSources(rows, students, []);
  const firstSemesterCounts = result.rows.filter(function(record) {
    return AcademicAnalytics.normalizeText(record.SEMESTRE_OFERTA) === '1'
      && record.ALUNOS_CONTABILIZADOS === true;
  }).map(function(record) {
    return record.ALUNOS_GRUPO;
  }).sort(function(a, b) { return a - b; });
  const specialRow = result.rows.filter(function(record) {
    return AcademicAnalytics.normalizeText(record.TURMA) === 'ESPECIAL';
  })[0];
  const secondSemesterRows = result.rows.filter(function(record) {
    return AcademicAnalytics.normalizeText(record.SEMESTRE_OFERTA) === '2';
  });

  Assert.equals('11,11', firstSemesterCounts.join(','),
    'Somente as duas turmas regulares do primeiro semestre devem dividir os 22 alunos.');
  Assert.equals('EXCLUIDA_TURMA_ESPECIAL', specialRow.STATUS_ASSOCIACAO_ALUNOS,
    'A turma especial não pode participar do divisor semestral.');
  Assert.equals(null, specialRow.ALUNOS_GRUPO,
    'A turma especial deve preservar carga horária sem estimativa de alunos.');
  Assert.equals('11,11', secondSemesterRows.map(function(record) {
    return record.ALUNOS_GRUPO;
  }).sort(function(a, b) { return a - b; }).join(','),
  'As duas ofertas do segundo semestre devem receber 11 alunos cada.');
  Assert.equals('2,2', secondSemesterRows.map(function(record) {
    return record.QUANTIDADE_OFERTAS_REGULARES_GRUPO;
  }).join(','), 'O divisor do segundo semestre deve considerar somente suas duas ofertas.');
  Assert.equals('22,22', secondSemesterRows.map(function(record) {
    return record.TOTAL_ALUNOS_GRUPO_ACADEMICO;
  }).join(','), 'Cada plano semestral deve partir do total completo do período acadêmico.');
}

/** Valida conteúdo, privacidade, formato e identificação do relatório PDF. */
function test_TeacherPdfReport_contract() {
  Logger.log('--- Rodando: test_TeacherPdfReport_contract ---');
  const model = {
    generatedAt: '06/08/2026 10:00',
    generatedBy: 'usuario@iftm.edu.br',
    professor: {
      name: 'Docente Teste', employment: 'Efetivo', registration: '1001',
      situation: 'Ativo', workRegime: '40 horas com dedicação exclusiva',
      officialFunction: 'COORDENADOR(A) DO CURSO DE TESTE',
      reducedWorkload: false,
      conditions: [{
        description: 'Coordenação de Curso',
        reason: 'Função confirmada pelo administrador.',
        minimum: 4,
        maximum: 12,
        exemption: false,
        justifiesBelowMinimum: true,
        active: true
      }],
      areas: ['Ciências Exatas']
    },
    scope: {
      years: ['2026'], semester: 'Ano completo', classDuration: 50,
      simulation: 'Todos os componentes especiais considerados.'
    },
    workload: {
      totalClockHours: 100, totalClassHours: 120, weeklyAverage: 2.5,
      weeklyStatus: 'Abaixo da referência', totalWeeks: 40
    },
    students: {
      available: true, uniqueStudents: 65, matchedOfferings: 2,
      averageStudentsPerOffering: 32.5, coveragePercent: 100
    },
    details: [{
      year: '2026', semester: 'Anual', form: 'FORMA INTEGRADA', course: 'Curso',
      ppc: 'PPC', period: '2', turma: 'DEP', discipline: 'Disciplina',
      clockHours: 40, classHours: 48, theoretical: 40, practical: 0, extension: 0,
      students: 'Não contabilizado - turma de dependência', workloadNote: ''
    }]
  };
  const html = TeacherPdfReportService._buildHtml(model);
  Assert.contains(html, '@page{size:A4 landscape',
    'Relatório deve usar A4 em orientação paisagem.');
  Assert.contains(html,
    'Relatório gerado a partir do Dashboard de Carga Horária Docente 10.0.9',
    'Rodapé deve identificar o dashboard e a versão implantada.');
  Assert.contains(html, 'Não contabilizado - turma de dependência',
    'Dependência deve possuir rótulo explícito na tabela do PDF.');
  Assert.contains(html, 'Docente Teste',
    'Relatório deve identificar o professor.');
  Assert.contains(html, 'Coordenação de Curso',
    'Relatório deve registrar a condição confirmada e seu motivo.');
  Assert.contains(html, 'COORDENADOR(A) DO CURSO DE TESTE',
    'Relatório deve registrar a função oficial importada.');
  Assert.notContains(html, 'studentKey',
    'Relatório não deve expor identificadores individuais de alunos.');
  Assert.equals('Dentro da referência', TeacherPdfReportReportStatus.resolve(
    12, 40, { minIntegral: 10, maxIntegral: 20, minPartial: 8, maxPartial: 12 }
  ), 'Situação semanal deve respeitar os parâmetros do recorte.');
  Assert.equals('Abaixo do Mínimo Justificado', TeacherPdfReportReportStatus.resolve(
    6, 40,
    { minIntegral: 10, maxIntegral: 20, minPartial: 8, maxPartial: 12 },
    [{ active: true, justifiesBelowMinimum: true }]
  ), 'PDF deve distinguir carga abaixo do mínimo com justificativa administrativa.');
}

/** Valida consolidação, agrupamento e identificação do relatório geral. */
function test_GeneralTeacherPdfReport_contract() {
  Logger.log('--- Rodando: test_GeneralTeacherPdfReport_contract ---');
  const teacher = function(name, registration, hours, students) {
    return {
      generatedAt: '06/08/2026 10:00',
      professor: {
        name: name, employment: 'Efetivo', registration: registration,
        situation: 'Ativo', workRegime: '40 horas',
        officialFunction: 'COORDENADOR(A) DE ÁREA', reducedWorkload: false,
        conditions: [{
          description: 'Coordenação', reason: 'Função confirmada.',
          justifiesBelowMinimum: true, active: true
        }],
        areas: ['Ciências Exatas', 'Ciências Exatas / Matemática']
      },
      workload: {
        totalClockHours: hours, totalClassHours: hours * 1.2,
        weeklyAverage: hours / 40, weeklyStatus: 'Abaixo da referência', totalWeeks: 40
      },
      students: {
        available: true, uniqueStudents: students,
        matchedOfferings: 2, averageStudentsPerOffering: students / 2,
        coveragePercent: 100
      },
      details: [{
        year: '2026', semester: 'Anual', form: 'FORMA INTEGRADA',
        course: 'Curso', ppc: 'PPC', period: '2', turma: 'E',
        discipline: 'Disciplina', clockHours: hours, classHours: hours * 1.2,
        theoretical: hours, practical: 0, extension: 0,
        students: String(students) + ' alunos (aprox.)', workloadNote: ''
      }]
    };
  };
  const teachers = [
    teacher('Docente B', '2002', 80, 33),
    teacher('Docente A', '1001', 40, 32)
  ];
  const sorted = GeneralTeacherPdfReportService._sortModels(
    teachers,
    'WORKLOAD_DESC'
  );
  Assert.equals('Docente B', sorted[0].professor.name,
    'Ordenação decrescente deve priorizar a maior carga horária.');
  const model = {
    generatedAt: '06/08/2026 10:00', generatedBy: 'admin@iftm.edu.br',
    version: '10.0.9', years: ['2026'], semester: 'Ano completo',
    sortLabel: 'Carga horária decrescente',
    filterSummary: ['FORMA: FORMA INTEGRADA'],
    summary: {
      teacherCount: 2, detailCount: 2, totalClockHours: 120,
      totalClassHours: 144, totalStudentLinks: 65
    },
    areaGroups: [{
      id: 'AREA-1', label: 'Ciências Exatas', teacherCount: 2,
      totalClockHours: 120
    }],
    teachers: sorted
  };
  const html = GeneralTeacherPdfReportService._buildHtml(model);
  Assert.contains(html, 'Relatório Geral de Carga Horária Docente',
    'PDF geral deve possuir identificação própria.');
  Assert.contains(html,
    'Relatório gerado a partir do Dashboard de Carga Horária Docente 10.0.9',
    'Rodapé do relatório geral deve registrar a versão implantada.');
  Assert.contains(html, 'Carga total sem duplicar docentes',
    'Resumo deve explicitar que o total geral não duplica professores por área.');
  Assert.contains(html, 'Ciências Exatas',
    'Relatório geral deve apresentar os grupos de área.');
  Assert.contains(html, 'Condições confirmadas',
    'Relatório geral deve discriminar condições e justificativas por docente.');
  Assert.contains(html, 'Matriculado',
    'Metodologia deve explicar os movimentos elegíveis.');
  Assert.notContains(html, 'studentKey',
    'Relatório geral não deve expor identificadores individuais de alunos.');
}

/**
 * Confirma que cada registro de aluno não ativo é contabilizado uma única vez.
 */
function test_AcademicAnalytics_excludedStudentCount() {
  Logger.log('--- Rodando: test_AcademicAnalytics_excludedStudentCount ---');
  const index = AcademicAnalytics._buildStudentIndex({
    '2026': [
      {
        studentKey: 'A1', form: 'Bacharelado', course: 'Curso', ppc: 'PPC',
        period: 1, currentMovement: 'CANCELADO', periodMovement: 'CANCELADO'
      },
      {
        studentKey: 'A2', form: 'Bacharelado', course: 'Curso', ppc: 'PPC',
        period: 1, currentMovement: 'MATRICULADO', periodMovement: 'MATRICULADO'
      }
    ]
  });

  Assert.equals(1, index.excludedRowsByYear['2026'],
    'Aluno não ativo deve ser contabilizado uma única vez no diagnóstico.');
  Assert.equals(1, index.activeRowsByYear['2026'],
    'Aluno ativo deve continuar contabilizado uma única vez.');
}

/**
 * Confirma que ofertas sem associação recebem motivo explicável e valores normalizados.
 */
function test_AcademicAnalytics_unmatchedReasonDiagnostics() {
  Logger.log('--- Rodando: test_AcademicAnalytics_unmatchedReasonDiagnostics ---');
  const rows = [{
    PROFESSOR: 'Docente Diagnóstico', ANO_LETIVO: '2026', SEMESTRE_OFERTA: '1',
    FORMA: 'Bacharelado', CURSO: 'Curso Teste', PPC: 'PPC NÃO EXISTENTE',
    DISCIPLINA: 'Disciplina Teste', 'PERÍODO': 3, LINHA_ORIGEM: 42
  }];
  const students = {
    '2026': [{
      studentKey: 'A1', form: 'Bacharelado', course: 'Curso Teste',
      ppc: 'PPC 2026', period: 2,
      currentMovement: 'MATRICULADO', periodMovement: 'MATRICULADO'
    }]
  };
  const result = AcademicAnalytics.buildFromSources(rows, students, []);
  Assert.equals('PPC_NAO_LOCALIZADO', result.rows[0].STATUS_ASSOCIACAO_ALUNOS,
    'PPC ausente deve permanecer sem associação e receber motivo específico.');
  Assert.contains(result.rows[0].MOTIVO_ASSOCIACAO_ALUNOS, 'PPC',
    'Motivo deve explicar o componente que não encontrou correspondência.');
  Assert.equals('BACHARELADO', result.rows[0].VALORES_NORMALIZADOS_ASSOCIACAO.forma,
    'Diagnóstico deve expor a forma normalizada usada na chave.');
  Assert.equals(42, result.rows[0].LINHA_ORIGEM,
    'Diagnóstico deve preservar a linha original informada pelo DAO.');
}

/**
 * Confirma a associação pelo maior período disponível quando somente o
 * PERÍODO da oferta docente não possui correspondência exata.
 */
function test_AcademicAnalytics_periodFallbackUsesLargestAvailable() {
  Logger.log('--- Rodando: test_AcademicAnalytics_periodFallbackUsesLargestAvailable ---');
  const rows = [{
    PROFESSOR: 'Docente Fallback', ANO_LETIVO: '2026', SEMESTRE_OFERTA: '1',
    FORMA: 'Bacharelado', CURSO: 'Curso Teste', PPC: 'PPC 2026',
    DISCIPLINA: 'Disciplina Teste', 'PERÍODO': 6, LINHA_ORIGEM: 17
  }];
  const students = {
    '2026': [
      {
        studentKey: 'A1', form: 'Bacharelado', course: 'Curso Teste',
        ppc: 'PPC 2026', period: 2,
        currentMovement: 'MATRICULADO', periodMovement: 'MATRICULADO'
      },
      {
        studentKey: 'A2', form: 'Bacharelado', course: 'Curso Teste',
        ppc: 'PPC 2026', period: 4,
        currentMovement: 'MATRICULADO', periodMovement: 'MATRICULADO'
      },
      {
        studentKey: 'A3', form: 'Bacharelado', course: 'Curso Teste',
        ppc: 'PPC 2026', period: 4,
        currentMovement: 'MATRICULADO', periodMovement: 'MATRICULADO'
      }
    ]
  };
  const result = AcademicAnalytics.buildFromSources(rows, students, []);
  const row = result.rows[0];
  const diagnostic = result.diagnostics.byYear['2026'];

  Assert.equals('LOCALIZADA_FALLBACK_PERIODO', row.STATUS_ASSOCIACAO_ALUNOS,
    'Período sem correspondência deve usar o maior período da mesma Forma + Curso + PPC.');
  Assert.equals('4', row.PERIODO_UTILIZADO_ASSOCIACAO,
    'Fallback deve selecionar numericamente o maior período disponível.');
  Assert.equals(2, row.ALUNOS_GRUPO,
    'Oferta deve receber os alunos ativos do período usado no fallback.');
  Assert.equals(true, row.ASSOCIACAO_POR_FALLBACK_PERIODO,
    'Registro deve identificar explicitamente a associação por fallback.');
  Assert.equals(1, diagnostic.fallbackMatchedRows,
    'Diagnóstico anual deve separar associações feitas pelo maior período.');
  Assert.equals(0, diagnostic.unmatchedRows,
    'Fallback válido deve contar como associação coberta.');
}

/**
 * Confirma classificação sutil de efetivo e substituto pelo cadastro DOCENTES.
 */
function test_AcademicAnalytics_employmentClassification() {
  Logger.log('--- Rodando: test_AcademicAnalytics_employmentClassification ---');

  Assert.equals('SUBSTITUTO', Dao._classifyEmploymentType(
    'Professor do Ensino Básico, Técnico e Tecnológico - Substituto',
    'Contrato temporário'
  ), 'Cargo substituto deve ser classificado como SUBSTITUTO.');
  Assert.equals('EFETIVO', Dao._classifyEmploymentType(
    'Professor do Ensino Básico, Técnico e Tecnológico',
    'Concurso público'
  ), 'Docente permanente deve ser classificado como EFETIVO.');

  const result = AcademicAnalytics.buildFromSources([{
    PROFESSOR: 'Docente Substituto', ANO_LETIVO: '2026', SEMESTRE_OFERTA: '1',
    FORMA: 'Bacharelado', CURSO: 'Curso', PPC: 'PPC', DISCIPLINA: 'Disciplina',
    'PERÍODO': 1
  }], {}, [{
    name: 'Docente Substituto', registration: '2001', employmentType: 'SUBSTITUTO'
  }]);
  Assert.equals('SUBSTITUTO', result.rows[0].VINCULO_DOCENTE,
    'Oferta deve herdar o vínculo do cadastro DOCENTES.');
}

/**
 * Confirma normalização, ordenação e montagem hierárquica das áreas.
 */
function test_KnowledgeAreas_normalizationAndHierarchy() {
  Logger.log('--- Rodando: test_KnowledgeAreas_normalizationAndHierarchy ---');

  Assert.equals('OPERACOES UNITARIAS',
    KnowledgeAreasService.normalizeName('  Operações   Unitárias  '),
    'Comparação de nomes deve ignorar acentuação, caixa e espaços repetidos.');

  const areas = [
    {
      id: 'P2', name: 'Produção Animal', parentId: '', description: '',
      active: true, order: 20, createdAt: new Date(), updatedAt: new Date(), sourceRow: 2
    },
    {
      id: 'P1', name: 'Produção Vegetal', parentId: '', description: '',
      active: true, order: 10, createdAt: new Date(), updatedAt: new Date(), sourceRow: 3
    },
    {
      id: 'S2', name: 'Fitossanidade', parentId: 'P1', description: '',
      active: true, order: 20, createdAt: new Date(), updatedAt: new Date(), sourceRow: 4
    },
    {
      id: 'S1', name: 'Solos e adubação', parentId: 'P1', description: '',
      active: true, order: 10, createdAt: new Date(), updatedAt: new Date(), sourceRow: 5
    }
  ];
  const hierarchy = KnowledgeAreasService.buildHierarchy(areas);

  Assert.equals(2, hierarchy.length,
    'Hierarquia deve preservar todas as áreas principais.');
  Assert.equals('P1', hierarchy[0].id,
    'Áreas principais devem respeitar Ordem_Exibicao.');
  Assert.equals('S1', hierarchy[0].children[0].id,
    'Subáreas devem respeitar Ordem_Exibicao dentro do pai.');
  Assert.equals(2, hierarchy[0].childCount,
    'Área principal deve informar a quantidade de subáreas.');
}

/**
 * Valida duplicidades, limite de dois níveis e coerência de ativação.
 */
function test_KnowledgeAreas_integrityRules() {
  Logger.log('--- Rodando: test_KnowledgeAreas_integrityRules ---');
  const base = [
    {
      id: 'P1', name: 'Área Principal', parentId: '', description: '',
      active: true, order: 10, createdAt: new Date(), updatedAt: new Date(), sourceRow: 2
    },
    {
      id: 'S1', name: 'Subárea', parentId: 'P1', description: '',
      active: true, order: 10, createdAt: new Date(), updatedAt: new Date(), sourceRow: 3
    }
  ];

  Assert.equals(true, KnowledgeAreasService.validateCollection(base).ok,
    'Coleção hierárquica válida deve passar na verificação de integridade.');

  Assert.throws(function() {
    KnowledgeAreasService._validateCandidate({
      id: '', name: ' area principal ', parentId: '', description: '', active: true, order: 20
    }, null, base);
  }, 'Nome duplicado no mesmo nível deve ser bloqueado como falha esperada.');

  Assert.throws(function() {
    KnowledgeAreasService._validateCandidate({
      id: '', name: 'Terceiro nível', parentId: 'S1', description: '', active: true, order: 10
    }, null, base);
  }, 'Subárea vinculada a outra subárea deve ser bloqueada como falha esperada.');

  Assert.throws(function() {
    KnowledgeAreasService._validateCandidate({
      id: '', name: 'Nova subárea', parentId: 'P1', description: '', active: true, order: 20
    }, null, [Object.assign({}, base[0], { active: false })]);
  }, 'Subárea ativa sob área principal inativa deve ser bloqueada como falha esperada.');

  const inactiveParentCollection = [
    Object.assign({}, base[0], { active: false }),
    Object.assign({}, base[1], { active: true })
  ];
  Assert.equals(false, KnowledgeAreasService.validateCollection(inactiveParentCollection).ok,
    'Subárea ativa sob área principal inativa deve falhar na integridade.');

  const sameNameDifferentParents = base.concat([
    {
      id: 'P2', name: 'Outra Área', parentId: '', description: '',
      active: true, order: 20, createdAt: new Date(), updatedAt: new Date(), sourceRow: 4
    },
    {
      id: 'S2', name: 'Subárea', parentId: 'P2', description: '',
      active: true, order: 10, createdAt: new Date(), updatedAt: new Date(), sourceRow: 5
    }
  ]);
  Assert.equals(true, KnowledgeAreasService.validateCollection(sameNameDifferentParents).ok,
    'Nomes iguais devem ser permitidos quando pertencem a áreas principais diferentes.');
}

/**
 * Garante que linhas preparadas pelo instalador, contendo apenas o checkbox
 * Ativa desmarcado, não sejam interpretadas como cadastros incompletos.
 */
function test_KnowledgeAreas_preparedBlankRowsAreIgnored() {
  Logger.log('--- Rodando: test_KnowledgeAreas_preparedBlankRowsAreIgnored ---');

  Assert.equals(false, KnowledgeAreasService._rowHasMeaningfulData([
    '', '', '', '', false, '', '', ''
  ]), 'Checkbox desmarcado isolado deve representar linha vazia preparada.');

  Assert.equals(true, KnowledgeAreasService._rowHasMeaningfulData([
    '', 'Área parcialmente digitada', '', '', false, '', '', ''
  ]), 'Linha parcialmente preenchida deve continuar sujeita ao diagnóstico.');

  Assert.equals(true, KnowledgeAreasService._rowHasMeaningfulData([
    '', '', '', '', true, '', '', ''
  ]), 'Checkbox marcado isolado deve ser tratado como preenchimento incompleto.');
}

/** Confirma que a cascata alcança somente a área escolhida e seus descendentes. */
function test_KnowledgeAreas_cascadeTargetContract() {
  Logger.log('--- Rodando: test_KnowledgeAreas_cascadeTargetContract ---');
  const areas = [
    { id: 'P1', name: 'Principal', parentId: '', active: true },
    { id: 'S1', name: 'Subárea 1', parentId: 'P1', active: true },
    { id: 'S2', name: 'Subárea 2', parentId: 'P1', active: false },
    { id: 'P2', name: 'Outra principal', parentId: '', active: true }
  ];
  const mainTargets = KnowledgeAreasService._resolveCascadeTargets(areas, 'P1')
    .map(function(area) { return area.id; }).sort();
  Assert.equals('P1,S1,S2', mainTargets.join(','),
    'Área principal deve incluir todas as subáreas, inclusive as já inativas, sem atingir outro grupo.');
  Assert.equals('S1', KnowledgeAreasService._resolveCascadeTargets(areas, 'S1')
    .map(function(area) { return area.id; }).join(','),
    'Inativação de subárea deve ficar restrita ao próprio ramo.');
}

/**
 * Confirma que a aba instalada pode ser lida sem realizar mutações.
 */
function test_KnowledgeAreas_readOnlyIntegration() {
  Logger.log('--- Rodando: test_KnowledgeAreas_readOnlyIntegration ---');
  const response = JSON.parse(getKnowledgeAreas());
  Assert.equals('success', response.status,
    'Endpoint de Áreas de Conhecimento deve ler a aba instalada.');
  Assert.equals(true, Array.isArray(response.areas),
    'Endpoint deve retornar uma lista de registros.');
  Assert.equals(true, Array.isArray(response.hierarchy),
    'Endpoint deve retornar a hierarquia de dois níveis.');
  Assert.equals(true, response.health.ok,
    'Cadastro atual deve passar no health check de integridade.');
  Assert.equals('10.0.9', response.meta.version,
    'Módulo de Áreas de Conhecimento deve identificar a versão 10.0.9.');
}

/**
 * Confirma o contrato persistente e o tratamento de linhas preparadas vazias.
 */
function test_TeacherAreas_contractAndEmptyState() {
  Logger.log('--- Rodando: test_TeacherAreas_contractAndEmptyState ---');

  Assert.equals('10.0.9', TEACHER_AREAS_CONFIG.version,
    'Módulo docente-área deve identificar a versão 10.0.9.');
  Assert.equals(9, TEACHER_AREAS_CONFIG.associationHeaders.length,
    'DOCENTES_AREAS deve possuir nove colunas contratadas.');
  Assert.equals('Semestre_Fim', TEACHER_AREAS_CONFIG.associationHeaders[8],
    'Última coluna deve registrar o corte semestral sem mover as colunas existentes.');
  Assert.equals(6, TEACHER_AREAS_CONFIG.controlHeaders.length,
    'DOCENTES_CONTROLE deve possuir seis colunas contratadas.');
  Assert.equals(false,
    TeacherAreasService._associationRowHasMeaningfulData(['', '', '', '', '', false, '', '', '']),
    'Checkbox falso em linha preparada não deve representar uma associação.');
  Assert.equals(false,
    TeacherAreasService._controlRowHasMeaningfulData(['', false, '', '', '', '']),
    'Checkbox falso em linha preparada não deve representar controle docente.');
  Assert.equals('00123A', TeacherAreasService.normalizeRegistration(' 001.23-a '),
    'Matrícula deve ser normalizada sem conversão numérica.');
  Assert.contains(TeacherAreasService.addAssignments.toString(), 'está inativo',
    'Backend deve bloquear nova associação para docente inativo.');
  Assert.contains(TeacherAreasService.reactivateAssignment.toString(), 'Reative o docente',
    'Backend deve bloquear reativação de associação enquanto o docente estiver inativo.');

  const validation = TeacherAreasService.validateAssignments([], [], []);
  Assert.equals(true, validation.ok,
    'Ausência de associações deve ser uma condição válida do sistema.');
  Assert.equals(0, validation.recordCount,
    'Coleção vazia deve manter contagem zero.');
}

/**
 * Confirma vigência histórica e bloqueio de sobreposição ativa.
 */
function test_TeacherAreas_vigencyAndOverlap() {
  Logger.log('--- Rodando: test_TeacherAreas_vigencyAndOverlap ---');

  const ended = { active: false, startYear: '2024', endYear: '2025' };
  Assert.equals(true, TeacherAreasService.assignmentAppliesToYear(ended, '2024'),
    'Associação encerrada deve permanecer válida dentro da vigência.');
  Assert.equals(false, TeacherAreasService.assignmentAppliesToYear(ended, '2026'),
    'Associação encerrada não deve avançar além do ano final.');
  Assert.equals(false,
    TeacherAreasService.assignmentAppliesToYear({ active: false, startYear: '2024', endYear: '' }, '2025'),
    'Associação inativa sem ano final não deve ser aplicada ao dashboard.');

  const areas = [{ id: 'A1' }];
  const teachers = [{ registration: '1001' }];
  const overlapping = [
    { id: 'R1', registration: '1001', areaId: 'A1', startYear: '2024', endYear: '', active: true, sourceRow: 2 },
    { id: 'R2', registration: '1001', areaId: 'A1', startYear: '2026', endYear: '', active: true, sourceRow: 3 }
  ];
  Assert.equals(false,
    TeacherAreasService.validateAssignments(overlapping, areas, teachers).ok,
    'Duas associações ativas sobrepostas devem falhar na integridade.');

  const separated = [
    { id: 'R1', registration: '1001', areaId: 'A1', startYear: '2024', endYear: '2025', active: false, sourceRow: 2 },
    { id: 'R2', registration: '1001', areaId: 'A1', startYear: '2026', endYear: '', active: true, sourceRow: 3 }
  ];
  Assert.equals(true,
    TeacherAreasService.validateAssignments(separated, areas, teachers).ok,
    'Vigências históricas não sobrepostas devem coexistir.');
}

/** Valida o corte semestral e a preservação integral das ofertas anuais. */
function test_TeacherAreas_semesterVigencyContract() {
  Logger.log('--- Rodando: test_TeacherAreas_semesterVigencyContract ---');
  const endedInFirstSemester = {
    active: false,
    startYear: '2024',
    endYear: '2026',
    endSemester: '1'
  };
  Assert.equals(true,
    TeacherAreasService.assignmentAppliesToYear(endedInFirstSemester, '2026', '1'),
    'Associação deve contar no último semestre válido.');
  Assert.equals(false,
    TeacherAreasService.assignmentAppliesToYear(endedInFirstSemester, '2026', '2'),
    'Associação não deve contar no semestre posterior ao encerramento.');
  Assert.equals(true,
    TeacherAreasService.assignmentAppliesToYear(endedInFirstSemester, '2026', ''),
    'Oferta anual deve continuar válida até o fim do último ano informado.');
  Assert.equals(false,
    TeacherAreasService.assignmentAppliesToYear(endedInFirstSemester, '2027', ''),
    'Oferta anual não deve avançar além do último ano válido.');
  Assert.equals(true,
    TeacherAreasService.assignmentAppliesToYear({
      active: false, startYear: '2024', endYear: '2026', endSemester: ''
    }, '2026', '2'),
    'Associação histórica anterior à 10.0.7 deve permanecer válida durante todo o ano final.');
  const filtered = AcademicAnalytics._filterAssignmentsForYear(
    [endedInFirstSemester],
    '2026',
    '2'
  );
  Assert.equals(0, filtered.length,
    'Dashboard e relatórios devem usar o mesmo corte semestral da associação.');
}

/** Valida o semestre final opcional sem criar um semestre inicial. */
function test_TeacherAreas_optionalEndSemesterContract() {
  Logger.log('--- Rodando: test_TeacherAreas_optionalEndSemesterContract ---');
  const wholeYear = TeacherAreasService.normalizeReferencePeriod({
    year: '2026',
    semester: ''
  });
  Assert.equals('', wholeYear.semester,
    'Semestre final vazio deve ser preservado como limite anual opcional.');
  Assert.equals('ano de 2026', wholeYear.label,
    'Período sem semestre deve ser identificado como ano completo.');
  Assert.equals(true, TeacherAreasService.assignmentAppliesToYear({
    active: false,
    startYear: '2024',
    endYear: '2026',
    endSemester: ''
  }, '2026', '2'),
  'Ano final sem semestre deve permanecer vigente até o segundo semestre.');
  Assert.throws(function() {
    TeacherAreasService._normalizeOptionalSemester('3', 'Semestre final');
  }, 'Semestre final diferente de 1 ou 2 deve ser rejeitado.');

  const invalid = TeacherAreasService.validateAssignments([{
    id: 'SEM-FIM-SEM-ANO',
    registration: '1001',
    areaId: 'A1',
    startYear: '',
    endYear: '',
    endSemester: '1',
    active: true,
    sourceRow: 2
  }], [{ id: 'A1' }], [{ registration: '1001' }]);
  Assert.equals(false, invalid.ok,
    'Semestre final preenchido sem ano final deve falhar na integridade.');
}

/** Valida contagem única direta, por subárea e agregada na área principal. */
function test_TeacherAreas_areaTeacherCountAggregationContract() {
  Logger.log('--- Rodando: test_TeacherAreas_areaTeacherCountAggregationContract ---');
  const areas = [
    { id: 'P1', parentId: '' },
    { id: 'S1', parentId: 'P1' },
    { id: 'S2', parentId: 'P1' },
    { id: 'P2', parentId: '' }
  ];
  const assignments = [
    { registration: 'T1', areaId: 'P1', active: true, startYear: '', endYear: '' },
    { registration: 'T1', areaId: 'S1', active: true, startYear: '', endYear: '' },
    { registration: 'T2', areaId: 'S1', active: true, startYear: '', endYear: '' },
    { registration: 'T3', areaId: 'S2', active: false, startYear: '2024', endYear: '2026', endSemester: '1' },
    { registration: 'T4', areaId: 'S2', active: true, startYear: '', endYear: '' },
    { registration: 'T5', areaId: 'S2', active: true, startYear: '', endYear: '' }
  ];
  const counts = TeacherAreasService.buildAreaTeacherCounts(
    areas,
    assignments,
    { T1: true, T2: true, T3: true, T5: true },
    { year: '2026', semester: '2' }
  );
  Assert.equals(1, counts.P1.directTeacherCount,
    'Área principal deve informar separadamente seu vínculo direto.');
  Assert.equals(3, counts.P1.teacherCount,
    'Área principal deve agregar T1, T2 e T5 sem duplicar T1.');
  Assert.equals(2, counts.S1.teacherCount,
    'Subárea deve contar somente seus professores únicos vigentes.');
  Assert.equals(1, counts.S2.teacherCount,
    'Subárea deve excluir vínculo encerrado no semestre anterior e docente inativo.');

  Assert.equals('P1,S1,S2', TeacherAreasService.resolveAreaScopeIds(
    areas,
    { id: 'P1', parentId: '' }
  ).join(','), 'Modal da área principal deve incluir todas as subáreas.');
  Assert.equals('S1', TeacherAreasService.resolveAreaScopeIds(
    areas,
    { id: 'S1', parentId: 'P1' }
  ).join(','), 'Modal da subárea deve permanecer no escopo direto.');
}

/**
 * Confirma a leitura das novas abas sem realizar mutações.
 */
function test_TeacherAreas_readOnlyIntegration() {
  Logger.log('--- Rodando: test_TeacherAreas_readOnlyIntegration ---');
  const response = JSON.parse(getTeacherAreaManagementData(''));
  Assert.equals('success', response.status,
    'Endpoint gerencial docente-área deve responder com sucesso.');
  Assert.equals(true, Array.isArray(response.management.teachers),
    'Endpoint deve fornecer o cadastro acumulado de docentes.');
  Assert.equals(true, Array.isArray(response.management.areas),
    'Endpoint deve fornecer o catálogo de áreas.');
  Assert.equals(true, Array.isArray(response.management.selectedAreaAssignments),
    'Endpoint sem área selecionada deve fornecer coleção vazia de associações selecionadas.');
  Assert.equals('10.0.9', response.meta.version,
    'Endpoint docente-área deve identificar a versão 10.0.9.');
}

/**
 * Testa a leitura minimalista das bases auxiliares e a não exposição de PII.
 */
function test_Dao_auxiliaryBases() {
  Logger.log('--- Rodando: test_Dao_auxiliaryBases ---');

  const studentsByYear = Dao.extractStudentRowsByYear();
  const teachers = Dao.extractTeacherRegistry();

  Assert.equals('object', typeof studentsByYear,
    'DAO deve retornar as bases anuais de alunos agrupadas por ano.');
  Assert.equals(true, Array.isArray(teachers),
    'DAO deve retornar o cadastro mínimo de docentes.');

  const years = Object.keys(studentsByYear);
  if (years.length > 0 && studentsByYear[years[0]].length > 0) {
    const student = studentsByYear[years[0]][0];
    Assert.hasProperty(student, 'studentKey',
      'Registro mínimo de aluno deve possuir chave técnica para deduplicação.');
    Assert.hasProperty(student, 'preferredClass',
      'Registro mínimo de aluno deve expor a turma preferencial usada na associação.');
    Assert.equals(false, Object.prototype.hasOwnProperty.call(student, 'name'),
      'Nome do aluno não deve sair da camada DAO.');
    Assert.equals(false, Object.prototype.hasOwnProperty.call(student, 'email'),
      'E-mail do aluno não deve sair da camada DAO.');
  }

  if (teachers.length > 0) {
    Assert.hasProperty(teachers[0], 'employmentType',
      'Cadastro mínimo deve classificar o vínculo docente.');
    Assert.hasProperty(teachers[0], 'active',
      'Cadastro enriquecido deve informar a situação administrativa.');
    Assert.equals(true, Array.isArray(teachers[0].areaAssignments),
      'Cadastro enriquecido deve fornecer uma lista de áreas, ainda que vazia.');
    Assert.equals(false, Object.prototype.hasOwnProperty.call(teachers[0], 'phone'),
      'Telefone do docente não deve sair da camada DAO.');
  }
}

/**
 * Teste de integração do DAO com a planilha ativa.
 */
function test_Dao_extractDataFromSheets() {
  Logger.log('--- Rodando: test_Dao_extractDataFromSheets ---');
  const data = Dao.extractDataFromSheets();

  Assert.equals(true, Array.isArray(data),
    'O DAO deve retornar um Array.');

  if (data.length === 0) {
    Logger.log('⚠️ Planilha vazia. Teste de propriedades pulado.');
    return;
  }

  Assert.hasProperty(data[0], 'PROFESSOR',
    'Objeto de dados deve conter PROFESSOR.');
  Assert.hasProperty(data[0], 'ANO_LETIVO',
    'Objeto de dados deve conter ANO_LETIVO.');
  Assert.hasProperty(data[0], 'SEMESTRE',
    'Objeto de dados deve preservar SEMESTRE.');
  Assert.hasProperty(data[0], 'CARGA HORÁRIA',
    'Objeto de dados deve preservar a carga em hora-relógio.');
}

/**
 * Reproduz na base oficial de 2026 o caso que motivou a correção: as ofertas
 * anuais 2 E e 2 F da professora Deborah devem receber, respectivamente, os
 * grupos definidos pela TURMA PREFERENCIAL, sem repetir o total agregado de 65.
 */
function test_Dao_realAnnualPreferredClassAssociation() {
  Logger.log('--- Rodando: test_Dao_realAnnualPreferredClassAssociation ---');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet.getSheetByName('2026')
      || !spreadsheet.getSheetByName('ALUNOXCAMPUSX2026')) {
    Logger.log('ℹ️ SKIP: as bases 2026 necessárias ao cenário real não estão disponíveis.');
    return;
  }

  const targetProfessor = AcademicAnalytics.normalizeText('DEBORAH SANTESSO BONNAS');
  const targetDiscipline = AcademicAnalytics.normalizeText(
    'ANÁLISE FÍSICO-QUÍMICA E SENSORIAL DE ALIMENTOS'
  );
  const sourceRows = DashboardRules.prepareRecords(Dao.extractDataFromYear('2026'))
    .filter(function(record) {
      return AcademicAnalytics.normalizeText(record.PROFESSOR) === targetProfessor
        && AcademicAnalytics.normalizeText(record.DISCIPLINA) === targetDiscipline;
    });

  if (sourceRows.length === 0) {
    Logger.log('ℹ️ SKIP: o cenário real de Deborah não está presente na base atual.');
    return;
  }

  Assert.equals(2, sourceRows.length,
    'A base real deve preservar as duas ofertas anuais da disciplina analisada.');
  Assert.equals('E,F', sourceRows.map(function(record) {
    return AcademicAnalytics.normalizePreferredClass(record.TURMA);
  }).sort().join(','),
  'As ofertas reais devem permanecer identificadas pelas turmas 2 E e 2 F.');

  const studentsByYear = {
    '2026': Dao.extractStudentRowsForYear('2026')
  };
  const result = AcademicAnalytics.buildFromSources(sourceRows, studentsByYear, []);
  const counts = result.rows.map(function(record) {
    return record.ALUNOS_GRUPO;
  }).sort(function(a, b) {
    return a - b;
  });
  const metric = result.professorIndicators[targetProfessor].years['2026'].ALL;

  Assert.equals('32,33', counts.join(','),
    'As duas ofertas reais devem receber 32 e 33 alunos, com o excedente na última turma.');
  Assert.equals(65, metric.uniqueStudents,
    'O total único real da professora deve permanecer em 65 alunos.');
  Assert.equals(2, metric.matchedOfferings,
    'As turmas E e F devem ser tratadas como duas ofertas anuais distintas.');
  Assert.approximatelyEquals(32.5, metric.averageStudentsPerOffering, 0.000001,
    'A média real deve ser calculada sobre os grupos aproximados 32 e 33.');
}

/**
 * Valida na base oficial os casos reportados de Engenharia Agronômica:
 * Zoologia no segundo semestre recebe os 28 alunos do 2º período; Bioquímica
 * divide os 22 alunos do 3º período somente entre as duas turmas do semestre.
 */
function test_Dao_realAgronomySemesterStudentDistribution() {
  Logger.log('--- Rodando: test_Dao_realAgronomySemesterStudentDistribution ---');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet.getSheetByName('2026')
      || !spreadsheet.getSheetByName('ALUNOXCAMPUSX2026')) {
    Logger.log('ℹ️ SKIP: as bases 2026 necessárias aos cenários de Agronomia não estão disponíveis.');
    return;
  }

  const targetForm = AcademicAnalytics.normalizeText('BACHARELADO');
  const targetCourse = AcademicAnalytics.normalizeText('ENGENHARIA AGRONÔMICA');
  const targetPpc = AcademicAnalytics.normalizeText('ENGENHARIA AGRONÔMICA 2021/01');
  const targetDisciplines = {
    ZOOLOGIA: true,
    BIOQUIMICA: true
  };
  const sourceRows = DashboardRules.prepareRecords(Dao.extractDataFromYear('2026'))
    .filter(function(record) {
      return AcademicAnalytics.normalizeText(record.FORMA) === targetForm
        && AcademicAnalytics.normalizeText(record.CURSO) === targetCourse
        && AcademicAnalytics.normalizeText(record.PPC) === targetPpc
        && targetDisciplines[AcademicAnalytics.normalizeText(record.DISCIPLINA)] === true;
    });

  Assert.equals(8, sourceRows.length,
    'A base real deve preservar três ofertas de Zoologia e cinco de Bioquímica em 2026.');

  const result = AcademicAnalytics.buildFromSources(sourceRows, {
    '2026': Dao.extractStudentRowsForYear('2026')
  }, []);
  const zoologySecondSemester = result.rows.filter(function(record) {
    return AcademicAnalytics.normalizeText(record.DISCIPLINA) === 'ZOOLOGIA'
      && AcademicAnalytics.normalizeText(record.SEMESTRE_OFERTA) === '2';
  });
  const biochemistrySecondSemester = result.rows.filter(function(record) {
    return AcademicAnalytics.normalizeText(record.DISCIPLINA) === 'BIOQUIMICA'
      && AcademicAnalytics.normalizeText(record.SEMESTRE_OFERTA) === '2';
  });
  const specialRows = result.rows.filter(function(record) {
    return AcademicAnalytics.normalizeText(record.TURMA) === 'ESPECIAL';
  });

  Assert.equals(1, zoologySecondSemester.length,
    'O segundo semestre deve possuir uma única turma de Zoologia.');
  Assert.equals(28, zoologySecondSemester[0].ALUNOS_GRUPO,
    'A única turma de Zoologia do segundo semestre deve receber os 28 alunos elegíveis.');
  Assert.equals(1, zoologySecondSemester[0].QUANTIDADE_OFERTAS_REGULARES_GRUPO,
    'Zoologia não pode usar as ofertas do primeiro semestre em seu divisor.');

  Assert.equals(2, biochemistrySecondSemester.length,
    'O segundo semestre deve possuir duas turmas de Bioquímica.');
  Assert.equals('11,11', biochemistrySecondSemester.map(function(record) {
    return record.ALUNOS_GRUPO;
  }).sort(function(a, b) { return a - b; }).join(','),
  'As duas turmas de Bioquímica do segundo semestre devem receber 11 alunos cada.');
  Assert.equals('2,2', biochemistrySecondSemester.map(function(record) {
    return record.QUANTIDADE_OFERTAS_REGULARES_GRUPO;
  }).join(','), 'Bioquímica deve usar somente as duas ofertas do segundo semestre no divisor.');
  Assert.equals(2, specialRows.length,
    'Os cenários reais devem preservar uma turma especial em cada disciplina.');
  Assert.equals('EXCLUIDA_TURMA_ESPECIAL,EXCLUIDA_TURMA_ESPECIAL', specialRows.map(function(record) {
    return record.STATUS_ASSOCIACAO_ALUNOS;
  }).join(','), 'Turmas especiais devem ficar fora do cálculo de alunos.');
}

/**
 * Garante que backups e abas temporárias nunca sejam lidos pelo dashboard.
 */
function test_Dao_onlyReadsCanonicalAnnualSheets() {
  Logger.log('--- Rodando: test_Dao_onlyReadsCanonicalAnnualSheets ---');
  const data = Dao.extractDataFromSheets();
  const invalid = data.filter(function(record) {
    return !/^\d{4}$/.test(String(record.ANO_LETIVO || ''));
  });

  Assert.equals(0, invalid.length,
    'DAO deve retornar somente registros provenientes de abas anuais canônicas.');
}

/**
 * Confirma que cada registro é integralmente distribuído entre os semestres.
 */
function test_Dao_realDataSemesterAllocationInvariant() {
  Logger.log('--- Rodando: test_Dao_realDataSemesterAllocationInvariant ---');
  const preparedData = DashboardRules.prepareRecords(
    Dao.extractDataFromSheets()
  );

  const invalidRecords = preparedData.filter(function(record) {
    const allocationSum = record['FATOR_SEMESTRE_1']
      + record['FATOR_SEMESTRE_2'];

    return Math.abs(1 - allocationSum) > 0.000001;
  });

  Assert.equals(0, invalidRecords.length,
    'Todos os registros reais devem ser integralmente distribuídos.');
}

/**
 * Confirma, com a base real, que os recortes semestrais recompõem a
 * carga anual em hora-relógio.
 */
function test_Dao_realClockHourTotalRecomposition() {
  Logger.log('--- Rodando: test_Dao_realClockHourTotalRecomposition ---');
  const preparedData = DashboardRules.prepareRecords(
    Dao.extractDataFromSheets()
  );

  const annualTotal = sumFieldWithFactor_(
    preparedData,
    ['CARGA HORÁRIA', 'CARGA HORARIA', 'CH'],
    null
  );
  const firstSemesterTotal = sumFieldWithFactor_(
    preparedData,
    ['CARGA HORÁRIA', 'CARGA HORARIA', 'CH'],
    'FATOR_SEMESTRE_1'
  );
  const secondSemesterTotal = sumFieldWithFactor_(
    preparedData,
    ['CARGA HORÁRIA', 'CARGA HORARIA', 'CH'],
    'FATOR_SEMESTRE_2'
  );

  Logger.log('Total anual em hora-relógio: ' + annualTotal);
  Logger.log('1º semestre em hora-relógio: ' + firstSemesterTotal);
  Logger.log('2º semestre em hora-relógio: ' + secondSemesterTotal);

  Assert.approximatelyEquals(
    annualTotal,
    firstSemesterTotal + secondSemesterTotal,
    0.000001,
    'Os dois semestres devem recompor a carga anual em hora-relógio.'
  );
}

/**
 * Repete a prova real para as cargas teórica, prática e de extensão.
 */
function test_Dao_realClockHourComponentsRecomposition() {
  Logger.log('--- Rodando: test_Dao_realClockHourComponentsRecomposition ---');
  const preparedData = DashboardRules.prepareRecords(
    Dao.extractDataFromSheets()
  );

  const fields = [
    ['CARGA HORÁRIA TEÓRICA', 'CARGA HORARIA TEORICA', 'TEORICA', 'TEÓRICA'],
    ['CARGA HORÁRIA PRÁTICA', 'CARGA HORARIA PRATICA', 'PRATICA', 'PRÁTICA'],
    ['CARGA HORÁRIA EXTENSÃO', 'CARGA HORARIA EXTENSAO', 'EXTENSAO', 'EXTENSÃO']
  ];

  fields.forEach(function(keys, index) {
    const annualTotal = sumFieldWithFactor_(preparedData, keys, null);
    const firstSemesterTotal = sumFieldWithFactor_(
      preparedData,
      keys,
      'FATOR_SEMESTRE_1'
    );
    const secondSemesterTotal = sumFieldWithFactor_(
      preparedData,
      keys,
      'FATOR_SEMESTRE_2'
    );

    Assert.approximatelyEquals(
      annualTotal,
      firstSemesterTotal + secondSemesterTotal,
      0.000001,
      'Componente ' + (index + 1)
        + ' deve ser recomposto pelos dois semestres em hora-relógio.'
    );
  });
}

/**
 * Prova, com dados controlados, que linhas de professores distintos são somadas.
 */
function test_Dao_courseAggregationSumsEveryTeacherRow() {
  Logger.log('--- Rodando: test_Dao_courseAggregationSumsEveryTeacherRow ---');

  const records = [
    { CURSO: 'PARTIU IF', FORMA: 'FIC', PROFESSOR: 'Professor 1', 'CARGA HORÁRIA': 80 },
    { CURSO: 'PARTIU IF', FORMA: 'FIC', PROFESSOR: 'Professor 2', 'CARGA HORÁRIA': 80 },
    { CURSO: 'PARTIU IF', FORMA: 'FIC', PROFESSOR: 'Professor 3', 'CARGA HORÁRIA': 80 },
    { CURSO: 'PARTIU IF', FORMA: 'FIC', PROFESSOR: 'Professor 4', 'CARGA HORÁRIA': 80 }
  ];

  const totals = aggregateCourseClockHours_(records, null);
  const courseKey = makeCourseFormKey_('PARTIU IF', 'FIC');

  Assert.approximatelyEquals(320, totals[courseKey], 0.000001,
    'Quatro linhas de 80 horas devem totalizar 320 horas no curso e forma.');
}

/**
 * Garante que cursos com o mesmo nome e formas diferentes não sejam consolidados.
 */
function test_Dao_courseAggregationSeparatesSameNameByForm() {
  Logger.log('--- Rodando: test_Dao_courseAggregationSeparatesSameNameByForm ---');

  const records = [
    { CURSO: 'TÉCNICO EM AGROPECUÁRIA', FORMA: 'FORMA INTEGRADA', 'CARGA HORÁRIA': 100 },
    { CURSO: 'TÉCNICO EM AGROPECUÁRIA', FORMA: 'FORMA INTEGRADA', 'CARGA HORÁRIA': 50 },
    { CURSO: 'TÉCNICO EM AGROPECUÁRIA', FORMA: 'FORMA SUBSEQUENTE', 'CARGA HORÁRIA': 30 }
  ];

  const totals = aggregateCourseClockHours_(records, null);
  const integratedKey = makeCourseFormKey_(
    'TÉCNICO EM AGROPECUÁRIA',
    'FORMA INTEGRADA'
  );
  const subsequentKey = makeCourseFormKey_(
    'TÉCNICO EM AGROPECUÁRIA',
    'FORMA SUBSEQUENTE'
  );

  Assert.approximatelyEquals(150, totals[integratedKey], 0.000001,
    'Forma integrada deve possuir total próprio.');
  Assert.approximatelyEquals(30, totals[subsequentKey], 0.000001,
    'Forma subsequente deve possuir total próprio.');
  Assert.equals(2, Object.keys(totals).length,
    'Mesmo nome com formas diferentes deve gerar dois agrupamentos.');
}

/**
 * Confirma, na base real, que a soma dos cursos corresponde ao total do dashboard.
 */
function test_Dao_realCourseTotalsMatchDashboardTotal() {
  Logger.log('--- Rodando: test_Dao_realCourseTotalsMatchDashboardTotal ---');
  const preparedData = DashboardRules.prepareRecords(
    Dao.extractDataFromSheets()
  );

  [null, 'FATOR_SEMESTRE_1', 'FATOR_SEMESTRE_2'].forEach(function(factorKey) {
    const dashboardTotal = sumFieldWithFactor_(
      preparedData,
      ['CARGA HORÁRIA', 'CARGA HORARIA', 'CH'],
      factorKey
    );
    const courseTotals = aggregateCourseClockHours_(preparedData, factorKey);
    const totalByCourses = Object.keys(courseTotals).reduce(function(total, course) {
      return total + courseTotals[course];
    }, 0);

    Assert.approximatelyEquals(
      dashboardTotal,
      totalByCourses,
      0.000001,
      'Soma dos cursos deve corresponder ao total do recorte '
        + (factorKey || 'anual') + '.'
    );
  });
}


/**
 * Confirma, na base real, a separação das formas do Técnico em Agropecuária.
 */
function test_Dao_realCourseFormsRemainSeparated() {
  Logger.log('--- Rodando: test_Dao_realCourseFormsRemainSeparated ---');
  const preparedData = DashboardRules.prepareRecords(
    Dao.extractDataFromSheets()
  );
  const totals = aggregateCourseClockHours_(preparedData, null);
  const integratedKey = makeCourseFormKey_(
    'TÉCNICO EM AGROPECUÁRIA',
    'FORMA INTEGRADA'
  );
  const subsequentKey = makeCourseFormKey_(
    'TÉCNICO EM AGROPECUÁRIA',
    'FORMA SUBSEQUENTE'
  );

  const hasIntegratedSource = preparedData.some(function(record) {
    return makeCourseFormKey_(record.CURSO, record.FORMA) === integratedKey;
  });
  const hasSubsequentSource = preparedData.some(function(record) {
    return makeCourseFormKey_(record.CURSO, record.FORMA) === subsequentKey;
  });
  if (!hasIntegratedSource || !hasSubsequentSource) {
    Logger.log('ℹ️ SKIP: a base atual não contém simultaneamente Técnico em Agropecuária nas formas integrada e subsequente. A separação permanece coberta pelo teste com dados controlados.');
    return;
  }

  Assert.equals(true, Object.prototype.hasOwnProperty.call(totals, integratedKey),
    'Base real deve manter Técnico em Agropecuária integrado separado.');
  Assert.equals(true, Object.prototype.hasOwnProperty.call(totals, subsequentKey),
    'Base real deve manter Técnico em Agropecuária subsequente separado.');
  Assert.equals(true, totals[integratedKey] > 0,
    'Forma integrada deve possuir carga positiva na base real.');
  Assert.equals(true, totals[subsequentKey] > 0,
    'Forma subsequente deve possuir carga positiva na base real.');
}

/**
 * Teste de integração do endpoint principal.
 */
function test_Controller_getDashboardData() {
  Logger.log('--- Rodando: test_Controller_getDashboardData ---');
  const response = getDashboardData();

  Assert.equals('string', typeof response,
    'O Controller deve retornar uma String JSON.');

  const parsed = JSON.parse(response);

  Assert.hasProperty(parsed, 'status',
    'Resposta JSON deve conter status.');
  Assert.hasProperty(parsed, 'data',
    'Resposta JSON deve conter data.');
  Assert.hasProperty(parsed, 'meta',
    'Resposta JSON deve conter metadados da implantação.');
  Assert.hasProperty(parsed, 'professorIndicators',
    'Resposta deve conter indicadores de alunos por professor.');
  Assert.hasProperty(parsed, 'diagnostics',
    'Resposta deve conter diagnóstico dos cruzamentos.');
  Assert.equals('success', parsed.status,
    'Status deve ser success na leitura padrão.');
  Assert.equals('10.0.9', parsed.meta.version,
    'Endpoint deve identificar a versão 10.0.9.');
  Assert.equals(parsed.data.length, parsed.meta.recordCount,
    'Metadado recordCount deve refletir a quantidade de registros.');

  if (parsed.data.length === 0) return;

  Assert.hasProperty(parsed.data[0], 'SEMESTRE_OFERTA',
    'Controller deve fornecer o semestre canônico.');
  Assert.hasProperty(parsed.data[0], 'FATOR_SEMESTRE_1',
    'Controller deve fornecer o fator do 1º semestre.');
  Assert.hasProperty(parsed.data[0], 'FATOR_SEMESTRE_2',
    'Controller deve fornecer o fator do 2º semestre.');
  Assert.hasProperty(parsed.data[0], 'ALUNOS_GRUPO',
    'Controller deve enriquecer a oferta com a quantidade de alunos do grupo.');
  Assert.hasProperty(parsed.data[0], 'VINCULO_DOCENTE',
    'Controller deve enriquecer a oferta com o vínculo docente.');
}

/**
 * Confirma o contrato de carregamento progressivo por ano.
 */
function test_Controller_progressiveLoadEndpoints() {
  Logger.log('--- Rodando: test_Controller_progressiveLoadEndpoints ---');
  const plan = JSON.parse(getDashboardLoadPlan());
  Assert.equals('success', plan.status,
    'Plano de carregamento deve ser retornado com sucesso.');
  Assert.equals(true, Array.isArray(plan.plan.years),
    'Plano deve listar os anos disponíveis.');
  Assert.equals('10.0.9', plan.meta.version,
    'Plano progressivo deve identificar a versão 10.0.9.');
  Assert.hasProperty(plan.plan, 'referenceData',
    'Plano progressivo deve fornecer o catálogo leve de áreas.');
  Assert.equals(true, Array.isArray(plan.plan.referenceData.areas),
    'Catálogo de áreas deve ser serializado como lista, mesmo quando vazio.');
  Assert.hasProperty(plan.plan.referenceData, 'teachingLoad',
    'Plano progressivo deve fornecer os parâmetros iniciais da Portaria.');
  Assert.equals(20, plan.plan.referenceData.teachingLoad.calendar.weeksSemester1,
    'Plano deve fornecer 20 semanas para o primeiro semestre.');
  Assert.equals(20, plan.plan.referenceData.teachingLoad.calendar.weeksSemester2,
    'Plano deve fornecer 20 semanas para o segundo semestre.');
  Assert.equals(10, plan.plan.referenceData.teachingLoad.weeklyRanges.integral.minimum,
    'Plano deve fornecer mínimo inicial integral de 10 horas.');
  Assert.equals(12, plan.plan.referenceData.teachingLoad.weeklyRanges.partial.maximum,
    'Plano deve fornecer máximo inicial parcial de 12 horas.');

  if (plan.plan.years.length > 0) {
    const year = plan.plan.years[0].year;
    const response = JSON.parse(getDashboardYearData(year));
    Assert.equals('success', response.status,
      'Endpoint anual deve processar um ano por chamada.');
    Assert.equals(year, response.year,
      'Endpoint anual deve preservar o ano solicitado.');
    Assert.equals(true, Array.isArray(response.data),
      'Endpoint anual deve devolver registros preparados.');
  }
}

/**
 * Valida o health check leve da implantação.
 */
function test_Controller_getAppHealth() {
  Logger.log('--- Rodando: test_Controller_getAppHealth ---');
  const response = JSON.parse(getAppHealth());

  Assert.equals('healthy', response.status,
    'Health check deve encontrar a planilha ativa.');
  Assert.equals('10.0.9', response.version,
    'Health check deve identificar a versão 10.0.9.');
  Assert.equals(true, Number(response.sheetCount) > 0,
    'Health check deve informar pelo menos uma aba.');
  Assert.hasProperty(response, 'knowledgeAreas',
    'Health check deve informar a estrutura de Áreas de Conhecimento.');
  Assert.equals(true, response.knowledgeAreas.sheetAvailable,
    'A aba AREAS_CONHECIMENTO deve estar disponível após o instalador.');
  Assert.equals(true, response.knowledgeAreas.headersValid,
    'Cabeçalhos de AREAS_CONHECIMENTO devem corresponder ao contrato.');
  Assert.hasProperty(response, 'teacherAreas',
    'Health check deve informar as estruturas docente-área.');
  Assert.equals(true, response.teacherAreas.associationSheetAvailable,
    'DOCENTES_AREAS deve estar disponível após o instalador 9.8.');
  Assert.equals(true, response.teacherAreas.controlSheetAvailable,
    'DOCENTES_CONTROLE deve estar disponível após o instalador 9.8.');
}

/**
 * Confirma que o frontend trata as colunas de carga como hora-relógio.
 */
function test_Frontend_clockHourIsPrimaryUnit() {
  Logger.log('--- Rodando: test_Frontend_clockHourIsPrimaryUnit ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'professor.chRelogio += Utils.getVal',
    'Carga total da base deve ser somada diretamente como hora-relógio.');
  Assert.contains(html, 'professor.chTeoricaRelogio += Utils.getVal',
    'Carga teórica deve ser somada diretamente como hora-relógio.');
  Assert.contains(html, 'professor.chPraticaRelogio += Utils.getVal',
    'Carga prática deve ser somada diretamente como hora-relógio.');
  Assert.contains(html, 'professor.chExtensaoRelogio += Utils.getVal',
    'Carga de extensão deve ser somada diretamente como hora-relógio.');
  Assert.contains(html, 'Utils.toClassHours',
    'Hora-aula deve ser derivada da hora-relógio.');
  Assert.notContains(html, 'Utils.toClockHours',
    'Frontend não deve converter a base de hora-aula para hora-relógio.');
  Assert.notContains(html, 'DURAÇÃO DE CADA AULA EM MINUTOS',
    'Coluna T não deve participar dos cálculos do dashboard.');
}

/**
 * Confirma que os gráficos exibem hora-relógio e hora-aula.
 */
function test_Frontend_chartsExposeBothUnits() {
  Logger.log('--- Rodando: test_Frontend_chartsExposeBothUnits ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, "label: 'Hora-relógio'",
    'Gráficos devem representar visualmente a unidade principal.');
  Assert.notContains(html, "label: 'Hora-aula equivalente'",
    'Hora-aula não deve ser desenhada como série ou anel comparável.');
  Assert.contains(html,
    '`Hora-aula equivalente: ${Utils.formatNum(classValues[index], 1)} h/a`',
    'Tooltips devem informar a hora-aula equivalente.');
  Assert.contains(html,
    'Teórica, prática e curricular de extensão em hora-relógio.',
    'Gráfico de composição deve explicar a representação em hora-relógio.');
  Assert.notContains(html, "xAxisID: 'xClass'",
    'Gráfico por curso não deve manter eixo comparativo de hora-aula.');
}

/**
 * Confirma que o gráfico por curso recebeu espaço próprio e altura adaptativa.
 */
function test_Frontend_courseChartLayoutContract() {
  Logger.log('--- Rodando: test_Frontend_courseChartLayoutContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, '<article class="chart-card course-chart-card">',
    'Gráfico por curso deve ocupar um card próprio abaixo das visualizações principais.');
  Assert.contains(html, 'id="courseChartContainer"',
    'Gráfico por curso deve possuir contêiner próprio.');
  Assert.contains(html, 'const dynamicHeight = Math.min(Math.max(source.length * 34 + 130, 420), 960);',
    'Altura do gráfico deve acompanhar a quantidade de cursos e formas.');
  Assert.contains(html, 'autoSkip: false',
    'Rótulos dos cursos não devem ser omitidos automaticamente.');
}

/**
 * Garante que o recorte de vários anos use dias e semanas de todos os anos ativos.
 */
function test_Frontend_multipleYearScopeContract() {
  Logger.log('--- Rodando: test_Frontend_multipleYearScopeContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'const activeYearCount = Math.max(sortedYears.length, 1);',
    'Cada professor deve contabilizar a própria quantidade de anos ativos.');
  Assert.contains(html, 'const calendar = this._resolveScopeCalendar(activeYearCount);',
    'Calendário do recorte deve considerar a quantidade de anos ativos.');
  Assert.contains(html, 'const activeWeeks = Number(calendar.weeks || 0);',
    'Média semanal deve usar semanas efetivamente consideradas.');
  Assert.contains(html, '? professor.chRelogio / activeWeeks',
    'Carga semanal deve resultar da carga em hora-relógio dividida pelas semanas.');
  Assert.contains(html, 'const totalProfessorYears = professors.reduce(',
    'Média geral deve usar professor/ano como denominador quando vários anos forem exibidos.');
  Assert.notContains(html, 'overloadThreshold',
    'Versão 9.8 não deve usar limite anual de sobrecarga.');
}

/**
 * Confirma a regra de agregação da carga ocupada por curso.
 */
function test_Frontend_courseAggregationContract() {
  Logger.log('--- Rodando: test_Frontend_courseAggregationContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'Carga de aulas por curso e forma',
    'Interface deve identificar as duas dimensões do agrupamento.');
  Assert.contains(html, '_aggregateCourses(entries)',
    'Modelo deve possuir agregação específica por curso e forma.');
  Assert.contains(html, "const courseName = Utils.getStr(row, ['CURSO'])",
    'Agregação deve ler o nome do curso.');
  Assert.contains(html, "const courseForm = Utils.getStr(row, ['FORMA'])",
    'Agregação deve ler a forma do curso.');
  Assert.contains(html, 'const courseKey = JSON.stringify([courseName, courseForm]);',
    'Nome e forma devem compor a chave de agrupamento.');
  Assert.contains(html, "rotulo: Utils.joinNonEmpty([courseName, courseForm], ' — ')",
    'Rótulo deve apresentar nome e forma sem ocultar a distinção.');
  Assert.contains(html, 'course.chRelogio += Utils.getVal',
    'Cada linha da base deve ser somada ao respectivo curso e forma.');
  Assert.contains(html, 'canvas id="courseChart"',
    'Interface deve possuir o canvas do gráfico por curso e forma.');
}

/**
 * Confirma o congelamento do cabeçalho da tabela analítica.
 */
function test_Frontend_stickyAnalyticalHeader() {
  Logger.log('--- Rodando: test_Frontend_stickyAnalyticalHeader ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'class="table-container analytics-table-container"',
    'Tabela analítica deve possuir contêiner próprio de rolagem.');
  Assert.contains(html, '.analytics-table-container thead th { position: sticky;',
    'Cabeçalho analítico deve permanecer fixo durante a rolagem.');
  Assert.contains(html, '.analytics-table-container { max-height:',
    'Tabela deve limitar a altura para ativar a rolagem vertical.');
}

/**
 * Confirma o ranking gráfico dos dez docentes com maior média semanal.
 */
function test_Frontend_compactProfessorRanking() {
  Logger.log('--- Rodando: test_Frontend_compactProfessorRanking ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'Docentes por média semanal',
    'Ranking gráfico deve possuir título coerente com a análise normativa.');
  Assert.contains(html, 'id="weeklyWorkloadChart"',
    'Interface deve conter o gráfico de médias semanais.');
  Assert.contains(html, '.slice(0, 10);',
    'Ranking deve limitar a visualização aos dez maiores resultados.');
  Assert.notContains(html, 'id="barChart"',
    'Antigo gráfico Top 10 deve permanecer removido.');
}

/**
 * Confirma renderização segura e o novo agrupamento acadêmico no modal.
 */
function test_Frontend_safeRenderingAndCourseClassDetail() {
  Logger.log('--- Rodando: test_Frontend_safeRenderingAndCourseClassDetail ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.notContains(html, '.innerHTML =',
    'Dados da planilha não devem ser inseridos por innerHTML.');
  Assert.contains(html, 'textContent =',
    'Valores dinâmicos devem usar textContent.');
  Assert.contains(html, 'const academicGroup = Utils.joinNonEmpty([',
    'Modal deve apresentar Forma, Curso, PPC e Período.');
  Assert.notContains(html, 'const classGroup = Utils.getStr(record, [\'TURMA\'])',
    'Campo TURMA não deve participar do agrupamento analítico.');
}

/**
 * Confirma a existência de uma única área dinâmica para todas as operações.
 */
function test_Frontend_dataManagementSingleWorkspace() {
  Logger.log('--- Rodando: test_Frontend_dataManagementSingleWorkspace ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'id="btnManageData"',
    'Dashboard deve exigir acionamento intencional para abrir a gestão.');
  Assert.contains(html, 'id="dataManagementModal"',
    'Operações devem permanecer em uma única interface modal dinâmica.');
  Assert.contains(html, 'data-management-action="annual"',
    'Interface deve oferecer gestão dos conjuntos anuais.');
  Assert.contains(html, 'data-management-action="teachers"',
    'Interface deve oferecer mesclagem do cadastro DOCENTES.');
  Assert.contains(html, 'data-management-action="delete"',
    'Interface deve oferecer exclusão separada.');
  Assert.contains(html, 'data-management-action="restore"',
    'Interface deve oferecer restauração de backup.');
}

/**
 * Confirma leitura exclusiva da primeira aba do .xlsx.
 */
function test_Frontend_xlsxFirstSheetContract() {
  Logger.log('--- Rodando: test_Frontend_xlsxFirstSheetContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'xlsx-0.20.3/package/dist/xlsx.full.min.js',
    'Frontend deve possuir leitor local de arquivos .xlsx.');
  Assert.contains(html, "const firstSheetName = workbook.SheetNames[0];",
    'Somente a primeira aba do relatório deve ser analisada.');
  Assert.notContains(html, 'workbook.SheetNames.forEach',
    'Abas secundárias não devem ser percorridas.');
  Assert.contains(html, "if (!/\\.xlsx$/i.test(file.name))",
    'Somente arquivos .xlsx devem ser aceitos.');
  Assert.contains(html, "normalized[contract.headers.indexOf('ANO')]",
    'Frontend deve identificar o ano pela coluna mapeada, sem depender da posição física.');
  Assert.contains(html, 'const mappedSourceIndexes = new Set(Object.values(mapping));',
    'Frontend deve aceitar e contabilizar colunas adicionais não mapeadas.');
  Assert.contains(html, 'headerSearchRows',
    'Frontend deve localizar o cabeçalho variável do relatório ALUNOXCAMPUS.');
}

/**
 * Confirma progresso real por bytes, registros e lotes do backend.
 */
function test_Frontend_realProgressAndBatchContract() {
  Logger.log('--- Rodando: test_Frontend_realProgressAndBatchContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'reader.onprogress = event =>',
    'Leitura local deve informar progresso real por bytes.');
  Assert.contains(html, 'Lendo registro ${processed} de ${dataRows.length}.',
    'Análise deve informar registro atual e total.');
  Assert.contains(html, "'appendDataImportBatch'",
    'Registros dos três relatórios devem ser enviados ao servidor em lotes.');
  Assert.contains(html, "'verifyDataImportBatch'",
    'Servidor deve revalidar os lotes antes do commit.');
  Assert.contains(html, "'getDataOperationProgress'",
    'Etapas destrutivas devem ser acompanhadas por polling de estado.');
  Assert.contains(html, 'role="progressbar"',
    'Barra de progresso deve expor semântica acessível.');
  Assert.contains(html, "const indeterminateStages = [",
    'Etapas sem contagem mensurável devem usar progresso indeterminado.');
  Assert.contains(html, "this.els.progressTrack.removeAttribute('aria-valuenow');",
    'Progresso indeterminado não deve publicar percentual fictício.');
}

/**
 * Garante feedback acessível e não intrusivo durante operações longas.
 */
function test_Frontend_nonIntrusiveManagementFeedback() {
  Logger.log('--- Rodando: test_Frontend_nonIntrusiveManagementFeedback ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'id="managementLiveRegion"',
    'Progresso deve ser anunciado por região aria-live.');
  Assert.contains(html, 'aria-live="polite"',
    'Atualizações não críticas devem ser anunciadas de modo não intrusivo.');
  Assert.notContains(html, 'alert(',
    'Interface não deve usar alertas bloqueantes.');
  Assert.contains(html, 'cancelDataOperation',
    'Operações ainda seguras devem oferecer cancelamento explícito.');
}

/**
 * Confirma os indicadores de alunos e a distinção discreta de vínculo.
 */
function test_Frontend_studentIndicatorsAndEmploymentBadge() {
  Logger.log('--- Rodando: test_Frontend_studentIndicatorsAndEmploymentBadge ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'Alunos atendidos (aprox.)',
    'Tabela deve apresentar alunos aproximados por docente.');
  Assert.contains(html, 'Média alunos/oferta',
    'Tabela deve apresentar a média de alunos por oferta docente.');
  Assert.contains(html, 'averageStudentsPerOffering',
    'Frontend deve consumir a métrica calculada pelo backend.');
  Assert.contains(html, 'employment-badge',
    'Vínculo efetivo ou substituto deve usar um selo visual sutil.');
  Assert.contains(html, "employmentType === 'SUBSTITUTO'",
    'Frontend deve distinguir docentes substitutos sem alterar os cálculos.');
  Assert.contains(html, 'ALUNOS_GRUPO',
    'Detalhamento deve mostrar a quantidade de alunos do grupo associado.');
  Assert.contains(html, 'methodology-hint',
    'Valores aproximados devem possuir explicação acessível por mouse e teclado.');
  Assert.contains(html, 'somente os alunos matriculados ou com vínculo ativo no PERÍODO acadêmico selecionado',
    'O ponto de interrogação deve explicar claramente a quantidade-base da estimativa.');
  Assert.contains(html, 'Turmas especiais e dependências',
    'A explicação sutil deve identificar as turmas que ficam fora do cálculo de alunos.');
  Assert.contains(html, 'Provável formando',
    'Explicação deve identificar os movimentos elegíveis para a contagem.');
  Assert.contains(html, 'Maior período disponível:',
    'Detalhamento do docente deve identificar associações feitas por fallback de período.');
  Assert.contains(html, 'Indicadores de alunos indisponíveis',
    'Ausência ou baixa cobertura da base de alunos deve gerar diagnóstico claro.');
}

/**
 * Confirma contraste e posicionamento seguro da explicação de alunos.
 */
function test_Frontend_studentMethodologyTooltipContract() {
  Logger.log('--- Rodando: test_Frontend_studentMethodologyTooltipContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'id="studentMethodologyTooltip"',
    'A explicação deve usar uma camada global para não ser recortada por tabelas ou modais.');
  Assert.contains(html, 'class="methodology-tooltip" role="tooltip"',
    'A camada explicativa deve preservar semântica acessível.');
  Assert.contains(html, '.methodology-tooltip { position:fixed;',
    'A explicação deve ser posicionada em relação à janela visível.');
  Assert.contains(html, '--color-tooltip-bg: #f8fafc;',
    'O tema escuro deve fornecer fundo explícito e legível para a explicação.');
  Assert.contains(html, '--color-tooltip-text: #0f172a;',
    'O tema escuro deve fornecer texto de alto contraste para a explicação.');
  Assert.contains(html, 'window.visualViewport',
    'O posicionamento deve considerar a janela visual, inclusive com zoom.');
  Assert.contains(html, "button.closest('.modal-container')",
    'Quando aberto em modal, o balão deve respeitar os limites desse modal.');
  Assert.contains(html, 'Math.max(minLeft, Math.min(maxLeft, preferredLeft))',
    'O posicionamento horizontal deve permanecer dentro dos limites calculados.');
  Assert.contains(html, 'Math.max(minTop, Math.min(maxTop, preferredTop))',
    'O posicionamento vertical deve permanecer dentro dos limites calculados.');
  Assert.notContains(html, '.methodology-hint::after',
    'A explicação não deve usar pseudo-elemento sujeito a recorte pelo modal.');
}

/** Valida a seleção administrativa e os filtros do relatório geral. */
function test_Frontend_generalTeacherReportContract() {
  Logger.log('--- Rodando: test_Frontend_generalTeacherReportContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  [
    'generalTeacherReportModal', 'generalReportFormFilter',
    'generalReportCourseFilter', 'generalReportPpcFilter',
    'generalReportPeriodFilter', 'generalReportAreaFilter',
    'generalReportSort', 'generalReportTeacherSearch',
    'generalReportSelectAllBtn', 'generalTeacherReportGenerateBtn'
  ].forEach(function(id) {
    Assert.contains(html, 'id="' + id + '"',
      'Relatório geral deve expor o controle ' + id + '.');
  });
  Assert.contains(html, "context.permissions.generateGeneralReport",
    'Botão do relatório geral deve depender da permissão administrativa.');
  Assert.contains(html, "ServerApi.call('generateGeneralTeacherPdfReport'",
    'Interface deve solicitar ao servidor o PDF geral validado.');
  Assert.contains(html, "'WORKLOAD_DESC'",
    'Interface deve permitir ordenar por carga horária decrescente.');
  Assert.contains(html, 'selectedTeachers.size',
    'Interface deve manter seleção explícita de um ou mais professores.');
}

/**
 * Confirma carregamento inicial por etapas e contagens reais.
 */
function test_Frontend_initialLoadingProgressContract() {
  Logger.log('--- Rodando: test_Frontend_initialLoadingProgressContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  Assert.contains(html, 'id="initialLoadingStage"',
    'Tela inicial deve informar a etapa atual.');
  Assert.contains(html, "ServerApi.call('getDashboardLoadPlan')",
    'Carregamento deve iniciar por um plano leve.');
  Assert.contains(html, "ServerApi.call('getDashboardYearData', yearPlan.year)",
    'Cada ano deve ser carregado em etapa própria.');
  Assert.contains(html, 'Preparando registro ${Utils.formatNum(processedRows)} de',
    'Consolidação deve informar registro atual e total real.');
  Assert.contains(html, "track.removeAttribute('aria-valuenow');",
    'Etapas não mensuráveis não devem publicar percentual fictício.');
  Assert.notContains(html, "ServerApi.call('getDashboardData')",
    'Inicialização não deve depender de uma única chamada monolítica.');
}

/**
 * Confirma validação acessível do ano-base e limpeza dos uploads.
 */
function test_Frontend_annualYearValidationAndResetContract() {
  Logger.log('--- Rodando: test_Frontend_annualYearValidationAndResetContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  Assert.contains(html, 'id="annualYearError"',
    'Ano-base deve possuir mensagem inline de validação.');
  Assert.contains(html, "this.els.annualYear.setAttribute('aria-invalid', 'true');",
    'Campo inválido deve publicar estado acessível.');
  Assert.contains(html, 'this.els.annualYear.focus()',
    'Foco deve retornar ao ano-base quando estiver vazio ou inválido.');
  Assert.contains(html, 'clearUploadFields()',
    'Fluxo deve possuir rotina central de limpeza dos uploads.');
  Assert.contains(html, "input.value = '';",
    'Campos de arquivo devem ser efetivamente reiniciados.');
  Assert.contains(html, 'this.resetManagementInputs();',
    'Voltar, sair ou concluir deve restaurar o estado inicial da gestão.');
  Assert.contains(html, 'id="annualYearInput" class="input-control" min="2000" max="2999" step="1" placeholder="2027" required',
    'Ano-base deve ser obrigatório também no contrato nativo do formulário.');
  const analyzeStart = html.indexOf('async analyzeAnnualReports()');
  const emptyYearGuard = html.indexOf('if (!rawYear)', analyzeStart);
  const preparingProgress = html.indexOf("this.renderLocalProgress('Preparando análise'", analyzeStart);
  Assert.equals(true, analyzeStart >= 0 && emptyYearGuard > analyzeStart
    && emptyYearGuard < preparingProgress,
  'Ano vazio deve ser bloqueado antes de iniciar ou anunciar a análise.');
  Assert.contains(html, 'invalidateLocalAnalysis()',
    'Fechar ou reiniciar a gestão deve invalidar leituras locais antigas.');
  Assert.contains(html, 'this.analysisRunId += 1;',
    'Cada cancelamento deve invalidar resultados assíncronos da tentativa anterior.');
  Assert.contains(html, 'this.localCancellationRequested = false;',
    'Estado de cancelamento deve ser limpo antes de uma nova tentativa.');
  Assert.contains(html, 'this.setControlsDisabled(false);',
    'Cancelamento e restauração devem reabilitar os controles da gestão.');
  Assert.contains(html, 'if (runId !== this.analysisRunId) return;',
    'Resultado de uma janela fechada não pode reaparecer em uma nova abertura.');
  Assert.notContains(html, 'window.location.reload()',
    'Reset não pode recarregar somente o frame interno do Apps Script.');
  Assert.contains(html, "new CustomEvent('database-reset-completed'",
    'Dashboard deve atualizar os dados e avisar a Ema sem recarregar a página.');
}

/**
 * Confirma acesso interativo ao diagnóstico das ofertas não associadas.
 */
function test_Frontend_coverageDiagnosticsContract() {
  Logger.log('--- Rodando: test_Frontend_coverageDiagnosticsContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  Assert.contains(html, 'id="coverageDiagnosticModal"',
    'Diagnóstico deve possuir modal próprio.');
  Assert.contains(html, 'id="studentCoverageCard" data-workload-metric="coverage"',
    'Card de cobertura deve usar botão nativo acionável por mouse e teclado.');
  Assert.contains(html, 'data-quality-link',
    'Aviso anual deve oferecer acesso às linhas não associadas.');
  Assert.contains(html, 'MOTIVO_ASSOCIACAO_ALUNOS',
    'Diagnóstico deve exibir o motivo calculado pelo backend.');
  Assert.contains(html, 'VALORES_NORMALIZADOS_ASSOCIACAO',
    'Diagnóstico deve exibir os valores normalizados usados no cruzamento.');
  Assert.contains(html, 'LINHA_ORIGEM',
    'Diagnóstico deve identificar a linha original do relatório.');
  Assert.contains(html, 'PERIODO_UTILIZADO_ASSOCIACAO',
    'Diagnóstico deve informar o período usado no fallback.');
  Assert.contains(html, "mode: 'fallback'",
    'Aviso anual deve permitir analisar associações pelo maior período.');
}

/**
 * Confirma largura ampliada e rolagem horizontal do modal do professor.
 */
function test_Frontend_professorModalResponsiveWidth() {
  Logger.log('--- Rodando: test_Frontend_professorModalResponsiveWidth ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  Assert.contains(html, 'professor-modal-container',
    'Modal do professor deve possuir contêiner ampliado específico.');
  Assert.contains(html, 'max-width: 1320px',
    'Modal do professor deve ser mais largo em telas grandes.');
  Assert.contains(html, 'professor-modal-table-container { overflow-x: auto;',
    'Tabela do modal deve ativar rolagem horizontal em telas menores.');
  Assert.contains(html, 'min-width: 1180px',
    'Colunas devem preservar legibilidade dentro da rolagem horizontal.');
}

/**
 * Confirma a análise gráfica de alunos por oferta docente.
 */
function test_Frontend_studentRankingContract() {
  Logger.log('--- Rodando: test_Frontend_studentRankingContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'Média de alunos por oferta docente',
    'Dashboard deve apresentar o indicador de alunos por oferta.');
  Assert.contains(html, "metric === 'studentAverage'",
    'Clique no card deve abrir análise específica de alunos por oferta.');
  Assert.contains(html, 'studentMetrics.averageStudentsPerOffering',
    'Gráfico detalhado deve usar a média de alunos por oferta associada.');
  Assert.contains(html, 'studentMetrics.matchedOfferings',
    'Detalhamento deve informar a quantidade de ofertas associadas.');
}

/**
 * Confirma a faixa principal com exatamente cinco cards clicáveis.
 */
function test_Frontend_fiveKpiContract() {
  Logger.log('--- Rodando: test_Frontend_fiveKpiContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  const sectionMarker = 'id="workloadDashboardSection"';
  const markerIndex = html.indexOf(sectionMarker);
  const sectionStart = markerIndex >= 0
    ? html.lastIndexOf('<section', markerIndex)
    : -1;
  const sectionEnd = markerIndex >= 0
    ? html.indexOf('</section>', markerIndex)
    : -1;

  Assert.equals(true, markerIndex >= 0,
    'Seção principal de carga horária deve ser identificada pelo ID estável.');
  Assert.equals(true, sectionStart >= 0 && sectionEnd > sectionStart,
    'Limites da seção principal devem ser localizados antes da contagem dos cards.');

  const kpiSection = html.substring(sectionStart, sectionEnd + '</section>'.length);
  const cardCount = (kpiSection.match(/data-workload-metric=/g) || []).length;

  Assert.equals(5, cardCount,
    'Faixa principal deve possuir exatamente cinco cards clicáveis.');
  Assert.contains(html, 'grid-template-columns: repeat(5, minmax(0, 1fr));',
    'Desktop deve exibir os cinco cards em uma única linha.');
  Assert.contains(kpiSection, 'Docentes com carga registrada',
    'Primeiro card deve apresentar os docentes do recorte.');
  Assert.notContains(html, 'id="kpiOverloaded"',
    'Card isolado de sobrecarga não deve permanecer na interface.');
  Assert.contains(kpiSection, 'Média de alunos por oferta docente',
    'Card de média deve identificar explicitamente a oferta docente.');
  Assert.contains(kpiSection, 'Ofertas docentes associadas aos alunos',
    'Card de cobertura deve indicar claramente seu denominador.');
  Assert.contains(html, 'de ${Utils.formatNum(totalOfferings)} ofertas associadas',
    'Card de cobertura deve apresentar numerador e denominador.');
}

/**
 * Confirma o contrato da nova tela de Áreas de Conhecimento.
 */
function test_Frontend_knowledgeAreasCrudContract() {
  Logger.log('--- Rodando: test_Frontend_knowledgeAreasCrudContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'id="knowledgeAreasContent"',
    'Cadastro deve possuir uma tela própria.');
  Assert.contains(html, 'id="btnKnowledgeAreas"',
    'Cabeçalho deve oferecer acesso ao cadastro.');
  Assert.contains(html, 'id="knowledgeAreaFormModal"',
    'Criação e edição devem usar formulário acessível não intrusivo.');
  Assert.contains(html, 'id="knowledgeAreaConfirmModal"',
    'Ativação e inativação devem possuir confirmação própria.');
  Assert.contains(html, "ServerApi.call('getKnowledgeAreas')",
    'Tela deve carregar os registros pelo endpoint dedicado.');
  Assert.contains(html, 'response.health && response.health.ok === false',
    'Tela deve bloquear o cadastro quando o health check encontrar inconsistências.');
  Assert.contains(html, "ServerApi.call('saveKnowledgeArea', payload)",
    'Tela deve criar e editar registros pelo endpoint dedicado.');
  Assert.contains(html, "'setKnowledgeAreaActive'",
    'Tela deve ativar e inativar sem exclusão física.');
  Assert.contains(html, 'this.els.type.disabled = true;',
    'Tipo hierárquico deve ficar bloqueado durante a edição.');
  Assert.contains(html, 'id="knowledgeAreasLiveRegion"',
    'Operações devem ser anunciadas por região aria-live.');
  Assert.notContains(html, 'alert(',
    'Nova tela não deve usar comunicação intrusiva.');
}

/**
 * Confirma a gestão de associações e situação sem CRUD dos dados oficiais.
 */
function test_Frontend_teacherAreaManagementContract() {
  Logger.log('--- Rodando: test_Frontend_teacherAreaManagementContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  Assert.contains(html, 'id="teacherAreaModal"',
    'Interface deve possuir modal dedicado às associações docente-área.');
  Assert.contains(html, "'getTeacherAreaManagementData'",
    'Modal deve carregar docentes e associações pelo endpoint dedicado.');
  Assert.contains(html, "ServerApi.call('addTeacherAreaAssignments'",
    'Associação múltipla deve usar endpoint transacional.');
  Assert.contains(html, "'endTeacherAreaAssignment'",
    'Encerramento deve preservar o histórico de vigência.');
  Assert.contains(html, "'reactivateTeacherAreaAssignment'",
    'Associação encerrada deve poder ser reativada.');
  Assert.contains(html, "'setTeacherActive'",
    'Situação administrativa do docente deve ser alterada separadamente do relatório.');
  Assert.contains(html, "new TeacherAreaManagementController()",
    'Controlador de associações deve ser inicializado.');
  Assert.notContains(html, 'alert(',
    'Gestão docente-área não deve usar comunicação intrusiva.');
}

/** Valida os contratos visuais do ciclo de vida histórico da versão 10.0.7. */
function test_Frontend_v1007AreaLifecycleContract() {
  Logger.log('--- Rodando: test_Frontend_v1007AreaLifecycleContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  const teacherPdfSource = TeacherPdfReportService._buildModel.toString();
  const generalPdfSource = GeneralTeacherPdfReportService._buildAreaGroups.toString();
  Assert.contains(html, 'id="knowledgeAreaCascadeImpact"',
    'Confirmação deve exibir o impacto da cascata.');
  Assert.contains(html, "'getKnowledgeAreaInactivationImpact'",
    'Frontend deve consultar o impacto real antes da inativação.');
  Assert.contains(html, 'referencePeriod: pending.referencePeriod',
    'Inativação deve enviar o último período válido ao backend.');
  Assert.contains(html, 'teacher.active === false',
    'Docente inativo deve permanecer visível e indisponível para seleção.');
  Assert.contains(html, 'Reativar docente',
    'Modal deve oferecer a reativação do docente sem sair do contexto da área.');
  Assert.contains(html, 'histórica (inativa atualmente)',
    'Dashboard deve identificar áreas históricas de forma explícita.');
  Assert.contains(teacherPdfSource, 'histórica (inativa atualmente)',
    'PDF individual deve usar a mesma identificação histórica.');
  Assert.contains(generalPdfSource, 'histórica (inativa atualmente)',
    'PDF geral deve usar a mesma identificação histórica.');
  Assert.contains(html, 'row.areaActive !== false || row.teacherCount > 0',
    'Gráficos devem manter áreas inativas quando elas possuem dados no recorte histórico.');
}

/** Valida a visão consolidada e a vigência opcional introduzidas na 10.0.8. */
function test_Frontend_v1008KnowledgeAreaContract() {
  Logger.log('--- Rodando: test_Frontend_v1008KnowledgeAreaContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  const managementSource = TeacherAreasService.listManagementData.toString();
  const countSource = TeacherAreasService.buildAreaTeacherCounts.toString();
  Assert.contains(html, 'id="teacherAreaEndSemester"',
    'Formulário deve oferecer semestre final opcional.');
  Assert.contains(html, '<option value="">Não informado</option>',
    'Semestre final da nova associação deve aceitar valor vazio.');
  Assert.contains(html, 'Não informado — fim do ano',
    'Inativação em cascata deve explicar o corte anual quando o semestre ficar vazio.');
  Assert.contains(html, 'endSemester: this.els.endSemester.value',
    'Frontend deve enviar o semestre final opcional ao backend.');
  Assert.contains(html, 'const groupsByRegistration = new Map();',
    'Associações da área principal devem ser agrupadas por professor.');
  Assert.contains(html, 'Associações cadastradas (${Utils.formatNum(teacherCount)}',
    'Título deve informar a quantidade de professores únicos agrupados no modal.');
  Assert.contains(html, 'const teacherCount = groupsByRegistration.size;',
    'Contagem do título deve usar o mesmo agrupamento que elimina professores duplicados.');
  Assert.contains(html, 'teacher-assignment-list',
    'Cada professor deve listar seus vínculos administráveis separadamente.');
  Assert.contains(html, "? 'Associar diretamente à área principal'",
    'Nova associação na visão principal deve deixar explícito seu escopo direto.');
  Assert.contains(html, "? 'professor' : 'professores'",
    'Cartões devem apresentar a quantidade de professores com concordância nominal.');
  Assert.contains(managementSource, 'resolveAreaScopeIds',
    'Backend deve resolver área principal e subáreas no carregamento gerencial.');
  Assert.contains(countSource, 'aggregated[registration] = true',
    'Contagem da área principal deve deduplicar matrículas entre subáreas.');
  Assert.notContains(TEACHER_AREAS_CONFIG.associationHeaders.join('|'), 'Semestre_Inicio',
    'Versão 10.0.8 não deve criar coluna de semestre inicial.');
}

/** Valida o ciclo híbrido de docentes, simulação, normas, relatórios e Ema. */
function test_Frontend_v1009TeacherConditionsContract() {
  Logger.log('--- Rodando: test_Frontend_v1009TeacherConditionsContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  const managementHtml = HtmlService.createHtmlOutputFromFile(
    'TeacherConditionsView'
  ).getContent();
  const dashboardTutorial = JSON.stringify(
    HelpTutorialCatalog.getById('dashboard')
  );
  const managementTutorial = HelpTutorialCatalog.getById('teacher-conditions');
  const dataManagementSource = [
    DataManagementService.commitTeacherMerge,
    DataManagementService.mergeTeacherValues
  ].map(function(item) { return item.toString(); }).join('\n');

  Assert.contains(html, 'id="btnTeachers"',
    'Cabeçalho administrativo deve oferecer o cadastro de docentes.');
  Assert.contains(html, "include('TeacherConditionsView')",
    'Dashboard deve carregar o cadastro híbrido como componente isolado.');
  Assert.contains(managementHtml, 'id="teacherRegistryModal"',
    'Cadastro deve possuir modal próprio.');
  Assert.contains(managementHtml, 'Os dados importados abaixo são somente para consulta.',
    'Dados oficiais importados devem ser explicitamente somente leitura.');
  Assert.contains(managementHtml, 'Sugestões da importação',
    'Colunas J e S devem gerar sugestões revisáveis.');
  Assert.contains(managementHtml, 'Justifica carga abaixo do mínimo geral',
    'Formulário deve permitir confirmar a justificativa administrativa.');
  Assert.contains(managementHtml, "toggle.textContent = condition.active ? 'Inativar' : 'Reativar'",
    'Condições devem preservar histórico por inativação e reativação.');

  Assert.contains(html, 'id="toggleConsiderJustifiedTeachers"',
    'Parâmetros devem oferecer a simulação com ou sem docentes justificados.');
  Assert.contains(html, 'Abaixo do Mínimo Justificado',
    'Dashboard deve apresentar o grupo distinto definido para justificativas.');
  Assert.contains(html, 'id="modalProfConditions"',
    'Detalhamento do professor deve apresentar condições e motivos.');
  Assert.contains(html, 'Resolução IFTM nº 29/2019',
    'Fundamento normativo deve registrar a Resolução nº 29/2019.');
  Assert.contains(html, 'Portaria MEC nº 750/2024',
    'Fundamento normativo deve preservar a referência geral da Portaria nº 750/2024.');
  Assert.contains(html, 'justifiedGapWeekly',
    'Agregação por área deve tornar mensurável o impacto semanal justificado.');
  Assert.contains(dashboardTutorial, 'dashboard.justified-teachers-toggle',
    'Tutorial do dashboard deve explicar o novo controle de simulação.');
  Assert.contains(dashboardTutorial, 'função importada, jornada reduzida, condições confirmadas',
    'Tutorial do PDF deve explicar os novos campos do relatório.');
  Assert.equals('teacher-conditions', managementTutorial.id,
    'Ema deve possuir tutorial administrativo específico para condições docentes.');
  Assert.equals('manageTeachers', managementTutorial.permission,
    'Tutorial administrativo deve respeitar a mesma permissão da tela.');

  Assert.equals(false, dataManagementSource.indexOf('DOCENTES_CONDICOES') >= 0,
    'Mesclagem de DOCENTES não pode gravar na aba complementar de condições.');
  Assert.equals(true,
    SYSTEM_RESET_CONFIG.dataSheetNames.indexOf('DOCENTES_CONDICOES') >= 0,
    'Reset global controlado deve conhecer a nova estrutura.');
}

/**
 * Confirma indicadores clicáveis e estado vazio seguro.
 */
function test_Frontend_areaIndicatorsAndEmptyStateContract() {
  Logger.log('--- Rodando: test_Frontend_areaIndicatorsAndEmptyStateContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  Assert.contains(html, 'data-area-metric="assignedTeachers"',
    'Indicadores por área devem ser clicáveis.');
  Assert.contains(html, 'data-area-metric="studentLinks"',
    'Alunos por área deve possuir detalhamento.');
  Assert.contains(html, 'id="areaAnalyticsModal"',
    'Detalhamento por áreas deve usar modal próprio.');
  Assert.contains(html, 'id="areaKpiEmptyState"',
    'Ausência de associações deve possuir estado vazio explícito.');
  Assert.contains(html, 'Nenhum docente possui área atribuída no recorte atual',
    'Estado vazio deve explicar que os demais indicadores permanecem disponíveis.');
  Assert.contains(html, 'Array.isArray(row.AREAS_DOCENTE) ? row.AREAS_DOCENTE : []',
    'Filtros devem tratar ausência da lista de áreas como coleção vazia.');
  Assert.contains(html, 'Sem área atribuída',
    'Docentes sem associação devem permanecer identificáveis.');
}

/**
 * Confirma ordenação por somente uma coluna e ciclo de três estados.
 */
function test_Frontend_singleColumnSortingContract() {
  Logger.log('--- Rodando: test_Frontend_singleColumnSortingContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  Assert.contains(html, 'this.sort = { key: null, direction: null };',
    'Modelo deve manter apenas uma chave de ordenação.');
  Assert.contains(html, 'cycleSort(key)',
    'Modelo deve possuir ciclo central de ordenação.');
  Assert.contains(html, "this.sort = { key: normalizedKey, direction: 'asc' };",
    'Primeiro clique deve ordenar em ordem crescente.');
  Assert.contains(html, "this.sort = { key: normalizedKey, direction: 'desc' };",
    'Segundo clique deve ordenar em ordem decrescente.');
  Assert.contains(html, "this.sort = { key: null, direction: null };",
    'Terceiro clique deve restaurar a ordem padrão.');
  Assert.contains(html, "header.setAttribute('aria-sort'",
    'Cabeçalhos devem anunciar a ordenação de forma acessível.');
  Assert.contains(html, "document.querySelectorAll('.table-sort-button[data-sort-key]')",
    'Clique no cabeçalho deve acionar a ordenação.');
}

/**
 * Confirma áreas e situação na tabela e no detalhamento do docente.
 */
function test_Frontend_professorAreaTableContract() {
  Logger.log('--- Rodando: test_Frontend_professorAreaTableContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  Assert.contains(html, '<span>Áreas de conhecimento</span>',
    'Tabela deve possuir coluna de áreas de conhecimento.');
  Assert.contains(html, '<span>Situação docente</span>',
    'Tabela deve possuir coluna de situação docente.');
  Assert.contains(html, 'this._appendAreaCell(row, professor.areas);',
    'Cada linha deve renderizar as áreas do docente.');
  Assert.contains(html, 'this._appendTeacherStatusCell(',
    'Cada linha deve renderizar a situação administrativa.');
  Assert.contains(html, 'id="modalProfAreas"',
    'Modal do professor deve exibir suas associações completas.');
  Assert.contains(html, 'row.tabIndex = 0;',
    'Linhas clicáveis devem ser acessíveis por teclado.');
}

/**
 * Confirma referência normativa, campos pré-preenchidos e simulação não persistente.
 */
function test_Frontend_portariaSimulationContract() {
  Logger.log('--- Rodando: test_Frontend_portariaSimulationContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'Portaria MEC nº 750, de 30 de julho de 2024',
    'Origem dos parâmetros deve permanecer visível no painel.');
  Assert.contains(html, 'id="normativeBasisBtn"',
    'Painel deve oferecer detalhamento do fundamento normativo.');
  Assert.contains(html, 'id="inputWeeksSemester1"',
    'Primeiro semestre deve possuir campo editável de semanas.');
  Assert.contains(html, 'id="inputWeeksSemester2"',
    'Segundo semestre deve possuir campo editável de semanas.');
  Assert.contains(html, 'value="20" min="1" step="1"',
    'Campos de semanas devem iniciar com 20 semanas.');
  Assert.contains(html, 'id="inputMinIntegral"',
    'Faixa de docentes integrais deve ser editável.');
  Assert.contains(html, 'id="inputMinPartial"',
    'Faixa de docentes parciais deve ser editável.');
  Assert.contains(html, 'Simulação ativa. Os valores alterados não serão gravados.',
    'Interface deve explicar que a simulação não altera a base.');
  Assert.contains(html, 'resetSimulation()',
    'Modelo deve restaurar os parâmetros oficiais durante a sessão.');
  Assert.contains(html, 'configureTeachingLoadReference(referenceData.teachingLoad)',
    'Frontend deve usar a referência enviada pelo backend no carregamento inicial.');
  const simulationControllerStart = html.indexOf('const syncSimulation = () =>');
  const simulationControllerEnd = html.indexOf(
    "document.addEventListener('keydown'",
    simulationControllerStart
  );
  const simulationControllerSource = simulationControllerStart >= 0
    && simulationControllerEnd > simulationControllerStart
    ? html.slice(simulationControllerStart, simulationControllerEnd)
    : '';
  Assert.equals(true, simulationControllerSource.length > 0,
    'Teste deve localizar o controlador dos parâmetros simulados.');
  Assert.notContains(simulationControllerSource, 'localStorage',
    'Parâmetros simulados não devem usar armazenamento persistente.');
  Assert.notContains(simulationControllerSource, 'sessionStorage',
    'Parâmetros simulados devem existir somente no modelo da página atual.');
  Assert.contains(html, "storageKey: 'CH_DOCENTE_THEME'",
    'Somente a preferência visual de tema pode persistir no navegador.');
}

/**
 * Confirma cards clicáveis, gráficos principais e detalhamento gráfico-tabular.
 */
function test_Frontend_clickableCardsAndChartsContract() {
  Logger.log('--- Rodando: test_Frontend_clickableCardsAndChartsContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'data-workload-metric="teachers"',
    'Cards de carga horária devem ser clicáveis.');
  Assert.contains(html, 'data-area-metric="assignedTeachers"',
    'Cards por área devem ser clicáveis.');
  Assert.contains(html, 'id="workloadStatusChart"',
    'Visão por carga deve incluir gráfico de situação semanal.');
  Assert.contains(html, 'id="weeklyWorkloadChart"',
    'Visão por carga deve incluir ranking gráfico de médias semanais.');
  Assert.contains(html, 'id="areaTeachersChart"',
    'Visão por área deve incluir gráfico de docentes por área.');
  Assert.contains(html, 'id="areaStudentsChart"',
    'Visão por área deve incluir gráfico de vínculos aluno-docente.');
  Assert.contains(html, 'id="areaWorkloadChart"',
    'Visão por área deve incluir gráfico de carga de aulas.');
  Assert.contains(html, "labels = ['Com área atribuída', 'Sem área atribuída'];",
    'Card de docentes com área deve abrir composição de atribuição.');
  Assert.contains(html, "labels = ['Áreas com docentes', 'Áreas sem docentes'];",
    'Card de áreas com docentes deve abrir composição de cobertura.');
  Assert.contains(html, 'id="workloadAnalyticsChart"',
    'Detalhamento de carga deve apresentar gráfico antes da tabela.');
  Assert.contains(html, 'id="areaAnalyticsChart"',
    'Detalhamento por área deve apresentar gráfico antes da tabela.');
  Assert.contains(html, "chartType = 'doughnut';",
    'Indicadores de composição devem usar visualização de parte para o todo.');
}

/**
 * Confirma restauração independente da tabela de professores.
 */
function test_Frontend_restoreTableContract() {
  Logger.log('--- Rodando: test_Frontend_restoreTableContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'id="restoreTableBtn"',
    'Tabela deve possuir controle discreto de restauração.');
  Assert.contains(html, '<span>Restaurar tabela</span>',
    'Controle deve ter rótulo textual claro.');
  Assert.contains(html, 'resetTableState()',
    'Modelo deve restaurar busca e ordenação locais.');
  Assert.contains(html, "this.tableSearch = '';",
    'Restauração deve limpar a busca local.');
  Assert.contains(html, 'this.sort = { key: null, direction: null };',
    'Restauração deve remover a ordenação ativa.');
  Assert.contains(html, 'this.els.restoreTableBtn.disabled = Boolean(tableState.isDefault);',
    'Controle deve ficar desabilitado quando a tabela já estiver no padrão.');
}

/**
 * Confirma alinhamento e dimensionamento consistente dos filtros superiores.
 */
function test_Frontend_filterAlignmentContract() {
  Logger.log('--- Rodando: test_Frontend_filterAlignmentContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, '.controls-grid { display: grid; align-items: end;',
    'Filtros devem usar grade com alinhamento inferior consistente.');
  Assert.contains(html, '.controls-grid .input-control { width: 100%; min-height: 42px;',
    'Campos superiores devem possuir largura e altura uniformes.');
  Assert.contains(html, '.filters-grid { grid-template-columns:',
    'Filtros gerais devem possuir larguras proporcionais.');
  Assert.contains(html, '@media (max-width: 760px)',
    'Grade deve reorganizar os filtros em telas menores.');
}

/**
 * Impede que null ou vazio sejam convertidos indevidamente para regime zero.
 */
function test_Frontend_nullableRegimeContract() {
  Logger.log('--- Rodando: test_Frontend_nullableRegimeContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'toNullableNumber: value =>',
    'Frontend deve possuir conversão numérica que preserve ausência de valor.');
  Assert.contains(html, "value === null || value === undefined || String(value).trim() === ''",
    'Null e vazio devem resultar em ausência, não em zero.');
  Assert.contains(html, 'Utils.hasFiniteNumber(professor.weeklyMinimum)',
    'Faixa não identificada não deve ser exibida como 0–0 horas.');
}

/**
 * Valida o contrato mínimo do frontend para impedir regressões.
 */
function test_Frontend_criticalRulesContract() {
  Logger.log('--- Rodando: test_Frontend_criticalRulesContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'FATOR_SEMESTRE_',
    'Frontend deve consumir os fatores semestrais do backend.');
  Assert.notContains(html, "['SEMESTRE', 'SEM', 'PERIODO']",
    'Frontend não deve usar PERÍODO como semestre.');
  Assert.contains(html, 'Total (Hora-relógio / Hora-aula)',
    'Tabela deve apresentar hora-relógio como unidade principal.');
  Assert.contains(html, 'Visão por carga horária',
    'Primeira faixa deve possuir título explícito.');
  Assert.contains(html, 'Visão por Área do Conhecimento',
    'Segunda faixa deve possuir título explícito.');
  Assert.contains(html, 'professor.chRelogio / activeWeeks',
    'Avaliação normativa deve trabalhar com média semanal.');
  Assert.contains(html, "if (contract === 40)",
    'Regimes integrais e substitutos devem usar a faixa de 40 horas.');
  Assert.contains(html, "if (contract === 20)",
    'Regime parcial deve usar a faixa de 20 horas.');
  Assert.notContains(html, 'currentThreshold',
    'Limite anual antigo não deve permanecer na versão 9.8.');
  Assert.notContains(html, 'alert(',
    'Frontend não deve usar comunicação intrusiva.');
}


/**
 * Agrega a carga em hora-relógio por nome e forma do curso sem remover linhas.
 *
 * @private
 * @param {Array<Object>} records Registros avaliados.
 * @param {string|null} factorKey Fator semestral ou null para carga integral.
 * @returns {Object<string, number>} Totais pela combinação curso e forma.
 */

/** Valida domínio, perfis e primeiro Super Usuário sem consultar a sessão. */
function test_AccessControl_profileAndDomainContract() {
  Assert.equals(true,
    AccessControlService.isInstitutionalEmail('Usuario@IFTM.EDU.BR'),
    'E-mail institucional é aceito sem diferenciar caixa');
  Assert.equals(false,
    AccessControlService.isInstitutionalEmail('usuario@example.com'),
    'E-mail externo é rejeitado');
  Assert.equals('antoniobarros@iftm.edu.br',
    ACCESS_CONTROL_CONFIG.firstSuperUser.email,
    'Primeiro Super Usuário configurado');
  Assert.equals('SUPER_USUARIO',
    ACCESS_CONTROL_CONFIG.profiles.SUPER,
    'Perfil Super Usuário estável');
  Assert.throws(function() {
    AccessControlService.assertUserRegistryIntegrity([
      { rowNumber: 2, id: '1', name: 'Usuário A', email: 'duplicado@iftm.edu.br', profile: 'ADMINISTRADOR' },
      { rowNumber: 3, id: '2', name: 'Usuário B', email: 'duplicado@iftm.edu.br', profile: 'ADMINISTRADOR' }
    ]);
  }, 'Cadastro administrativo não pode aceitar e-mails duplicados.');
}

/** Confirma a matriz aprovada para gestão de áreas e relatórios. */
function test_AccessControl_areaPermissionMatrix() {
  Logger.log('--- Rodando: test_AccessControl_areaPermissionMatrix ---');
  const publicPermissions = AccessControlService.buildPermissions('PUBLICO_INSTITUCIONAL');
  const adminPermissions = AccessControlService.buildPermissions('ADMINISTRADOR');
  const superPermissions = AccessControlService.buildPermissions('SUPER_USUARIO');
  Assert.equals(false, publicPermissions.manageAreas,
    'Acesso público deve permanecer somente leitura para áreas.');
  Assert.equals(false, publicPermissions.generateGeneralReport,
    'Acesso público não deve gerar relatório geral administrativo.');
  Assert.equals(false, publicPermissions.manageTeachers,
    'Acesso público não deve administrar condições docentes.');
  Assert.equals(true, adminPermissions.manageAreas,
    'Administrador deve gerir áreas, subáreas, docentes e associações.');
  Assert.equals(true, adminPermissions.manageTeachers,
    'Administrador deve confirmar funções, jornadas e justificativas docentes.');
  Assert.equals(true, superPermissions.manageAreas,
    'Super Usuário deve manter as mesmas permissões de gestão de áreas.');
  Assert.equals(true, superPermissions.manageTeachers,
    'Super Usuário deve manter a gestão de condições docentes.');
  Assert.equals(false, adminPermissions.resetDatabase,
    'Administrador não deve receber permissão adicional de reset.');
  Assert.equals(true, superPermissions.resetDatabase,
    'Reset deve continuar restrito ao Super Usuário.');
}

/** Valida o contrato flexível sem alterar as bases. */
function test_DataManagement_flexibleImportContract() {
  const cloned = DataManagementService.cloneContracts();
  Assert.equals(true,
    cloned.teachers.requiredHeaders.indexOf('Cargo') >= 0,
    'Cargo obrigatório no relatório de servidores');
  Assert.equals(true,
    cloned.teachers.aliases['Matrícula'].indexOf('SIAPE') >= 0,
    'Alias SIAPE reconhecido');
  Assert.equals(true,
    cloned.students.headers.length > cloned.students.requiredHeaders.length,
    'Relatório de alunos aceita colunas opcionais');
  Assert.equals('PROFESSOR SUBSTITUTO',
    DataManagementService.normalizeHeaderText('Professor substituto'),
    'Normalização permite identificar cargos docentes');
}

/** Valida a segurança criptográfica e o escopo preservado do reset. */
function test_SystemReset_securityContract() {
  const first = SystemResetService.hashCode('salt-a', 'ABC12345');
  const second = SystemResetService.hashCode('salt-a', 'ABC12345');
  const different = SystemResetService.hashCode('salt-b', 'ABC12345');
  Assert.equals(first, second, 'Hash do código é determinístico');
  Assert.equals(false, first === different, 'Salt altera o hash armazenado');
  Assert.equals(true,
    SYSTEM_RESET_CONFIG.dataSheetNames.indexOf('AREAS_CONHECIMENTO') >= 0,
    'Reset inclui áreas de conhecimento');
  Assert.equals(false,
    SYSTEM_RESET_CONFIG.dataSheetNames.indexOf('USUARIOS') >= 0,
    'Reset preserva usuários');
  ['DOCENTES', 'AREAS_CONHECIMENTO', 'DOCENTES_AREAS', 'DOCENTES_CONTROLE']
    .forEach(function(sheetName) {
      Assert.equals(false, SystemResetService.isAnnualDataSheetName(sheetName),
        'Aba fixa deve ser preservada: ' + sheetName + '.');
    });
  ['2024', 'ALUNOXCAMPUS2024', 'ALUNOXCAMPUSX2024', 'ALUNOSXCAMPUS2024', 'ALUNOSXCAMPUSX2024']
    .forEach(function(sheetName) {
      Assert.equals(true, SystemResetService.isAnnualDataSheetName(sheetName),
        'Aba anual deve poder ser excluída: ' + sheetName + '.');
    });
  ['202', '20245', 'ALUNOSXCAMPUS', 'ALUNOSXCAMPUS_CONTROLE', 'AUDITORIA']
    .forEach(function(sheetName) {
      Assert.equals(false, SystemResetService.isAnnualDataSheetName(sheetName),
        'Nome não anual não pode ser excluído: ' + sheetName + '.');
    });

  Assert.equals('function', typeof SystemResetService.listAnnualDataSheets,
    'Reset deve listar as abas anuais antes e depois da exclusão.');
  Assert.equals('function', typeof SystemResetService.deleteAnnualDataSheets,
    'Reset deve excluir e verificar as abas anuais antes de concluir.');
}

/** Valida os principais contratos de interface da versão 9.9. */
function test_Frontend_v99UsersImportResetAndSectionsContract() {
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();
  Assert.contains(html, 'Relacionar colunas',
    'Mapeamento manual está disponível');
  Assert.contains(html, 'normalizeImportHeader',
    'Cabeçalhos são normalizados no frontend');
  Assert.contains(html, 'Não docentes ignorados',
    'Resumo informa registros não docentes ignorados');
  Assert.contains(html, 'Preparando análise',
    'Análise informa processamento imediatamente');
  Assert.contains(html, 'DashboardSectionsController',
    'Seções recolhíveis possuem controlador dedicado');
  Assert.contains(html, 'Recolher todas',
    'Controle global de seções está presente');
  Assert.contains(html, 'UserManagementController',
    'Tela de usuários está implementada');
  Assert.contains(html, 'requestFullDatabaseReset',
    'Reset solicita código no backend');
  Assert.contains(html, 'executeFullDatabaseReset',
    'Reset validado executa no backend');
  Assert.contains(html, "grid-template-areas:'status weekly' 'course composition'",
    'Curso e composição permanecem alinhados após a remoção do gráfico de cobertura');
  Assert.notContains(html, 'alert(',
    'Frontend não utiliza alert intrusivo');
}

/** Valida toggles, impacto auditável e remoção do gráfico na versão 9.9.2. */
function test_Frontend_v992SpecialComponentsContract() {
  Logger.log('--- Rodando: test_Frontend_v992SpecialComponentsContract ---');
  const html = HtmlService.createHtmlOutputFromFile('index').getContent();

  Assert.contains(html, 'id="toggleConsiderTcc" checked',
    'Toggle de TCC inicia ligado para preservar o cálculo atual.');
  Assert.contains(html, 'id="toggleConsiderInternship" checked',
    'Toggle de estágio inicia ligado.');
  Assert.contains(html, 'id="toggleConsiderComplementary" checked',
    'Toggle de atividades complementares inicia ligado.');
  Assert.contains(html, 'workloadFactor: includedInWorkload ? allocationFactor : 0',
    'Componente desativado deve zerar somente o fator de carga de aulas.');
  Assert.contains(html, 'Alunos, vínculos e dados importados permanecem inalterados.',
    'Interface deve explicar que os indicadores de alunos não são removidos.');
  Assert.contains(html, 'id="specialComponentImpactBtn"',
    'Resumo de impacto deve ser um único elemento clicável.');
  Assert.contains(html, 'id="specialComponentsModal"',
    'Elemento de impacto deve abrir detalhamento próprio.');
  Assert.contains(html, 'GRUPO_COMPONENTE_ESPECIAL',
    'Frontend deve consumir a classificação calculada no backend.');
  Assert.contains(html, '_buildSpecialComponentImpact(entries)',
    'Modelo deve consolidar quantidade, horas e linhas detalhadas.');
  Assert.contains(html, 'isSpecialComponentIncluded: (groupCode, filters = {}) =>',
    'Todas as visões devem compartilhar a mesma regra dos três toggles.');
  Assert.contains(html, 'return Utils.isSpecialComponentIncluded(groupCode, this.filters);',
    'Cálculo principal deve delegar a decisão ao helper compartilhado.');
  const modalStart = html.indexOf('showProfessorModal(professorName, rawRows, filters)');
  const modalEnd = html.indexOf('showCoverageDiagnosticModal', modalStart);
  const modalSource = html.slice(modalStart, modalEnd);
  Assert.equals(true, modalStart >= 0 && modalEnd > modalStart,
    'Fonte do detalhamento do professor deve ser localizável.');
  Assert.contains(modalSource, 'const includedInWorkload = Utils.isSpecialComponentIncluded(',
    'Detalhamento deve respeitar o estado dos toggles.');
  Assert.contains(modalSource, 'const workloadFactor = includedInWorkload ? allocationFactor : 0;',
    'Detalhamento deve zerar o fator de componentes desconsiderados.');
  Assert.equals(4, modalSource.split(') * workloadFactor;').length - 1,
    'Total, carga teórica, prática e extensão devem usar o mesmo fator do dashboard.');
  Assert.contains(modalSource, 'Desconsiderado nesta simulação',
    'Linha preservada no modal deve explicar por que sua carga foi zerada.');
  Assert.contains(modalSource, "row.dataset.workloadIncluded = 'false'",
    'Linha desconsiderada deve expor estado semântico para auditoria e acessibilidade.');
  Assert.notContains(html, 'id="coverageChart"',
    'Canvas do gráfico de cobertura deve ser removido.');
  Assert.notContains(html, 'Cobertura das ofertas com alunos',
    'Título do gráfico removido não deve permanecer no dashboard.');
  Assert.notContains(html, '_renderCoverageChart(',
    'Renderização específica do gráfico removido não deve permanecer como código morto.');
  Assert.contains(html, 'id="studentCoverageCard" data-workload-metric="coverage"',
    'Card e diagnóstico de associação permanecem disponíveis.');
  Assert.notContains(html, 'alert(',
    'Novos fluxos não podem usar comunicação intrusiva.');
}

/** Valida catálogo, perfis e origem dos relatórios orientada pela Ema. */
function test_HelpTutorials_catalogContract() {
  Logger.log('--- Rodando: test_HelpTutorials_catalogContract ---');
  const tutorials = HelpTutorialCatalog.getAll();
  const ids = tutorials.map(function(tutorial) { return tutorial.id; });
  const stepIds = [];

  Assert.equals(true, ids.indexOf('dashboard') >= 0,
    'Catálogo deve incluir tutorial do dashboard.');
  Assert.equals(true, ids.indexOf('base-preparation') >= 0,
    'Catálogo deve incluir preparação da base.');
  Assert.equals(true, ids.indexOf('manage-data') >= 0,
    'Catálogo deve incluir Gerenciar base.');
  Assert.equals(true, ids.indexOf('knowledge-areas') >= 0,
    'Catálogo deve incluir Áreas do Conhecimento.');
  Assert.equals(true, ids.indexOf('users') >= 0,
    'Catálogo deve incluir Usuários.');
  Assert.equals(true, ids.indexOf('general-report') >= 0,
    'Catálogo deve incluir o relatório geral administrativo.');

  tutorials.forEach(function(tutorial) {
    Assert.equals(true, tutorial.steps.length > 0,
      'Todo tutorial deve possuir passos: ' + tutorial.id + '.');
    Assert.equals(tutorial.id + '.position-ema', tutorial.steps[0].id,
      'Todo tutorial deve começar explicando como posicionar a Ema.');
    Assert.equals('#emaLauncher', tutorial.steps[0].target,
      'Passo inicial deve destacar a própria Ema como alça de arraste.');
    Assert.contains(tutorial.steps[0].message, 'arrastar a Ema ou o cabeçalho deste balão',
      'Passo inicial deve explicar as duas formas de reposicionar o conjunto.');
    tutorial.steps.forEach(function(step) {
      const selfContainedAction = step.action === 'confirm-reports';
      Assert.equals(true, Boolean(step.id && step.action
        && (step.target || selfContainedAction)),
      'Passo deve declarar id, action e alvo quando necessário: ' + tutorial.id + '.');
      stepIds.push(step.id);
    });
  });
  Assert.equals(stepIds.length, Array.from(new Set(stepIds)).length,
    'IDs de passos devem ser únicos em todo o catálogo.');

  const serialized = JSON.stringify(tutorials);
  Assert.contains(serialized, 'módulo CRA do VirtualIF',
    'Ema deve informar a origem de Professor × Disciplina e Alunos × Campus.');
  Assert.contains(serialized, 'CGP-UDI',
    'Ema deve informar a origem do relatório de Docentes.');
  Assert.contains(serialized, 'base.confirm-annual',
    'Preparação deve exigir a confirmação da importação anual.');
  Assert.contains(serialized, 'base.confirm-teachers',
    'Preparação deve exigir a confirmação da mesclagem de docentes.');
  Assert.contains(serialized, '"id":"base.finish-annual","target":"#finishOperationBtn"',
    'Depois da importação anual, a Ema deve focalizar o botão Concluir.');
  Assert.contains(serialized, '"id":"base.finish-teachers","target":"#finishOperationBtn"',
    'Depois da mesclagem de docentes, a Ema deve focalizar o botão Concluir.');
  Assert.contains(serialized, 'teacher-area-assignments-updated',
    'Associação docente deve aguardar o evento de sucesso do sistema.');
  Assert.contains(serialized, 'data-assignment-active',
    'Associação já existente deve ser reconhecida pelo estado renderizado.');
  Assert.contains(serialized, 'somente os alunos matriculados ou com vínculo ativo naquele PERÍODO acadêmico',
    'Tutorial do dashboard deve explicar de qual período vem a quantidade-base de alunos.');
  Assert.contains(serialized, 'Turmas especiais e dependências mantêm a carga horária',
    'Tutorial deve esclarecer que turmas não regulares ficam fora da estimativa de alunos.');
  Assert.contains(serialized, '"valueRequired":true',
    'Passo do ano deve exigir um valor válido antes de liberar o avanço.');
  Assert.contains(serialized, '"minValue":2000',
    'Passo do ano deve respeitar o limite mínimo aceito pelo formulário.');
  Assert.contains(serialized, '"maxValue":2999',
    'Passo do ano deve respeitar o limite máximo aceito pelo formulário.');
  Assert.contains(serialized, '"gate":"DATA"',
    'Áreas somente devem ser liberadas após os dados reais.');
  Assert.contains(serialized, '"gate":"AREAS"',
    'Usuários somente devem ser liberados após áreas e associações reais.');

  const publicTutorials = HelpTutorialCatalog.getAvailable({
    profile: 'PUBLICO_INSTITUCIONAL',
    permissions: { viewDashboard: true }
  });
  Assert.equals(true, publicTutorials.every(function(tutorial) {
    return !tutorial.permission;
  }), 'Público não deve receber roteiros administrativos.');
  const publicRelease = HelpTutorialCatalog.getReleaseNotes({
    profile: 'PUBLICO_INSTITUCIONAL',
    permissions: { viewDashboard: true }
  });
  const adminRelease = HelpTutorialCatalog.getReleaseNotes({
    profile: 'ADMINISTRADOR',
    permissions: { generateGeneralReport: true }
  });
  Assert.equals(false, JSON.stringify(publicRelease).includes('Relatório geral de professores'),
    'Novidades públicas não devem anunciar recurso administrativo.');
  Assert.equals(true, JSON.stringify(adminRelease).includes('Relatório geral de professores'),
    'Novidades administrativas devem incluir o relatório geral.');
}

/** Garante que cada roteiro percorra os elementos na ordem visual de cada tela. */
function test_HelpTutorials_visualOrderContract() {
  Logger.log('--- Rodando: test_HelpTutorials_visualOrderContract ---');
  const tutorials = HelpTutorialCatalog.getAll();
  const byId = {};
  tutorials.forEach(function(tutorial) { byId[tutorial.id] = tutorial; });
  const visualGroups = {
    dashboard: [[
      'dashboard.introduction', 'dashboard.theme', 'dashboard.collapse-all',
      'dashboard.expand-all', 'dashboard.year', 'dashboard.semester',
      'dashboard.teacher-search', 'dashboard.area-filter', 'dashboard.teacher-status',
      'dashboard.simulation-overview', 'dashboard.normative-open',
      'dashboard.normative-detail', 'dashboard.normative-close',
      'dashboard.workload-overview', 'dashboard.workload-collapse',
      'dashboard.workload-expand', 'dashboard.workload',
      'dashboard.workload-detail-summary', 'dashboard.workload-detail-chart',
      'dashboard.workload-detail-table', 'dashboard.workload-close',
      'dashboard.areas-overview', 'dashboard.areas', 'dashboard.area-detail-summary',
      'dashboard.area-detail-table', 'dashboard.area-teachers-open',
      'dashboard.area-teachers-detail', 'dashboard.area-close',
      'dashboard.table-overview', 'dashboard.table-search', 'dashboard.table-sort',
      'dashboard.professor-open', 'dashboard.professor-summary',
      'dashboard.professor-disciplines', 'dashboard.professor-pdf',
      'dashboard.professor-close'
    ]],
    'base-preparation': [
      ['base.report-sources', 'base.choose-annual'],
      ['base.year', 'base.discipline-file', 'base.student-file', 'base.analyze-annual',
        'base.annual-progress', 'base.annual-result', 'base.confirm-annual',
        'base.finish-annual'],
      ['base.teacher-source', 'base.teacher-file', 'base.analyze-teachers',
        'base.teacher-progress', 'base.teacher-result', 'base.confirm-teachers',
        'base.finish-teachers'],
      ['base.new-area', 'base.area-name', 'base.save-area', 'base.manage-area-teachers'],
      ['base.select-teacher', 'base.add-teacher']
    ],
    'manage-data': [[
      'manage-data.sources', 'manage-data.annual', 'manage-data.teachers',
      'manage-data.safety'
    ]],
    'knowledge-areas': [[
      'areas.new', 'areas.form', 'areas.associations'
    ]],
    'general-report': [[
      'general-report.open', 'general-report.filters', 'general-report.teachers',
      'general-report.sort', 'general-report.generate', 'general-report.close'
    ]],
    users: [[
      'users.public-access', 'users.new', 'users.form'
    ]]
  };
  const forbiddenTargets = [
    '#mainContent', '#managementHome', '#teacherManagementPanel',
    '#knowledgeAreaForm', '#usersModal'
  ];

  Object.keys(visualGroups).forEach(function(tutorialId) {
    const tutorial = byId[tutorialId];
    const indexes = {};
    tutorial.steps.forEach(function(step, index) {
      indexes[step.id] = index;
      Assert.equals(false, forbiddenTargets.indexOf(step.target) >= 0,
        'Tutorial não deve focalizar contêiner genérico: ' + step.id + '.');
      Assert.equals(false, step.placement === 'center',
        'Tutorial não deve centralizar genericamente o foco: ' + step.id + '.');
    });
    visualGroups[tutorialId].forEach(function(group) {
      for (let index = 1; index < group.length; index += 1) {
        Assert.equals(true, indexes[group[index - 1]] < indexes[group[index]],
          'Ordem visual deve ser preservada entre '
            + group[index - 1] + ' e ' + group[index] + '.');
      }
    });
  });
}

/** Valida a persistência sem acessar PropertiesService. */
function test_HelpPersistence_stateContract() {
  Logger.log('--- Rodando: test_HelpPersistence_stateContract ---');
  const state = HelpPersistenceService.applyPatch(
    HelpPersistenceService.createDefaultState(),
    {
      welcomeDismissed: true,
      completed: { dashboard: true },
      seenTips: { 'manage-data-report-sources': true },
      active: {
        tutorialId: 'manage-data',
        stepId: 'manage-data.open',
        state: 'WAITING_FOR_CLICK'
      }
    }
  );
  Assert.equals(true, state.welcomeDismissed,
    'Usuário cadastrado pode dispensar boas-vindas.');
  Assert.equals(true, state.completed.dashboard,
    'Conclusão do dashboard deve ser persistível.');
  Assert.equals(true, state.seenTips['manage-data-report-sources'],
    'Dicas contextuais vistas devem ser persistíveis.');
  Assert.equals('WAITING_FOR_CLICK', state.active.state,
    'Retomada deve preservar a espera por interação real.');
  Assert.equals(false, HelpPersistenceService.canPersist({
    profile: 'PUBLICO_INSTITUCIONAL',
    registeredActive: false
  }), 'Público não deve possuir dispensa duradoura.');
  Assert.equals(true, HelpPersistenceService.canPersist({
    profile: 'ADMINISTRADOR',
    registeredActive: true
  }), 'Administrador ativo deve possuir persistência por usuário.');
}

/** Valida estados explícitos e contratos de interação do motor. */
function test_HelpAssistant_stateMachineContract() {
  Logger.log('--- Rodando: test_HelpAssistant_stateMachineContract ---');
  ['IDLE', 'WELCOME', 'PREPARING', 'WAITING_FOR_ELEMENT',
    'WAITING_FOR_CLICK', 'SHOWING_MESSAGE', 'PAUSED',
    'COMPLETED', 'DISMISSED'].forEach(function(state) {
    Assert.equals(true, HELP_ASSISTANT_CONFIG.states.indexOf(state) >= 0,
      'Máquina de estados deve incluir ' + state + '.');
  });
  const dashboard = HelpTutorialCatalog.getById('dashboard');
  const workloadIndicatorStep = dashboard.steps.filter(function(step) {
    return step.id === 'dashboard.workload';
  })[0];
  Assert.equals('Abra um indicador de carga horária', workloadIndicatorStep.title,
    'Passo de indicadores deve nomear integralmente a carga horária.');
  Assert.equals('[data-workload-metric="total"]', workloadIndicatorStep.target,
    'Passo de carga horária deve destacar um indicador específico.');
  Assert.equals(undefined, workloadIndicatorStep.delegateTarget,
    'Passo específico não deve aceitar cliques dispersos por toda a seção.');
  const areaIndicatorStep = dashboard.steps.filter(function(step) {
    return step.id === 'dashboard.areas';
  })[0];
  Assert.equals('[data-area-metric="workload"]', areaIndicatorStep.target,
    'Passo de áreas deve destacar um indicador específico.');
  Assert.equals(undefined, workloadIndicatorStep.autoAdvance,
    'Abertura da carga horária não pode pular a explicação do modal.');
  Assert.equals(undefined, areaIndicatorStep.autoAdvance,
    'Abertura da área não pode pular a explicação do modal.');
  Assert.equals(true, dashboard.audiences.indexOf('PUBLICO_INSTITUCIONAL') >= 0,
    'Tema e recolhimento devem integrar o tutorial do público institucional.');
  const introductionStep = dashboard.steps.filter(function(step) {
    return step.id === 'dashboard.introduction';
  })[0];
  const themeStep = dashboard.steps.filter(function(step) {
    return step.id === 'dashboard.theme';
  })[0];
  Assert.equals('#dashboardFiltersPanel', introductionStep.target,
    'Introdução deve destacar visualmente o painel superior completo.');
  Assert.equals('next', themeStep.action,
    'Alternância de tema deve avançar somente pelo controle da Ema.');
  Assert.equals(false, themeStep.required,
    'Clique no tema não deve concluir automaticamente a etapa.');
  Assert.equals('Continuar', themeStep.continueLabel,
    'Etapa de tema deve oferecer o botão Continuar no balão da Ema.');
  Assert.contains(themeStep.message, 'Clique quantas vezes quiser',
    'Ema deve explicar que o esquema de cores pode ser alternado livremente.');
  const helpHtml = HtmlService.createHtmlOutputFromFile('HelpAssistant_').getContent();
  Assert.contains(helpHtml,
    'professor-(summary|disciplines|pdf|close)',
    'Navegação deve manter o modal do professor aberto durante a explicação do PDF.');
  ['dashboard.theme', 'dashboard.collapse-all', 'dashboard.expand-all',
    'dashboard.workload-collapse', 'dashboard.workload-expand',
    'dashboard.workload-detail-summary', 'dashboard.area-teachers-detail',
    'dashboard.professor-disciplines', 'dashboard.professor-pdf'].forEach(function(stepId) {
      Assert.equals(true, dashboard.steps.some(function(step) { return step.id === stepId; }),
        'Tutorial completo deve incluir ' + stepId + '.');
    });
  const broadOperationalTargets = [
    '.simulation-panel',
    '#workloadDashboardSection',
    '#areaDashboardSection',
    '#teacherTableSection'
  ];
  Assert.equals(false, dashboard.steps.some(function(step) {
    return broadOperationalTargets.indexOf(step.target) >= 0;
  }), 'Passos operacionais não devem destacar seções inteiras.');
  Assert.equals(true, dashboard.steps.some(function(step) {
    return step.required && step.action === 'change';
  }), 'Tutorial deve aguardar alterações reais em controles.');
  Assert.equals(true, dashboard.steps.some(function(step) {
    return step.required && step.action === 'click';
  }), 'Tutorial deve aguardar cliques reais em elementos interativos.');

  const preparation = HelpTutorialCatalog.getById('base-preparation');
  const reportConfirmationIndex = preparation.steps.findIndex(function(step) {
    return step.id === 'base.confirm-cra-reports';
  });
  const openManagementIndex = preparation.steps.findIndex(function(step) {
    return step.id === 'base.open-management';
  });
  const reportConfirmation = preparation.steps[reportConfirmationIndex];
  const openManagementStep = preparation.steps[openManagementIndex];
  Assert.equals(true, reportConfirmationIndex >= 0,
    'Preparação deve explicar a geração dos relatórios antes de abrir a gestão.');
  Assert.equals(true, reportConfirmationIndex < openManagementIndex,
    'Confirmação dos relatórios deve anteceder o clique em Gerenciar Base.');
  Assert.equals(true, openManagementStep.autoAdvance,
    'Tutorial deve avançar automaticamente após abrir Gerenciar Base.');
  Assert.equals('confirm-reports', reportConfirmation.action,
    'Confirmação deve depender de resposta explícita do usuário.');
  Assert.equals(true, reportConfirmation.correctionAllowed,
    'Resposta contextual do usuário deve poder ser revisada pelo botão Voltar.');
  Assert.contains(reportConfirmation.message, 'todos os períodos letivos',
    'Orientação deve exigir todos os períodos letivos.');
  Assert.contains(reportConfirmation.message,
    'Matriculado, Trancado, Mobilidade, Provável formando e Integralizada',
    'Orientação deve explicar todos os movimentos elegíveis.');
  Assert.contains(reportConfirmation.message, 'Selecionar Todos',
    'Orientação deve exigir todos os campos do relatório.');
  Assert.contains(reportConfirmation.message, 'Professor × Disciplina',
    'Orientação deve explicar a geração do relatório Professor × Disciplina.');
  Assert.contains(reportConfirmation.message, 'informe somente o ano',
    'Professor × Disciplina deve ser gerado somente com o parâmetro de ano.');
  Assert.contains(reportConfirmation.message,
    'Planilha com dados organizados em colunas destinado à manipulação por meio de tabela dinâmica',
    'Professor × Disciplina deve exigir a opção destinada à tabela dinâmica.');
  Assert.contains(reportConfirmation.message, 'para o mesmo ano',
    'Os dois relatórios do CRA devem corresponder ao mesmo ano.');
  Assert.contains(reportConfirmation.message, 'relatório de Docentes deve ser solicitado à CGP-UDI',
    'Orientação deve informar a origem do relatório de Docentes.');
  Assert.contains(reportConfirmation.message, 'três relatórios necessários',
    'Confirmação deve abranger os dois relatórios do CRA e o relatório de Docentes.');
  const yearStep = preparation.steps.filter(function(step) {
    return step.id === 'base.year';
  })[0];
  Assert.equals(true, yearStep.valueRequired,
    'Ano da base deve permanecer obrigatório durante o tutorial.');
  Assert.equals(2000, yearStep.minValue,
    'Ano da base deve usar o mesmo limite mínimo do formulário.');
  Assert.equals(2999, yearStep.maxValue,
    'Ano da base deve usar o mesmo limite máximo do formulário.');
  Assert.equals('10.0.9', dashboard.version,
    'Tutorial atualizado deve acompanhar a versão do software.');
}

/**
 * Reproduz o contrato do primeiro acesso: quando a área já está aberta, a Ema
 * deve reconhecer a tela atual e não procurar novamente o botão de navegação.
 */
function test_HelpAssistant_firstAccessScreenContract() {
  Logger.log('--- Rodando: test_HelpAssistant_firstAccessScreenContract ---');
  const expectedScreens = {
    'manage-data': ['manage-data.open', '#dataManagementModal.active'],
    'knowledge-areas': ['areas.open', '#knowledgeAreasContent:not(.hidden)'],
    users: ['users.open', '#usersModal.active']
  };
  Object.keys(expectedScreens).forEach(function(tutorialId) {
    const tutorial = HelpTutorialCatalog.getById(tutorialId);
    const expected = expectedScreens[tutorialId];
    const openStep = tutorial.steps.filter(function(step) {
      return step.id === expected[0];
    })[0];
    Assert.equals(expected[1], openStep.screenTarget,
      'Primeiro acesso deve reconhecer a tela já aberta em ' + tutorialId + '.');
  });

  const helpHtml = HtmlService.createHtmlOutputFromFile('HelpAssistant_').getContent();
  const screenCheckIndex = helpHtml.indexOf('if (this.isStepScreenAlreadyOpen(step))');
  const navigationIndex = helpHtml.indexOf('await this.navigateToStepScreen(step)');
  Assert.equals(true, screenCheckIndex >= 0,
    'Motor da Ema deve possuir verificação explícita da tela já aberta.');
  Assert.equals(true, screenCheckIndex < navigationIndex,
    'Verificação da tela atual deve ocorrer antes de tentar navegar e localizar o botão.');
  Assert.contains(helpHtml, "this.announce('A tela desta etapa já está aberta.",
    'Ema deve comunicar a transição sem exibir falso aviso de elemento ausente.');
  Assert.contains(helpHtml, "screen.getAttribute('aria-hidden') === 'true'",
    'Tela declarada deve estar realmente visível para ser considerada aberta.');
  Assert.contains(helpHtml, "style.display !== 'none' && style.visibility !== 'hidden'",
    'Reconhecimento do primeiro acesso não deve depender de dimensões transitórias da tela.');
}

/** Garante resposta visual imediata do botão Sair, mesmo com persistência lenta. */
function test_HelpAssistant_exitRespondsBeforePersistenceContract() {
  Logger.log('--- Rodando: test_HelpAssistant_exitRespondsBeforePersistenceContract ---');
  const helpHtml = HtmlService.createHtmlOutputFromFile('HelpAssistant_').getContent();
  const pauseStart = helpHtml.indexOf('async pauseTutorial()');
  const pauseEnd = helpHtml.indexOf('\n      closePausedTutorial() {', pauseStart);
  const pauseSource = helpHtml.slice(pauseStart, pauseEnd);
  const feedbackIndex = pauseSource.indexOf("this.showBubble(\n            'Tutorial pausado'");
  const persistenceIndex = pauseSource.indexOf('await this.saveProgress(pausePatch)');

  Assert.equals(true, pauseStart >= 0 && pauseEnd > pauseStart,
    'Motor da Ema deve possuir fluxo isolado para sair do tutorial.');
  Assert.equals(true, feedbackIndex >= 0 && feedbackIndex < persistenceIndex,
    'Botão Sair deve pausar visualmente antes de aguardar o servidor.');
  Assert.contains(pauseSource, "{ label: 'Fechar', handler: () => this.closePausedTutorial() }",
    'Usuário deve poder fechar o balão enquanto o progresso é salvo.');
  Assert.contains(pauseSource, "{ label: 'Salvando progresso...', primary: true, disabled: true }",
    'Ema deve informar quando a persistência da pausa ainda está em andamento.');
  Assert.contains(pauseSource,
    "if (this.activeTutorial !== tutorial || this.state !== 'PAUSED') return;",
    'Conclusão tardia do salvamento não deve reabrir um tutorial já fechado.');
}

/** Garante que a janela Ajuda permaneça integralmente dentro da área visível. */
function test_HelpAssistant_menuStaysWithinViewportContract() {
  Logger.log('--- Rodando: test_HelpAssistant_menuStaysWithinViewportContract ---');
  const helpHtml = HtmlService.createHtmlOutputFromFile('HelpAssistant_').getContent();
  const openStart = helpHtml.indexOf('openMenu() {');
  const openEnd = helpHtml.indexOf('\n      closeMenu() {', openStart);
  const openSource = helpHtml.slice(openStart, openEnd);
  const visibleIndex = openSource.indexOf('this.els.menu.hidden = false');
  const placementIndex = openSource.indexOf('this.positionMenuWithinViewport()');

  Assert.equals(true, visibleIndex >= 0 && placementIndex > visibleIndex,
    'Ajuda deve ser medida e posicionada depois de ficar visível.');
  Assert.contains(helpHtml, 'positionMenuWithinViewport() {',
    'Motor da Ema deve calcular a posição segura da janela Ajuda.');
  Assert.contains(helpHtml, 'const visualViewport = window.visualViewport;',
    'Posicionamento deve considerar a área visual real em dispositivos móveis.');
  Assert.contains(helpHtml, 'const spaceAbove = Math.max(0,',
    'Posicionamento deve medir o espaço disponível acima da Ema.');
  Assert.contains(helpHtml, 'const spaceBelow = Math.max(0,',
    'Posicionamento deve medir o espaço disponível abaixo da Ema.');
  Assert.contains(helpHtml, 'viewportBottom - menuRect.height - margin',
    'Borda inferior da Ajuda deve ser limitada à área visível.');
  Assert.contains(helpHtml, 'Math.max(viewportTop + margin, Math.min(maximumTop, safeTop))',
    'Borda superior da Ajuda deve ser limitada à área visível.');
  Assert.contains(helpHtml, "window.visualViewport.addEventListener('resize', keepHelpWithinViewport",
    'Ajuda deve recalcular a posição quando a área visual mudar.');
  Assert.contains(helpHtml, "['position', 'left', 'top', 'right', 'bottom', 'max-height']",
    'Estilos temporários de posicionamento devem ser removidos ao fechar a Ajuda.');
  Assert.contains(helpHtml, 'box-sizing: border-box;',
    'Largura da janela Ajuda deve incluir borda e preenchimento no limite da tela.');
}

/** Valida o aviso não guiado e as três decisões das novidades da versão. */
function test_HelpAssistant_releaseNotesContract() {
  Logger.log('--- Rodando: test_HelpAssistant_releaseNotesContract ---');
  const helpHtml = HtmlService.createHtmlOutputFromFile('HelpAssistant_').getContent();
  const bootstrap = HelpAssistantService.buildBootstrap({
    name: 'Usuário Teste', profile: 'PUBLICO_INSTITUCIONAL',
    registered: false, registeredActive: false,
    permissions: { viewDashboard: true }
  });
  Assert.equals('10.0.9', bootstrap.releaseNotes.version,
    'Bootstrap deve informar a versão das novidades.');
  Assert.equals(true, bootstrap.releaseNotes.items.length > 0,
    'Bootstrap deve fornecer a lista de funcionalidades do perfil.');
  Assert.contains(helpHtml, "label: 'Sim'",
    'Aviso de atualização deve permitir exibir as novidades agora.');
  Assert.contains(helpHtml, "label: 'Depois'",
    'Aviso de atualização deve permitir adiar para o próximo acesso.');
  Assert.contains(helpHtml, "label: 'Nunca nesta versão'",
    'Aviso de atualização deve permitir dispensar somente a versão atual.');
  Assert.contains(helpHtml, 'sessionStorage.setItem(`${key}:LATER`, \'1\')',
    'Decisão Depois deve durar apenas a sessão atual.');
  Assert.contains(helpHtml, 'localStorage.setItem(key',
    'Decisões Sim e Nunca devem ser vinculadas à versão no navegador.');
  Assert.contains(helpHtml, 'Lista de funcionalidades — não é um tutorial guiado',
    'Novidades devem ser apresentadas como lista, sem navegação pela tela.');
  Assert.contains(helpHtml, 'Ajuda → Novidades da versão',
    'Ema deve informar onde a lista continuará disponível.');
  Assert.contains(helpHtml, 'this.activeTutorial || this.state !== \'IDLE\'',
    'Aviso de novidades deve aguardar a conclusão de tutoriais e mensagens ativos.');
}

/** Garante minimização, retomada e integração visual da Ema com Ajuda. */
function test_HelpAssistant_minimizationContract() {
  Logger.log('--- Rodando: test_HelpAssistant_minimizationContract ---');
  const indexHtml = HtmlService.createHtmlOutputFromFile('index').getContent();
  const helpHtml = HtmlService.createHtmlOutputFromFile('HelpAssistant_').getContent();
  const dashboardTutorial = JSON.stringify(HelpTutorialCatalog.getById('dashboard'));
  Assert.contains(indexHtml, 'id="emaHelpHead"',
    'Botão Ajuda deve incorporar a cabeça da Ema.');
  Assert.contains(indexHtml, 'id="emaHelpBadge"',
    'Botão Ajuda deve possuir marcador de orientação pendente.');
  Assert.contains(helpHtml, 'id="emaMinimizeBtn"',
    'Balão da Ema deve oferecer o botão Minimizar.');
  Assert.contains(helpHtml, 'async minimizeAssistant() {',
    'Motor deve possuir fluxo dedicado de minimização.');
  Assert.contains(helpHtml, 'this.minimizedTutorial = true;',
    'Minimização durante tutorial deve registrar uma pausa retomável.');
  Assert.contains(helpHtml, 'stepId: step.id',
    'Pausa deve preservar o passo atual.');
  Assert.contains(helpHtml, 'if (this.minimizedTutorial && this.activeTutorial)',
    'Clique em Ajuda deve retomar o tutorial pausado na mesma sessão.');
  Assert.contains(helpHtml, 'const contextual = Boolean(this.pendingContextTip);',
    'Marcador deve considerar ajuda contextual pendente.');
  Assert.contains(dashboardTutorial, '"id":"dashboard.ema-minimize"',
    'Tutorial de apresentação deve explicar a minimização da Ema.');
}

/** Garante que o instalador da 10.0.9 seja aditivo e preserve dados existentes. */
function test_SetupVersao10_structureOnlyContract() {
  Logger.log('--- Rodando: test_SetupVersao10_structureOnlyContract ---');
  const plan = obterPlanoInstalacaoVersao10();
  Assert.equals(true, plan.structureOnly,
    'Instalador deve operar exclusivamente em modo estrutural.');
  Assert.equals(true, plan.additiveOnly,
    'Instalador deve operar apenas por acréscimo e validação.');
  Assert.equals('DOCENTES_CONDICOES', plan.newStructure,
    'Plano deve declarar a única nova estrutura persistente da 10.0.9.');
  Assert.equals(true, plan.preservedImportedSheets.indexOf('DOCENTES') >= 0,
    'Plano deve declarar o espelho DOCENTES como preservado.');
  Assert.equals(false, plan.includeAreaCatalog,
    'Instalador não pode inserir o catálogo inicial de áreas.');
  Assert.equals(false, plan.createInitialUser,
    'Instalador não pode inserir usuário inicial ou outro dado de negócio.');
  Assert.equals('function', typeof criarEstruturasVersao10_,
    'Versão 10 deve possuir um instalador estrutural autossuficiente.');
  Assert.equals('function', typeof validarCabecalhosVersao10_,
    'Instalador deve validar estruturas existentes antes de formatá-las.');
  Assert.equals('function', typeof instalarVersao1007,
    'Pacote deve oferecer ponto de entrada explícito para instalar a versão 10.0.7.');
  Assert.equals('function', typeof executarSmokeTestVersao1007,
    'Pacote deve oferecer smoke test explícito para a versão 10.0.7.');
  Assert.equals('function', typeof diagnosticarVersao1007,
    'Pacote deve oferecer diagnóstico explícito para a versão 10.0.7.');
  Assert.equals('function', typeof instalarVersao1008,
    'Pacote deve oferecer ponto de entrada explícito para instalar a versão 10.0.8.');
  Assert.equals('function', typeof executarSmokeTestVersao1008,
    'Pacote deve oferecer smoke test explícito para a versão 10.0.8.');
  Assert.equals('function', typeof diagnosticarVersao1008,
    'Pacote deve oferecer diagnóstico explícito para a versão 10.0.8.');
  Assert.equals('function', typeof instalarVersao1009,
    'Pacote deve oferecer ponto de entrada explícito para instalar a versão 10.0.9.');
  Assert.equals('function', typeof executarSmokeTestVersao1009,
    'Pacote deve oferecer smoke test explícito para a versão 10.0.9.');
  Assert.equals('function', typeof diagnosticarVersao1009,
    'Pacote deve oferecer diagnóstico explícito para a versão 10.0.9.');
  Assert.equals('10.0.9', SETUP_V10_CONFIG.version,
    'Instalador deve identificar a versão 10.0.9.');
  Assert.equals('function', typeof migrarEstruturaVersao1007_,
    'Instalador deve reconhecer e ampliar a estrutura 10.0.6 sem mover dados.');
  const installerSource = criarEstruturasVersao10_.toString();
  Assert.contains(installerSource, 'TEACHER_CONDITIONS_CONFIG.sheetName',
    'Instalador deve criar a estrutura separada de condições docentes.');
  Assert.notContains(installerSource, "getSheetByName('DOCENTES')",
    'Instalador não pode abrir o espelho DOCENTES para substituição.');
  Assert.notContains(installerSource, 'deleteSheet',
    'Instalador aditivo não pode excluir abas existentes.');
  Assert.notContains(installerSource, 'clearContent',
    'Instalador aditivo não pode limpar dados existentes.');
  Assert.contains(installerSource, 'result.preserved.push(definition.name)',
    'Estruturas já instaladas devem ser validadas e preservadas.');
}

/** Garante a apresentação obrigatória da Ema após reset ou em base inicial vazia. */
function test_HelpAssistant_resetWelcomeContract() {
  Logger.log('--- Rodando: test_HelpAssistant_resetWelcomeContract ---');
  const policy = HelpAssistantService.getWelcomePolicy(
    'base-preparation',
    { profile: 'ADMINISTRADOR' },
    { welcomeDismissed: true }
  );
  Assert.equals(true, policy.initialSetupRequired,
    'Backend deve sinalizar que a preparação inicial é obrigatória.');
  Assert.equals(true, policy.showWelcome,
    'Base resetada deve forçar a apresentação mesmo após dispensa antiga.');
}

/** Valida a integração visual isolada da Ema com o dashboard. */
function test_Frontend_emaHelpContract() {
  Logger.log('--- Rodando: test_Frontend_emaHelpContract ---');
  const indexHtml = HtmlService.createHtmlOutputFromFile('index').getContent();
  const helpHtml = HtmlService.createHtmlOutputFromFile('HelpAssistant_').getContent();
  const compactHelpHtml = helpHtml.replace(/\s+/g, ' ');
  const preparationTutorialJson = JSON.stringify(
    HelpTutorialCatalog.getById('base-preparation')
  );
  const dashboardTutorialJson = JSON.stringify(
    HelpTutorialCatalog.getById('dashboard')
  );

  Assert.contains(indexHtml, "include('HelpAssistant_')",
    'Dashboard deve carregar o módulo de ajuda como componente separado.');
  Assert.contains(indexHtml, "new CustomEvent('ema-help-open')",
    'Botão Ajuda deve abrir o módulo da Ema.');
  Assert.contains(indexHtml, 'z-index: 1200',
    'Toasts devem permanecer acima da Ema.');
  Assert.contains(helpHtml, 'id="emaHelpRoot"',
    'Componente deve possuir raiz isolada.');
  Assert.contains(helpHtml, 'id="emaHelpRoot" data-state="IDLE" aria-label="Assistente de ajuda Ema" hidden',
    'Ema deve permanecer oculta enquanto o dashboard carrega.');
  Assert.contains(indexHtml, "new CustomEvent('dashboard-ready'",
    'Dashboard deve avisar a Ema somente depois da renderização inicial.');
  Assert.contains(helpHtml, "document.addEventListener('dashboard-ready'",
    'Ema deve aguardar explicitamente o evento de dashboard pronto.');
  Assert.contains(helpHtml, "document.addEventListener('database-reset-completed'",
    'Ema deve consultar novamente o estado da base depois do reset.');
  Assert.contains(helpHtml, 'refreshAfterDatabaseReset',
    'Ema deve se reapresentar na base vazia sem depender do recarregamento do frame.');
  Assert.contains(helpHtml, "this.tutorials.has('dashboard') ? 'dashboard' : ''",
    'Apresentação deve oferecer o tour do dashboard mesmo sem início automático.');
  Assert.contains(helpHtml, 'this.startTutorial(welcomeTutorialId)',
    'Botão principal da apresentação deve iniciar o tutorial oferecido.');
  Assert.contains(indexHtml, 'id="dashboardFiltersPanel"',
    'Dashboard deve identificar o painel superior completo para o primeiro foco do tour.');
  Assert.contains(indexHtml, 'id="dashboardFiltersHeading"',
    'Painel focalizado deve preservar seu título acessível.');
  Assert.contains(dashboardTutorialJson, '"target":"#dashboardFiltersPanel"',
    'Visão geral deve destacar visualmente o painel superior do dashboard.');
  Assert.notContains(dashboardTutorialJson,
    '"id":"dashboard.introduction","target":"#mainContent"',
    'Visão geral não pode centralizar o foco no contêiner inteiro da tela.');
  Assert.contains(dashboardTutorialJson,
    '"id":"dashboard.theme","target":"#themeToggle","action":"next","required":false,"continueLabel":"Continuar"',
    'Tema deve permanecer interativo até o usuário clicar em Continuar no balão.');
  Assert.contains(helpHtml, 'label: step.continueLabel || (',
    'Motor da Ema deve respeitar um rótulo manual de continuação por etapa.');
  Assert.contains(dashboardTutorialJson, '"eventName":"area-analytics-opened"',
    'Passo de carga horária por área deve aguardar a abertura real do detalhamento.');
  Assert.contains(indexHtml, "new CustomEvent('area-analytics-opened'",
    'Dashboard deve confirmar à Ema que o detalhamento por área foi aberto.');
  Assert.contains(helpHtml, 'dashboardModalTarget',
    'Tour deve preservar o modal enquanto explica seus elementos internos.');
  Assert.contains(helpHtml, 'step.skipIfMissing',
    'Detalhes sem dados devem ser ignorados sem bloquear o tutorial.');
  Assert.contains(helpHtml, 'handleDashboardDetailClose(event)',
    'Fechar um detalhamento deve oferecer uma saída segura e avançar o roteiro.');
  Assert.contains(compactHelpHtml,
    "if (stepId === 'areas.associations') { closeOverlaysExcept(''); await waitForUi(); }",
    'Tutorial de áreas deve fechar o formulário antes de focalizar a lista inferior.');
  Assert.contains(helpHtml,
    "scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })",
    'Ema deve preservar a posição visual de elementos que já estão visíveis.');
  Assert.contains(indexHtml, "new CustomEvent('workload-analytics-opened'",
    'Dashboard deve confirmar a abertura do detalhamento de carga horária.');
  Assert.contains(indexHtml, "new CustomEvent('area-teacher-details-opened'",
    'Seleção de uma área deve confirmar a exibição de seus docentes.');
  Assert.contains(indexHtml, "new CustomEvent('professor-details-opened'",
    'Clique na tabela deve confirmar a abertura do professor.');
  Assert.contains(indexHtml, 'id="generateTeacherPdfBtn"',
    'Detalhamento do professor deve oferecer o PDF no acesso público.');
  Assert.contains(indexHtml, "'generateTeacherPdfReport'",
    'Botão do modal deve solicitar o PDF recomposto pelo servidor.');
  Assert.contains(dashboardTutorialJson, '"id":"dashboard.professor-pdf"',
    'Tutorial de apresentação deve explicar a geração do relatório individual.');
  Assert.contains(helpHtml, 'reopenStepForCorrection(targetIndex)',
    'Botão Voltar deve reabrir etapas de preenchimento para correção.');
  Assert.contains(helpHtml, 'this.correctionStepIds.add(targetStep.id)',
    'Etapa reaberta deve exigir nova validação mesmo quando o valor anterior era válido.');
  Assert.contains(helpHtml, 'this.completedStepIds.delete(steps[index].id)',
    'Correção deve invalidar o progresso dependente das etapas posteriores.');
  Assert.contains(indexHtml, "new CustomEvent('normative-basis-opened'",
    'Fundamento normativo deve confirmar a abertura para o tutorial.');
  Assert.contains(indexHtml, "new CustomEvent('knowledge-area-saved'",
    'Cadastro deve confirmar à Ema somente depois que a área for salva.');
  Assert.contains(indexHtml, "new CustomEvent('data-import-operation-finished'",
    'Importações devem informar sucesso ou falha à Ema.');
  Assert.contains(indexHtml, 'this.els.confirmAnnual.disabled = true;',
    'Confirmação anual deve ser desativada depois da gravação bem-sucedida.');
  Assert.contains(indexHtml, 'this.els.confirmTeacher.disabled = true;',
    'Confirmação de docentes deve ser desativada depois da gravação bem-sucedida.');
  Assert.contains(indexHtml, 'this.notifyDataImportFinished(true, null, operationMode);',
    'Evento de sucesso deve manter o escopo mesmo depois de encerrar a importação pendente.');
  Assert.contains(helpHtml, 'handleSuccessfulDataImport(event)',
    'Ema deve possuir uma transição específica depois da importação bem-sucedida.');
  Assert.contains(helpHtml, "? 'base.finish-annual'",
    'Sucesso anual deve direcionar diretamente ao passo do botão Concluir.');
  Assert.contains(helpHtml, ": 'base.finish-teachers';",
    'Sucesso de docentes deve direcionar diretamente ao passo do botão Concluir.');
  Assert.contains(helpHtml, 'promoteVisibleFinishButton()',
    'Ema deve detectar o botão Concluir diretamente, sem depender apenas do evento do servidor.');
  Assert.contains(helpHtml, "node.closest('#finishOperationBtn')",
    'Botão Concluir deve permanecer clicável como saída segura do passo de confirmação.');
  Assert.contains(helpHtml, 'completeImportStepFromFinishClick()',
    'Clique manual em Concluir deve liberar e avançar o tutorial mesmo se o evento falhar.');
  Assert.contains(helpHtml, 'showStepEventFailure(step, event)',
    'Motor deve orientar correção quando uma ação assíncrona falhar.');
  Assert.contains(helpHtml, 'step.requiresCheckedSelection',
    'Motor deve validar que uma opção real foi marcada na lista.');
  Assert.contains(indexHtml, 'id="themeToggle"',
    'Cabeçalho deve oferecer um controle discreto para alternar o tema.');
  Assert.contains(indexHtml, 'CH_DOCENTE_THEME',
    'Preferência de tema deve ser persistida no navegador.');
  Assert.contains(indexHtml, '(prefers-color-scheme: dark)',
    'Primeiro acesso deve respeitar o tema do sistema operacional.');
  Assert.contains(indexHtml, 'const ThemeController',
    'Frontend deve coordenar a alternância do tema sem recarregar a página.');
  Assert.contains(indexHtml, 'syncCharts: function(dark)',
    'Cores dos gráficos devem acompanhar o tema selecionado.');
  Assert.contains(indexHtml, 'aria-pressed',
    'Alternador de tema deve expor seu estado para tecnologias assistivas.');
  Assert.contains(helpHtml, 'html[data-theme="dark"]',
    'Ema deve possuir uma paleta própria para o tema escuro.');
  Assert.contains(preparationTutorialJson, '"eventName":"data-import-operation-finished"',
    'Tutorial não pode avançar importações antes da confirmação final do servidor.');
  Assert.contains(preparationTutorialJson, '"target":"#teacherAreaAvailableList"',
    'Seleção de docentes deve abranger toda a lista disponível.');
  Assert.contains(preparationTutorialJson,
    '"delegateTarget":"[data-teacher-registration]"',
    'Seleção de docentes deve reconhecer qualquer checkbox da lista.');
  Assert.contains(helpHtml, 'id="emaCharacter"',
    'Componente deve renderizar a personagem Ema.');
  Assert.contains(helpHtml, 'prefers-reduced-motion',
    'Animações devem respeitar a preferência de movimento reduzido.');
  Assert.contains(helpHtml, 'EMA_EXPRESSION_SOURCES',
    'Componente deve incorporar variações de expressão da Ema.');
  Assert.contains(helpHtml, 'setExpression(expression)',
    'Estado do tutorial deve controlar a expressão apresentada.');
  Assert.contains(helpHtml, 'orientToward(target)',
    'Ema deve orientar automaticamente a asa para o elemento destacado.');
  Assert.contains(helpHtml, 'ema-face-left',
    'Personagem deve ser espelhada sem inverter o balão ou seus textos.');
  Assert.contains(helpHtml, "MutationObserver",
    'Motor deve aguardar elementos carregados dinamicamente.');
  Assert.contains(helpHtml, "ema-help-open",
    'Componente deve ouvir o evento do botão Ajuda.');
  Assert.contains(helpHtml, 'checkReadinessGate',
    'Preparação deve validar portões com os dados reais do backend.');
  Assert.contains(helpHtml, 'showGatePassed',
    'Ema deve informar explicitamente o sucesso após analisar os dados gravados.');
  Assert.contains(helpHtml, 'Dados preparados com sucesso',
    'Validação positiva deve confirmar a importação anual e os Docentes.');
  Assert.contains(helpHtml, 'A preparação ainda precisa de correção',
    'Validação negativa deve explicar que existem pendências.');
  Assert.contains(helpHtml, 'A importação anual ainda não contém Professor × Disciplina e Alunos × Campus válidos para o mesmo ano',
    'Falha nos dados anuais deve apresentar um motivo específico.');
  Assert.contains(helpHtml, 'O cadastro de Docentes ainda não possui registros válidos',
    'Falha no relatório de Docentes deve apresentar um motivo específico.');
  Assert.contains(helpHtml, 'returnToGateStage',
    'Falha deve direcionar o tutorial de volta à etapa responsável pela correção.');
  Assert.contains(helpHtml, 'Corrigir em Gerenciar Base',
    'Falha de dados deve oferecer retorno direto à tela Gerenciar Base.');
  Assert.contains(helpHtml, 'guardTutorialInteraction',
    'Motor deve bloquear interações fora do alvo durante todos os tutoriais.');
  Assert.contains(helpHtml, 'isStepValueValid',
    'Motor deve validar o conteúdo obrigatório antes de liberar o próximo passo.');
  Assert.contains(helpHtml, "step.action === 'input' ? 1200 : 120",
    'Motor deve avançar sozinho após a ação, aguardando o fim da digitação quando necessário.');
  Assert.contains(helpHtml, 'Ação confirmada. Avançando automaticamente.',
    'Motor deve anunciar o avanço automático após reconhecer a ação esperada.');
  Assert.contains(helpHtml, 'interactionAdvanceTimer',
    'Avanço pendente deve ser controlado e cancelado ao sair do passo.');
  Assert.contains(helpHtml, 'completedStepIds: new Set()',
    'Motor deve registrar as ações obrigatórias já concluídas.');
  Assert.contains(helpHtml, 'this.completedStepIds.has(step.id)',
    'Voltar a um passo concluído não deve exigir a ação novamente.');
  Assert.contains(helpHtml, 'Você já concluiu esta ação. Não é necessário executá-la novamente.',
    'Ema deve explicar que uma etapa revista já está concluída.');
  Assert.contains(helpHtml, 'EMA_HELP_COMPLETED_STEPS_V10:',
    'Histórico dos passos concluídos deve sobreviver a uma pausa na mesma sessão.');
  Assert.contains(helpHtml, 'navigateToStepScreen',
    'Motor deve abrir automaticamente a tela exigida pelo passo atual.');
  Assert.contains(helpHtml, "click('#btnDashboard')",
    'Tutorial do dashboard deve retornar automaticamente à tela principal.');
  Assert.contains(helpHtml, "click('#btnManageData')",
    'Passos de dados devem abrir automaticamente Gerenciar Base.');
  Assert.contains(helpHtml, "click('#btnKnowledgeAreas')",
    'Passos de áreas devem abrir automaticamente Áreas do Conhecimento.');
  Assert.contains(helpHtml, "click('#btnUsers')",
    'Passos de usuários devem abrir automaticamente a janela de Usuários.');
  Assert.contains(preparationTutorialJson, 'base.annual-progress',
    'Tutorial deve acompanhar visualmente o progresso da análise anual.');
  Assert.contains(preparationTutorialJson, 'base.teacher-progress',
    'Tutorial deve acompanhar visualmente o progresso da análise de docentes.');
  Assert.contains(indexHtml, 'annual-report-analysis-completed',
    'Análise anual deve avisar a Ema quando o resultado estiver disponível.');
  Assert.contains(indexHtml, 'teacher-report-analysis-completed',
    'Análise de docentes deve avisar a Ema quando o resultado estiver disponível.');
  Assert.notContains(helpHtml, 'Se outra tela estiver aberta, conclua ou feche a operação atual.',
    'Ema não deve transferir ao usuário uma navegação que pode executar automaticamente.');
  Assert.contains(helpHtml, 'Etapa concluída. Avançando automaticamente',
    'Sucesso validado pelo backend não deve exigir clique adicional em Continuar.');
  Assert.contains(helpHtml, '}, 2500);',
    'Mensagem de sucesso deve permanecer visível brevemente antes do avanço automático.');
  Assert.contains(helpHtml, 'autoFocus: true',
    'Botão manual de avanço deve solicitar foco na janela da Ema.');
  Assert.contains(helpHtml, "button.classList.add('ema-next-focus')",
    'Botão de avanço focado deve receber destaque visual explícito.');
  Assert.contains(helpHtml, 'focusTarget.focus({ preventScroll: true })',
    'Foco do teclado deve ser transferido ao botão de avanço sem deslocar a página.');
  Assert.contains(helpHtml, 'event.stopImmediatePropagation()',
    'Interações bloqueadas não podem alcançar os controles do dashboard.');
  Assert.contains(helpHtml,
    "['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'contextmenu']",
    'Bloqueio deve abranger mouse, toque e menu de contexto.');
  Assert.contains(helpHtml, "if (event.key === 'Escape') return;",
    'Teclado deve ser bloqueado sem impedir a saída segura pelo Escape.');
  Assert.contains(helpHtml, 'isAllowedTutorialTarget',
    'Somente o alvo destacado e os controles da Ema devem permanecer interativos.');
  Assert.contains(helpHtml, 'redirectTutorialFocus',
    'Foco indevido deve retornar ao elemento esperado ou ao balão da Ema.');
  Assert.contains(helpHtml, 'deactivateInteractionLock',
    'Pausar ou encerrar um tutorial deve liberar a interface imediatamente.');
  Assert.contains(helpHtml, 'bindDragHandle',
    'Ema e cabeçalho do balão devem funcionar como alças de arraste.');
  Assert.contains(helpHtml, "this.bindDragHandle(this.els.launcher)",
    'A própria Ema deve poder ser arrastada.');
  Assert.contains(helpHtml,
    "this.bindDragHandle(this.els.bubble.querySelector('.ema-bubble-header'))",
    'O cabeçalho do balão também deve mover o conjunto.');
  Assert.contains(helpHtml, 'setPointerCapture',
    'Arraste deve funcionar de forma unificada com mouse, caneta e toque.');
  Assert.contains(helpHtml, "sessionStorage.setItem('EMA_HELP_POSITION_V10'",
    'Posição escolhida deve permanecer durante a sessão atual.');
  Assert.contains(helpHtml, 'if (this.userPositioned) return;',
    'Posicionamento manual deve prevalecer sobre o reposicionamento automático.');
  Assert.contains(helpHtml, "step.action === 'event'",
    'Motor deve reconhecer eventos de sucesso emitidos após operações assíncronas.');
  Assert.contains(helpHtml, 'step.satisfiedBy',
    'Motor deve reconhecer uma associação já concluída antes de abrir o passo.');
  Assert.contains(indexHtml, 'teacher-area-assignments-updated',
    'Gestão de áreas deve emitir um evento somente após atualizar as associações com sucesso.');
  Assert.contains(indexHtml, 'row.dataset.assignmentActive',
    'Tabela deve expor o estado real da associação para retomada do tutorial.');
  Assert.contains(helpHtml, 'showReportConfirmation',
    'Motor deve perguntar se o usuário já possui os relatórios.');
  Assert.contains(helpHtml, 'O sistema está sem os dados iniciais necessários para funcionar',
    'Base resetada deve receber apresentação e explicação antes da preparação.');
  Assert.contains(helpHtml, "if (!initialSetupRequired)",
    'Apresentação de base resetada não deve oferecer a saída comum Agora não.');
  Assert.contains(helpHtml, 'Iniciar preparação',
    'Apresentação deve anunciar claramente o início do tutorial de preparação.');
  Assert.contains(helpHtml, 'Sim, já possuo',
    'Confirmação positiva deve liberar a continuação da preparação.');
  Assert.contains(helpHtml, 'Ainda não',
    'Confirmação negativa deve manter a orientação antes de Gerenciar Base.');
  Assert.contains(helpHtml, 'Gere também Professor × Disciplina usando somente',
    'Orientação pausada deve repetir os parâmetros de Professor × Disciplina.');
  Assert.contains(helpHtml, 'Os dois relatórios do CRA devem corresponder ao mesmo ano',
    'Orientação pausada deve repetir a compatibilidade anual dos relatórios.');
  Assert.contains(helpHtml, 'Solicite o relatório de Docentes à CGP-UDI',
    'Orientação pausada deve repetir a origem do relatório de Docentes.');
  Assert.contains(helpHtml, 'dismissActiveTutorial',
    'Usuário cadastrado deve poder dispensar tutoriais não obrigatórios.');
  Assert.contains(compactHelpHtml, "tutorial.id !== 'base-preparation'",
    'Preparação de base não deve oferecer a ação de dispensa permanente.');
  Assert.contains(compactHelpHtml, "tutorial.id === 'base-preparation') return;",
    'Rotina de dispensa deve recusar explicitamente a preparação da base.');
  Assert.notContains(helpHtml, 'alert(',
    'Módulo não pode usar alertas intrusivos.');
  Assert.notContains(helpHtml, '.innerHTML',
    'Módulo deve construir mensagens com APIs seguras do DOM.');
}

function aggregateCourseClockHours_(records, factorKey) {
  return records.reduce(function(totals, record) {
    const course = String(record['CURSO'] || 'Curso não informado').trim();
    const form = String(record['FORMA'] || 'Forma não informada').trim();
    const courseKey = makeCourseFormKey_(course, form);
    const clockHours = getNumericField_(
      record,
      ['CARGA HORÁRIA', 'CARGA HORARIA', 'CH']
    );
    const factor = factorKey ? Number(record[factorKey]) : 1;

    totals[courseKey] = (totals[courseKey] || 0) + (clockHours * factor);
    return totals;
  }, {});
}

/**
 * Cria a mesma chave composta usada pelo frontend.
 *
 * @private
 * @param {string} course Nome do curso.
 * @param {string} form Forma do curso.
 * @returns {string} Chave serializada e sem ambiguidades de separador.
 */
function makeCourseFormKey_(course, form) {
  return JSON.stringify([String(course).trim(), String(form).trim()]);
}

/**
 * Soma um campo numérico, opcionalmente aplicando um fator do registro.
 *
 * @private
 * @param {Array<Object>} records Registros preparados.
 * @param {Array<string>} keys Chaves alternativas do campo.
 * @param {string|null} factorKey Chave do fator ou null para soma integral.
 * @returns {number} Soma calculada.
 */
function sumFieldWithFactor_(records, keys, factorKey) {
  return records.reduce(function(total, record) {
    const value = getNumericField_(record, keys);
    const factor = factorKey ? Number(record[factorKey]) : 1;

    return total + (value * factor);
  }, 0);
}

/**
 * Lê o primeiro campo numérico disponível.
 *
 * @private
 * @param {Object} record Registro avaliado.
 * @param {Array<string>} keys Chaves alternativas.
 * @returns {number} Valor encontrado ou zero.
 */
function getNumericField_(record, keys) {
  for (let index = 0; index < keys.length; index++) {
    const value = record[keys[index]];

    if (value !== null && value !== undefined && value !== '') {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : 0;
    }
  }

  return 0;
}
