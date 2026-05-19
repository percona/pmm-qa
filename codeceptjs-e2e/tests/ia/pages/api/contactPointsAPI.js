const { I } = inject();
const assert = require('assert');

module.exports = {
  async createContactPoints() {
    const headers = {
      Authorization: `Basic ${await I.getAuth()}`,
      'X-Disable-Provenance': 'true',
    };
    const contactPoint = {
      name: 'default',
      type: 'webhook',
      settings: {
        url: 'http://webhookd:8080/alert',
        username: 'alert',
        password: 'alert',
        authorization_credentials: '',
      },
      disableResolveMessage: false,
    };
    const contactPointResp = await I.sendPostRequest('graph/api/v1/provisioning/contact-points', contactPoint, headers);
    const policyResp = await I.sendPutRequest('graph/api/v1/provisioning/policies', {
      receiver: 'default',
      group_by: ['grafana_folder', 'alertname'],
    }, headers);

    assert.strictEqual(contactPointResp.status, 202);
    assert.strictEqual(policyResp.status, 202);
  },
};
