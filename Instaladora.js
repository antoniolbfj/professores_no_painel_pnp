/**
 * @file Instaladora.gs
 * @fileoverview Menu da planilha e preparação do modelo instalador do PNP.
 */

const PNP_INSTALADORA_CONFIG = Object.freeze({
  sheetName: 'INSTALADORA',
  installedSheetName: 'PNP INSTALADA',
  installedPropertyPrefix: 'PNP_INSTALACAO_VIGENTE_',
  rows: 40,
  columns: 8,
  recordCell: 'A40',
  colors: Object.freeze({
    background: '#f0fdf4',
    primary: '#166534',
    text: '#14532d',
    muted: '#475569',
    white: '#ffffff',
    warningBackground: '#fef3c7',
    warningText: '#78350f'
  })
});

/**
 * O gatilho simples dispensa autorização e cadastro prévio no sistema.
 * O menu aparece ao abrir ou recarregar uma planilha com o projeto vinculado.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('PNP')
    .addItem('Preparar planilha instaladora', 'prepararPlanilhaInstaladora')
    .addItem('Iniciar assistente de instalação', 'iniciarAssistenteInstalacao')
    .addToUi();
}

/**
 * Prepara o modelo instalador após confirmação explícita da exclusão das abas.
 * Pode ser chamada pelo menu PNP ou pelo editor do Apps Script.
 *
 * Não exige USUARIOS: a planilha em branco ainda não tem a estrutura do PNP.
 * As permissões de edição e execução são verificadas pelo próprio Google.
 *
 * @returns {Object} Resultado da preparação ou do cancelamento.
 */
function prepararPlanilhaInstaladora() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Abra a planilha que será preparada como instaladora do PNP.');
  }

  const ui = SpreadsheetApp.getUi();
  try {
    exigirPlanilhaSemInstalacaoVigentePnp_(spreadsheet);
  } catch (error) {
    ui.alert('Preparação não permitida', error.message, ui.ButtonSet.OK);
    return { status: 'blocked', message: error.message };
  }
  const originalSheets = spreadsheet.getSheets();
  const originalNames = originalSheets.map(function(sheet) { return sheet.getName(); });
  const originalIds = originalSheets.map(function(sheet) {
    return sheet.getSheetId();
  }).sort().join(',');
  const answer = ui.alert(
    'Preparar planilha instaladora do PNP',
    'Esta operação criará uma nova aba INSTALADORA com boas-vindas e orientações. '
      + 'TODAS as abas atuais serão excluídas, incluindo seus dados:\n\n'
      + originalNames.map(function(name) { return '• ' + name; }).join('\n')
      + '\n\nUse uma planilha em branco ou guarde uma cópia dos dados antes de continuar. '
      + 'Deseja preparar esta planilha?',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return { status: 'cancelled' };

  // Diálogos suspendem a execução: o bloqueio só é adquirido após a resposta.
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(5000)) {
    throw new Error('Já existe uma preparação em andamento. Aguarde e tente novamente.');
  }

  let guide = null;
  let deletionStarted = false;
  try {
    // A instalação pode ter terminado enquanto a confirmação estava aberta.
    exigirPlanilhaSemInstalacaoVigentePnp_(spreadsheet);
    const currentIds = spreadsheet.getSheets().map(function(sheet) {
      return sheet.getSheetId();
    }).sort().join(',');
    if (currentIds !== originalIds) {
      throw new Error('As abas da planilha mudaram durante a confirmação. '
        + 'Execute a preparação novamente para conferir as abas que serão excluídas.');
    }

    // Uma aba nova permite repetir a preparação sem conflito de nomes e mantém
    // as abas originais intactas até as orientações estarem prontas.
    guide = spreadsheet.insertSheet();
    formatarAbaInstaladoraPnp_(guide);
    SpreadsheetApp.flush();
    spreadsheet.setActiveSheet(guide);

    deletionStarted = true;
    originalSheets.forEach(function(sheet) { spreadsheet.deleteSheet(sheet); });
    guide.setName(PNP_INSTALADORA_CONFIG.sheetName);
    spreadsheet.moveActiveSheet(1);
    // O registro só existe depois de a preparação ser concluída. Ele acompanha
    // a cópia completa do arquivo e conserva o ID do modelo de origem.
    salvarRegistroInstaladoraPnp_(guide, {
      kind: 'PNP_INSTALLER',
      version: 1,
      sourceSpreadsheetId: spreadsheet.getId(),
      preparedAt: new Date().toISOString(),
      installation: null
    });
    SpreadsheetApp.flush();
  } catch (error) {
    if (guide && !deletionStarted) spreadsheet.deleteSheet(guide);
    if (deletionStarted) {
      throw new Error('A preparação foi interrompida durante a substituição das abas. '
        + 'Confira as abas restantes antes de tentar novamente. Detalhes: ' + error.message);
    }
    throw error;
  } finally {
    lock.releaseLock();
  }

  spreadsheet.toast(
    'Modelo preparado. Antes de instalar o PNP, use Arquivo > Fazer uma cópia.',
    'Professores no Painel (PNP)',
    10
  );
  return {
    status: 'prepared',
    sheetName: guide.getName(),
    removedSheets: originalNames
  };
}

/** Formata somente a nova aba de orientações, antes da exclusão das demais. */
function formatarAbaInstaladoraPnp_(sheet) {
  const config = PNP_INSTALADORA_CONFIG;
  const colors = config.colors;
  if (sheet.getMaxRows() > config.rows) {
    sheet.deleteRows(config.rows + 1, sheet.getMaxRows() - config.rows);
  }
  if (sheet.getMaxColumns() > config.columns) {
    sheet.deleteColumns(config.columns + 1, sheet.getMaxColumns() - config.columns);
  }
  sheet.setHiddenGridlines(true);
  sheet.setTabColor(colors.primary);
  sheet.setColumnWidth(1, 24);
  sheet.setColumnWidths(2, 6, 110);
  sheet.setColumnWidth(8, 24);
  sheet.setRowHeights(1, config.rows, 24);
  sheet.setRowHeights(2, 2, 32);
  sheet.setFrozenRows(5);
  sheet.getRange('A1:H40')
    .setBackground(colors.background)
    .setFontFamily('Arial')
    .setFontSize(11)
    .setFontColor(colors.text)
    .setVerticalAlignment('middle')
    .setWrap(true);

  escreverBlocoInstaladoraPnp_(sheet, 'B2:G3', 'PROFESSORES NO PAINEL (PNP)')
    .setBackground(colors.primary)
    .setFontColor(colors.white)
    .setFontSize(22)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  escreverBlocoInstaladoraPnp_(sheet, 'B4:G5',
    'Bem-vindo(a) ao Professores no Painel (PNP)! '
      + 'Este é o modelo instalador do sistema. '
      + 'Use-o para criar uma nova instalação em uma cópia desta planilha.')
    .setHorizontalAlignment('center');
  escreverBlocoInstaladoraPnp_(sheet, 'B7:G9',
    'CÓPIA OBRIGATÓRIA ANTES DA INSTALAÇÃO\n'
      + 'Faça uma cópia COMPLETA desta planilha. Execute a instalação somente na cópia. '
      + 'Mantenha esta planilha original como modelo para novas instalações.')
    .setBackground(colors.warningBackground)
    .setFontColor(colors.warningText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  const steps = [
    {
      titleRange: 'B11:G11', bodyRange: 'B12:G14',
      title: '1. FAÇA UMA CÓPIA COMPLETA',
      body: 'No Google Planilhas, acesse Arquivo > Fazer uma cópia. '
        + 'Escolha um nome para a sua instalação do PNP e a pasta onde ela será salva. '
        + 'Copie o arquivo inteiro; duplicar apenas esta aba não cria uma nova instalação.'
    },
    {
      titleRange: 'B16:G16', bodyRange: 'B17:G19',
      title: '2. ABRA A CÓPIA E CONFIRA O ARQUIVO',
      body: 'Abra a planilha recém-criada e confira o nome escolhido. '
        + 'Todas as etapas seguintes devem ocorrer nesse novo arquivo. '
        + 'Para cada instalação independente, crie uma nova cópia do modelo original.'
    },
    {
      titleRange: 'B21:G21', bodyRange: 'B22:G25',
      title: '3. INICIE A INSTALAÇÃO NA SUA CÓPIA',
      body: 'Na cópia, acesse PNP > Iniciar assistente de instalação. '
        + 'Confira o arquivo e a conta apresentados, avance e confirme a instalação. '
        + 'Autorize as permissões solicitadas pelo Google. O assistente bloqueia '
        + 'a instalação no modelo original e em arquivos sem preparação concluída.'
    },
    {
      titleRange: 'B27:G27', bodyRange: 'B28:G30',
      title: '4. CONFIGURE A NOVA INSTALAÇÃO',
      body: 'Após concluir a instalação, configure os acessos dos usuários e importe '
        + 'os dados necessários para utilizar o PNP. Mantenha os dados de cada '
        + 'instalação em sua própria planilha.'
    }
  ];
  steps.forEach(function(step) {
    escreverBlocoInstaladoraPnp_(sheet, step.titleRange, step.title)
      .setBackground(colors.primary)
      .setFontColor(colors.white)
      .setFontWeight('bold');
    escreverBlocoInstaladoraPnp_(sheet, step.bodyRange, step.body)
      .setBackground(colors.white);
  });

  escreverBlocoInstaladoraPnp_(sheet, 'B32:G35',
    'ATENÇÃO AO MENU DE PREPARAÇÃO\n'
      + 'A opção PNP > Preparar planilha instaladora serve para criar o modelo '
      + 'e exclui todas as outras abas. Não a execute em uma instalação em uso. '
      + 'Para criar uma nova instalação, faça uma cópia completa do modelo.')
    .setBackground(colors.warningBackground)
    .setFontColor(colors.warningText);
  escreverBlocoInstaladoraPnp_(sheet, 'B37:G38',
    'Professores no Painel • PNP\nUma cópia da planilha para cada nova instalação.')
    .setFontColor(colors.muted)
    .setFontSize(10)
    .setHorizontalAlignment('center');
}

function escreverBlocoInstaladoraPnp_(sheet, address, text) {
  return sheet.getRange(address).merge().setValue(text);
}

/** Substitui as instruções do modelo pela apresentação da instalação pronta. */
function formatarAbaPnpInstalada_(sheet) {
  const colors = PNP_INSTALADORA_CONFIG.colors;
  const blocks = [
    ['B4:G5', 'Bem-vindo(a) ao Professores no Painel (PNP)! '
      + 'Esta planilha agora é uma instalação do sistema.'],
    ['B7:G9', 'PNP INSTALADA — INSTALAÇÃO EM FUNCIONAMENTO\n'
      + 'Esta planilha deixou de ser instaladora. As estruturas do PNP foram criadas '
      + 'e esta é a base em funcionamento da sua instalação.'],
    ['B11:G11', '1. SUA INSTALAÇÃO ESTÁ PRONTA'],
    ['B12:G14', 'As tabelas do sistema foram criadas e estão ocultas. '
      + 'Use esta planilha como base da sua instalação do Professores no Painel. '
      + 'Após a implantação, o aplicativo usará essas tabelas para armazenar os dados.'],
    ['B16:G16', '2. COMO IMPLANTAR O APLICATIVO'],
    ['B17:G19', 'Abra Extensões > Apps Script nesta planilha. No editor, '
      + 'clique em Implantar > Nova implantação e selecione o tipo Aplicativo da Web.'],
    ['B21:G21', '3. CONFIGURE O ACESSO E IMPLANTE'],
    ['B22:G25', 'Para identificar cada pessoa no PNP, selecione a execução como '
      + 'o usuário que acessa o app da Web e restrinja o acesso ao domínio institucional. '
      + 'Clique em Implantar, autorize as permissões solicitadas e guarde a URL do aplicativo. '
      + 'Essa etapa pode ser realizada depois de fechar o assistente.'],
    ['B27:G27', '4. UTILIZE O PROFESSORES NO PAINEL'],
    ['B28:G30', 'Configure os acessos dos usuários, importe os dados necessários '
      + 'e compartilhe a URL do aplicativo com as pessoas autorizadas. '
      + 'A orientação de implantação é opcional e não bloqueia a conclusão da instalação.'],
    ['B32:G35', 'INSTALAÇÃO PROTEGIDA\n'
      + 'A preparação de instalador e o assistente de instalação ficam bloqueados '
      + 'nesta planilha. Para uma nova instalação, faça outra cópia da planilha '
      + 'instaladora original. Mantenha esta instalação para uso do PNP.'],
    ['B37:G38', 'Professores no Painel • PNP\n'
      + 'Instalação concluída. As tabelas do sistema permanecem ocultas.']
  ];
  blocks.forEach(function(block) {
    escreverBlocoInstaladoraPnp_(sheet, block[0], block[1]);
  });
  sheet.getRange('B7:G9').setBackground(colors.primary).setFontColor(colors.white);
}

/** Mantém a origem e o andamento dentro do arquivo, inclusive ao fazer cópia. */
function salvarRegistroInstaladoraPnp_(sheet, record) {
  sheet.getRange(PNP_INSTALADORA_CONFIG.recordCell).setValue(JSON.stringify(record));
  sheet.hideRows(PNP_INSTALADORA_CONFIG.rows);
}

/** Marca o arquivo concluído fora das células, sem armazenar qualquer segredo. */
function registrarInstalacaoVigentePnp_(spreadsheet) {
  PropertiesService.getScriptProperties().setProperty(
    PNP_INSTALADORA_CONFIG.installedPropertyPrefix + spreadsheet.getId(),
    'installed'
  );
}

/**
 * Bloqueia operações de instalador em uma instalação vigente, mesmo que a aba
 * de apresentação tenha sido renomeada ou removida. O ID evita confundir o
 * modelo e suas cópias caso propriedades do projeto sejam copiadas também.
 */
function exigirPlanilhaSemInstalacaoVigentePnp_(spreadsheet) {
  const persistent = PropertiesService.getScriptProperties().getProperty(
    PNP_INSTALADORA_CONFIG.installedPropertyPrefix + spreadsheet.getId()
  );
  const installed = persistent === 'installed' || spreadsheet.getSheets().some(function(sheet) {
    // Compatibilidade com instalações anteriores à propriedade persistente e
    // bloqueio de cópias de uma instalação, inclusive com a aba renomeada.
    if (sheet.getMaxRows() < PNP_INSTALADORA_CONFIG.rows) return false;
    let record;
    try {
      record = JSON.parse(sheet.getRange(PNP_INSTALADORA_CONFIG.recordCell).getValue());
    } catch (error) {
      return false;
    }
    return record && record.kind === 'PNP_INSTALLER'
      && record.installation && record.installation.status === 'installed';
  });
  if (installed) {
    throw new Error('Esta planilha já possui uma instalação vigente do Professores no Painel (PNP). '
      + 'Preparar instalador e iniciar o assistente estão bloqueados para preservar a instalação. '
      + 'Para criar uma nova instalação, faça uma nova cópia da planilha instaladora original.');
  }
}

/** Validação compartilhada pelo assistente e pelos pontos de entrada antigos. */
function validarRequisitosInstalacaoPnp_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Abra uma cópia da planilha instaladora do PNP.');
  exigirPlanilhaSemInstalacaoVigentePnp_(spreadsheet);
  const installer = spreadsheet.getSheetByName(PNP_INSTALADORA_CONFIG.sheetName);
  const installed = spreadsheet.getSheetByName(PNP_INSTALADORA_CONFIG.installedSheetName);
  if (installer && installed) {
    throw new Error('Existem abas INSTALADORA e PNP INSTALADA neste arquivo. '
      + 'Resolva o conflito de nomes antes de continuar; nenhuma aba será substituída.');
  }
  const sheet = installer || installed;
  let record = null;
  try {
    record = sheet && JSON.parse(sheet.getRange(PNP_INSTALADORA_CONFIG.recordCell).getValue());
  } catch (error) {
    // Registros ausentes, antigos ou inválidos nunca comprovam preparação.
  }
  if (!record || record.kind !== 'PNP_INSTALLER' || record.version !== 1
      || typeof record.sourceSpreadsheetId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(record.sourceSpreadsheetId)
      || typeof record.preparedAt !== 'string' || !Number.isFinite(Date.parse(record.preparedAt))) {
    throw new Error('A preparação da planilha instaladora não foi concluída ou é de uma versão antiga. '
      + 'No modelo, execute PNP > Preparar planilha instaladora e depois use '
      + 'Arquivo > Fazer uma cópia. Inicie a instalação nessa nova cópia.');
  }
  if (record.sourceSpreadsheetId === spreadsheet.getId()) {
    throw new Error('A instalação no modelo original não é permitida. '
      + 'Use Arquivo > Fazer uma cópia, abra a cópia e acesse '
      + 'PNP > Iniciar assistente de instalação.');
  }
  if (record.installation && (record.installation.spreadsheetId !== spreadsheet.getId()
      || ['installing', 'failed', 'installed'].indexOf(record.installation.status) < 0)) {
    throw new Error('Este arquivo é uma cópia de uma instalação já iniciada. '
      + 'Para uma nova instalação, faça uma cópia da planilha modelo preparada.');
  }
  return { spreadsheet: spreadsheet, sheet: sheet, record: record };
}
