const assert = require('assert');

const {
  I, iaCommon,
} = inject();

module.exports = {
  url: 'graph/alerting/notifications',
  types: {
    email: {
      name: 'Email Channel',
      type: 'Email',
      addresses: 'some@email.com',
    },
    pagerDuty: {
      name: 'PagerDuty Channel',
      type: 'PagerDuty',
      key: 'routingKey',
    },
    slack: {
      name: 'Slack Channel',
      type: 'Slack',
      slackChannel: 'slackChannel',
    },
    webhook: {
      name: 'Webhook Channel',
      type: 'Webhook',
      url: 'https://webhookd:8080/alert',
    },
  },
  elements: {
    cPHeader: locate('h1').withText('Contact points'),
    cPTable: '$dynamic-table',
    deleteCPDialogHeader: locate('h2').withText('Delete contact point'),
    cannotdeleteCPDialogHeader: locate('h2').withText('Cannot delete contact point'),
    cPEditHeader: locate('h4').withText('Update contact point'),
    cPTableRow: (name) => `//*[@data-testid="row"][contains(., '${name}')]`,
  },
  buttons: {
    newContactPoint: locate('[aria-label="add contact point"]'),
    saveCP: locate('button').find('span').withText('Save contact point'),
    deleteCP: locate('button').withText('Delete'),
    moreMenu: (name) => locate(`//*[@data-testid="contact-point"][contains(., '${name}')]//button[@aria-label = 'More']`),
    confirmDeleteCP: locate('button').find('span').withText('Yes, delete'),
    editCP: (name) => `//*[@data-testid="row"][contains(., '${name}')]//a[@aria-label = 'Edit contact point']`,
    closeModal: locate('button').find('span').withText('Close'),
    testCP: locate('button').find('span').withText('Test'),
    sendTest: locate('button').find('span').withText('Send test notification'),
  },
  messages: {
    cPCreatedSuccess: 'Contact point created',
    cPDeletedSuccess: 'Contact point deleted.',
    cPCannotDelete: 'Contact point cannot be deleted because it is used in more policies. Please update or delete these policies first.',
    deleteCPConfirm: (name) => `Are you sure you want to delete contact point "${name}"?`,
    cPEditedSuccess: 'Contact point updated.',
    missingRequired: 'There are errors in the form. Please correct them and try again!',
    testNotification: 'You will send a test notification that uses a predefined alert. If you have defined a custom template or message, for better results switch to custom notification message, from above.',
    testSent: 'Test alert sent.',
  },
  fields: {
    cPName: 'input[id=\'name\']',
    cPType: 'input[id=\'contact-point-type-items.0.\']',
    slackWebhookUrl: 'input[id=\'items.0.secureSettings.url\']',
    webhookUrl: 'input[id=\'items.0.settings.url\']',
    pagerDutyKey: 'input[id=\'items.0.secureSettings.integrationKey\']',
    emailAddress: 'textarea[id=\'items.0.settings.addresses\']',
  },

  async openContactPointsTab() {
    I.amOnPage(this.url);
    I.waitForVisible(this.elements.cPHeader, 10);
  },

  async createCP(name, type) {
    I.waitForVisible(this.buttons.newContactPoint, 10);
    I.click(this.buttons.newContactPoint);
    I.waitForVisible(this.fields.cPType, 10);
    I.click(this.fields.cPType);
    I.waitForVisible(iaCommon.elements.selectDropdownOption(type), 10);
    I.click(iaCommon.elements.selectDropdownOption(type));
    await this.fillFields(name, type);
  },

  async openMoreMenu(name) {
    I.waitForVisible(this.buttons.moreMenu(name), 10);
    I.click(this.buttons.moreMenu(name));
  },

  async deleteCP(name) {
    await this.openMoreMenu(name);
    I.click(this.buttons.deleteCP(name));
  },

  async editCP(name) {
    I.waitForVisible(this.buttons.editCP(name), 10);
    I.click(this.buttons.editCP(name));
    I.waitForVisible(this.elements.cPEditHeader, 10);
  },

  async verifyCPInTable(name) {
    I.waitForVisible(this.elements.cPTable, 10);
    I.seeElement(this.elements.cPTableRow(name));
  },

  async fillFields(name, type) {
    I.fillField(this.fields.cPName, name);

    switch (type) {
      case this.types.email.type:
        I.fillField(this.fields.emailAddress, this.types.email.addresses);
        break;
      case this.types.pagerDuty.type:
        I.fillField(this.fields.pagerDutyKey, this.types.pagerDuty.key);
        break;
      case this.types.slack.type:
        I.fillField(this.fields.slackWebhookUrl, this.types.slack.slackChannel);
        break;
      case this.types.webhook.type:
        I.fillField(this.fields.webhookUrl, this.types.webhook.url);
        break;
      default:
        assert.ok(false, `Did not find a matching notification channel type ${type}`);
    }
  },
};
