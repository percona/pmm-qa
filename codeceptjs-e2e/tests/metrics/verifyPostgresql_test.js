const pmmManagerCmd = 'bash /srv/pmm-qa/pmm-tests/pmm-framework.sh --pmm2';

Feature('Test functional related to the PostgreSQL');

Before(async ({ I }) => {
  await I.Authorize();
});

xScenario(
  'PMM-T1102 - Verify last scrape of metrics from PostgreSQL',
  async ({ I, grafanaAPI, settingsAPI }) => {
    const metricName = 'pg_up';
    const serviceName = 'PG-service';

    // fix of the scraping bug
    await settingsAPI.changeSettings({ metrics_resolutions: { lr: '60s', mr: '15s', hr: '10s' } }, true);
    await I.verifyCommand(`${pmmManagerCmd} --addclient=pdpgsql,1 --pdpgsql-version=13.4 --deploy-service-with-name ${serviceName}`);
    let response = await grafanaAPI.waitForMetric(metricName, { type: 'service_name', value: serviceName }, 30);
    const lastValue = Number(response.data.data.result[0].values.slice(-1)[0].slice(-1)[0]);

    I.assertEqual(lastValue, 1, `PostgreSQL ${serviceName} ${metricName} should be 1`);

    await I.verifyCommand(`docker stop ${serviceName}`);

    async function pgUpIsZero() {
      response = await grafanaAPI.checkMetricExist(metricName, { type: 'service_name', value: serviceName });

      return Number(response.data.data.result[0].values.slice(-1)[0].slice(-1)[0]) === 0;
    }

    await I.asyncWaitFor(pgUpIsZero, 180);
    await I.say(`PostgreSQL ${serviceName} ${metricName} is 0`);
    await I.verifyCommand(`${pmmManagerCmd} --cleanup-service ${serviceName}`);
    await settingsAPI.changeSettings({ resolution: settingsAPI.defaultResolution });
  },
);
