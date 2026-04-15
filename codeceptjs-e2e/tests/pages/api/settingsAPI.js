const assert = require('assert');

const { I, codeceptjsConfig } = inject();

const mailosaur = codeceptjsConfig.config.helpers.Mailosaur;

const defaultCheckIntervals = {
  standard_interval: '86400s',
  rare_interval: '280800s',
  frequent_interval: '14400s',
};

const defaultResolution = {
  hr: '5s',
  mr: '10s',
  lr: '60s',
};

const endpoint = 'v1/server/settings';

module.exports = {
  defaultCheckIntervals,
  defaultResolution,

  // methods for preparing state of application before test
  async apiEnableSTT() {
    const body = {
      enable_advisor: true,
      enable_telemetry: true,
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendPutRequest(endpoint, body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to enabled STT. ${resp.data.message}`,
    );
  },

  async apiDisableSTT() {
    const body = {
      enable_advisor: false,
      enable_telemetry: true,
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendPutRequest(endpoint, body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to disable STT. ${resp.data.message}`,
    );
  },

  async apiDisableIA() {
    await this.changeSettings({ alerting: false });
  },

  async apiEnableIA() {
    await this.changeSettings({ alerting: true });
  },

  async enableAzure() {
    await this.changeSettings({ azureDiscover: true });
  },

  async disableAzure() {
    await this.changeSettings({ azureDiscover: false });
  },

  async restoreSettingsDefaults() {
    const body = {
      data_retention: '2592000s',
      metrics_resolutions: defaultResolution,
      enable_telemetry: true,
      enable_advisor: true,
      enable_alerting: true,
      remove_email_alerting_settings: true,
      remove_slack_alerting_settings: true,
      remove_alert_manager_url: true,
      remove_alert_manager_rules: true,
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    await I.sendPutRequest(endpoint, body, headers);
  },

  async setCheckIntervals(intervals = defaultCheckIntervals) {
    const body = {
      advisor_run_intervals: intervals,
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    await I.sendPutRequest(endpoint, body, headers);
  },

  async setEmailAlertingSettings(settings) {
    const body = {
      email_alerting_settings: settings || {
        from: 'pmm@mail.com',
        smarthost: 'mailosaur.net:465',
        username: `${mailosaur.serverId}@mailosaur.net`,
        password: process.env.MAILOSAUR_SMTP_PASSWORD,
      },
    };
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendPostRequest(endpoint, body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to set Email Alerting settings. ${resp.data.message}`,
    );

    return body;
  },

  /**
   * Change Settings API call
   *
   * @param values object
   * @param fullPayload boolean (default = false. If true - passed values object will be send as a payload)
   * @returns {Promise<void>}
   *
   * @example
   * await settingsAPI.changeSettings({ alerting: true, publicAddress: 127.0.0.1, stt: false });
   * await settingsAPI.changeSettings({ enable_alerting: true, publicAddress: 127.0.0.1, disable_stt: true }, true);
   */
  async changeSettings(values, fullPayload = false) {
    const body = fullPayload ? values : {};

    if (!fullPayload) {
      Object.entries(values).forEach(([key, value]) => {
        switch (key) {
          case 'alerting':
            body.enable_alerting = value;
            break;
          case 'stt':
            body.enable_advisor = value;
            break;
          case 'telemetry':
            body.enable_telemetry = value;
            break;
          case 'azureDiscover':
            body.enable_azurediscover = value;
            break;
          case 'backup':
            body.enable_backup_management = value;
            break;
          case 'updates':
            body.enable_updates = value;
            break;
          case 'publicAddress':
            body.pmm_public_address = value;
            break;
          case 'data_retention':
            body.data_retention = value;
            break;
          case 'resolution':
            body.metrics_resolutions = value;
            break;
          case 'checkIntervals':
            body.advisor_run_intervals = value;
            break;
          case 'alertmanagerRules':
            body.alert_manager_rules = value;
            break;
          case 'alertmanagerURL':
            body.alert_manager_url = value;
            break;
          case 'ssh':
            body.ssh_key = value;
            break;
          case 'rbac':
            value ? body.enable_access_control = true : body.disable_access_control = true;
            break;
          default:
            throw Error(`Unknown property "${key}" was passed to Change Settings function`);
        }
      });
    }

    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const resp = await I.sendPutRequest(endpoint, body, headers);

    // assert.ok(
    //   resp.status === 200,
    //   `Failed to Apply settings \n${JSON.stringify(values, null, 2)}. ${resp.data.message}`,
    // );
  },

  async getSettings(property) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const resp = await I.sendGetRequest(endpoint, headers);

    if (property) return resp.data.settings[property];

    return resp.data.settings;
  },

  async setTourOptions(productTour = true, alertingTour = true, pmmVersion = '3.2.0') {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const body = {
      product_tour_completed: productTour,
      alerting_tour_completed: alertingTour,
      snoozed_pmm_version: pmmVersion,
    };

    const resp = await I.sendPutRequest('v1/users/me', body, headers);

    assert.equal(resp.status, 200, `Failed to set up PMM tour options! Response with status ${resp.status}`);
  },
};
