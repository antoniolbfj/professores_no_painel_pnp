/**
 * @file AcademicAnalytics.gs
 * @fileoverview Cruzamento seguro entre DOCENTESXDISCIPLINA, ALUNOXCAMPUSX[ANO]
 * e DOCENTES. Nenhum identificador individual de aluno é devolvido ao frontend.
 * @version 10.0.9
 */

const AcademicAnalytics = {
  KEY_SEPARATOR: '\u001f',
  ELIGIBLE_STUDENT_MOVEMENTS: Object.freeze([
    'MATRICULADO',
    'TRANCADO',
    'MOBILIDADE',
    'PROVAVEL FORMANDO',
    'INTEGRALIZADA'
  ]),
  STUDENT_APPROXIMATION_EXPLANATION: 'A estimativa considera somente os alunos matriculados ou com vínculo ativo no PERÍODO acadêmico selecionado, nos movimentos Matriculado, Trancado, Mobilidade, Provável formando ou Integralizada. Esse total de FORMA, CURSO, PPC e PERÍODO é dividido entre as turmas regulares da mesma disciplina e do mesmo semestre. Nos cursos anuais, o semestre permanece vazio e as ofertas são distribuídas no regime anual. Eventuais excedentes são atribuídos às últimas turmas. Turmas especiais e de dependência não participam do cálculo.',

  /**
   * Carrega as bases auxiliares pelo DAO e enriquece os registros do dashboard.
   *
   * @param {Array<Object>} preparedRows Registros já preparados pelo Controller.
   * @returns {{rows:Array<Object>, professorIndicators:Object, diagnostics:Object}}
   */
  build: function(preparedRows) {
    return AcademicAnalytics.buildFromSources(
      preparedRows,
      Dao.extractStudentRowsByYear(),
      Dao.extractTeacherRegistry()
    );
  },

  /**
   * Implementação pura do cruzamento, adequada a testes unitários.
   *
   * @param {Array<Object>} preparedRows Registros de docentes por disciplina.
   * @param {Object<string, Array<Object>>} studentsByYear Alunos mínimos por ano.
   * @param {Array<Object>} teachers Cadastro mínimo de docentes.
   * @param {Object=} options Recorte opcional aplicado somente aos indicadores.
   * @returns {{rows:Array<Object>, professorIndicators:Object, diagnostics:Object}}
   */
  buildFromSources: function(preparedRows, studentsByYear, teachers, options) {
    const rows = Array.isArray(preparedRows) ? preparedRows : [];
    const studentSources = studentsByYear || {};
    const teacherRows = Array.isArray(teachers) ? teachers : [];
    const buildOptions = options && typeof options === 'object' ? options : {};
    const metricOfferingKeys = buildOptions.metricOfferingKeys || null;
    const metricProfessorKey = AcademicAnalytics.normalizeText(buildOptions.metricProfessorKey);
    const studentIndexResult = AcademicAnalytics._buildStudentIndex(studentSources);
    const teacherIndex = AcademicAnalytics._buildTeacherIndex(teacherRows);
    const accumulators = {};
    const diagnosticsByYear = {};
    let teacherMatchedRows = 0;

    const rowContexts = rows.map(function(row, sourceIndex) {
      const year = AcademicAnalytics.normalizeYear(row.ANO_LETIVO);
      const professorName = AcademicAnalytics._firstText(row, ['PROFESSOR', 'DOCENTE', 'NOME']);
      const professorKey = AcademicAnalytics.normalizeText(professorName);
      const groupValues = {
        form: AcademicAnalytics._firstText(row, ['FORMA']),
        course: AcademicAnalytics._firstText(row, ['CURSO']),
        ppc: AcademicAnalytics._firstText(row, ['PPC']),
        period: AcademicAnalytics._firstText(row, ['PERÍODO', 'PERIODO']),
        preferredClass: AcademicAnalytics._firstText(row, ['TURMA'])
      };
      const dependencyOffering = AcademicAnalytics.isDependencyClass(
        groupValues.preferredClass
      );
      const specialOffering = AcademicAnalytics.isSpecialClass(
        groupValues.preferredClass
      );
      const normalizedPreferredClass = AcademicAnalytics.normalizePreferredClass(
        groupValues.preferredClass
      );
      const discipline = AcademicAnalytics._firstText(row, ['DISCIPLINA']);
      const specialComponent = AcademicAnalytics.classifySpecialCurricularComponent(discipline);
      const groupKey = AcademicAnalytics.buildStudentGroupKey(
        groupValues.form,
        groupValues.course,
        groupValues.ppc,
        groupValues.period,
        normalizedPreferredClass
      );
      const offeringKey = AcademicAnalytics.buildOfferingKey(
        year,
        row.SEMESTRE_OFERTA,
        groupValues.form,
        groupValues.course,
        groupValues.ppc,
        discipline,
        groupValues.period,
        groupValues.preferredClass
      );
      return {
        row: row,
        sourceIndex: sourceIndex,
        year: year,
        semester: row.SEMESTRE_OFERTA,
        professorName: professorName,
        professorKey: professorKey,
        groupValues: groupValues,
        dependencyOffering: dependencyOffering,
        specialOffering: specialOffering,
        normalizedPreferredClass: normalizedPreferredClass,
        discipline: discipline,
        specialComponent: specialComponent,
        groupKey: groupKey,
        offeringKey: offeringKey,
        allocationKey: AcademicAnalytics.buildStudentAllocationKey(
          year,
          row.SEMESTRE_OFERTA,
          groupValues.form,
          groupValues.course,
          groupValues.ppc,
          groupValues.period,
          discipline
        )
      };
    });
    const allocationPlans = AcademicAnalytics._buildStudentAllocationPlans(
      rowContexts,
      studentIndexResult
    );

    const enrichedRows = rowContexts.map(function(context) {
      const row = context.row;
      const enriched = Object.assign({}, row);
      const year = context.year;
      const professorName = context.professorName;
      const professorKey = context.professorKey;
      const groupValues = context.groupValues;
      const dependencyOffering = context.dependencyOffering;
      const specialOffering = context.specialOffering;
      const nonRegularOffering = dependencyOffering || specialOffering;
      const normalizedPreferredClass = context.normalizedPreferredClass;
      const discipline = context.discipline;
      const specialComponent = context.specialComponent;
      const groupKey = context.groupKey;
      const offeringKey = context.offeringKey;
      const teacher = teacherIndex[professorKey] || null;
      const yearIndex = studentIndexResult.index[year] || null;
      const allocationPlan = allocationPlans[context.allocationKey] || null;
      const allocation = allocationPlan
        && allocationPlan.offerings[offeringKey]
        ? allocationPlan.offerings[offeringKey]
        : null;
      const association = dependencyOffering
        ? AcademicAnalytics._dependencyAssociation(groupValues, groupKey)
        : (specialOffering
          ? AcademicAnalytics._specialAssociation(groupValues, groupKey)
          : allocationPlan.association);
      const studentSet = allocation ? allocation.studentSet : null;
      const studentCount = allocation ? allocation.studentCount : null;

      enriched.CHAVE_GRUPO_ALUNOS = association.groupKey || groupKey;
      enriched.CHAVE_OFERTA_ANALITICA = offeringKey;
      enriched.GRUPO_COMPONENTE_ESPECIAL = specialComponent ? specialComponent.code : '';
      enriched.ROTULO_GRUPO_COMPONENTE_ESPECIAL = specialComponent
        ? specialComponent.label
        : '';
      enriched.NOME_COMPONENTE_NORMALIZADO = specialComponent
        ? specialComponent.normalizedName
        : AcademicAnalytics.normalizeCurricularComponentName(discipline);
      enriched.ALUNOS_GRUPO = studentCount;
      enriched.ALUNOS_CONTABILIZADOS = !nonRegularOffering;
      enriched.OFERTA_DEPENDENCIA_ALUNOS = dependencyOffering;
      enriched.OFERTA_ESPECIAL_ALUNOS = specialOffering;
      enriched.OFERTA_NAO_REGULAR_ALUNOS = nonRegularOffering;
      enriched.ALUNOS_APROXIMADOS = !nonRegularOffering && Boolean(allocation);
      enriched.METODOLOGIA_ALUNOS = dependencyOffering
        ? 'DEPENDENCIA_EXCLUIDA'
        : (specialOffering
          ? 'TURMA_ESPECIAL_EXCLUIDA'
          : (allocation ? 'DIVISAO_IGUAL_ENTRE_OFERTAS' : 'NAO_ASSOCIADA'));
      enriched.TOTAL_ALUNOS_GRUPO_ACADEMICO = allocationPlan
        ? allocationPlan.totalStudents
        : null;
      enriched.QUANTIDADE_OFERTAS_REGULARES_GRUPO = allocationPlan
        ? allocationPlan.offeringCount
        : 0;
      enriched.ORDEM_OFERTA_DISTRIBUICAO = allocation
        ? allocation.order
        : null;
      enriched.STATUS_ASSOCIACAO_ALUNOS = association.code;
      enriched.MOTIVO_ASSOCIACAO_ALUNOS = allocation
        ? association.message + ' ' + AcademicAnalytics._buildAllocationMessage(
          allocationPlan.totalStudents,
          allocationPlan.offeringCount
        )
        : association.message;
      enriched.ASSOCIACAO_POR_FALLBACK_PERIODO = association.code
        === 'LOCALIZADA_FALLBACK_PERIODO';
      enriched.PERIODO_SOLICITADO_ASSOCIACAO = association.requestedPeriod;
      enriched.PERIODO_UTILIZADO_ASSOCIACAO = association.usedPeriod;
      enriched.VALORES_NORMALIZADOS_ASSOCIACAO = {
        forma: AcademicAnalytics.normalizeText(groupValues.form),
        curso: AcademicAnalytics.normalizeText(groupValues.course),
        ppc: AcademicAnalytics.normalizeText(groupValues.ppc),
        periodo: AcademicAnalytics.normalizeText(groupValues.period),
        turma: normalizedPreferredClass,
        periodoUtilizado: association.usedPeriod
      };
      enriched.VINCULO_DOCENTE = teacher ? teacher.employmentType : 'NAO_IDENTIFICADO';
      enriched.MATRICULA_DOCENTE = teacher ? String(teacher.registration || '') : '';
      enriched.CARGO_DOCENTE = teacher ? String(teacher.jobTitle || '') : '';
      enriched.CODIGO_CARGA_HORARIA_DOCENTE = teacher
        ? String(teacher.workloadCode || '')
        : '';
      enriched.REGIME_TRABALHO_DOCENTE = teacher
        ? String(teacher.workRegimeCode || 'NAO_IDENTIFICADO')
        : 'NAO_IDENTIFICADO';
      enriched.ROTULO_REGIME_TRABALHO_DOCENTE = teacher
        ? String(teacher.workRegimeLabel || 'Regime não identificado')
        : 'Regime não identificado';
      enriched.CARGA_SEMANAL_CONTRATUAL_DOCENTE = teacher
        && teacher.weeklyContractHours !== null
        && teacher.weeklyContractHours !== ''
        && Number.isFinite(Number(teacher.weeklyContractHours))
        ? Number(teacher.weeklyContractHours)
        : null;
      enriched.JORNADA_REDUZIDA_DOCENTE = teacher
        ? teacher.reducedWorkload === true
        : false;
      enriched.FUNCAO_OFICIAL_DOCENTE = teacher
        ? String(teacher.officialFunction || '')
        : '';
      enriched.CONDICOES_DOCENTE = teacher
        ? AcademicAnalytics._filterConditionsForYear(
          teacher.conditions,
          year,
          row.SEMESTRE_OFERTA
        )
        : [];
      enriched.DEDICACAO_EXCLUSIVA_DOCENTE = teacher
        ? teacher.exclusiveDedication === true
        : false;
      enriched.REGIME_TRABALHO_IDENTIFICADO = teacher
        ? teacher.workRegimeIdentified === true
        : false;
      enriched.DOCENTE_ATIVO = teacher ? teacher.active !== false : true;
      enriched.MOTIVO_INATIVACAO_DOCENTE = teacher
        ? String(teacher.inactiveReason || '')
        : '';
      enriched.AREAS_DOCENTE = teacher
        ? AcademicAnalytics._filterAssignmentsForYear(
          teacher.areaAssignments,
          year,
          row.SEMESTRE_OFERTA
        )
        : [];

      if (teacher) teacherMatchedRows += 1;

      if (!diagnosticsByYear[year]) {
        diagnosticsByYear[year] = {
          year: year,
          disciplineRows: 0,
          matchedRows: 0,
          exactMatchedRows: 0,
          fallbackMatchedRows: 0,
          unmatchedRows: 0,
          excludedDependencyRows: 0,
          excludedSpecialRows: 0,
          excludedNonRegularRows: 0,
          studentsAvailable: Boolean(yearIndex),
          activeStudentRecords: studentIndexResult.activeRowsByYear[year] || 0,
          excludedStudentRecords: studentIndexResult.excludedRowsByYear[year] || 0,
          unmatchedGroups: {}
        };
      }

      const yearDiagnostic = diagnosticsByYear[year];
      yearDiagnostic.disciplineRows += 1;
      if (nonRegularOffering) {
        yearDiagnostic.excludedNonRegularRows += 1;
        if (dependencyOffering) yearDiagnostic.excludedDependencyRows += 1;
        if (specialOffering) yearDiagnostic.excludedSpecialRows += 1;
      } else if (studentSet) {
        yearDiagnostic.matchedRows += 1;
        if (association.code === 'LOCALIZADA_FALLBACK_PERIODO') {
          yearDiagnostic.fallbackMatchedRows += 1;
        } else {
          yearDiagnostic.exactMatchedRows += 1;
        }
      } else {
        yearDiagnostic.unmatchedRows += 1;
        yearDiagnostic.unmatchedGroups[groupKey] = true;
      }

      AcademicAnalytics._accumulateProfessorMetrics(
        accumulators,
        professorKey,
        professorName,
        enriched.VINCULO_DOCENTE,
        year,
        row.SEMESTRE_OFERTA,
        offeringKey,
        studentSet,
        !nonRegularOffering
          && (!metricOfferingKeys || metricOfferingKeys[offeringKey] === true)
          && (!metricProfessorKey || metricProfessorKey === professorKey)
      );

      return enriched;
    });

    const diagnostics = {
      byYear: {},
      teacherRegistryAvailable: teacherRows.length > 0,
      teacherRegistryCount: teacherRows.length,
      teacherMatchedRows: teacherMatchedRows,
      teacherUnmatchedRows: Math.max(rows.length - teacherMatchedRows, 0)
    };

    Object.keys(diagnosticsByYear).forEach(function(year) {
      const item = diagnosticsByYear[year];
      diagnostics.byYear[year] = {
        year: year,
        disciplineRows: item.disciplineRows,
        eligibleStudentRows: Math.max(
          item.disciplineRows - item.excludedNonRegularRows,
          0
        ),
        excludedDependencyRows: item.excludedDependencyRows,
        excludedSpecialRows: item.excludedSpecialRows,
        excludedNonRegularRows: item.excludedNonRegularRows,
        matchedRows: item.matchedRows,
        exactMatchedRows: item.exactMatchedRows,
        fallbackMatchedRows: item.fallbackMatchedRows,
        unmatchedRows: item.unmatchedRows,
        matchedPercent: item.disciplineRows - item.excludedNonRegularRows > 0
          ? (item.matchedRows / (item.disciplineRows - item.excludedNonRegularRows)) * 100
          : 0,
        studentsAvailable: item.studentsAvailable,
        activeStudentRecords: item.activeStudentRecords,
        excludedStudentRecords: item.excludedStudentRecords,
        unmatchedGroupCount: Object.keys(item.unmatchedGroups).length
      };
    });

    return {
      rows: enrichedRows,
      professorIndicators: AcademicAnalytics._finalizeProfessorIndicators(accumulators),
      diagnostics: diagnostics
    };
  },

  /**
   * Normaliza textos usados exclusivamente como chaves de associação.
   * Os valores exibidos ao usuário permanecem inalterados.
   *
   * @param {*} value Valor bruto.
   * @returns {string} Texto canônico.
   */
  normalizeText: function(value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  },

  /**
   * Normaliza o nome de um componente curricular para classificação controlada.
   * Pontuação, acentos e diferenças de caixa são eliminados; o valor original
   * permanece disponível para apresentação e auditoria.
   *
   * @param {*} value Nome bruto do componente.
   * @returns {string} Nome canônico.
   */
  normalizeCurricularComponentName: function(value) {
    return AcademicAnalytics.normalizeText(value)
      .replace(/[^A-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Classifica componentes cuja carga pode ser desconsiderada em simulações.
   * As regras são deliberadamente restritas para evitar que palavras isoladas
   * em disciplinas regulares provoquem falsos positivos.
   *
   * @param {*} disciplineName Nome original da disciplina.
   * @returns {{code:string,label:string,normalizedName:string,matchedBy:string}|null}
   */
  classifySpecialCurricularComponent: function(disciplineName) {
    const normalizedName = AcademicAnalytics.normalizeCurricularComponentName(
      disciplineName
    );
    if (!normalizedName) return null;

    const definitions = [
      {
        code: 'TCC',
        label: 'Trabalho de Conclusão de Curso',
        tests: [
          { rule: /^TCC(?:\s+(?:[0-9]+|I{1,3}|IV|V|VI{0,3}|IX|X))?(?:\s+.*)?$/, matchedBy: 'SIGLA_TCC' },
          { rule: /(?:^|\s)TRABALHO DE CONCLUSAO(?: DE CURSO)?(?:\s|$)/, matchedBy: 'NOME_TCC' }
        ]
      },
      {
        code: 'ESTAGIO_SUPERVISIONADO',
        label: 'Estágio Supervisionado',
        tests: [
          { rule: /^ESTAGIO(?:\s+(?:[0-9]+|I{1,3}|IV|V|VI{0,3}|IX|X))?$/, matchedBy: 'ESTAGIO_SIMPLES' },
          { rule: /^ESTAGIO (?:SUPERVISIONADO|CURRICULAR|OBRIGATORIO)(?:\s+(?:[0-9]+|I{1,3}|IV|V|VI{0,3}|IX|X))?(?:\s+.*)?$/, matchedBy: 'INICIO_ESTAGIO_QUALIFICADO' },
          { rule: /(?:^|\s)ESTAGIO SUPERVISIONADO(?:\s|$)/, matchedBy: 'NOME_ESTAGIO_SUPERVISIONADO' }
        ]
      },
      {
        code: 'ATIVIDADES_COMPLEMENTARES',
        label: 'Atividades Complementares',
        tests: [
          { rule: /^(?:ATIVIDADE COMPLEMENTAR|ATIVIDADES COMPLEMENTARES)(?:\s+(?:[0-9]+|I{1,3}|IV|V|VI{0,3}|IX|X))?(?:\s+.*)?$/, matchedBy: 'NOME_ATIVIDADES_COMPLEMENTARES' },
          { rule: /^ATIVIDADES ACADEMICO CIENTIFICO CULTURAIS(?:\s+.*)?$/, matchedBy: 'NOME_AACC_EXTENSO' },
          { rule: /^AACCS?(?:\s+(?:[0-9]+|I{1,3}|IV|V|VI{0,3}|IX|X))?$/, matchedBy: 'SIGLA_AACC' }
        ]
      }
    ];

    for (let definitionIndex = 0; definitionIndex < definitions.length; definitionIndex += 1) {
      const definition = definitions[definitionIndex];
      for (let testIndex = 0; testIndex < definition.tests.length; testIndex += 1) {
        const test = definition.tests[testIndex];
        if (test.rule.test(normalizedName)) {
          return {
            code: definition.code,
            label: definition.label,
            normalizedName: normalizedName,
            matchedBy: test.matchedBy
          };
        }
      }
    }

    return null;
  },

  /**
   * Normaliza um ano para uso em índices internos.
   *
   * @param {*} value Ano.
   * @returns {string} Ano textual ou vazio.
   */
  normalizeYear: function(value) {
    const text = String(value === null || value === undefined ? '' : value).trim();
    return /^\d{4}$/.test(text) ? text : text;
  },

  /**
   * Chave dos alunos, conforme regra confirmada pelo usuário.
   * Disciplina não existe na base de alunos e é acrescentada somente na chave da oferta.
   *
   * @param {*} form Forma/classificação.
   * @param {*} course Curso.
   * @param {*} ppc PPC.
   * @param {*} period Período curricular.
   * @param {*} preferredClass Turma preferencial canônica.
   * @returns {string} Chave canônica.
   */
  buildStudentGroupKey: function(form, course, ppc, period, preferredClass) {
    return [form, course, ppc, period, preferredClass]
      .map(AcademicAnalytics.normalizeText)
      .join(AcademicAnalytics.KEY_SEPARATOR);
  },

  /**
   * Chave acadêmica agregada, usada somente quando a oferta não informa turma.
   *
   * @param {*} form Forma.
   * @param {*} course Curso.
   * @param {*} ppc PPC.
   * @param {*} period Período curricular.
   * @returns {string} Chave canônica sem turma.
   */
  buildStudentAcademicKey: function(form, course, ppc, period) {
    return [form, course, ppc, period]
      .map(AcademicAnalytics.normalizeText)
      .join(AcademicAnalytics.KEY_SEPARATOR);
  },

  /**
   * Canoniza representações equivalentes, como 2E, 2º E e Turma E.
   * O período continua em campo próprio da chave.
   *
   * @param {*} value Turma bruta.
   * @returns {string} Código canônico da turma.
   */
  normalizePreferredClass: function(value) {
    const withoutLabels = AcademicAnalytics.normalizeText(value)
      .replace(/\b(?:TURMA|PREFERENCIAL|PERIODO|ANO|SERIE)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const compact = withoutLabels.replace(/[^A-Z0-9]+/g, '');
    if (!compact) return '';
    const alphabeticSuffix = compact.match(/([A-Z]+)$/);
    return alphabeticSuffix ? alphabeticSuffix[1] : compact;
  },

  /**
   * Identifica ofertas de dependência exclusivamente pelo campo TURMA.
   *
   * @param {*} value Turma bruta da oferta.
   * @returns {boolean} Verdadeiro para DEP/DEPENDÊNCIA.
   */
  isDependencyClass: function(value) {
    const normalized = AcademicAnalytics.normalizeText(value)
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
    if (!normalized) return false;
    return normalized.split(/\s+/).some(function(token) {
      return token === 'DEP' || /^DEPENDENCIAS?$/.test(token);
    });
  },

  /**
   * Identifica turmas especiais, que preservam a carga horária mas não
   * representam uma turma regular para estimar alunos atendidos.
   *
   * @param {*} value Turma bruta da oferta.
   * @returns {boolean} Verdadeiro para ESPECIAL/ESPECIAIS.
   */
  isSpecialClass: function(value) {
    const normalized = AcademicAnalytics.normalizeText(value)
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
    if (!normalized) return false;
    return normalized.split(/\s+/).some(function(token) {
      return token === 'ESPECIAL' || token === 'ESPECIAIS';
    });
  },

  /**
   * Chave lógica da oferta: ano + semestre + grupo + disciplina + turma.
   * O ano é prefixado apenas para impedir colisões entre fotografias históricas.
   *
   * @param {*} year Ano.
   * @param {*} semester Semestre; vazio identifica a oferta anual única.
   * @param {*} form Forma.
   * @param {*} course Curso.
   * @param {*} ppc PPC.
   * @param {*} discipline Disciplina.
   * @param {*} period Período curricular.
   * @param {*} turma Turma da oferta.
   * @returns {string} Chave canônica.
   */
  buildOfferingKey: function(year, semester, form, course, ppc, discipline, period, turma) {
    return [year, semester, form, course, ppc, discipline, period, turma]
      .map(AcademicAnalytics.normalizeText)
      .join(AcademicAnalytics.KEY_SEPARATOR);
  },

  /**
   * Chave do conjunto cujos alunos serão distribuídos entre ofertas regulares.
   * TURMA não participa, pois identifica cada oferta receptora. SEMESTRE participa
   * para impedir que ofertas do primeiro e do segundo semestre dividam o mesmo
   * conjunto de alunos. O valor vazio preserva o agrupamento dos cursos anuais.
   *
   * @returns {string} Chave canônica da distribuição.
   */
  buildStudentAllocationKey: function(year, semester, form, course, ppc, period, discipline) {
    return [year, semester, form, course, ppc, period, discipline]
      .map(AcademicAnalytics.normalizeText)
      .join(AcademicAnalytics.KEY_SEPARATOR);
  },

  /** @private */
  _buildStudentAllocationPlans: function(contexts, studentIndexResult) {
    const plans = {};
    (Array.isArray(contexts) ? contexts : []).forEach(function(context) {
      if (context.dependencyOffering || context.specialOffering) return;
      if (!plans[context.allocationKey]) {
        plans[context.allocationKey] = {
          year: context.year,
          groupValues: context.groupValues,
          requestedAcademicKey: AcademicAnalytics.buildStudentAcademicKey(
            context.groupValues.form,
            context.groupValues.course,
            context.groupValues.ppc,
            context.groupValues.period
          ),
          offeringContexts: {},
          offerings: {},
          association: null,
          totalStudents: null,
          offeringCount: 0
        };
      }
      const plan = plans[context.allocationKey];
      if (!plan.offeringContexts[context.offeringKey]) {
        plan.offeringContexts[context.offeringKey] = context;
      }
    });

    Object.keys(plans).forEach(function(allocationKey) {
      const plan = plans[allocationKey];
      const year = plan.year;
      const association = AcademicAnalytics._resolveAggregateStudentAssociation(
        Boolean(studentIndexResult.aggregateIndex[year]),
        studentIndexResult.aggregateIndex[year] || null,
        studentIndexResult.groupsByYear[year] || [],
        plan.groupValues,
        plan.requestedAcademicKey
      );
      const orderedContexts = Object.keys(plan.offeringContexts)
        .map(function(key) { return plan.offeringContexts[key]; })
        .sort(AcademicAnalytics._compareAllocationOfferings);
      plan.association = association;
      plan.offeringCount = orderedContexts.length;
      plan.totalStudents = association.studentSet ? association.studentSet.size : null;

      if (!association.studentSet || orderedContexts.length === 0) return;
      const studentIds = Array.from(association.studentSet).sort();
      const baseCount = Math.floor(studentIds.length / orderedContexts.length);
      const remainder = studentIds.length % orderedContexts.length;
      const firstRemainderIndex = orderedContexts.length - remainder;
      let offset = 0;
      orderedContexts.forEach(function(context, index) {
        const studentCount = baseCount + (remainder > 0 && index >= firstRemainderIndex ? 1 : 0);
        const allocatedIds = studentIds.slice(offset, offset + studentCount);
        offset += studentCount;
        plan.offerings[context.offeringKey] = {
          studentSet: new Set(allocatedIds),
          studentCount: studentCount,
          order: index + 1
        };
      });
    });

    return plans;
  },

  /** @private */
  _compareAllocationOfferings: function(first, second) {
    const firstClass = AcademicAnalytics.normalizePreferredClass(
      first && first.groupValues ? first.groupValues.preferredClass : ''
    );
    const secondClass = AcademicAnalytics.normalizePreferredClass(
      second && second.groupValues ? second.groupValues.preferredClass : ''
    );
    if (firstClass !== secondClass) return firstClass < secondClass ? -1 : 1;
    const firstSemester = AcademicAnalytics.normalizeText(first ? first.semester : '');
    const secondSemester = AcademicAnalytics.normalizeText(second ? second.semester : '');
    if (firstSemester !== secondSemester) return firstSemester < secondSemester ? -1 : 1;
    return Number(first && first.sourceIndex || 0) - Number(second && second.sourceIndex || 0);
  },

  /** @private */
  _buildAllocationMessage: function(totalStudents, offeringCount) {
    return 'O total de ' + Number(totalStudents || 0) + ' aluno(s) elegível(is) foi dividido entre '
      + Number(offeringCount || 0) + ' oferta(s) regular(es) do mesmo semestre ou regime anual; '
      + 'os excedentes foram atribuídos às últimas turmas.';
  },

  /** @private */
  _buildStudentIndex: function(studentsByYear) {
    const index = {};
    const aggregateIndex = {};
    const activeRowsByYear = {};
    const excludedRowsByYear = {};
    const groupsByYear = {};

    Object.keys(studentsByYear || {}).forEach(function(year) {
      const rows = Array.isArray(studentsByYear[year]) ? studentsByYear[year] : [];
      index[year] = {};
      aggregateIndex[year] = {};
      activeRowsByYear[year] = 0;
      excludedRowsByYear[year] = 0;
      groupsByYear[year] = {};

      rows.forEach(function(student) {
        const studentKey = AcademicAnalytics.normalizeText(student.studentKey);
        if (!studentKey) {
          excludedRowsByYear[year] += 1;
          return;
        }

        const preferredClass = AcademicAnalytics.normalizePreferredClass(
          student.preferredClass
        );
        const groupKey = AcademicAnalytics.buildStudentGroupKey(
          student.form,
          student.course,
          student.ppc,
          student.period,
          preferredClass
        );
        const academicKey = AcademicAnalytics.buildStudentAcademicKey(
          student.form,
          student.course,
          student.ppc,
          student.period
        );
        if (!index[year][groupKey]) index[year][groupKey] = new Set();
        if (!aggregateIndex[year][academicKey]) aggregateIndex[year][academicKey] = new Set();
        if (!groupsByYear[year][groupKey]) {
          groupsByYear[year][groupKey] = {
            key: groupKey,
            form: AcademicAnalytics.normalizeText(student.form),
            course: AcademicAnalytics.normalizeText(student.course),
            ppc: AcademicAnalytics.normalizeText(student.ppc),
            period: AcademicAnalytics.normalizeText(student.period),
            preferredClass: preferredClass
          };
        }
        if (!AcademicAnalytics._isActiveStudent(student)) {
          excludedRowsByYear[year] += 1;
          return;
        }

        index[year][groupKey].add(studentKey);
        aggregateIndex[year][academicKey].add(studentKey);
        activeRowsByYear[year] += 1;
      });
    });

    const groupListsByYear = {};
    Object.keys(groupsByYear).forEach(function(year) {
      groupListsByYear[year] = Object.keys(groupsByYear[year]).map(function(key) {
        return groupsByYear[year][key];
      });
    });

    return {
      index: index,
      aggregateIndex: aggregateIndex,
      groupsByYear: groupListsByYear,
      activeRowsByYear: activeRowsByYear,
      excludedRowsByYear: excludedRowsByYear
    };
  },

  /**
   * Resolve a associação exata ou, quando somente o período diverge, usa o
   * maior período numérico disponível para a mesma FORMA + CURSO + PPC.
   *
   * @param {boolean} baseAvailable Existência da base anual.
   * @param {Object<string, Set<string>>|null} yearIndex Índice anual por turma.
   * @param {Object<string, Set<string>>|null} yearAggregateIndex Índice anual agregado.
   * @param {Array<Object>} availableGroups Grupos disponíveis.
   * @param {Object} rawValues Valores da oferta docente.
   * @param {string} requestedGroupKey Chave exata solicitada.
   * @returns {{studentSet:Set<string>|null,groupKey:string,code:string,message:string,requestedPeriod:string,usedPeriod:string}}
   * @private
   */
  _resolveStudentAssociation: function(
    baseAvailable,
    yearIndex,
    yearAggregateIndex,
    availableGroups,
    rawValues,
    requestedGroupKey
  ) {
    const requestedPeriod = AcademicAnalytics.normalizeText(rawValues.period);
    const requestedClass = AcademicAnalytics.normalizePreferredClass(
      rawValues.preferredClass
    );
    const academicKey = AcademicAnalytics.buildStudentAcademicKey(
      rawValues.form,
      rawValues.course,
      rawValues.ppc,
      rawValues.period
    );
    const exactStudentSet = requestedClass
      ? (yearIndex && yearIndex[requestedGroupKey])
      : (yearAggregateIndex && yearAggregateIndex[academicKey]);
    if (baseAvailable && exactStudentSet) {
      return {
        studentSet: exactStudentSet,
        groupKey: requestedClass ? requestedGroupKey : academicKey,
        code: 'LOCALIZADA',
        message: requestedClass
          ? 'Associação exata localizada pela turma preferencial na base anual de alunos.'
          : 'Associação exata localizada na base anual de alunos.',
        requestedPeriod: requestedPeriod,
        usedPeriod: requestedPeriod
      };
    }

    const values = {
      form: AcademicAnalytics.normalizeText(rawValues.form),
      course: AcademicAnalytics.normalizeText(rawValues.course),
      ppc: AcademicAnalytics.normalizeText(rawValues.ppc),
      period: requestedPeriod,
      preferredClass: requestedClass
    };
    const hasCompleteBaseKey = values.form && values.course && values.ppc && values.period;
    if (baseAvailable && yearIndex && hasCompleteBaseKey) {
      const ppcMatches = (Array.isArray(availableGroups) ? availableGroups : [])
        .filter(function(group) {
          return group.form === values.form
            && group.course === values.course
            && group.ppc === values.ppc
            && (!values.preferredClass || group.preferredClass === values.preferredClass);
        });
      const fallbackGroup = AcademicAnalytics._selectLargestNumericPeriodGroup(ppcMatches);
      const fallbackAcademicKey = fallbackGroup
        ? AcademicAnalytics.buildStudentAcademicKey(
          fallbackGroup.form,
          fallbackGroup.course,
          fallbackGroup.ppc,
          fallbackGroup.period
        )
        : '';
      const fallbackStudentSet = fallbackGroup
        ? (values.preferredClass
          ? yearIndex[fallbackGroup.key]
          : yearAggregateIndex[fallbackAcademicKey])
        : null;
      if (fallbackGroup && fallbackStudentSet) {
        return {
          studentSet: fallbackStudentSet,
          groupKey: values.preferredClass ? fallbackGroup.key : fallbackAcademicKey,
          code: 'LOCALIZADA_FALLBACK_PERIODO',
          message: 'O PERÍODO ' + values.period
            + ' não foi encontrado em ALUNOXCAMPUS. A associação foi realizada com o maior período disponível para a mesma FORMA + CURSO + PPC: '
            + fallbackGroup.period
            + (values.preferredClass ? ', turma ' + values.preferredClass : '') + '.',
          requestedPeriod: values.period,
          usedPeriod: fallbackGroup.period
        };
      }
    }

    const diagnosis = AcademicAnalytics._diagnoseUnmatchedGroup(
      baseAvailable,
      availableGroups,
      rawValues
    );
    return {
      studentSet: null,
      groupKey: requestedGroupKey,
      code: diagnosis.code,
      message: diagnosis.message,
      requestedPeriod: requestedPeriod,
      usedPeriod: ''
    };
  },

  /**
   * Localiza o total elegível de FORMA + CURSO + PPC + PERÍODO sem usar TURMA.
   * A turma é considerada somente depois, na divisão inteira entre as ofertas.
   *
   * @private
   */
  _resolveAggregateStudentAssociation: function(
    baseAvailable,
    yearAggregateIndex,
    availableGroups,
    rawValues,
    requestedAcademicKey
  ) {
    const requestedPeriod = AcademicAnalytics.normalizeText(rawValues.period);
    const exactStudentSet = yearAggregateIndex
      && yearAggregateIndex[requestedAcademicKey];
    if (baseAvailable && exactStudentSet) {
      return {
        studentSet: exactStudentSet,
        groupKey: requestedAcademicKey,
        code: 'LOCALIZADA',
        message: 'Associação localizada por FORMA + CURSO + PPC + PERÍODO na base anual de alunos.',
        requestedPeriod: requestedPeriod,
        usedPeriod: requestedPeriod
      };
    }

    const values = {
      form: AcademicAnalytics.normalizeText(rawValues.form),
      course: AcademicAnalytics.normalizeText(rawValues.course),
      ppc: AcademicAnalytics.normalizeText(rawValues.ppc),
      period: requestedPeriod
    };
    const hasCompleteBaseKey = values.form && values.course && values.ppc && values.period;
    if (baseAvailable && yearAggregateIndex && hasCompleteBaseKey) {
      const ppcMatches = (Array.isArray(availableGroups) ? availableGroups : [])
        .filter(function(group) {
          return group.form === values.form
            && group.course === values.course
            && group.ppc === values.ppc;
        });
      const fallbackGroup = AcademicAnalytics._selectLargestNumericPeriodGroup(ppcMatches);
      const fallbackAcademicKey = fallbackGroup
        ? AcademicAnalytics.buildStudentAcademicKey(
          fallbackGroup.form,
          fallbackGroup.course,
          fallbackGroup.ppc,
          fallbackGroup.period
        )
        : '';
      const fallbackStudentSet = fallbackAcademicKey
        ? yearAggregateIndex[fallbackAcademicKey]
        : null;
      if (fallbackGroup && fallbackStudentSet) {
        return {
          studentSet: fallbackStudentSet,
          groupKey: fallbackAcademicKey,
          code: 'LOCALIZADA_FALLBACK_PERIODO',
          message: 'O PERÍODO ' + values.period
            + ' não foi encontrado em ALUNOXCAMPUS. A associação agregada usou o maior período disponível para a mesma FORMA + CURSO + PPC: '
            + fallbackGroup.period + '.',
          requestedPeriod: values.period,
          usedPeriod: fallbackGroup.period
        };
      }
    }

    const diagnosisValues = Object.assign({}, rawValues, { preferredClass: '' });
    const diagnosis = AcademicAnalytics._diagnoseUnmatchedGroup(
      baseAvailable,
      availableGroups,
      diagnosisValues
    );
    return {
      studentSet: null,
      groupKey: requestedAcademicKey,
      code: diagnosis.code,
      message: diagnosis.message,
      requestedPeriod: requestedPeriod,
      usedPeriod: ''
    };
  },

  /** @private */
  _dependencyAssociation: function(rawValues, requestedGroupKey) {
    const requestedPeriod = AcademicAnalytics.normalizeText(rawValues.period);
    return {
      studentSet: null,
      groupKey: requestedGroupKey,
      code: 'EXCLUIDA_DEPENDENCIA',
      message: 'Oferta de dependência: a carga horária é contabilizada, mas a oferta não participa dos indicadores de alunos.',
      requestedPeriod: requestedPeriod,
      usedPeriod: ''
    };
  },

  /** @private */
  _specialAssociation: function(rawValues, requestedGroupKey) {
    const requestedPeriod = AcademicAnalytics.normalizeText(rawValues.period);
    return {
      studentSet: null,
      groupKey: requestedGroupKey,
      code: 'EXCLUIDA_TURMA_ESPECIAL',
      message: 'Turma especial: a carga horária é contabilizada, mas a oferta não participa dos indicadores de alunos.',
      requestedPeriod: requestedPeriod,
      usedPeriod: ''
    };
  },

  /**
   * Seleciona o grupo com o maior período estritamente numérico.
   * Valores não numéricos não são usados como fallback silencioso.
   *
   * @param {Array<Object>} groups Grupos da mesma FORMA + CURSO + PPC.
   * @returns {Object|null} Grupo selecionado ou null.
   * @private
   */
  _selectLargestNumericPeriodGroup: function(groups) {
    let selected = null;
    let selectedValue = -Infinity;
    (Array.isArray(groups) ? groups : []).forEach(function(group) {
      const text = String(group.period || '').trim().replace(',', '.');
      if (!/^\d+(?:\.\d+)?$/.test(text)) return;
      const numeric = Number(text);
      if (!Number.isFinite(numeric) || numeric <= selectedValue) return;
      selected = group;
      selectedValue = numeric;
    });
    return selected;
  },

  /**
   * Explica por que uma oferta não encontrou alunos, sem inferir correspondências.
   * A análise é hierárquica e usa os mesmos valores normalizados da chave oficial.
   *
   * @param {boolean} baseAvailable Existência da base anual de alunos.
   * @param {Array<Object>} availableGroups Grupos acadêmicos existentes no ano.
   * @param {Object} rawValues Valores da oferta docente.
   * @returns {{code:string, message:string}} Diagnóstico seguro.
   * @private
   */
  _diagnoseUnmatchedGroup: function(baseAvailable, availableGroups, rawValues) {
    if (!baseAvailable) {
      return {
        code: 'BASE_ALUNOS_AUSENTE',
        message: 'A base anual ALUNOXCAMPUS não está disponível.'
      };
    }

    const values = {
      form: AcademicAnalytics.normalizeText(rawValues.form),
      course: AcademicAnalytics.normalizeText(rawValues.course),
      ppc: AcademicAnalytics.normalizeText(rawValues.ppc),
      period: AcademicAnalytics.normalizeText(rawValues.period),
      preferredClass: AcademicAnalytics.normalizePreferredClass(rawValues.preferredClass)
    };
    const missing = [];
    if (!values.form) missing.push('FORMA');
    if (!values.course) missing.push('CURSO');
    if (!values.ppc) missing.push('PPC');
    if (!values.period) missing.push('PERÍODO');
    if (missing.length > 0) {
      return {
        code: 'CAMPOS_CHAVE_AUSENTES',
        message: 'Campos necessários sem valor: ' + missing.join(', ') + '.'
      };
    }

    const groups = Array.isArray(availableGroups) ? availableGroups : [];
    const formMatches = groups.filter(function(group) { return group.form === values.form; });
    if (formMatches.length === 0) {
      return {
        code: 'FORMA_NAO_LOCALIZADA',
        message: 'A FORMA não foi encontrada na base anual de alunos.'
      };
    }

    const courseMatches = formMatches.filter(function(group) {
      return group.course === values.course;
    });
    if (courseMatches.length === 0) {
      return {
        code: 'CURSO_NAO_LOCALIZADO',
        message: 'O CURSO não foi encontrado para a FORMA informada.'
      };
    }

    const ppcMatches = courseMatches.filter(function(group) { return group.ppc === values.ppc; });
    if (ppcMatches.length === 0) {
      return {
        code: 'PPC_NAO_LOCALIZADO',
        message: 'O PPC não foi encontrado para a combinação FORMA + CURSO.'
      };
    }

    const periodMatches = ppcMatches.filter(function(group) {
      return group.period === values.period;
    });
    if (periodMatches.length === 0) {
      const availablePeriods = AcademicAnalytics._uniqueTexts(
        ppcMatches.map(function(group) { return group.period; })
      );
      return {
        code: 'PERIODO_NAO_LOCALIZADO',
        message: 'O PERÍODO não foi encontrado para FORMA + CURSO + PPC.'
          + (availablePeriods.length > 0
            ? ' Períodos disponíveis: ' + availablePeriods.slice(0, 8).join(', ') + '.'
            : '')
      };
    }

    if (values.preferredClass) {
      const classMatches = periodMatches.filter(function(group) {
        return group.preferredClass === values.preferredClass;
      });
      if (classMatches.length === 0) {
        return {
          code: 'TURMA_PREFERENCIAL_NAO_LOCALIZADA',
          message: 'A TURMA da oferta não encontrou a mesma TURMA PREFERENCIAL na base anual de alunos.'
        };
      }
    }

    return {
      code: 'GRUPO_NAO_LOCALIZADO',
      message: 'A combinação completa FORMA + CURSO + PPC + PERÍODO + TURMA PREFERENCIAL não foi localizada.'
    };
  },

  /** @private */
  _uniqueTexts: function(values) {
    const seen = {};
    return (values || []).filter(function(value) {
      const text = String(value || '').trim();
      if (!text || seen[text]) return false;
      seen[text] = true;
      return true;
    });
  },

  /** @private */
  _isActiveStudent: function(student) {
    const current = AcademicAnalytics.normalizeText(student.currentMovement);
    const period = AcademicAnalytics.normalizeText(student.periodMovement);
    const eligible = AcademicAnalytics.ELIGIBLE_STUDENT_MOVEMENTS;
    return eligible.indexOf(current) >= 0 && eligible.indexOf(period) >= 0;
  },

  /** @private */
  _buildTeacherIndex: function(teachers) {
    const index = {};
    teachers.forEach(function(teacher) {
      const key = AcademicAnalytics.normalizeText(teacher.name);
      if (!key) return;
      const weeklyContractHours = teacher.weeklyContractHours !== null
        && teacher.weeklyContractHours !== ''
        && Number.isFinite(Number(teacher.weeklyContractHours))
        ? Number(teacher.weeklyContractHours)
        : null;
      index[key] = {
        name: teacher.name,
        registration: teacher.registration,
        employmentType: teacher.employmentType || 'NAO_IDENTIFICADO',
        jobTitle: String(teacher.jobTitle || ''),
        workloadCode: teacher.workloadCode === null
          || teacher.workloadCode === undefined
          ? ''
          : String(teacher.workloadCode).trim(),
        workRegimeCode: teacher.workRegimeCode || 'NAO_IDENTIFICADO',
        workRegimeLabel: teacher.workRegimeLabel || 'Regime não identificado',
        weeklyContractHours: weeklyContractHours,
        reducedWorkload: teacher.reducedWorkload === true,
        officialFunction: String(teacher.officialFunction || ''),
        conditions: Array.isArray(teacher.conditions)
          ? teacher.conditions.slice()
          : [],
        exclusiveDedication: teacher.exclusiveDedication === true,
        workRegimeIdentified: teacher.workRegimeIdentified === true,
        active: teacher.active !== false,
        inactiveReason: teacher.inactiveReason || '',
        areaAssignments: Array.isArray(teacher.areaAssignments)
          ? teacher.areaAssignments.slice()
          : []
      };
    });
    return index;
  },

  /**
   * Filtra as associações válidas no período da linha docente.
   * A ausência de áreas é um estado válido e sempre retorna uma lista vazia.
   *
   * @param {Array<Object>} assignments Associações do docente.
   * @param {string} year Ano do registro.
   * @param {string=} semester Semestre; vazio representa oferta anual.
   * @returns {Array<Object>} Associações aplicáveis.
   * @private
   */
  _filterAssignmentsForYear: function(assignments, year, semester) {
    return (Array.isArray(assignments) ? assignments : []).filter(function(assignment) {
      if (typeof TeacherAreasService !== 'undefined') {
        return TeacherAreasService.assignmentAppliesToYear(assignment, year, semester);
      }
      const normalizedYear = String(year || '').trim();
      const start = String(assignment.startYear || '').trim();
      const end = String(assignment.endYear || '').trim();
      if (start && Number(normalizedYear) < Number(start)) return false;
      if (end && Number(normalizedYear) > Number(end)) return false;
      const endSemester = String(assignment.endSemester || '').trim();
      const rowSemester = String(semester || '').trim();
      if (end && normalizedYear === end && endSemester && rowSemester
          && Number(rowSemester) > Number(endSemester)) return false;
      return assignment.active !== false || Boolean(end);
    }).map(function(assignment) {
      return Object.assign({}, assignment);
    });
  },

  /**
   * Filtra condições administrativas ativas no período acadêmico da linha.
   * A regra é delegada ao módulo persistente para manter ano e semestre
   * consistentes no dashboard e nos relatórios.
   *
   * @param {Array<Object>} conditions Condições cadastradas.
   * @param {string} year Ano do registro.
   * @param {string=} semester Semestre ou vazio para oferta anual.
   * @returns {Array<Object>} Condições vigentes.
   * @private
   */
  _filterConditionsForYear: function(conditions, year, semester) {
    const source = Array.isArray(conditions) ? conditions : [];
    if (typeof TeacherConditionsService !== 'undefined') {
      return TeacherConditionsService.filterForPeriod(source, year, semester);
    }
    return source.filter(function(condition) { return condition.active !== false; });
  },

  /** @private */
  _createMetricAccumulator: function() {
    return {
      studentIds: new Set(),
      matchedOfferings: {},
      unmatchedOfferings: {}
    };
  },

  /** @private */
  _ensureProfessorAccumulator: function(accumulators, key, name, employmentType) {
    if (!accumulators[key]) {
      accumulators[key] = {
        name: name,
        employmentType: employmentType,
        years: {},
        allYears: AcademicAnalytics._createMetricAccumulator()
      };
    }
    if (accumulators[key].employmentType === 'NAO_IDENTIFICADO'
        && employmentType !== 'NAO_IDENTIFICADO') {
      accumulators[key].employmentType = employmentType;
    }
    return accumulators[key];
  },

  /** @private */
  _ensureYearScopes: function(professor, year) {
    if (!professor.years[year]) {
      professor.years[year] = {
        ALL: AcademicAnalytics._createMetricAccumulator(),
        '1': AcademicAnalytics._createMetricAccumulator(),
        '2': AcademicAnalytics._createMetricAccumulator()
      };
    }
    return professor.years[year];
  },

  /** @private */
  _accumulateProfessorMetrics: function(
    accumulators,
    professorKey,
    professorName,
    employmentType,
    year,
    semester,
    offeringKey,
    studentSet,
    studentMetricEligible
  ) {
    if (!professorKey || studentMetricEligible === false) return;
    const professor = AcademicAnalytics._ensureProfessorAccumulator(
      accumulators,
      professorKey,
      professorName,
      employmentType
    );
    const yearScopes = AcademicAnalytics._ensureYearScopes(professor, year);
    const normalizedSemester = String(semester || '').trim();
    const scopes = ['ALL'];
    if (normalizedSemester === '1' || normalizedSemester === '2') {
      scopes.push(normalizedSemester);
    } else {
      scopes.push('1', '2');
    }

    scopes.forEach(function(scope) {
      AcademicAnalytics._addOfferingToAccumulator(
        yearScopes[scope],
        year,
        offeringKey,
        studentSet
      );
    });

    AcademicAnalytics._addOfferingToAccumulator(
      professor.allYears,
      year,
      offeringKey,
      studentSet
    );
  },

  /** @private */
  _addOfferingToAccumulator: function(accumulator, year, offeringKey, studentSet) {
    if (!studentSet) {
      accumulator.unmatchedOfferings[offeringKey] = true;
      return;
    }

    if (!accumulator.matchedOfferings[offeringKey]) {
      accumulator.matchedOfferings[offeringKey] = studentSet.size;
    }
    studentSet.forEach(function(studentId) {
      accumulator.studentIds.add(String(year) + AcademicAnalytics.KEY_SEPARATOR + studentId);
    });
  },

  /** @private */
  _finalizeMetric: function(accumulator) {
    const matchedKeys = Object.keys(accumulator.matchedOfferings);
    const unmatchedCount = Object.keys(accumulator.unmatchedOfferings).length;
    const counts = matchedKeys.map(function(key) {
      return Number(accumulator.matchedOfferings[key]) || 0;
    });
    const sum = counts.reduce(function(total, value) { return total + value; }, 0);

    return {
      uniqueStudents: accumulator.studentIds.size,
      matchedOfferings: matchedKeys.length,
      unmatchedOfferings: unmatchedCount,
      totalOfferings: matchedKeys.length + unmatchedCount,
      averageStudentsPerOffering: counts.length > 0 ? sum / counts.length : null,
      minimumStudentsPerOffering: counts.length > 0 ? Math.min.apply(null, counts) : null,
      maximumStudentsPerOffering: counts.length > 0 ? Math.max.apply(null, counts) : null,
      coveragePercent: matchedKeys.length + unmatchedCount > 0
        ? (matchedKeys.length / (matchedKeys.length + unmatchedCount)) * 100
        : 0,
      available: counts.length > 0
    };
  },

  /** @private */
  _finalizeProfessorIndicators: function(accumulators) {
    const result = {};
    Object.keys(accumulators).forEach(function(key) {
      const professor = accumulators[key];
      const years = {};
      Object.keys(professor.years).forEach(function(year) {
        years[year] = {
          ALL: AcademicAnalytics._finalizeMetric(professor.years[year].ALL),
          '1': AcademicAnalytics._finalizeMetric(professor.years[year]['1']),
          '2': AcademicAnalytics._finalizeMetric(professor.years[year]['2'])
        };
      });
      result[key] = {
        name: professor.name,
        employmentType: professor.employmentType,
        years: years,
        allYears: AcademicAnalytics._finalizeMetric(professor.allYears)
      };
    });
    return result;
  },

  /** @private */
  _firstText: function(row, keys) {
    for (let index = 0; index < keys.length; index += 1) {
      const value = row[keys[index]];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return value;
      }
    }
    return '';
  }
};
