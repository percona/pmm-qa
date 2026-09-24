import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { AlertSeverity } from '@interfaces/alerting';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const templatesDir = 'testdata/ia/templates';
const templateYaml = `${templatesDir}/template.yaml`;
const inputTemplate = `${templatesDir}/inputTemplate.yml`;
const bulkTemplates = `${templatesDir}/multiple-templates.yml`;
const added = 'Alert rule template successfully added';
const edited = 'Alert rule template successfully edited';
const failedToParse = 'Failed to parse rule template';
const nameWarning = 'Name cannot be changed. If you need to change it, please create a new Template.';
const uiSource = 'User Created (UI)';
const editor = { password: 'password', username: 'test_editor' };
const users = [{ password: undefined, username: 'admin' }, editor];
let createdEditorId: number | undefined;

pmmTest.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  const grafanaHelper = new GrafanaHelper(page);
  const { created, id } = await grafanaHelper.findOrCreateUser(editor.username, editor.password);

  if (created) createdEditorId = id;

  await grafanaHelper.promoteToEditor(id);
  await page.close();
});

pmmTest.beforeEach(async ({ api, cliHelper, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await api.settingsApi.updateSettings({ enable_alerting: true });
  await api.alertingApi.removeAllAlertRules();
  cliHelper.execute(`docker exec pmm-server sh -c 'rm -f /srv/alerting/templates/*'`).assertSuccess();

  const response = await api.alertingApi.listTemplates(GrafanaHelper.getAuthHeader());

  expect(response.status()).toEqual(200);

  const { templates } = (await response.json()) as { templates: { name: string; source: string }[] };

  for (const { name } of templates.filter(({ source }) => source === 'TEMPLATE_SOURCE_USER_API')) {
    expect((await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), name)).status()).toEqual(200);
  }
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();

  if (createdEditorId) await new GrafanaHelper(page).deleteUser(createdEditorId);

  await page.close();
});

pmmTest(
  'Verify rule templates list elements @fb-alerting @grafana-pr',
  async ({ alertingPage, api, page }) => {
    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    for (const header of ['Name', 'Source', 'Actions']) {
      await expect(alertingPage.builders.templateColumnHeader(header)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    }

    await api.alertingApi.uploadTemplate(alertingPage.readTemplateFile(templateYaml).content);
    await page.reload();

    for (const header of ['Name', 'Source', 'Actions']) {
      await expect(alertingPage.builders.templateColumnHeader(header)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    }

    await expect
      .poll(() => alertingPage.elements.templateNames.allInnerTexts(), {
        message: 'Rule Template name should not be empty',
      })
      .not.toContain('');
    await expect(alertingPage.buttons.addTemplate).toBeVisible();
  },
);

pmmTest('Add rule template modal elements @fb-alerting @grafana-pr', async ({ alertingPage, page }) => {
  await page.goto(alertingPage.urls.templates);
  await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  await alertingPage.buttons.addTemplate.click();
  await expect(alertingPage.elements.modalHeader).toContainText('Add alert rule template');
  await expect(alertingPage.buttons.closeModal).toBeVisible();
  await expect(alertingPage.buttons.uploadFile).toBeVisible();
  await expect(alertingPage.buttons.submitTemplate).toBeVisible();
  await expect(alertingPage.buttons.cancelTemplate).toBeVisible();
});

pmmTest(
  'PMM-T1993 - verify editor can create alert rule template @fb-alerting',
  async ({ alertingPage, grafanaHelper, page }) => {
    const templateName = 'E2E editor permissions input YML';

    await grafanaHelper.authorize(editor.username, editor.password);
    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.createTemplate(
      alertingPage
        .readTemplateFile(inputTemplate)
        .content.replace('name: input_template_yml', 'name: input_template_yml_editor_permissions')
        .replace('summary: E2E TemplateForAutomation input YML', `summary: ${templateName}`),
    );
    await expect(alertingPage.builders.editTemplate(templateName)).toBeEnabled({
      timeout: Timeouts.ONE_MINUTE,
    });
    await expect(alertingPage.builders.deleteTemplate(templateName)).toBeEnabled({
      timeout: Timeouts.ONE_MINUTE,
    });
  },
);

for (const [unit, range] of [
  ['%', '[0, 100]'],
  ['s', '[0, 100]'],
  ['%', ''],
] as const) {
  pmmTest(
    `PMM-T500 + PMM-T595 + PMM-T596 - Add rule templates with different units, empty range @fb-alerting | unit ${unit}, range ${range || 'empty'}`,
    async ({ alertingPage, api, page }) => {
      const {
        content,
        templates: [{ name, summary }],
      } = alertingPage.readTemplateFile(inputTemplate);

      await page.goto(alertingPage.urls.templates);
      await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await alertingPage.createTemplate(
        content.replace("unit: '%'", `unit: '${unit}'`).replace('range: [0, 100]', `range: ${range}`),
      );
      await expect(alertingPage.messages.popUp).toContainText(added, { timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.builders.editTemplate(summary)).toBeEnabled({ timeout: Timeouts.ONE_MINUTE });
      await expect(alertingPage.builders.deleteTemplate(summary)).toBeEnabled({
        timeout: Timeouts.ONE_MINUTE,
      });
      expect((await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), name)).status()).toEqual(
        200,
      );
    },
  );
}

pmmTest(
  'PMM-T500 + PMM-T595 + PMM-T596 - Add rule templates with different units, empty range @fb-alerting | unit *, range [0, 100]',
  async ({ alertingPage, page }) => {
    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.createTemplate(
      alertingPage.readTemplateFile(inputTemplate).content.replace("unit: '%'", "unit: '*'"),
    );
    await expect(alertingPage.messages.popUp).toContainText(failedToParse, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

for (const file of ['template.yaml', 'template.yml', 'customParam.yml']) {
  pmmTest(
    `PMM-T482 + PMM-T499 + PMM-T766 + PMM-T758 + PMM-T766 + PMM-T767 + PMM-T931 - Upload rule templates @fb-alerting | ${file}`,
    async ({ alertingPage, page }) => {
      const path = `${templatesDir}/${file}`;
      const {
        content,
        templates: [{ summary }],
      } = alertingPage.readTemplateFile(path);

      await page.goto(alertingPage.urls.templates);
      await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await alertingPage.attachTemplateFile(path);
      await expect.poll(() => alertingPage.inputs.template.inputValue()).toContain(content);
      await alertingPage.buttons.submitTemplate.click();
      await expect(alertingPage.messages.popUp).toContainText(added, { timeout: Timeouts.THIRTY_SECONDS });
      await expect(alertingPage.builders.templateRow(summary)).toContainText(uiSource, {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.builders.editTemplate(summary)).toBeEnabled({ timeout: Timeouts.ONE_MINUTE });
    },
  );
}

for (const [file, error] of [
  ['template.txt', failedToParse],
  [
    'undefinedParam.yml',
    'failed to fill expression placeholders: template: :4:5: executing "" at <.threshold>: map has no entry for key "threshold".',
  ],
  ['specialCharInParam.yml', "failed to parse expression: template: :4: bad character U+0040 '@'."],
  ['spaceInParam.yml', 'failed to parse expression: template: :4: function "old" not defined.'],
] as const) {
  pmmTest(
    `PMM-T482 + PMM-T499 + PMM-T766 + PMM-T758 + PMM-T766 + PMM-T767 + PMM-T931 - Upload rule templates @fb-alerting | ${file}`,
    async ({ alertingPage, page }) => {
      const path = `${templatesDir}/${file}`;

      await page.goto(alertingPage.urls.templates);
      await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await alertingPage.attachTemplateFile(path);
      await expect
        .poll(() => alertingPage.inputs.template.inputValue())
        .toContain(alertingPage.readTemplateFile(path).content);
      await alertingPage.buttons.submitTemplate.click();
      await expect(alertingPage.messages.popUp).toContainText(error, { timeout: Timeouts.THIRTY_SECONDS });
    },
  );
}

pmmTest('PMM-T1785 - Bulk rule templates upload @fb-alerting', async ({ alertingPage, page }) => {
  const { content, templates } = alertingPage.readTemplateFile(bulkTemplates);

  await page.goto(alertingPage.urls.templates);
  await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  await alertingPage.attachTemplateFile(bulkTemplates);
  await expect.poll(() => alertingPage.inputs.template.inputValue()).toContain(content);
  await alertingPage.buttons.submitTemplate.click();
  await expect(alertingPage.messages.popUp).toContainText(added, { timeout: Timeouts.THIRTY_SECONDS });

  for (const { summary } of templates) {
    await expect(alertingPage.builders.templateRow(summary)).toContainText(uiSource, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(alertingPage.builders.editTemplate(summary)).toBeEnabled({ timeout: Timeouts.ONE_MINUTE });
  }
});

pmmTest('PMM-T1786 - Edit bulk uploaded rule template @fb-alerting', async ({ alertingPage, api, page }) => {
  const { content, templates } = alertingPage.readTemplateFile(bulkTemplates);

  await api.alertingApi.uploadTemplate(content);

  for (const { summary, yaml } of templates) {
    const updatedYaml = yaml.replaceAll(summary, `${summary}_updated`);

    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.builders.editTemplate(summary).click();
    await expect(alertingPage.inputs.template).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect
      .poll(async () => alertingPage.normalizeTemplate(await alertingPage.inputs.template.inputValue()))
      .toBe(alertingPage.normalizeTemplate(yaml));
    await alertingPage.inputs.template.fill(updatedYaml);
    await alertingPage.buttons.saveTemplate.click();
    await expect(alertingPage.messages.popUp).toContainText(edited, { timeout: Timeouts.THIRTY_SECONDS });

    await alertingPage.builders.editTemplate(`${summary}_updated`).click();
    await expect(alertingPage.inputs.template).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect
      .poll(async () => alertingPage.normalizeTemplate(await alertingPage.inputs.template.inputValue()))
      .toBe(alertingPage.normalizeTemplate(updatedYaml));
  }
});

pmmTest(
  'PMM-T1787 - Delete bulk uploaded rule template @fb-alerting',
  async ({ alertingPage, api, page }) => {
    const { content, templates } = alertingPage.readTemplateFile(bulkTemplates);

    await api.alertingApi.uploadTemplate(content);

    for (const { summary } of templates) {
      await page.goto(alertingPage.urls.templates);
      await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await alertingPage.builders.deleteTemplate(summary).click();
      await expect(alertingPage.elements.modalHeader).toContainText('Delete Alert Rule Template', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.elements.deleteModalMessage).toHaveText(
        `Are you sure you want to delete the alert rule template "${summary}"?`,
      );
      await alertingPage.buttons.confirmDelete.click();
      await expect(alertingPage.messages.popUp).toContainText(
        `Alert rule template "${summary}" successfully deleted.`,
        {
          timeout: Timeouts.THIRTY_SECONDS,
        },
      );
      await expect(alertingPage.builders.deleteTemplate(summary)).toBeHidden();
    }
  },
);

pmmTest(
  'PMM-T501 - Upload duplicate rule template @fb-alerting @grafana-pr',
  async ({ alertingPage, api, page }) => {
    const {
      content,
      templates: [{ name }],
    } = alertingPage.readTemplateFile(templateYaml);

    await api.alertingApi.uploadTemplate(content);
    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.attachTemplateFile(templateYaml);
    await expect.poll(() => alertingPage.inputs.template.inputValue()).toContain(content);
    await alertingPage.buttons.submitTemplate.click();
    await expect(alertingPage.messages.popUp).toContainText(`Template with name "${name}" already exists.`, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

for (const user of users) {
  pmmTest(
    `PMM-T483 + PMM-T699 + PMM-T1994 - Verify user can edit UI-created IA rule template @grafana-pr @fb-alerting | ${user.username}`,
    async ({ alertingPage, api, grafanaHelper, page }) => {
      const newSummary = 'Updated E2E Template';
      const {
        content,
        templates: [{ name, summary }],
      } = alertingPage.readTemplateFile(templateYaml);
      const updatedContent = content.replace(summary, newSummary);

      await grafanaHelper.authorize(user.username, user.password);
      await api.alertingApi.uploadTemplate(content);
      await page.goto(alertingPage.urls.templates);
      await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await alertingPage.builders.editTemplate(summary).click();
      await expect(alertingPage.inputs.template).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect
        .poll(async () => alertingPage.normalizeTemplate(await alertingPage.inputs.template.inputValue()))
        .toBe(alertingPage.normalizeTemplate(content));
      await expect(alertingPage.buttons.saveTemplate).toBeDisabled();
      await alertingPage.inputs.template.fill(updatedContent);
      await expect(alertingPage.buttons.saveTemplate).toBeEnabled({ timeout: Timeouts.TEN_SECONDS });
      await expect(alertingPage.elements.modalHeader).toHaveText(`Edit "${summary}" Alert Rule Template`);
      await expect(alertingPage.elements.modalWarning).toHaveText(nameWarning);
      await alertingPage.buttons.saveTemplate.click();
      await expect(alertingPage.messages.popUp).toContainText(edited, { timeout: Timeouts.THIRTY_SECONDS });
      await alertingPage.builders.editTemplate(newSummary).click();
      await expect(alertingPage.inputs.template).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect
        .poll(async () => alertingPage.normalizeTemplate(await alertingPage.inputs.template.inputValue()))
        .toBe(alertingPage.normalizeTemplate(updatedContent));
      await expect(alertingPage.elements.modalHeader).toHaveText(`Edit "${newSummary}" Alert Rule Template`);
      await expect(alertingPage.elements.modalWarning).toHaveText(nameWarning);
      expect((await api.alertingApi.deleteTemplate(GrafanaHelper.getAuthHeader(), name)).status()).toEqual(
        200,
      );
    },
  );
}

for (const user of users) {
  pmmTest(
    `PMM-T562 + PMM-T1995 - Verify user can delete User-defined (UI) rule templates @grafana-pr @fb-alerting | ${user.username}`,
    async ({ alertingPage, api, grafanaHelper, page }) => {
      const {
        content,
        templates: [{ summary }],
      } = alertingPage.readTemplateFile(templateYaml);

      await grafanaHelper.authorize(user.username, user.password);
      await api.alertingApi.uploadTemplate(content);
      await page.goto(alertingPage.urls.templates);
      await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await alertingPage.builders.deleteTemplate(summary).click();
      await expect(alertingPage.elements.modalHeader).toContainText('Delete Alert Rule Template', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(alertingPage.elements.deleteModalMessage).toHaveText(
        `Are you sure you want to delete the alert rule template "${summary}"?`,
      );
      await alertingPage.buttons.confirmDelete.click();
      await expect(alertingPage.messages.popUp).toContainText(
        `Alert rule template "${summary}" successfully deleted.`,
        { timeout: Timeouts.THIRTY_SECONDS },
      );
      await expect(alertingPage.builders.deleteTemplate(summary)).toBeHidden();
    },
  );
}

pmmTest(
  'PMM-T553 - Verify rule template can be deleted if there is a rule based on it @fb-alerting',
  async ({ alertingPage, api, page }) => {
    const {
      content,
      templates: [{ summary }],
    } = alertingPage.readTemplateFile(templateYaml);

    await api.alertingApi.uploadTemplate(content);
    await api.alertingApi.createRuleFromTemplate({
      folderUid: await api.grafanaApi.getFolderUid('PostgreSQL'),
      group: '10s',
      interval: '10s',
      name: 'Rule for PMM-T553',
      pendingPeriod: '10s',
      serviceName: 'pmm-server-postgresql',
      severity: AlertSeverity.Critical,
      templateName: 'pmm_postgresql_too_many_connections',
      threshold: 0.01,
    });
    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.builders.deleteTemplate(summary).click();
    await alertingPage.buttons.confirmDelete.click();
    await expect(alertingPage.messages.popUp).toContainText(
      `Alert rule template "${summary}" successfully deleted.`,
      {
        timeout: Timeouts.THIRTY_SECONDS,
      },
    );
  },
);

pmmTest(
  'PMM-T825 + PMM-T821 - Verify User can add Alert rule template in the file system @not-ovf @fb-alerting',
  async ({ alertingPage, cliHelper, page }) => {
    for (const file of ['customParam.yml', 'spaceInParam.yml', 'template.txt']) {
      cliHelper
        .execute(`docker cp ${templatesDir}/${file} pmm-server:/srv/alerting/templates`)
        .assertSuccess();
    }

    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(alertingPage.builders.createRuleFromTemplate('Custom parameter template')).toBeVisible();
    await expect(alertingPage.builders.createRuleFromTemplate('Space in parameter')).toBeHidden();
    await expect(alertingPage.builders.editTemplate('Custom parameter template')).toBeHidden();
    await expect(alertingPage.builders.deleteTemplate('Custom parameter template')).toBeHidden();
  },
);

pmmTest(
  'PMM-T1514 - Verify that alert rule templates has only 1 exit button @fb-alerting',
  async ({ alertingPage, page }) => {
    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    const [templateName] = (await alertingPage.elements.templateNames.first().innerText()).split('\n');

    await alertingPage.builders.createRuleFromTemplate(templateName.trim()).click();
    await expect(alertingPage.buttons.saveRuleAndExit).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(alertingPage.buttons.save).toBeHidden();
  },
);

pmmTest(
  'PMM-T2164 - Verify user can create alert from template with tiers field @fb-alerting',
  async ({ alertingPage, page }) => {
    await page.goto(alertingPage.urls.templates);
    await expect(alertingPage.elements.templatesTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await alertingPage.createTemplate(
      alertingPage.readTemplateFile(`${templatesDir}/templateWithTiers.yml`).content,
    );
    await expect(alertingPage.messages.popUp).toContainText(added, { timeout: Timeouts.THIRTY_SECONDS });
  },
);
