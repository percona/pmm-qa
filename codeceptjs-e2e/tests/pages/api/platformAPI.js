const assert = require('assert');
const buildUrl = require('build-url');

const { I } = inject();

module.exports = {
  async signOut() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    // todo: find equivalent api endpoint
    await I.sendPostRequest('v1/Platform/SignOut', {}, headers);
  },

  async getServerInfo() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendGetRequest('/v1/platform/server', headers);

    assert.ok(
      resp.status === 200,
      `Failed to get Server Info. Response message is "${resp.data.message}"`,
    );

    return resp.data;
  },

  async getGrafanaSessionCookieFromDevPMM() {
    I.amOnPage('https://pmm.check-dev.percona.com/');
    I.fillField('[name=user]', secret(process.env.PORTAL_USER_EMAIL));
    I.fillField('[name=password]', secret(process.env.PORTAL_USER_PASSWORD));
    I.click('Log in');
    I.waitForVisible('$updates-info', 60);

    return await I.grabCookie('grafana_session');
  },

  async getTelemetryFromPortal(telemetryId, sessionCookie) {
    const headers = {
      Cookie: `grafana_session=${sessionCookie.value}`,
    };
    const queryParams = {
      query: `SELECT * FROM telemetryd.pmm_metrics m WHERE m.pmm_server_telemetry_id = '${telemetryId}' ORDER BY m.event_time DESC LIMIT 1 FORMAT JSON`,
    };
    const url = buildUrl('https://pmm.check-dev.percona.com/graph/api/datasources/proxy/7/', { queryParams });
    const resp = await I.sendGetRequest(url, headers);

    assert.ok(
      resp.status === 200,
      `Failed to get telemetry from PMM Dev. Response message is "${resp.data.message}"`,
    );

    return resp.data;
  },

  async waitForTelemetryDataReceived(telemetryId, sessionCookie, timeout = 120) {
    await I.asyncWaitFor(async () => (await this.getTelemetryFromPortal(telemetryId, sessionCookie)).rows, timeout);
  },
};
