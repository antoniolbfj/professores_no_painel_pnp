/**
 * @file Instaladora.gs
 * @fileoverview Menu da planilha e preparação do modelo instalador do PNP.
 */

const PNP_INSTALADORA_CONFIG = Object.freeze({
  sheetName: 'INSTALADORA',
  rows: 40,
  columns: 8,
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
    'Bem-vindo(a)! Este é o modelo instalador do sistema Professores no Painel. '
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
      body: 'A instalação deve ser iniciada na cópia por uma conta autorizada do PNP. '
        + 'Siga as orientações do responsável pela instalação e autorize as permissões '
        + 'solicitadas pelo Google. As abas e estruturas do sistema devem ser criadas '
        + 'nessa cópia, preservando a planilha modelo.'
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
