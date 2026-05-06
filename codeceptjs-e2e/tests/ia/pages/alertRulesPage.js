const { I } = inject();
const { rules, templates, filterOperators } = require('./testData');

const rowByAlertRuleName = (ruleName) => `//div[@data-testid="row"][div[@data-column="Name" and contains(text(), "${ruleName}")]]`;

module.exports = {
  url: 'graph/alerting/list',
  newRuleFromTemplateUrl: 'graph/alerting/new-from-template',
  columnHeaders: ['State', 'Name', 'Health', 'Summary'],
  filterOperators,
  rules,
  templates,
  alertRuleFilters: ['Firing', 'Normal', 'Pending', 'Alert', 'Recording', 'List', 'Grouped', 'State'],
  elements: {
    noRules: '#pageContent',
    columnHeaderLocator: (columnHeaderText) => locate('$header').withText(columnHeaderText),
    ruleNameValue: 'div[data-column=\'Name\']',
    ruleState: (text) => `//span[contains(.,'${text}')]`,
    alertRuleNameByName: (ruleName) => locate(rowByAlertRuleName(ruleName)).find('div[data-column="Name"]'),
    ruleDetails: I.useDataQA('data-testid expanded-content'),
    searchByDataSourceDropdown: I.useDataQA('data-testid Data source picker select container'),
    searchByLabel: '$input-wrapper',
    // eslint-disable-next-line no-inline-comments
    ruleFilterLocator: (ruleFilterText) => locate('label').withText(ruleFilterText).after('//input[@type="radio"]'),
    // eslint-disable-next-line no-inline-comments
    totalRulesCounter: (count, folder) => locate('$rule-group-header').withText(folder).find('span').withText(count),
    alertsLearnMoreLinks: locate('a').withText('Learn more'),
    detailsEvaluateValue: '//div[text()="Evaluate"]/following-sibling::div',
    detailsDurationValue: '//div[text()="For"]/following-sibling::div',
    detailsSeverityLabel: (value) => locate('span').withText(`severity=${value}`).inside('//ul[@aria-label="Tags"]').at(2),
    detailsFolderLabel: (value) => locate('span').withText(`grafana_folder=${value}`).inside('//ul[@aria-label="Tags"]'),
    ruleValidationError: (error) => locate('div').withText(error).inside('div').withAttr({ role: 'alert' }),
    unathorizedMessage: '$unauthorized',
  },
  buttons: {
    newAlertRule: locate('a').withText('New alert rule'),
    newAlertRuleFromTemplate: locate('a').withText('New alert rule from template'),
    saveAndExit: locate('//button[.="Save rule and exit"]'),
    editAlertRule: '//a[contains(@href, "/edit")]',
    editRuleOnView: '//span[text()="Edit"]',
    deleteAlertRule: locate('[role="menuitem"]').withText('Delete'),
    groupCollapseButton: (folderText) => `//button[@data-testid='data-testid group-collapse-toggle'][following::div/h3[contains(., '${folderText}')]]`,
    ruleCollapseButton: 'button[aria-label=\'Expand row\']',
    goToFolderButton: (folderID, folderText) => locate('[aria-label="go to folder"]').withAttr({ href: `/graph/dashboards/f/${folderID}/${folderText}` }),
    managePermissionsButton: (folderID, folderText) => locate('[aria-label="manage permissions"]').withAttr({ href: `/graph/dashboards/f/${folderID}/${folderText}/permissions` }),
    confirmModal: I.useDataQA('data-testid Confirm Modal Danger Button'),
    cancelModal: locate('button').withText('Cancel'),
    newEvaluationGroup: I.useDataQA('data-testid alert-rule new-evaluation-group-button'),
    evaluationGroupCreate: I.useDataQA('data-testid alert-rule new-evaluation-group-create-button'),
    moreMenuByAlertRuleName: (ruleName) => locate(rowByAlertRuleName(ruleName)).find('[aria-label="More"]'),
  },
  fields: {
    // searchDropdown returns a locator of a search input for a given label
    searchDropdown: (option) => `$${option}-select-input`,
    folderLocator: locate('button').withText('Select folder'),
    folderResultsLocator: (name) => locate(I.useDataQA('folder-picker'))
      .find('label')
      .withText(name),
    dropdownValue: (option) => `//*[@id='${option}']/div/div[1]/div[1]`,
    // resultsLocator returns item locator in a search dropdown based on a text
    resultsLocator: (name) => locate('[class*="grafana-select-menu"]')
    // resultsLocator: (name) => locate('//div[@aria-label="Select options menu"]')
      .find(I.useDataQA('data-testid Select option')).withText(name),
    inputField: (input) => `input[name='${input}']`,
    editRuleThreshold: 'input[name=\'evaluateFor\']',
    editRuleEvaluate: 'input[name=\'evaluateEvery\']',
    editRuleSeverity: I.useDataQA('label-value-1'),
    templatesLoader: locate('//div[@id=\'template\']').find('div').withText('Choose'),
    evaluationGroupName: I.useDataQA('data-testid alert-rule new-evaluation-group-name'),
  },
  messages: {
    noRulesFound: 'You haven\'t created any rules yet',
    confirmDelete: 'Deleting this rule will permanently remove it from your alert rule list. Are you sure you want to delete this rule?',
    successRuleCreate: (name) => `Rule "${name}" saved.`,
    successRuleEdit: 'Rule updated successfully',
    successfullyDeleted: 'Rule successfully deleted',
    failRuleCreate: 'There are errors in the form. Please correct them and try again!',
    failRuleCreateDuration: 'Failed to save rule: Duration (0s) can\'t be shorter than evaluation interval for the given group (1m0s).; Duration (0s) can\'t be shorter than evaluation interval for the given group (1m0s).',
  },

  async fillPerconaAlert(defaultRuleObj, newruleObj) {
    const {
      template, ruleName, threshold, duration, severity,
    } = defaultRuleObj;

    const editedRule = {
      ruleName: newruleObj.ruleName || 'test',
      threshold: newruleObj.threshold || '1',
      duration: newruleObj.duration || '2m',
      severity: newruleObj.severity || 'Debug',
      folder: newruleObj.folder || 'Insight',
    };

    I.waitForElement(this.fields.templatesLoader);
    this.searchAndSelectResult('template', template);
    this.verifyAndReplaceInputField('ruleName', ruleName, editedRule.ruleName);
    const thresholdExists = await I.grabNumberOfVisibleElements(this.fields.resultsLocator(threshold));

    if (thresholdExists > 0) {
      this.verifyAndReplaceInputField('threshold', threshold, editedRule.threshold);
    }

    this.verifyAndReplaceInputField('duration', duration, editedRule.duration);
    I.see(severity, this.fields.searchDropdown('severity'));
    this.searchAndSelectResult('severity', editedRule.severity);
    this.selectFolder(editedRule.folder);
    I.click(this.buttons.newEvaluationGroup);
    I.fillField(this.fields.evaluationGroupName, '1m');
    I.click(this.buttons.evaluationGroupCreate);
  },

  async editPerconaAlert(ruleObj) {
    const {
      ruleName, duration, severity, folder,
    } = ruleObj;

    I.waitForVisible(this.fields.inputField('name'));
    I.fillField(this.fields.inputField('name'), ruleName);
    // this.selectFolder(folder);
    // I.fillField(this.fields.editRuleSeverity, severity);
    I.fillField(this.fields.editRuleThreshold, duration);
    // I.fillField(this.fields.editRuleEvaluate, '10s');
    I.click(this.buttons.saveAndExit);
    I.verifyPopUpMessage(this.messages.successRuleEdit);
  },

  openAlertRulesTab() {
    I.amOnPage(this.url);
    I.waitForVisible(this.buttons.newAlertRule, 30);
  },

  openAlertRuleFromTemplatePage() {
    I.amOnPage(this.newRuleFromTemplateUrl);
    I.waitForVisible(this.fields.templatesLoader, 30);
  },

  searchAndSelectResult(dropdownLabel, option) {
    I.waitForElement(this.fields.searchDropdown(dropdownLabel));
    I.click(this.fields.searchDropdown(dropdownLabel));
    I.waitForElement(this.fields.resultsLocator(option));
    I.click(this.fields.resultsLocator(option));
  },

  verifyAndReplaceInputField(fieldName, oldValue, newValue) {
    I.waitForValue(this.fields.inputField(fieldName), oldValue);
    I.clearField(this.fields.inputField(fieldName));
    I.fillField(this.fields.inputField(fieldName), newValue);
  },

  selectFolder(option) {
    I.waitForElement(this.fields.folderLocator);
    I.click(this.fields.folderLocator);
    I.waitForElement(this.fields.folderResultsLocator(option));
    I.click(this.fields.folderResultsLocator(option));
  },

  verifyRuleDetails(ruleObj) {
    const {
      ruleName, duration, folder,
    } = ruleObj;

    this.verifyRuleList(folder, ruleName);
    I.seeElement(this.buttons.ruleCollapseButton);
    I.click(this.buttons.ruleCollapseButton);
    I.waitForElement(this.elements.ruleDetails);
    I.see(`Pending period ${duration}`, this.elements.ruleDetails);
  },

  verifyRuleList(folder, ruleName) {
    I.waitForVisible(this.buttons.groupCollapseButton(folder));
    I.click(this.buttons.groupCollapseButton(folder));
    I.seeTextEquals(ruleName, this.elements.ruleNameValue);
  },

  verifyRuleState(ruleName, timeOut) {
    I.waitForText(ruleName, timeOut, this.elements.ruleState(ruleName));
  },

  openMoreMenu(ruleName) {
    I.waitForVisible(this.buttons.moreMenuByAlertRuleName(ruleName), 30);
    I.click(this.buttons.moreMenuByAlertRuleName(ruleName));
    I.waitForVisible(this.buttons.deleteAlertRule, 10);
  },
};
