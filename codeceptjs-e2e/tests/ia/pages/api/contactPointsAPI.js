const { I } = inject();
const assert = require('assert');

module.exports = {
  async createContactPoints() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const listReceivers = await I.sendGetRequest('graph/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers', headers);
    const receiverName = listReceivers.data.items[0].metadata.name;
    const { resourceVersion } = listReceivers.data.items[0].metadata;
    const body = {
      metadata: {
        name: receiverName,
        resourceVersion,
      },
      spec: {
        title: 'empty',
        integrations: [
          {
            settings: {
              url: 'http://webhookd:8080/alert',
              username: 'alert',
              password: 'alert',
            },
            secureFields: {},
            type: 'webhook',
            name: 'empty',
            disableResolveMessage: false,
          },
        ],
      },
    };
    const resp = await I.sendPutRequest(`graph/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers/${receiverName}`, body, headers);

    assert.strictEqual(resp.status, 200);
  },
};
