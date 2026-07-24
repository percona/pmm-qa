const { I } = inject();
const assert = require('assert');
const { api } = require('@pagerduty/pdjs');

module.exports = {
  /*
  waitForAlerts method is used for waiting for alerts to appear with a timeout.
  expectedAlertsCount parameter is optional and only needed when we need to wait for a
  specific number of alerts to appear
  */
  async waitForAlerts(timeout, expectedAlertsCount = 0) {
    for (let i = 0; i < timeout; i++) {
      const results = await this.getAlertsList();

      // waiting for some exact number of alerts to be active
      if (results && results.length >= expectedAlertsCount) break;

      I.wait(5);
    }

    return await this.getAlertsList();
  },

  // waitForAlertsToDisappear method is used for waiting for alerts to disappear with a timeout
  async waitForAlertsToDisappear(timeout) {
    for (let i = 0; i < timeout; i++) {
      const results = await this.getAlertsList();

      if (!results) break;

      I.wait(5);
    }
  },

  async getAlertsList() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendGetRequest('graph/api/alertmanager/grafana/api/v2/alerts', headers);

    assert.ok(
      resp.status === 200,
      `Failed to get Alerts. Response message is "${resp.data.message}"`,
    );

    return resp.data;
  },

  async getAlertsForIncident(pd, incidentId, ruleId) {
    return await pd.get(`/incidents/${incidentId}/alerts?limit=100`).then(({ data }) => {
      if (!data.alerts.length) return null;

      return data.alerts
        .find(({ body: { details: { firing } } }) => firing.includes(ruleId));
    })
      .catch((e) => Error(`failed to get alerts for incident: ${e}`));
  },

  async getAlertFromPD(pd, ruleId) {
    return await pd.get('/incidents?statuses[]=triggered&limit=100')
      .then(async ({ data }) => {
        const { incidents } = data;
        let alert;

        for (const i in incidents) {
          const { id } = incidents[i];

          alert = await this.getAlertsForIncident(pd, id, ruleId);
          if (alert) break;
        }

        return alert;
      })
      .catch((e) => Error(`failed to get incidents from PD: ${e}`));
  },

  async verifyAlertInPagerDuty(ruleId) {
    const pd = api({ token: process.env.PAGER_DUTY_API_KEY });
    const alert = await this.getAlertFromPD(pd, ruleId);

    try {
      assert.ok(alert.incident.summary.includes('PSQL immortal rule PostgreSQL'));
      assert.ok(alert.body.details.firing.includes('PSQL immortal rule'));
      assert.ok(alert.body.details.firing.includes(ruleId));
    } finally {
      await pd({
        method: 'put',
        endpoint: `/incidents/${alert.incident.id}/alerts/${alert.id}`,
        headers: {
          From: 'platform.qa.automation@percona.com',
        },
        data: {
          alert: {
            status: 'resolved',
          },
        },
      }).catch((e) => Error(`failed to resolve alert for an incident: ${e}`));
    }
  },
};
