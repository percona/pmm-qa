const { I } = inject();
const assert = require('assert');

module.exports = {
  async createContactPoints() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      template_files: {},
      template_file_provenances: {},
      alertmanager_config: {
        route: { receiver: 'default', group_by: ['grafana_folder', 'alertname'] },
        templates: null,
        receivers: [{
          name: 'default',
          grafana_managed_receiver_configs: [{
            // Pager Duty config
            //   settings: {},
            //   secureSettings: {
            //     integrationKey: process.env.PAGER_DUTY_SERVICE_KEY,
            //   },
            //   type: 'pagerduty',
            //   name: 'default',
            //   disableResolveMessage: false,
            // }, {
            // Webhook config
            settings: {
              url: 'http://webhookd:8080/alert',
              username: 'alert',
            },
            secureSettings: {
              password: 'alert',
              authorization_credentials: '',
            },
            type: 'webhook',
            name: 'default',
            disableResolveMessage: false,
          }],
        }],
      },
    };
    const resp = await I.sendPostRequest('graph/api/alertmanager/grafana/config/api/v1/alerts', body, headers);

    assert.strictEqual(resp.status, 202);
    assert.strictEqual(resp.data.message, 'configuration created');
  },
};
