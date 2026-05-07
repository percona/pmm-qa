const assert = require('assert');

let sessionCookie;

Feature('Telemetry');

Before(async ({ I, platformAPI, settingsAPI }) => {
  await settingsAPI.changeSettings({ updates: false });
  I.wait(20);
  sessionCookie = await platformAPI.getGrafanaSessionCookieFromDevPMM();
});

AfterSuite(async ({ settingsAPI }) => {
  await settingsAPI.changeSettings({ updates: true });
});

Scenario(
  'Telemetry data should land on portal @telemetry',
  async ({ platformAPI }) => {
    const { pmm_server_telemetry_id } = await platformAPI.getServerInfo();

    await platformAPI.waitForTelemetryDataReceived(pmm_server_telemetry_id, sessionCookie);
    const { data: [{ pmm_server_metrics_with_classifier }] } = await platformAPI.getTelemetryFromPortal(
      pmm_server_telemetry_id,
      sessionCookie,
    );

    assert.ok(
      pmm_server_metrics_with_classifier.find(([key, value]) => key === 'updates_disabled' && value === 'true'),
      'Expected to have updates_disabled: true as telemetry data',
    );
  },
);
