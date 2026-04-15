const assert = require('assert');

const { I } = inject();

module.exports = {
  checkNames: {
    mysqlVersion: 'mysql_version',
    mysqlEmptyPassword: 'mysql_security_1',
  },

  async getAdvisorsNames() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendGetRequest('v1/advisors/checks', headers);

    assert.ok(
      resp.status === 200,
      `Failed to get Advisors. Response message is "${resp.data.message}"`,
    );

    return resp.data.checks.map((check) => check.name);
  },

  async getAdvisors() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendGetRequest('v1/advisors', headers);

    assert.ok(
      resp.status === 200,
      `Failed to get Advisors. Response message is "${resp.data.message}"`,
    );

    return resp.data.advisors;
  },

  async getAdvisorCategory(expectedName) {
    const resp = await this.getAdvisors();

    return resp.find((advisor) => advisor.checks.some((check) => check.name === expectedName)).category;
  },

  async getAdvisorDetails(expectedName) {
    const resp = await this.getAdvisors();
    const advisors = resp.map((item) => item.checks).flat();

    return advisors.find((advisor) => advisor.name === expectedName);
  },

  async getSecurityChecksResults() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendGetRequest('v1/advisor/checks', headers);

    assert.ok(
      resp.status === 200,
      `Failed to get Security Checks results. Response message is "${resp.data.message}"`,
    );

    return resp.data.results;
  },

  async startSecurityChecks(checkNamesArray) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = checkNamesArray ? { names: checkNamesArray } : {};

    const resp = await I.sendPostRequest('v1/advisors/checks:start', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to start Security Checks. Response message is "${resp.data.message}"`,
    );
  },

  async getFailedChecks(service_id) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = { service_id, page_params: { page_size: 25, index: 0 } };

    const resp = await I.sendPostRequest('v1/advisors/checks/failed', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to get FailedChecks for the service. Response message is "${resp.data.message}"`,
    );

    return resp.data.results;
  },

  async toggleChecksAlert(alert_id, silence = true) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = { alert_id, silence };

    // todo: api-breaking-changes
    const resp = await I.sendPostRequest('v1/management/SecurityChecks/ToggleCheckAlert', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to ToggleCheckAlert. Response message is "${resp.data.message}"`,
    );
  },

  async verifyFailedCheckNotExists(detailsText, serviceName) {
    const failedCheckDoesNotExist = await this.getFailedCheckBySummary(detailsText, serviceName);

    assert.ok(!failedCheckDoesNotExist, `Expected "${detailsText}" failed check to not be present`);
  },

  async waitForFailedCheckExistance(detailsText, serviceName, timeout = 120) {
    await I.asyncWaitFor(async () => await this.getFailedCheckBySummary(detailsText, serviceName), timeout);
    I.wait(5);
  },

  async waitForFailedCheckNonExistance(detailsText, serviceName, timeout = 120) {
    await I.asyncWaitFor(async () => {
      const check = await this.getFailedCheckBySummary(detailsText, serviceName);

      return !check;
    }, timeout);
    I.wait(5);
  },

  async verifyFailedCheckExists(detailsText, serviceName) {
    const failedCheckExists = await this.getFailedCheckBySummary(detailsText, serviceName);

    assert.ok(failedCheckExists, `Expected to have "${detailsText}" failed check.`);
  },

  async getFailedCheckBySummary(summaryText, serviceName) {
    const results = await this.getSecurityChecksResults();

    // return null if there are no failed checks
    if (!results) return null;

    // eslint-disable-next-line max-len
    return results.find((obj) => obj.summary.trim() === summaryText && (serviceName ? obj.service_name.trim() === serviceName : true));
  },

  async enableCheck(checkName) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      params: [{
        name: checkName,
        enable: true,
      }],
    };

    const resp = await I.sendPostRequest('v1/advisors/checks:batchChange', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to change Security Checks results. Response message is "${resp.data.message}"`,
    );
  },

  async disableCheck(checkName) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      params: [{
        name: checkName,
        disable: true,
      }],
    };

    const resp = await I.sendPostRequest('v1/advisors/checks:batchChange', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to disable Security Check "${checkName}". Response message is "${resp.data.message}"`,
    );
  },

  async changeCheckInterval(checkName, interval = 'ADVISOR_CHECK_INTERVAL_FREQUENT') {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      params: [{
        name: checkName,
        interval,
      }],
    };

    const resp = await I.sendPostRequest('v1/advisors/checks:batchChange', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to Change Check Interval. Response message is "${resp.data.message}"`,
    );
  },

  async getAllChecksList() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendGetRequest('v1/advisors/checks', headers);

    return resp.data.checks;
  },

  async restoreDefaultIntervals() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = {
      params: [],
    };

    await I.asyncWaitFor(this.getAllChecksList, 60);
    const allChecks = await this.getAllChecksList();

    allChecks.forEach(({ name }) => body.params.push({ name, interval: 'ADVISOR_CHECK_INTERVAL_STANDARD' }));
    const resp = await I.sendPostRequest('v1/advisors/checks:batchChange', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to Change Check Interval. Response message is "${resp.data.message}"`,
    );
  },
};
