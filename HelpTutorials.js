/**
 * @file HelpTutorials.gs
 * @fileoverview Catálogo declarativo de tutoriais e dicas contextuais da Ema.
 * @version 10.0.9
 *
 * O catálogo não acessa DOM, planilhas ou preferências. Essa separação mantém
 * o conteúdo revisável e permite validar todos os seletores em testes de
 * contrato antes de publicar uma nova versão.
 */

const HELP_TUTORIAL_CATALOG_VERSION = '10.0.9';

const HelpReleaseNotesCatalog = Object.freeze({
  version: HELP_TUTORIAL_CATALOG_VERSION,
  title: 'Novidades da versão ' + HELP_TUTORIAL_CATALOG_VERSION,
  summary: 'Veja o que mudou no Dashboard de Carga Horária Docente.',
  items: Object.freeze([
    Object.freeze({
      title: 'Condições especiais dos docentes',
      description: 'Administradores podem confirmar funções, jornadas reduzidas e outras justificativas sem alterar o espelho importado do relatório DOCENTES.',
      permission: 'manageTeachers',
      audiences: Object.freeze(['ADMINISTRADOR', 'SUPER_USUARIO'])
    }),
    Object.freeze({
      title: 'Abaixo do Mínimo Justificado',
      description: 'Docentes abaixo da referência geral com condição confirmada formam uma situação distinta, com motivo visível na tabela, nas áreas e nos relatórios.',
      audiences: Object.freeze([
        'PUBLICO_INSTITUCIONAL', 'ADMINISTRADOR', 'SUPER_USUARIO'
      ])
    }),
    Object.freeze({
      title: 'Simulação com docentes justificados',
      description: 'Um novo controle permite incluir ou separar os docentes justificados dos totais de situação, preservando sempre suas horas e o impacto real em todas as áreas vinculadas.',
      audiences: Object.freeze([
        'PUBLICO_INSTITUCIONAL', 'ADMINISTRADOR', 'SUPER_USUARIO'
      ])
    }),
    Object.freeze({
      title: 'Fundamento normativo ampliado',
      description: 'A consulta normativa agora reúne a Portaria MEC nº 750/2024 e os parâmetros de funções e reduções previstos na Resolução IFTM nº 29/2019.',
      audiences: Object.freeze([
        'PUBLICO_INSTITUCIONAL', 'ADMINISTRADOR', 'SUPER_USUARIO'
      ])
    }),
    Object.freeze({
      title: 'Relatórios com justificativas',
      description: 'Os PDFs individual e geral registram função importada, jornada reduzida, condições confirmadas, motivos e a situação semanal correspondente.',
      audiences: Object.freeze([
        'PUBLICO_INSTITUCIONAL', 'ADMINISTRADOR', 'SUPER_USUARIO'
      ])
    })
  ])
});

const HelpTutorialCatalog = Object.freeze({
  /** Retorna uma cópia serializável de todos os tutoriais. */
  getAll: function() {
    return JSON.parse(JSON.stringify(HelpTutorialCatalog._definitions)).map(
      function(tutorial) {
        tutorial.steps.unshift({
          id: tutorial.id + '.position-ema',
          target: '#emaLauncher',
          action: 'next',
          required: false,
          placement: 'left',
          title: 'Posicione a Ema onde preferir',
          message: 'Você pode arrastar a Ema ou o cabeçalho deste balão e soltar o conjunto em qualquer lugar da tela. A posição escolhida será mantida durante esta sessão. Se perceber que informou uma opção válida, mas inadequada ao contexto, use Voltar: a Ema reabrirá o campo para correção e validará novamente as etapas dependentes.'
        });
        return tutorial;
      }
    );
  },

  /** Localiza um tutorial pelo identificador estável. */
  getById: function(tutorialId) {
    const normalized = String(tutorialId || '').trim();
    const tutorial = HelpTutorialCatalog.getAll().filter(function(item) {
      return item.id === normalized;
    })[0];
    return tutorial || null;
  },

  /**
   * Filtra o catálogo conforme o perfil e as permissões efetivas.
   * A segurança continua no backend; este filtro apenas evita oferecer um
   * roteiro para uma tela que o usuário não pode abrir.
   */
  getAvailable: function(context) {
    const profile = context && context.profile ? context.profile : '';
    const permissions = context && context.permissions ? context.permissions : {};
    return HelpTutorialCatalog.getAll().filter(function(tutorial) {
      if (tutorial.audiences.indexOf(profile) < 0) return false;
      if (tutorial.permission && !permissions[tutorial.permission]) return false;
      return true;
    });
  },

  /** Retorna as dicas contextuais autorizadas para o perfil atual. */
  getContextTips: function(context) {
    const profile = context && context.profile ? context.profile : '';
    const permissions = context && context.permissions ? context.permissions : {};
    return JSON.parse(JSON.stringify(HelpTutorialCatalog._contextTips.filter(function(tip) {
      if (tip.audiences.indexOf(profile) < 0) return false;
      if (tip.permission && !permissions[tip.permission]) return false;
      return true;
    })));
  },

  /** Retorna as novidades da versão, limitadas ao perfil efetivo. */
  getReleaseNotes: function(context) {
    const profile = context && context.profile ? context.profile : '';
    const permissions = context && context.permissions ? context.permissions : {};
    const release = JSON.parse(JSON.stringify(HelpReleaseNotesCatalog));
    release.items = release.items.filter(function(item) {
      if (item.audiences.indexOf(profile) < 0) return false;
      if (item.permission && !permissions[item.permission]) return false;
      delete item.audiences;
      delete item.permission;
      return true;
    });
    return release;
  },

  _definitions: Object.freeze([
    Object.freeze({
      id: 'empty-state',
      version: HELP_TUTORIAL_CATALOG_VERSION,
      title: 'Dashboard ainda sem dados',
      description: 'Explica por que o conteúdo ainda não está disponível.',
      area: 'dashboard',
      audiences: Object.freeze([
        'PUBLICO_INSTITUCIONAL',
        'ADMINISTRADOR',
        'SUPER_USUARIO'
      ]),
      steps: Object.freeze([
        Object.freeze({
          id: 'empty-state.explanation',
          target: '#dashboardFiltersHeading',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'A base ainda está em preparação',
          message: 'Ainda não há dados suficientes para apresentar o dashboard. Se você não possui permissão administrativa, aguarde a preparação da base pela equipe responsável.'
        })
      ])
    }),
    Object.freeze({
      id: 'dashboard',
      version: HELP_TUTORIAL_CATALOG_VERSION,
      title: 'Conhecer o dashboard',
      description: 'Filtros, simulações, indicadores, gráficos e detalhamentos.',
      area: 'dashboard',
      audiences: Object.freeze([
        'PUBLICO_INSTITUCIONAL',
        'ADMINISTRADOR',
        'SUPER_USUARIO'
      ]),
      steps: Object.freeze([
        Object.freeze({
          id: 'dashboard.introduction',
          target: '#dashboardFiltersPanel',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Visão geral',
          message: 'Este painel reúne a carga de aulas, os vínculos com alunos, as áreas do conhecimento e a situação dos docentes. Vamos percorrer cada parte sem alterar a base.'
        }),
        Object.freeze({
          id: 'dashboard.theme',
          target: '#themeToggle',
          action: 'next',
          required: false,
          continueLabel: 'Continuar',
          placement: 'bottom',
          title: 'Alterne entre tema claro e escuro',
          message: 'Clique quantas vezes quiser para experimentar os temas claro e escuro. Esta preferência é pessoal e fica salva neste navegador. Quando estiver satisfeito com o esquema de cores, clique em Continuar no balão da Ema.'
        }),
        Object.freeze({
          id: 'dashboard.collapse-all',
          target: '#toggleAllSectionsBtn',
          action: 'click',
          required: true,
          placement: 'bottom',
          title: 'Recolha todas as seções',
          message: 'Clique para recolher as três seções analíticas e obter uma visão mais compacta da página.'
        }),
        Object.freeze({
          id: 'dashboard.expand-all',
          target: '#toggleAllSectionsBtn',
          action: 'click',
          required: true,
          placement: 'bottom',
          title: 'Expanda todas as seções',
          message: 'Clique novamente para restaurar todos os indicadores, gráficos e a tabela.'
        }),
        Object.freeze({
          id: 'dashboard.year',
          target: '#filterYear',
          action: 'change',
          required: true,
          placement: 'bottom',
          title: 'Escolha o ano letivo',
          message: 'Abra este campo e selecione um ano. Quando um ano específico é escolhido, o filtro de semestre é habilitado. A Ema aguardará sua seleção.'
        }),
        Object.freeze({
          id: 'dashboard.semester',
          target: '#filterSemester',
          action: 'change',
          required: true,
          requiresEnabled: true,
          placement: 'bottom',
          title: 'Defina o recorte do período',
          message: 'Selecione o ano completo, o primeiro semestre ou o segundo semestre. Disciplinas anuais são distribuídas proporcionalmente entre os dois semestres.'
        }),
        Object.freeze({
          id: 'dashboard.teacher-search',
          target: '#searchProf',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Localize um docente',
          message: 'Este campo filtra todo o dashboard pelo nome do professor. Você pode usá-lo a qualquer momento; não vamos preenchê-lo agora para preservar exemplos nas próximas seções.'
        }),
        Object.freeze({
          id: 'dashboard.area-filter',
          target: '#filterKnowledgeArea',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Filtre por área do conhecimento',
          message: 'Use este campo para analisar uma área específica ou identificar docentes que ainda não possuem associação.'
        }),
        Object.freeze({
          id: 'dashboard.teacher-status',
          target: '#filterTeacherStatus',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Considere a situação docente',
          message: 'Escolha entre docentes ativos, inativos ou ambos. O filtro afeta os indicadores, gráficos e a tabela.'
        }),
        Object.freeze({
          id: 'dashboard.simulation-overview',
          target: '#simulationPanelHeading',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Simule sem modificar a base',
          message: 'Dias letivos, semanas, limites dos regimes e duração da hora-aula alteram somente os cálculos desta sessão. TCC, estágio, atividades complementares e a forma de apresentar docentes com justificativa também podem ser simulados sem apagar dados.'
        }),
        Object.freeze({
          id: 'dashboard.justified-teachers-toggle',
          target: '#toggleConsiderJustifiedTeachers',
          action: 'next',
          required: false,
          continueLabel: 'Continuar',
          placement: 'bottom',
          title: 'Simule com ou sem os justificados',
          message: 'Alterne quantas vezes quiser. Quando marcado, docentes abaixo do mínimo com justificativa confirmada participam do total de situação; quando desmarcado, aparecem separados. Em ambos os casos, suas horas e o impacto real nas áreas permanecem integralmente contabilizados. Clique em Continuar quando terminar.'
        }),
        Object.freeze({
          id: 'dashboard.normative-open',
          target: '#normativeBasisBtn',
          action: 'event',
          eventName: 'normative-basis-opened',
          required: true,
          placement: 'bottom',
          title: 'Abra o fundamento normativo',
          message: 'Clique para consultar a origem dos parâmetros oficiais usados como referência.'
        }),
        Object.freeze({
          id: 'dashboard.normative-detail',
          target: '#normativeBasisContent',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Entenda o escopo da simulação',
          message: 'A janela explica que o dashboard avalia carga de aulas em horas de 60 minutos, apresenta as faixas gerais da Portaria MEC nº 750/2024 e os parâmetros de funções e reduções da Resolução IFTM nº 29/2019. Condições só justificam a situação depois de confirmadas por um administrador.'
        }),
        Object.freeze({
          id: 'dashboard.normative-close',
          target: '#normativeBasisCloseFooterBtn',
          action: 'click',
          required: true,
          placement: 'top',
          title: 'Feche o fundamento normativo',
          message: 'Clique em Fechar para retornar ao dashboard.'
        }),
        Object.freeze({
          id: 'dashboard.workload-overview',
          target: '#workloadKpiTitle',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Visão por carga horária',
          message: 'Esta seção combina cinco indicadores e quatro gráficos: situação semanal, incluindo Abaixo do Mínimo Justificado como grupo próprio, maiores médias, composição da carga e distribuição por curso e forma.'
        }),
        Object.freeze({
          id: 'dashboard.workload-collapse',
          target: '#workloadDashboardSectionToggleBtn',
          action: 'click',
          required: true,
          placement: 'left',
          title: 'Recolha somente esta seção',
          message: 'Cada seção possui seu próprio controle. Recolha a visão por carga horária sem alterar as demais.'
        }),
        Object.freeze({
          id: 'dashboard.workload-expand',
          target: '#workloadDashboardSectionToggleBtn',
          action: 'click',
          required: true,
          placement: 'left',
          title: 'Expanda a seção novamente',
          message: 'Clique para exibir novamente os indicadores e gráficos da carga horária.'
        }),
        Object.freeze({
          id: 'dashboard.workload',
          target: '[data-workload-metric="total"]',
          action: 'event',
          eventName: 'workload-analytics-opened',
          required: true,
          placement: 'top',
          title: 'Abra um indicador de carga horária',
          message: 'Clique no indicador Carga horária total para consultar seu detalhamento. Os demais indicadores desta faixa seguem o mesmo padrão de interação.'
        }),
        Object.freeze({
          id: 'dashboard.workload-detail-summary',
          target: '#workloadAnalyticsSummary',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Resumo do indicador',
          message: 'O resumo apresenta os totais do recorte atual e mantém a distinção entre hora-relógio e hora-aula equivalente.'
        }),
        Object.freeze({
          id: 'dashboard.workload-detail-chart',
          target: '.analytics-modal-chart',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Visualização do detalhamento',
          message: 'O gráfico adapta sua apresentação ao indicador selecionado e respeita todos os filtros e parâmetros ativos.'
        }),
        Object.freeze({
          id: 'dashboard.workload-detail-table',
          target: '#workloadAnalyticsTableBody',
          action: 'next',
          required: false,
          placement: 'top',
          title: 'Tabela complementar',
          message: 'A tabela permite identificar os docentes ou grupos que formam o indicador. Use a rolagem da janela quando houver muitas linhas ou colunas.'
        }),
        Object.freeze({
          id: 'dashboard.workload-close',
          target: '#workloadAnalyticsCloseFooterBtn',
          action: 'click',
          required: true,
          placement: 'top',
          title: 'Feche o detalhamento',
          message: 'Clique em Fechar somente depois de revisar o resumo, o gráfico e a tabela.'
        }),
        Object.freeze({
          id: 'dashboard.areas-overview',
          target: '#areaKpiTitle',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Visão por Área do Conhecimento',
          message: 'Os indicadores e gráficos mostram docentes, alunos e carga horária por área. Um docente associado a mais de uma área contribui integralmente para cada associação. Condições justificadoras explicam o impacto, mas nunca retiram as horas da área. Em recortes históricos, áreas já inativadas continuam visíveis e são identificadas como históricas.'
        }),
        Object.freeze({
          id: 'dashboard.areas',
          target: '[data-area-metric="workload"]',
          action: 'event',
          eventName: 'area-analytics-opened',
          required: true,
          placement: 'top',
          title: 'Analise a carga horária por área',
          message: 'Clique neste indicador para conhecer a distribuição da carga horária entre as áreas no recorte atual.'
        }),
        Object.freeze({
          id: 'dashboard.area-detail-summary',
          target: '#areaAnalyticsSummary',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Resumo por área',
          message: 'Confira docentes no recorte, associações, áreas representadas e vínculos aluno-docente.'
        }),
        Object.freeze({
          id: 'dashboard.area-detail-table',
          target: '#areaAnalyticsTableBody',
          action: 'next',
          required: false,
          placement: 'top',
          title: 'Compare as áreas',
          message: 'Cada linha apresenta o nível, o caminho hierárquico, docentes, alunos, carga total e média por docente. Linhas com dados podem ser abertas para mostrar seus professores.'
        }),
        Object.freeze({
          id: 'dashboard.area-teachers-open',
          target: '#areaAnalyticsTableBody .area-analytics-row',
          action: 'event',
          eventName: 'area-teacher-details-opened',
          required: true,
          skipIfMissing: true,
          targetTimeout: 1200,
          placement: 'top',
          title: 'Abra os docentes de uma área',
          message: 'Clique em uma linha para conhecer os docentes que formam o indicador. Se o recorte não possuir áreas, a Ema seguirá sem bloquear o tutorial.'
        }),
        Object.freeze({
          id: 'dashboard.area-teachers-detail',
          target: '#areaAnalyticsTeacherSection',
          action: 'next',
          required: false,
          skipIfMissing: true,
          targetTimeout: 1200,
          placement: 'top',
          title: 'Docentes da área',
          message: 'Este detalhamento apresenta vínculo, situação, alunos, carga horária e todas as associações do docente.'
        }),
        Object.freeze({
          id: 'dashboard.area-close',
          target: '#areaAnalyticsCloseFooterBtn',
          action: 'click',
          required: true,
          placement: 'top',
          title: 'Feche o detalhamento por área',
          message: 'Clique em Fechar para continuar até a tabela final do dashboard.'
        }),
        Object.freeze({
          id: 'dashboard.table-overview',
          target: '#teacherTableTitle',
          action: 'next',
          required: false,
          placement: 'bottom',
          title: 'Tabela de professores',
          message: 'A tabela exibe até 100 resultados e permite rolagem horizontal. Ela reúne período, áreas, condições confirmadas e seus motivos, situação semanal, vínculo, regime, carga, alunos e a composição teórica, prática e de extensão.'
        }),
        Object.freeze({
          id: 'dashboard.table-search',
          target: '#tableSearchInput',
          action: 'next',
          required: false,
          placement: 'top',
          title: 'Pesquise somente na tabela',
          message: 'Este campo não altera cards ou gráficos. Os cabeçalhos ordenam cada coluna, e Restaurar tabela limpa a pesquisa e a ordenação local.'
        }),
        Object.freeze({
          id: 'dashboard.table-sort',
          target: '.table-sort-button[data-sort-key="workload"]',
          action: 'click',
          required: true,
          placement: 'top',
          title: 'Ordene uma coluna',
          message: 'Clique para ordenar pelo total de carga horária. Um segundo clique inverte a ordem, e Restaurar tabela volta ao estado inicial.'
        }),
        Object.freeze({
          id: 'dashboard.professor-open',
          target: '#tableBody .clickable-row',
          action: 'event',
          eventName: 'professor-details-opened',
          required: true,
          skipIfMissing: true,
          targetTimeout: 1200,
          placement: 'top',
          title: 'Abra um professor',
          message: 'Clique em uma linha para consultar as disciplinas e os dados que formam os totais do professor. Se o recorte estiver vazio, a Ema concluirá sem bloquear.'
        }),
        Object.freeze({
          id: 'dashboard.professor-summary',
          target: '#modalProfAreas',
          action: 'next',
          required: false,
          skipIfMissing: true,
          targetTimeout: 1200,
          placement: 'bottom',
          title: 'Identificação e áreas do professor',
          message: 'O cabeçalho mostra período, vínculo, matrícula e situação. Os marcadores apresentam as áreas e suas vigências; a seção seguinte registra condições confirmadas, motivos e faixas aplicáveis. Uma área encerrada depois do período analisado aparece como histórica e inativa atualmente.'
        }),
        Object.freeze({
          id: 'dashboard.professor-disciplines',
          target: '#modalTableBody',
          action: 'next',
          required: false,
          skipIfMissing: true,
          targetTimeout: 1200,
          placement: 'top',
          title: 'Disciplinas e alunos do professor',
          message: 'A tabela detalha ano, semestre, forma, curso, PPC, período, turma, disciplina, hora-relógio, hora-aula, componentes da carga e alunos aproximados. Para estimar alunos atendidos, o sistema considera somente os alunos matriculados ou com vínculo ativo naquele PERÍODO acadêmico — movimentos Matriculado, Trancado, Mobilidade, Provável formando e Integralizada. O total de FORMA, CURSO, PPC e PERÍODO é dividido apenas entre as turmas regulares da mesma disciplina e do mesmo semestre, ou do regime anual, com eventual excedente destinado às últimas turmas. Turmas especiais e dependências mantêm a carga horária, mas não entram no cálculo de alunos.'
        }),
        Object.freeze({
          id: 'dashboard.professor-pdf',
          target: '#generateTeacherPdfBtn',
          action: 'next',
          required: false,
          skipIfMissing: true,
          targetTimeout: 1200,
          placement: 'top',
          title: 'Gere o relatório individual em PDF',
          message: 'Este botão está disponível também no acesso público institucional. Ele gera um PDF em formato A4 paisagem com identificação do professor, ano ou período de anos, vínculo, matrícula, situação, regime, função importada, jornada reduzida, condições confirmadas, motivos, áreas, indicadores de carga e alunos, parâmetros do recorte e todas as ofertas detalhadas. O arquivo não contém dados pessoais de alunos e registra a versão do Dashboard de Carga Horária Docente no rodapé.'
        }),
        Object.freeze({
          id: 'dashboard.professor-close',
          target: '#modalCloseFooterBtn',
          action: 'click',
          required: true,
          skipIfMissing: true,
          targetTimeout: 1200,
          placement: 'top',
          title: 'Conclua a exploração da tabela',
          message: 'Clique em Fechar. O tutorial termina sem alterar os dados ou as permissões do sistema.'
        }),
        Object.freeze({
          id: 'dashboard.ema-minimize',
          target: '#btnAjuda',
          action: 'next',
          required: false,
          continueLabel: 'Concluir apresentação',
          placement: 'bottom',
          title: 'A Ema fica no menu Ajuda',
          message: 'Quando não estiver orientando uma tarefa, a Ema fica minimizada neste botão, representada pela cabeça. Use Minimizar no balão a qualquer momento; se houver um tutorial em andamento, o passo será pausado e preservado. Clique na cabeça da Ema para retomar. Um marcador avisa sobre tutorial pausado ou novidade ainda não lida.'
        })
      ])
    }),
    Object.freeze({
      id: 'general-report',
      version: HELP_TUTORIAL_CATALOG_VERSION,
      title: 'Gerar relatório geral',
      description: 'Filtros, seleção e ordenação do PDF administrativo.',
      area: 'dashboard',
      permission: 'generateGeneralReport',
      audiences: Object.freeze(['ADMINISTRADOR', 'SUPER_USUARIO']),
      steps: Object.freeze([
        Object.freeze({
          id: 'general-report.open',
          target: '#generateGeneralTeacherReportBtn',
          screenTarget: '#generalTeacherReportModal.active',
          action: 'event',
          eventName: 'general-teacher-report-opened',
          required: true,
          placement: 'top',
          title: 'Abra o relatório geral',
          message: 'Clique para selecionar um ou mais professores e gerar um único PDF consolidado. Esta função é restrita a Administradores e Super Usuários.'
        }),
        Object.freeze({
          id: 'general-report.filters',
          target: '.general-report-filters',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Combine os filtros',
          message: 'FORMA, CURSO, PPC, PERÍODO e ÁREA ou SUBÁREA aceitam vários valores e são encadeados. O relatório também respeita o ano e o semestre escolhidos no dashboard.'
        }),
        Object.freeze({
          id: 'general-report.teachers',
          target: '.general-report-selection',
          action: 'next',
          required: false,
          placement: 'left',
          title: 'Escolha os professores',
          message: 'Busque por nome ou matrícula, selecione individualmente ou marque todos os resultados filtrados. Um professor associado a várias áreas aparece nos respectivos grupos do PDF, sem duplicar o total geral.'
        }),
        Object.freeze({
          id: 'general-report.sort',
          target: '#generalReportSort',
          action: 'next',
          required: false,
          placement: 'top',
          title: 'Defina a ordenação',
          message: 'Ordene por nome em A–Z ou Z–A, ou pela carga horária em ordem crescente ou decrescente. Empates de carga são resolvidos pelo nome em A–Z.'
        }),
        Object.freeze({
          id: 'general-report.generate',
          target: '#generalTeacherReportGenerateBtn',
          action: 'next',
          required: false,
          placement: 'top',
          title: 'Gere o PDF consolidado',
          message: 'Após selecionar ao menos um professor, este botão gera o resumo consolidado, os grupos por área e uma seção detalhada para cada docente, incluindo função importada, jornada reduzida, condições confirmadas, motivos e situação semanal. Não é necessário gerar o arquivo durante o tutorial.'
        }),
        Object.freeze({
          id: 'general-report.close',
          target: '#generalTeacherReportCancelBtn',
          action: 'click',
          required: true,
          placement: 'top',
          title: 'Feche sem gerar',
          message: 'Clique em Cancelar para retornar ao dashboard sem gerar um arquivo.'
        })
      ])
    }),
    Object.freeze({
      id: 'base-preparation',
      version: HELP_TUTORIAL_CATALOG_VERSION,
      title: 'Preparar a base inicial',
      description: 'Importação dos relatórios, áreas, associações e usuários.',
      area: 'administration',
      permission: 'manageData',
      audiences: Object.freeze(['ADMINISTRADOR', 'SUPER_USUARIO']),
      steps: Object.freeze([
        Object.freeze({
          id: 'base.confirm-cra-reports',
          action: 'confirm-reports',
          required: true,
          correctionAllowed: true,
          title: 'Prepare os relatórios no VirtualIF',
          message: 'Antes de abrir Gerenciar Base, acesse o módulo CRA do VirtualIF e gere Alunos × Campus e Professor × Disciplina para o mesmo ano. Em Alunos × Campus, marque todos os períodos letivos e considere os movimentos Matriculado, Trancado, Mobilidade, Provável formando e Integralizada; outros movimentos são ignorados pelo dashboard. Em Selecionar Campos, marque Selecionar Todos. Em Professor × Disciplina, informe somente o ano e marque “Planilha com dados organizados em colunas destinado à manipulação por meio de tabela dinâmica”. O relatório de Docentes deve ser solicitado à CGP-UDI. Você já possui os três relatórios necessários para continuar?'
        }),
        Object.freeze({
          id: 'base.open-management',
          target: '#btnManageData',
          screenTarget: '#dataManagementModal.active',
          action: 'click',
          required: true,
          autoAdvance: true,
          placement: 'bottom',
          title: 'Comece por Gerenciar base',
          message: 'Clique em Gerenciar Base. Assim que a janela abrir, a Ema avançará automaticamente para o próximo elemento.'
        }),
        Object.freeze({
          id: 'base.report-sources',
          target: '#managementIntro',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Onde obter os relatórios',
          message: 'Os relatórios Professor × Disciplina e Alunos × Campus estão disponíveis no módulo CRA do VirtualIF. O relatório de Docentes pode ser solicitado à CGP-UDI.'
        }),
        Object.freeze({
          id: 'base.choose-annual',
          target: '[data-management-action="annual"]',
          action: 'click',
          required: true,
          placement: 'right',
          title: 'Adicione os dados de um ano',
          message: 'Escolha Dados de um ano para importar, em conjunto, Professor × Disciplina e Alunos × Campus.'
        }),
        Object.freeze({
          id: 'base.year',
          target: '#annualYearInput',
          action: 'input',
          required: true,
          valueRequired: true,
          minValue: 2000,
          maxValue: 2999,
          validationMessage: 'Informe um ano válido entre 2000 e 2999 para liberar a próxima etapa.',
          placement: 'bottom',
          title: 'Informe o ano da base',
          message: 'Digite o ano letivo correspondente aos dois relatórios. Confira se ambos pertencem ao mesmo período. A próxima etapa só será liberada depois de um ano válido.'
        }),
        Object.freeze({
          id: 'base.discipline-file',
          target: '#disciplineReportInput',
          action: 'change',
          required: true,
          valueRequired: true,
          validationMessage: 'Selecione o arquivo Professor × Disciplina para continuar.',
          placement: 'bottom',
          title: 'Selecione Professor × Disciplina',
          message: 'Escolha o arquivo obtido no módulo CRA do VirtualIF. O sistema analisará somente a primeira aba do arquivo .xlsx.'
        }),
        Object.freeze({
          id: 'base.student-file',
          target: '#studentReportInput',
          action: 'change',
          required: true,
          valueRequired: true,
          validationMessage: 'Selecione o arquivo Alunos × Campus para continuar.',
          placement: 'bottom',
          title: 'Selecione Alunos × Campus',
          message: 'Escolha o relatório do mesmo ano, também obtido no módulo CRA do VirtualIF.'
        }),
        Object.freeze({
          id: 'base.analyze-annual',
          target: '#analyzeAnnualReportsBtn',
          action: 'click',
          required: true,
          autoAdvance: true,
          placement: 'top',
          title: 'Analise antes de importar',
          message: 'Clique em Analisar relatórios. Revise colunas reconhecidas, registros válidos, divergências e mapeamentos antes de confirmar a operação.'
        }),
        Object.freeze({
          id: 'base.annual-progress',
          target: '#managementProgress',
          action: 'event',
          eventName: 'annual-report-analysis-completed',
          eventSuccessProperty: 'valid',
          failureStepId: 'base.discipline-file',
          failureTitle: 'A análise encontrou pendências',
          failureMessage: 'Revise as divergências apresentadas pelo sistema e selecione novamente os dois relatórios corretos, referentes ao mesmo ano.',
          required: true,
          placement: 'top',
          title: 'Acompanhe a análise dos relatórios',
          message: 'Acompanhe aqui a barra de progresso, a etapa atual e os detalhes da análise. A Ema avançará quando o resultado estiver disponível.'
        }),
        Object.freeze({
          id: 'base.annual-result',
          target: '#annualAnalysisSummary',
          action: 'next',
          required: false,
          placement: 'top',
          title: 'Confira o resultado da análise',
          message: 'Revise o resumo e as divergências encontradas. A confirmação somente será liberada quando a análise for válida.'
        }),
        Object.freeze({
          id: 'base.confirm-annual',
          target: '#confirmAnnualImportBtn',
          action: 'event',
          eventName: 'data-import-operation-finished',
          eventDetail: Object.freeze({ scope: 'annual' }),
          eventSuccessProperty: 'success',
          failureStepId: 'base.analyze-annual',
          failureTitle: 'A importação anual não foi concluída',
          failureMessage: 'Consulte o motivo informado na área de progresso. Corrija os relatórios se necessário e execute a análise novamente.',
          required: true,
          requiresEnabled: true,
          placement: 'top',
          title: 'Confirme a importação anual',
          message: 'Este botão somente é liberado após uma análise válida. Confirme a operação e aguarde a mensagem de conclusão antes de voltar.'
        }),
        Object.freeze({
          id: 'base.finish-annual',
          target: '#finishOperationBtn',
          action: 'click',
          required: true,
          requiresEnabled: true,
          placement: 'top',
          title: 'Conclua a importação anual',
          message: 'A importação foi realizada com sucesso. Clique em Concluir para encerrar esta operação; não clique novamente em Confirmar operação.'
        }),
        Object.freeze({
          id: 'base.return-management',
          target: '#managementBackBtn',
          action: 'click',
          required: true,
          placement: 'bottom',
          title: 'Volte às opções',
          message: 'Depois de concluir a importação anual, volte para preparar o cadastro de docentes.'
        }),
        Object.freeze({
          id: 'base.choose-teachers',
          target: '[data-management-action="teachers"]',
          action: 'click',
          required: true,
          placement: 'right',
          title: 'Atualize o cadastro de docentes',
          message: 'Abra Atualizar docentes. Esse cadastro é acumulado e preserva professores de períodos anteriores.'
        }),
        Object.freeze({
          id: 'base.teacher-source',
          target: '#teacherManagementTitle',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Relatório de Docentes',
          message: 'O relatório de Docentes pode ser solicitado à CGP-UDI. Confirme que o arquivo recebido contém os dados institucionais, a jornada de trabalho na coluna J e a função na coluna S.'
        }),
        Object.freeze({
          id: 'base.teacher-file',
          target: '#teacherReportInput',
          action: 'change',
          required: true,
          valueRequired: true,
          validationMessage: 'Selecione o relatório de Docentes para continuar.',
          placement: 'bottom',
          title: 'Selecione o relatório de Docentes',
          message: 'Escolha o arquivo .xlsx. Servidores cujo cargo não contenha PROFESSOR serão informados e ignorados, sem serem tratados como erro. A importação atualiza o espelho, mas preserva integralmente as condições administrativas já cadastradas.'
        }),
        Object.freeze({
          id: 'base.analyze-teachers',
          target: '#analyzeTeacherReportBtn',
          action: 'click',
          required: true,
          autoAdvance: true,
          placement: 'top',
          title: 'Valide os docentes',
          message: 'Analise o relatório, revise o resumo e confirme a mesclagem somente quando não houver pendências.'
        }),
        Object.freeze({
          id: 'base.teacher-progress',
          target: '#managementProgress',
          action: 'event',
          eventName: 'teacher-report-analysis-completed',
          eventSuccessProperty: 'valid',
          failureStepId: 'base.teacher-file',
          failureTitle: 'A análise dos docentes encontrou pendências',
          failureMessage: 'Revise as divergências apresentadas e selecione novamente o relatório correto de Docentes.',
          required: true,
          placement: 'top',
          title: 'Acompanhe a análise dos docentes',
          message: 'Acompanhe aqui a barra de progresso, os registros processados e as informações da análise. A Ema avançará quando o resultado estiver disponível.'
        }),
        Object.freeze({
          id: 'base.teacher-result',
          target: '#teacherAnalysisSummary',
          action: 'next',
          required: false,
          placement: 'top',
          title: 'Confira o resultado dos docentes',
          message: 'Revise os registros considerados, os itens ignorados e as divergências antes de confirmar a mesclagem.'
        }),
        Object.freeze({
          id: 'base.confirm-teachers',
          target: '#confirmTeacherMergeBtn',
          action: 'event',
          eventName: 'data-import-operation-finished',
          eventDetail: Object.freeze({ scope: 'teachers' }),
          eventSuccessProperty: 'success',
          failureStepId: 'base.analyze-teachers',
          failureTitle: 'A atualização dos docentes não foi concluída',
          failureMessage: 'Consulte o motivo informado na área de progresso. Corrija o relatório se necessário e execute a análise novamente.',
          required: true,
          requiresEnabled: true,
          placement: 'top',
          title: 'Confirme a mesclagem de docentes',
          message: 'Este botão somente é liberado após uma análise válida. Confirme a mesclagem e aguarde a conclusão.'
        }),
        Object.freeze({
          id: 'base.finish-teachers',
          target: '#finishOperationBtn',
          action: 'click',
          required: true,
          requiresEnabled: true,
          placement: 'top',
          title: 'Conclua a atualização dos docentes',
          message: 'A atualização foi realizada com sucesso. Clique em Concluir para encerrar a operação.'
        }),
        Object.freeze({
          id: 'base.close-management',
          target: '#dataManagementCloseBtn',
          action: 'click',
          required: true,
          placement: 'left',
          title: 'Conclua a etapa de dados',
          message: 'Feche a gestão quando as bases anuais e o cadastro de docentes estiverem prontos.'
        }),
        Object.freeze({
          id: 'base.open-areas',
          target: '#btnKnowledgeAreas',
          screenTarget: '#knowledgeAreasContent:not(.hidden)',
          action: 'click',
          required: true,
          gate: 'DATA',
          placement: 'bottom',
          title: 'Cadastre as áreas do conhecimento',
          message: 'Abra Áreas de conhecimento. A próxima etapa depende de existir ao menos uma área ativa e uma associação docente válida.'
        }),
        Object.freeze({
          id: 'base.new-area',
          target: '#newMainKnowledgeAreaBtn',
          action: 'click',
          required: true,
          placement: 'bottom',
          title: 'Crie uma área principal',
          message: 'Use Nova área principal. Informe um nome claro, uma descrição útil e a ordem de exibição.'
        }),
        Object.freeze({
          id: 'base.area-name',
          target: '#knowledgeAreaName',
          action: 'input',
          required: true,
          valueRequired: true,
          validationMessage: 'Informe o nome da área para continuar.',
          placement: 'bottom',
          title: 'Identifique a área',
          message: 'Digite o nome da área. O identificador interno será mantido pelo sistema para preservar o histórico.'
        }),
        Object.freeze({
          id: 'base.save-area',
          target: '#knowledgeAreaSaveBtn',
          action: 'event',
          eventName: 'knowledge-area-saved',
          required: true,
          placement: 'top',
          title: 'Salve e depois associe docentes',
          message: 'Salve a área. Em seguida, use Gerenciar docentes na lista para criar ao menos uma associação válida.'
        }),
        Object.freeze({
          id: 'base.manage-area-teachers',
          target: '[data-area-action="manage-teachers"]',
          action: 'click',
          required: true,
          placement: 'right',
          title: 'Abra as associações',
          message: 'Clique em Gerenciar docentes na área que acabou de cadastrar.'
        }),
        Object.freeze({
          id: 'base.select-teacher',
          target: '#teacherAreaAvailableList',
          action: 'change',
          delegateTarget: '[data-teacher-registration]',
          requiresCheckedSelection: '[data-teacher-registration]:checked',
          required: true,
          placement: 'right',
          title: 'Selecione um docente',
          message: 'Marque um docente disponível. Você pode limitar a vigência informando os anos inicial e final.'
        }),
        Object.freeze({
          id: 'base.add-teacher',
          target: '#teacherAreaAddBtn',
          action: 'event',
          eventName: 'teacher-area-assignments-updated',
          satisfiedBy: '#teacherAreaAssignmentBody [data-assignment-active="true"]',
          required: true,
          placement: 'top',
          title: 'Confirme a associação',
          message: 'Associe os docentes selecionados. A Ema aguardará a confirmação do sistema e somente continuará quando houver uma associação ativa.',
          completionMessage: 'A associação docente ativa foi identificada. Você pode continuar.'
        }),
        Object.freeze({
          id: 'base.review-users',
          target: '#btnUsers',
          screenTarget: '#usersModal.active',
          action: 'click',
          required: true,
          gate: 'AREAS',
          placement: 'bottom',
          title: 'Revise os usuários administrativos',
          message: 'Por fim, confira se os Administradores e Super Usuários necessários estão ativos. Usuários públicos do domínio não precisam ser cadastrados.'
        })
      ])
    }),
    Object.freeze({
      id: 'teacher-conditions',
      version: HELP_TUTORIAL_CATALOG_VERSION,
      title: 'Docentes e condições especiais',
      description: 'Consultar o espelho importado e administrar justificativas sem sobrescrevê-lo.',
      area: 'teacher-conditions',
      permission: 'manageTeachers',
      audiences: Object.freeze(['ADMINISTRADOR', 'SUPER_USUARIO']),
      steps: Object.freeze([
        Object.freeze({
          id: 'teacher-conditions.open',
          target: '#btnTeachers',
          screenTarget: '#teacherRegistryModal.active',
          action: 'event',
          eventName: 'teacher-registry-opened',
          required: true,
          placement: 'bottom',
          title: 'Abra o cadastro de docentes',
          message: 'Clique em Docentes. Esta tela combina o espelho importado do relatório DOCENTES com uma camada administrativa separada para condições especiais.'
        }),
        Object.freeze({
          id: 'teacher-conditions.list',
          target: '#teacherRegistryList',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Localize o docente',
          message: 'Pesquise por nome, matrícula, função ou condição. O filtro “Somente com sugestões pendentes” identifica registros das colunas J e S que ainda precisam de revisão administrativa.'
        }),
        Object.freeze({
          id: 'teacher-conditions.imported',
          target: '.teacher-imported-summary',
          action: 'next',
          required: false,
          skipIfMissing: true,
          targetTimeout: 4000,
          placement: 'bottom',
          title: 'Confira os dados importados',
          message: 'Cargo, regime, coluna J e função da coluna S são somente para consulta. A próxima importação pode atualizá-los, mas nunca apaga nem reescreve as condições confirmadas pelo administrador.'
        }),
        Object.freeze({
          id: 'teacher-conditions.suggestions',
          target: '.teacher-suggestion-list',
          action: 'next',
          required: false,
          skipIfMissing: true,
          targetTimeout: 1200,
          placement: 'left',
          title: 'Revise as sugestões',
          message: 'Funções e jornadas menores que 40 horas geram sugestões. Use Revisar e cadastrar para conferir descrição pública, motivo, faixa, dispensa e vigência antes de confirmar; a sugestão sozinha não altera o dashboard.'
        }),
        Object.freeze({
          id: 'teacher-conditions.confirmed',
          target: '#teacherRegistryDetail',
          action: 'next',
          required: false,
          placement: 'left',
          title: 'Administre cada condição',
          message: 'Condições confirmadas podem ser editadas, inativadas ou reativadas sem exclusão histórica. Marque “Justifica carga abaixo do mínimo geral” somente quando houver fundamento para classificar o docente como Abaixo do Mínimo Justificado.'
        }),
        Object.freeze({
          id: 'teacher-conditions.close',
          target: '#teacherRegistryCloseFooterBtn',
          action: 'click',
          required: true,
          placement: 'top',
          title: 'Conclua sem alterar dados',
          message: 'Clique em Fechar. Este roteiro apresentou o fluxo, mas não salvou nenhuma condição.'
        })
      ])
    }),
    Object.freeze({
      id: 'manage-data',
      version: HELP_TUTORIAL_CATALOG_VERSION,
      title: 'Gerenciar a base',
      description: 'Importar, atualizar, excluir e restaurar dados com segurança.',
      area: 'manage-data',
      permission: 'manageData',
      audiences: Object.freeze(['ADMINISTRADOR', 'SUPER_USUARIO']),
      steps: Object.freeze([
        Object.freeze({
          id: 'manage-data.open',
          target: '#btnManageData',
          screenTarget: '#dataManagementModal.active',
          action: 'click',
          required: true,
          placement: 'bottom',
          title: 'Abra Gerenciar base',
          message: 'Clique para acessar as operações. Nenhuma alteração ocorre apenas por abrir esta tela.'
        }),
        Object.freeze({
          id: 'manage-data.sources',
          target: '#managementIntro',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Origem dos relatórios',
          message: 'Professor × Disciplina e Alunos × Campus estão disponíveis no módulo CRA do VirtualIF. O relatório de Docentes pode ser solicitado à CGP-UDI.'
        }),
        Object.freeze({
          id: 'manage-data.annual',
          target: '[data-management-action="annual"]',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Dados anuais',
          message: 'Adicione um novo ano com os dois relatórios ou atualize bases existentes. Analise sempre o arquivo antes de confirmar.'
        }),
        Object.freeze({
          id: 'manage-data.teachers',
          target: '[data-management-action="teachers"]',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Cadastro acumulado de docentes',
          message: 'A mesclagem atualiza registros existentes e preserva docentes históricos ausentes do relatório atual.'
        }),
        Object.freeze({
          id: 'manage-data.safety',
          target: '[data-management-action="restore"]',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Exclusão, backup e restauração',
          message: 'Operações destrutivas exigem confirmação e criam proteções. O reset completo é exclusivo do Super Usuário e possui validação adicional por e-mail.'
        })
      ])
    }),
    Object.freeze({
      id: 'knowledge-areas',
      version: HELP_TUTORIAL_CATALOG_VERSION,
      title: 'Áreas do conhecimento',
      description: 'Cadastrar áreas, subáreas e associações com docentes.',
      area: 'knowledge-areas',
      permission: 'manageAreas',
      audiences: Object.freeze(['ADMINISTRADOR', 'SUPER_USUARIO']),
      steps: Object.freeze([
        Object.freeze({
          id: 'areas.open',
          target: '#btnKnowledgeAreas',
          screenTarget: '#knowledgeAreasContent:not(.hidden)',
          action: 'click',
          required: true,
          placement: 'bottom',
          title: 'Abra Áreas de conhecimento',
          message: 'Clique para acessar o cadastro hierárquico de áreas e subáreas.'
        }),
        Object.freeze({
          id: 'areas.new',
          target: '#newMainKnowledgeAreaBtn',
          action: 'click',
          required: true,
          placement: 'bottom',
          title: 'Nova área principal',
          message: 'Crie primeiro uma área principal. Depois, você poderá adicionar subáreas vinculadas a ela.'
        }),
        Object.freeze({
          id: 'areas.form',
          target: '#knowledgeAreaFormTitle',
          action: 'next',
          required: false,
          placement: 'right',
          title: 'Preencha o cadastro',
          message: 'Informe nome, descrição, ordem e situação. O sistema impede duplicidades e relações hierárquicas inválidas.'
        }),
        Object.freeze({
          id: 'areas.associations',
          target: '#knowledgeAreasList',
          action: 'next',
          required: false,
          placement: 'top',
          title: 'Associe os docentes',
          message: 'Em cada área, use Gerenciar docentes. Na área principal, cada professor aparece uma única vez e seus vínculos com a área e as subáreas ficam agrupados, mas continuam administráveis separadamente. O título Associações cadastradas mostra entre parênteses quantos professores únicos estão listados. O semestre final é opcional: se houver ano final sem semestre, o vínculo vale até o fim daquele ano; sem ano final, permanece sem prazo definido. Os cartões mostram professores únicos, ativos e vigentes no período atual, agregando as subáreas sem duplicar matrículas.'
        })
      ])
    }),
    Object.freeze({
      id: 'users',
      version: HELP_TUTORIAL_CATALOG_VERSION,
      title: 'Usuários e perfis',
      description: 'Administradores, Super Usuários e proteções de acesso.',
      area: 'users',
      permission: 'manageUsers',
      audiences: Object.freeze(['ADMINISTRADOR', 'SUPER_USUARIO']),
      steps: Object.freeze([
        Object.freeze({
          id: 'users.open',
          target: '#btnUsers',
          screenTarget: '#usersModal.active',
          action: 'click',
          required: true,
          placement: 'bottom',
          title: 'Abra Usuários',
          message: 'Clique para consultar as contas com privilégios administrativos.'
        }),
        Object.freeze({
          id: 'users.public-access',
          target: '#usersPublicAccessNote',
          action: 'next',
          required: false,
          placement: 'left',
          title: 'Acesso público institucional',
          message: 'Contas autenticadas do domínio @iftm.edu.br podem consultar o dashboard sem cadastro. Esta tela armazena apenas Administradores e Super Usuários.'
        }),
        Object.freeze({
          id: 'users.new',
          target: '#newUserBtn',
          action: 'click',
          required: true,
          placement: 'bottom',
          title: 'Cadastre um usuário administrativo',
          message: 'Clique em Novo usuário. Administradores podem cadastrar outros Administradores; somente Super Usuários podem conceder o perfil máximo.'
        }),
        Object.freeze({
          id: 'users.form',
          target: '#userForm',
          action: 'next',
          required: false,
          placement: 'top',
          title: 'Preencha com atenção',
          message: 'Use nome completo e e-mail institucional. O sistema protege a própria conta e impede a remoção do último Super Usuário ativo.'
        })
      ])
    })
  ]),

  _contextTips: Object.freeze([
    Object.freeze({
      id: 'manage-data-report-sources',
      trigger: '#btnManageData',
      target: '#managementHome',
      permission: 'manageData',
      audiences: Object.freeze(['ADMINISTRADOR', 'SUPER_USUARIO']),
      title: 'Origem dos relatórios',
      message: 'Professor × Disciplina e Alunos × Campus: módulo CRA do VirtualIF. Docentes: solicite à CGP-UDI.'
    }),
    Object.freeze({
      id: 'teacher-conditions-context',
      trigger: '#btnTeachers',
      target: '#teacherRegistryDetail',
      permission: 'manageTeachers',
      audiences: Object.freeze(['ADMINISTRADOR', 'SUPER_USUARIO']),
      title: 'Espelho importado e condições separadas',
      message: 'Colunas J e S geram sugestões. Somente condições confirmadas pelo administrador justificam a situação exibida no dashboard; importações futuras preservam esse cadastro.'
    }),
    Object.freeze({
      id: 'special-components-impact',
      trigger: '#specialComponentImpactBtn',
      target: '#specialComponentImpactBtn',
      audiences: Object.freeze([
        'PUBLICO_INSTITUCIONAL',
        'ADMINISTRADOR',
        'SUPER_USUARIO'
      ]),
      title: 'Detalhamento auditável',
      message: 'Este elemento mostra quais componentes foram desconsiderados e a carga retirada da simulação.'
    })
  ])
});
