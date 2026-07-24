const assert = require('assert');

const { I } = inject();

module.exports = {

  async getAlerts(serviceName) {
    let filter = '';

    if (serviceName) filter = `filter=service_name="${serviceName}"&`;

    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const alerts = await I.sendGetRequest(`alertmanager/api/v2/alerts/groups?${filter}silenced=false&inhibited=false&active=true`, headers);

    return alerts.data;
  },
  /**
   * Get all silenced alerts with active status
   * @return {array} of silences IDs
   */
  async getSilenced() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const silences = await I.sendGetRequest('graph/api/alertmanager/grafana/api/v2/silences', headers);

    return silences.data.filter(({ status }) => status.state === 'active').map((e) => e.id);
  },

  async deleteSilences(silenceID) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    silenceID.forEach((item) => I.sendDeleteRequest(`graph/api/alertmanager/grafana/api/v2/silence/${item}`, headers));
  },

  /**
   * Verify alerts states
   * @example await alertmanagerAPI.verifyAlerts([{ ruleId: ruleId, serviceName: serviceName }], true)
   * @param alertAttributesArray
   * @param silenced
   */
  async verifyAlerts(alertAttributesArray, silenced = false) {
    for (const i in alertAttributesArray) {
      const { ruleId, serviceName } = alertAttributesArray[i];
      const alerts = await this.getAlerts(serviceName);
      const silences = await this.getSilenced();

      if (silenced) {
        assert.ok(
          JSON.stringify(silences).includes(ruleId),
          'Alert should be silenced in alertmanager',
        );

        assert.ok(
          !JSON.stringify(alerts).includes(ruleId),
          'Silenced alert should not be active in alertmanager',
        );
      } else {
        assert.ok(
          JSON.stringify(alerts).includes(ruleId),
          'Alert should be active in alertmanager',
        );

        assert.ok(
          !JSON.stringify(silences).includes(ruleId),
          'Alert should not be be silenced in alertmanager',
        );
      }
    }
  },
};
