const { I } = inject();
const YAML = require('yaml');

const templateRow = (templateName) => `//tr[td[contains(., "${templateName}")]]`;

module.exports = {
  url: 'graph/alerting/alert-rule-templates',
  columnHeaders: ['Name', 'Source', 'Created', 'Actions'],
  elements: {
    addedTemplate: '//td[text()="TemplateForAutomation"]/following-sibling::td[text()="User-defined (UI)"]',
    ruleTemplateTab: '//div/a[@aria-label="Tab Alert rule Templates"]',
    templatesTableHeader: '$alert-rule-templates-table-thead',
    templatesTable: '$table-tbody',
    templateName: '//tr/td[1]',
    modalHeader: '$modal-header',
    modalWarning: '$alert-rule-name-warning',
    templateRowByName: (name) => templateRow(name),
    templateRowBySource: (source) => `//tr[descendant::div[contains(text(), "${source}")]]`,
    columnHeaderLocator: (columnHeaderText) => `//th[text()="${columnHeaderText}"]`,
    unathorizedMessage: '$unauthorized',
  },
  buttons: {
    openAddTemplateModal: '$alert-rule-template-add-modal-button',
    uploadFile: '$alert-rule-template-upload-button',
    closeModal: '$modal-close-button',
    addTemplate: '$alert-rule-template-add-button',
    editTemplate: '$alert-rule-template-edit-button',
    cancelAdding: '$alert-rule-template-cancel-button',
    confirmDelete: '$confirm-delete-modal-button',
    // editButtonBySource returns Edit template button locators for a given source
    editButtonBySource: (source) => `//tr[descendant::div[contains(text(), "${source}")]]//button[@data-testid="edit-template-button"]`,
    // deleteButtonBySource returns Delete template button locators for a given source
    deleteButtonBySource: (source) => `//tr[descendant::div[contains(text(), "${source}")]]//button[@data-testid="delete-template-button"]`,
    // editButtonByName returns Delete template button locator for a given Template name
    editButtonByName: (name) => `//td[contains(text(), "${name}")]/following-sibling::td//button[@data-testid="edit-template-button"]`,
    // deleteButtonByName returns Delete template button locator for a given Template name
    deleteButtonByName: (name) => `//td[contains(text(), "${name}")]/following-sibling::td//button[@data-testid="delete-template-button"]`,
    addRuleButtonByName: (name) => `//td[contains(text(), "${name}")]/following-sibling::td//a[@data-testid="create-from-template-button"]`,
  },
  fields: {
    templateInput: '$yaml-textarea-input',
    fileInput: locate('$modal-content').find('input').withAttr({ type: 'file' }),
  },
  messages: {
    modalHeaderText: 'Add alert rule template',
    editModalHeaderText: (name) => `Edit "${name}" Alert Rule Template`,
    editModalWarning: 'Name cannot be changed. If you need to change it, please create a new Template.',
    deleteModalHeaderText: 'Delete alert rule template',
    deleteModalMessage: (name) => `Are you sure you want to delete the alert rule template "${name}"?`,
    successfullyAdded: 'Alert rule template successfully added',
    successfullyEdited: 'Alert rule template successfully edited',
    successfullyDeleted: (name) => `Alert rule template "${name}" successfully deleted.`,
    failedToParse: 'Failed to parse rule template',
    failedToDelete: (name) => `You can't delete the "${name}" rule template when it's being used by a rule.`,
    duplicateTemplate: (id) => `Template with name "${id}" already exists.`,
  },
  templateSources: {
    ui: 'User Created (UI)',
    builtin: 'Built-in',
    file: 'User Created (file)',
    saas: 'Percona Platform',
  },
  ruleTemplate: {
    // templateNameAndContent parses yaml file and returns
    // template name, full content as string and template id
    templateNameAndContent: async (ymlPath) => {
      const content = await I.readFile(ymlPath);

      try {
        const name = YAML.parse(content).templates[0].summary;
        const id = YAML.parse(content).templates[0].name;
        const { expr } = YAML.parse(content).templates[0];

        return [name, content, id, expr];
      } catch (e) {
        return ['', '', '', ''];
      }
    },

    parseTemplates: async (ymlPath) => {
      const content = await I.readFile(ymlPath);

      try {
        const { templates } = YAML.parse(content);

        return templates;
      } catch (e) {
        return [];
      }
    },
    inputFilePath: 'tests/ia/templates/inputTemplate.yml',
    paths: {
      yml: 'tests/ia/templates/template.yml',
      yaml: 'tests/ia/templates/template.yaml',
      txt: 'tests/ia/templates/template.txt',
    },
  },

  getSourceLocator(templateName, source) {
    return locate(templateRow(templateName)).find('td').withText(source);
    // return `//td[contains(text(), "${templateName}")]/following-sibling::td[text()="${source}"]`;
  },

  async verifyInputContent(ymlPath) {
    const file = await I.readFile(ymlPath);

    I.seeInField(this.fields.templateInput, file);
  },

  openRuleTemplatesTab() {
    I.amOnPage(this.url);
    // I.waitForVisible(this.elements.ruleTemplateTab, 30);
    // I.click(this.elements.ruleTemplateTab);
    I.waitForVisible(this.elements.templatesTable, 30);
  },

  verifyEditModalHeaderAndWarning(templateName) {
    // Checking Rule template name in modal header
    I.seeTextEquals(
      this.messages.editModalHeaderText(templateName),
      this.elements.modalHeader,
    );
    // Checking Warning in modal
    I.seeTextEquals(this.messages.editModalWarning, this.elements.modalWarning);
  },

  openEditDialog(templateName) {
    I.waitForElement(this.buttons.editButtonByName(templateName), 30);
    I.click(this.buttons.editButtonByName(templateName));
  },

  async verifyRuleTemplateContent(content) {
    I.waitForVisible(this.fields.templateInput, 30);
    const expected = content.replaceAll(/ +(?= )/g, '');
    const val = (await I.grabValueFrom(this.fields.templateInput)).replaceAll(/ +(?= )/g, '');

    I.assertEqual(val, expected);
  },

  openAddDialog(templateName) {
    I.waitForElement(this.buttons.addRuleButtonByName(templateName), 30);
    I.click(this.buttons.addRuleButtonByName(templateName));
  },
};
