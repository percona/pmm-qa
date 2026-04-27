const assert = require('assert');
const YAML = require('yaml');
const page = require('./pages/ruleTemplatesPage');
const { users } = require('../helper/constants');

const templates = new DataTable(['path', 'error']);
const units = new DataTable(['unit', 'range']);

units.add(['%', '[0, 100]']);
units.add(['s', '[0, 100]']);
units.add(['*', '[0, 100]']);
units.add(['%', '']);

templates.add([page.ruleTemplate.paths.yaml, null]);
templates.add([page.ruleTemplate.paths.yml, null]);
templates.add([page.ruleTemplate.paths.txt, page.messages.failedToParse]);
templates.add(['tests/ia/templates/customParam.yml', null]);
templates.add(['tests/ia/templates/undefinedParam.yml',
  'failed to fill expression placeholders: template: :4:5: executing "" at <.threshold>: map has no entry for key "threshold".']);
templates.add(['tests/ia/templates/specialCharInParam.yml',
  'failed to parse expression: template: :4: bad character U+0040 \'@\'.']);
templates.add(['tests/ia/templates/spaceInParam.yml',
  'failed to parse expression: template: :4: function "old" not defined.']);

Feature('IA: Alert rule templates').retry(1);

BeforeSuite(async ({ I }) => {
  const viewerId = await I.createUser(users.viewer.username, users.viewer.password);
  const adminId = await I.createUser(users.admin.username, users.admin.password);
  const editorId = await I.createUser(users.editor.username, users.editor.password);

  await I.setRole(viewerId);
  await I.setRole(adminId, 'Admin');
  await I.setRole(editorId, 'Editor');
});

Before(async ({
  I, settingsAPI, templatesAPI, rulesAPI,
}) => {
  await I.Authorize();
  await settingsAPI.apiEnableIA();
  await rulesAPI.removeAllAlertRules();
  await templatesAPI.clearAllTemplates();
});

// TODO: Unskip after we bring back built-in templates
Scenario.skip(
  'PMM-T510 - Verify built-in rule templates are non-editable @fb-alerting @grafana-pr',
  async ({ I, ruleTemplatesPage }) => {
    const editButton = ruleTemplatesPage.buttons
      .editButtonBySource(ruleTemplatesPage.templateSources.builtin);
    const deleteButton = ruleTemplatesPage.buttons
      .deleteButtonBySource(ruleTemplatesPage.templateSources.builtin);

    ruleTemplatesPage.openRuleTemplatesTab();
    I.waitForVisible(editButton, 30);
    I.seeElementsDisabled(editButton);
    I.seeElementsDisabled(deleteButton);
  },
);

Scenario(
  'Verify rule templates list elements @fb-alerting @grafana-pr',
  async ({ I, ruleTemplatesPage, templatesAPI }) => {
    const path = ruleTemplatesPage.ruleTemplate.paths.yaml;

    ruleTemplatesPage.openRuleTemplatesTab();
    I.waitForVisible(ruleTemplatesPage.elements.columnHeaderLocator('Name'), 30);
    I.waitForVisible(ruleTemplatesPage.elements.columnHeaderLocator('Source'), 30);
    I.waitForVisible(ruleTemplatesPage.elements.columnHeaderLocator('Actions'), 30);

    await templatesAPI.createRuleTemplate(path);
    I.refreshPage();

    I.waitForVisible(ruleTemplatesPage.elements.columnHeaderLocator('Name'), 30);
    I.waitForVisible(ruleTemplatesPage.elements.columnHeaderLocator('Source'), 30);
    // I.waitForVisible(ruleTemplatesPage.elements.columnHeaderLocator('Created'), 30);
    I.waitForVisible(ruleTemplatesPage.elements.columnHeaderLocator('Actions'), 30);
    const templateName = await I.grabTextFromAll(ruleTemplatesPage.elements.templateName);

    templateName.forEach((name) => {
      assert.ok(name.length > 0, 'Rule Template name should not be empty');
    });
    I.seeElement(ruleTemplatesPage.buttons.openAddTemplateModal);
  },
);

Scenario(
  'Add rule template modal elements @fb-alerting @grafana-pr',
  async ({ I, ruleTemplatesPage }) => {
    ruleTemplatesPage.openRuleTemplatesTab();
    I.click(ruleTemplatesPage.buttons.openAddTemplateModal);
    I.see(ruleTemplatesPage.messages.modalHeaderText, ruleTemplatesPage.elements.modalHeader);
    I.seeElement(ruleTemplatesPage.buttons.closeModal);
    I.seeElement(ruleTemplatesPage.buttons.uploadFile);
    I.seeElement(ruleTemplatesPage.buttons.addTemplate);
    I.seeElement(ruleTemplatesPage.buttons.cancelAdding);
  },
);

Scenario(
  'PMM-T1993 - verify editor can create alert rule template @fb-alerting',
  async ({
    I, ruleTemplatesPage,
  }) => {
    await I.Authorize(users.editor.username, users.editor.password);
    const templateName = 'E2E editor permissions input YML';

    const [, fileContent] = await ruleTemplatesPage.ruleTemplate
      .templateNameAndContent(ruleTemplatesPage.ruleTemplate.inputFilePath);
    const editButton = ruleTemplatesPage.buttons
      .editButtonByName(templateName);
    const deleteButton = ruleTemplatesPage.buttons
      .deleteButtonByName(templateName);

    const newFileContent = fileContent
      .replace('name: input_template_yml', 'name: input_template_yml_editor_permissions')
      .replace('summary: E2E TemplateForAutomation input YML', `summary: ${templateName}`);

    ruleTemplatesPage.openRuleTemplatesTab();

    I.click(ruleTemplatesPage.buttons.openAddTemplateModal);
    I.fillField(ruleTemplatesPage.fields.templateInput, newFileContent);
    I.click(ruleTemplatesPage.buttons.addTemplate);
    I.waitForEnabled(editButton);
    I.waitForEnabled(deleteButton);
  },
);

// nightly candidate
Data(units)
  .Scenario(
    'PMM-T500 + PMM-T595 + PMM-T596 - Add rule templates with different units, empty range @fb-alerting',
    async ({
      I, ruleTemplatesPage, templatesAPI, current,
    }) => {
      const [templateName, fileContent, id] = await ruleTemplatesPage.ruleTemplate
        .templateNameAndContent(ruleTemplatesPage.ruleTemplate.inputFilePath);
      const editButton = ruleTemplatesPage.buttons
        .editButtonByName(templateName);
      const deleteButton = ruleTemplatesPage.buttons
        .deleteButtonByName(templateName);

      const newFileContent = fileContent
        .replace('unit: \'%\'', `unit: '${current.unit}'`)
        .replace('range: [0, 100]', `range: ${current.range}`);

      ruleTemplatesPage.openRuleTemplatesTab();

      I.click(ruleTemplatesPage.buttons.openAddTemplateModal);
      I.fillField(ruleTemplatesPage.fields.templateInput, newFileContent);
      I.click(ruleTemplatesPage.buttons.addTemplate);
      if (current.unit !== '*') {
        I.verifyPopUpMessage(ruleTemplatesPage.messages.successfullyAdded);

        // Check that Edit and Delete buttons are enabled
        I.waitForEnabled(editButton);
        I.waitForEnabled(deleteButton);

        await templatesAPI.removeTemplate(id);
      } else {
        I.verifyPopUpMessage(ruleTemplatesPage.messages.failedToParse);
      }
    },
  );

Data(templates)
  .Scenario(
    'PMM-T482 + PMM-T499 + PMM-T766 + PMM-T758 + PMM-T766 + PMM-T767 + PMM-T931 - Upload rule templates @fb-alerting',
    async ({ I, ruleTemplatesPage, current }) => {
      const { path } = current;
      const validFile = !current.error;
      const [templateName] = await ruleTemplatesPage.ruleTemplate.templateNameAndContent(path);
      const expectedSourceLocator = ruleTemplatesPage
        .getSourceLocator(templateName, ruleTemplatesPage.templateSources.ui);
      const editButton = ruleTemplatesPage.buttons
        .editButtonBySource(ruleTemplatesPage.templateSources.ui);

      ruleTemplatesPage.openRuleTemplatesTab();
      I.click(ruleTemplatesPage.buttons.openAddTemplateModal);
      I.attachFile(ruleTemplatesPage.fields.fileInput, path);
      await ruleTemplatesPage.verifyInputContent(path);
      I.click(ruleTemplatesPage.buttons.addTemplate);

      if (validFile) {
        I.verifyPopUpMessage(ruleTemplatesPage.messages.successfullyAdded);
        I.waitForVisible(expectedSourceLocator, 30);
        I.waitForEnabled(editButton);
      } else {
        I.verifyPopUpMessage(current.error);
      }
    },
  );

Scenario(
  'PMM-T1785 - Bulk rule templates upload @fb-alerting',
  async ({ I, ruleTemplatesPage }) => {
    const path = 'tests/ia/templates/multiple-templates.yml';
    const templates = await ruleTemplatesPage.ruleTemplate.parseTemplates(path);

    ruleTemplatesPage.openRuleTemplatesTab();
    I.click(ruleTemplatesPage.buttons.openAddTemplateModal);
    I.attachFile(ruleTemplatesPage.fields.fileInput, path);
    await ruleTemplatesPage.verifyInputContent(path);
    I.click(ruleTemplatesPage.buttons.addTemplate);
    I.verifyPopUpMessage(ruleTemplatesPage.messages.successfullyAdded);

    for (const { summary: templateName } of templates) {
      const expectedSourceLocator = ruleTemplatesPage
        .getSourceLocator(templateName, ruleTemplatesPage.templateSources.ui);
      const editButton = ruleTemplatesPage.buttons
        .editButtonBySource(ruleTemplatesPage.templateSources.ui);

      I.waitForVisible(expectedSourceLocator, 30);
      I.waitForEnabled(editButton);
    }
  },
);

Scenario(
  'PMM-T1786 - Edit bulk uploaded rule template @fb-alerting',
  async ({ I, ruleTemplatesPage, templatesAPI }) => {
    const path = 'tests/ia/templates/multiple-templates.yml';
    const templates = await ruleTemplatesPage.ruleTemplate.parseTemplates(path);

    await templatesAPI.createRuleTemplate(path);

    for (const templateData of templates) {
      const templateName = templateData.summary;
      const newTemplateName = `${templateName}_updated`;
      const template = YAML.stringify({ templates: [templateData] });

      // Normalizing data due to a library formatting difference
      const yml = template
        .replaceAll(/ +(?= )/g, '')
        .replaceAll(' range:\n'
          + ' - 0\n'
          + ' - 100\n', ' range: [0, 100]\n')
        .replaceAll('unit: "%"', 'unit: \'%\'');

      ruleTemplatesPage.openRuleTemplatesTab();
      ruleTemplatesPage.openEditDialog(templateName);
      await ruleTemplatesPage.verifyRuleTemplateContent(yml);
      const updatedTemplateText = template.replaceAll(templateName, newTemplateName);
      const expectedTemplateText = yml.replaceAll(templateName, newTemplateName);

      I.clearField(ruleTemplatesPage.fields.templateInput);
      I.fillField(ruleTemplatesPage.fields.templateInput, updatedTemplateText);
      I.click(ruleTemplatesPage.buttons.editTemplate);
      I.verifyPopUpMessage(ruleTemplatesPage.messages.successfullyEdited);
      ruleTemplatesPage.openEditDialog(newTemplateName);
      await ruleTemplatesPage.verifyRuleTemplateContent(expectedTemplateText);
    }
  },
);

Scenario(
  'PMM-T1787 - Delete bulk uploaded rule template @fb-alerting',
  async ({ I, ruleTemplatesPage, templatesAPI }) => {
    const path = 'tests/ia/templates/multiple-templates.yml';
    const templates = await ruleTemplatesPage.ruleTemplate.parseTemplates(path);

    await templatesAPI.createRuleTemplate(path);

    for (const { summary: templateName } of templates) {
      const deleteButton = ruleTemplatesPage.buttons
        .deleteButtonByName(templateName);

      ruleTemplatesPage.openRuleTemplatesTab();

      I.waitForElement(deleteButton, 30);
      I.click(deleteButton);
      I.waitForText(
        ruleTemplatesPage.messages.deleteModalHeaderText,
        30,
        ruleTemplatesPage.elements.modalHeader,
      );
      I.seeTextEquals(
        ruleTemplatesPage.messages.deleteModalMessage(templateName),
        locate(ruleTemplatesPage.elements.modalContent).find('h4'),
      );
      I.click(ruleTemplatesPage.buttons.confirmDelete);
      I.verifyPopUpMessage(ruleTemplatesPage.messages.successfullyDeleted(templateName));
      I.dontSeeElement(deleteButton);
    }
  },
);

Scenario(
  'PMM-T501 - Upload duplicate rule template @fb-alerting @grafana-pr',
  async ({ I, ruleTemplatesPage, templatesAPI }) => {
    const path = ruleTemplatesPage.ruleTemplate.paths.yaml;
    const [, , id] = await ruleTemplatesPage.ruleTemplate.templateNameAndContent(path);
    const message = ruleTemplatesPage.messages.duplicateTemplate(id);

    await templatesAPI.createRuleTemplate(path);

    ruleTemplatesPage.openRuleTemplatesTab();
    I.click(ruleTemplatesPage.buttons.openAddTemplateModal);
    I.attachFile(ruleTemplatesPage.fields.fileInput, path);
    await ruleTemplatesPage.verifyInputContent(path);
    I.click(ruleTemplatesPage.buttons.addTemplate);
    I.verifyPopUpMessage(message);
  },
);
const usersTable = new DataTable(['username', 'password']);

usersTable.add(['admin', '']);
usersTable.add([users.editor.username, users.editor.password]);

Data(usersTable).Scenario(
  'PMM-T483 + PMM-T699 + PMM-T1994 - Verify user can edit UI-created IA rule template @grafana-pr @fb-alerting',
  async ({
    I, ruleTemplatesPage, templatesAPI, current,
  }) => {
    if (current.username !== 'admin') await I.Authorize(current.username, current.password);

    const path = ruleTemplatesPage.ruleTemplate.paths.yaml;
    const [templateName, fileContent, id] = await ruleTemplatesPage.ruleTemplate
      .templateNameAndContent(path);
    const newTemplateName = 'Updated E2E Template';
    const updatedTemplateText = fileContent.replace(templateName, newTemplateName);

    await templatesAPI.createRuleTemplate(path);

    ruleTemplatesPage.openRuleTemplatesTab();
    ruleTemplatesPage.openEditDialog(templateName);
    await ruleTemplatesPage.verifyRuleTemplateContent(fileContent);
    I.seeElementsDisabled(ruleTemplatesPage.buttons.editTemplate);
    I.clearField(ruleTemplatesPage.fields.templateInput);
    I.fillField(ruleTemplatesPage.fields.templateInput, updatedTemplateText);
    I.waitForEnabled(ruleTemplatesPage.buttons.editTemplate, 10);
    ruleTemplatesPage.verifyEditModalHeaderAndWarning(templateName);
    I.click(ruleTemplatesPage.buttons.editTemplate);
    I.verifyPopUpMessage(ruleTemplatesPage.messages.successfullyEdited);
    ruleTemplatesPage.openEditDialog(newTemplateName);
    await ruleTemplatesPage.verifyRuleTemplateContent(updatedTemplateText);

    // Checking Updated Rule template name in modal header
    ruleTemplatesPage.verifyEditModalHeaderAndWarning(newTemplateName);

    await templatesAPI.removeTemplate(id);
  },
);

Data(usersTable).Scenario(
  'PMM-T562 + PMM-T1995 - Verify user can delete User-defined (UI) rule templates @grafana-pr @fb-alerting',
  async ({
    I, ruleTemplatesPage, templatesAPI, current,
  }) => {
    if (current.username !== 'admin') await I.Authorize(current.username, current.password);

    const path = ruleTemplatesPage.ruleTemplate.paths.yaml;
    const [templateName] = await ruleTemplatesPage.ruleTemplate
      .templateNameAndContent(path);
    const deleteButton = ruleTemplatesPage.buttons
      .deleteButtonByName(templateName);

    await templatesAPI.createRuleTemplate(path);
    ruleTemplatesPage.openRuleTemplatesTab();

    I.waitForElement(deleteButton, 30);
    I.click(deleteButton);
    I.waitForText(
      ruleTemplatesPage.messages.deleteModalHeaderText,
      30,
      ruleTemplatesPage.elements.modalHeader,
    );
    I.seeTextEquals(
      ruleTemplatesPage.messages.deleteModalMessage(templateName),
      locate(ruleTemplatesPage.elements.modalContent).find('h4'),
    );
    I.click(ruleTemplatesPage.buttons.confirmDelete);
    I.verifyPopUpMessage(ruleTemplatesPage.messages.successfullyDeleted(templateName));
    I.dontSeeElement(deleteButton);
  },
);

Scenario(
  'PMM-T553 - Verify rule template can be deleted if there is a rule based on it @fb-alerting',
  async ({
    I, ruleTemplatesPage, templatesAPI, rulesAPI,
  }) => {
    const path = ruleTemplatesPage.ruleTemplate.paths.yaml;
    const [templateName] = await ruleTemplatesPage.ruleTemplate
      .templateNameAndContent(path);
    const deleteButton = ruleTemplatesPage.buttons
      .deleteButtonByName(templateName);

    await templatesAPI.createRuleTemplate(path);
    await rulesAPI.createAlertRule({ ruleName: 'Rule for PMM-T553' }, 'PostgreSQL');
    ruleTemplatesPage.openRuleTemplatesTab();

    I.waitForElement(deleteButton, 30);
    I.click(deleteButton);
    I.click(ruleTemplatesPage.buttons.confirmDelete);
    I.verifyPopUpMessage(ruleTemplatesPage.messages.successfullyDeleted(templateName));
  },
);

Scenario(
  'PMM-T825 + PMM-T821 - Verify User can add Alert rule template in the file system @not-ovf @fb-alerting',
  async ({ I, ruleTemplatesPage }) => {
    const editButton = ruleTemplatesPage.buttons
      .editButtonBySource(ruleTemplatesPage.templateSources.file);
    const deleteButton = ruleTemplatesPage.buttons
      .deleteButtonBySource(ruleTemplatesPage.templateSources.file);

    await I.verifyCommand('docker cp tests/ia/templates/customParam.yml pmm-server:/srv/alerting/templates');
    await I.verifyCommand('docker cp tests/ia/templates/spaceInParam.yml pmm-server:/srv/alerting/templates');
    await I.verifyCommand('docker cp tests/ia/templates/template.txt pmm-server:/srv/alerting/templates');

    ruleTemplatesPage.openRuleTemplatesTab();
    I.seeElement(ruleTemplatesPage.buttons.addRuleButtonByName('Custom parameter template'));
    I.dontSeeElement(ruleTemplatesPage.buttons.addRuleButtonByName('Space in parameter'));

    I.dontSeeElement(editButton);
    I.dontSeeElement(deleteButton);
  },
);

Scenario(
  'PMM-T1514 - Verify that alert rule templates has only 1 exit button @fb-alerting',
  async ({ I, ruleTemplatesPage, alertRulesPage }) => {
    ruleTemplatesPage.openRuleTemplatesTab();
    ruleTemplatesPage.openAddDialog(await I.grabTextFrom(ruleTemplatesPage.elements.templateName));
    I.dontSeeElement('//button[span[text()="Save"]]');
    I.seeElement(alertRulesPage.buttons.saveAndExit);
  },
);

Scenario(
  'PMM-T2164 - Verify user can create alert from template with tiers field @fb-alerting',
  async ({
    I, ruleTemplatesPage,
  }) => {
    ruleTemplatesPage.openRuleTemplatesTab();
    I.waitForVisible(ruleTemplatesPage.buttons.openAddTemplateModal);
    I.click(ruleTemplatesPage.buttons.openAddTemplateModal);
    const alertRule = await ruleTemplatesPage.ruleTemplate.templateContent('tests/ia/templates/templateWithTiers.yml');

    I.usePlaywrightTo('Fill alert rule template', async ({ page }) => {
      await page.locator(ruleTemplatesPage.fields.templateInput.value).waitFor({ state: 'visible' });
      await page.locator(ruleTemplatesPage.fields.templateInput.value).fill(alertRule);
    });

    I.click(ruleTemplatesPage.buttons.addTemplate);
    I.verifyPopUpMessage(ruleTemplatesPage.messages.successfullyAdded);
  },
);
