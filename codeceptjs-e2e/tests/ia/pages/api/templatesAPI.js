const { I, ruleTemplatesPage } = inject();
const assert = require('assert');
const { faker } = require('@faker-js/faker');

module.exports = {
  async createRuleTemplate(path = ruleTemplatesPage.ruleTemplate.inputFilePath) {
    const [, content, id] = await ruleTemplatesPage.ruleTemplate.templateNameAndContent(path);
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    // Ternary is used to generate different ids for templates
    const templateText = path === ruleTemplatesPage.ruleTemplate.inputFilePath
      ? content.replace('name: input_template_yml', `name: ${faker.internet.username()}_template`)
      : content;
    const body = {
      yaml: templateText,
    };
    const resp = await I.sendPostRequest('v1/alerting/templates', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to create a template with id "${id}". Response message is "${resp.data.message}"`,
    );

    return id;
  },

  async clearAllTemplates() {
    const templates = await this.getTemplatesList();

    if (process.env.OVF_TEST !== 'yes') {
      await I.verifyCommand('docker exec pmm-server rm -f /srv/alerting/templates/*');
    }

    for (const { source, name } of templates) {
      if (source === 'TEMPLATE_SOURCE_USER_API') { await this.removeTemplate(name); }
    }
  },

  async getTemplatesList() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendGetRequest('v1/alerting/templates', headers);

    return resp.data.templates;
  },

  async removeTemplate(templateId) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendDeleteRequest(`v1/alerting/templates/${templateId}`, headers);

    assert.ok(
      resp.status === 200,
      `Failed to remove template with templateID "${templateId}". Response message is "${resp.data.message}"`,
    );
  },

  async createRuleTemplates(numberOfTemplatesToCreate) {
    for (let i = 0; i < numberOfTemplatesToCreate; i++) {
      await this.createRuleTemplate();
    }
  },
};
