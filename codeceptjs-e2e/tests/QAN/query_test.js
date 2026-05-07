const assert = require('assert');
const { isJenkinsGssapiJob } = require('../helper/constants');

Feature('Query tests for QAN');

const services = [];

services.push({ serviceName: 'rs101' });

if (!isJenkinsGssapiJob) {
  services.push({ serviceName: 'pdpgsql_pgsm_pmm' });
  services.push({ serviceName: 'pgsql_pgss_pmm' });
  services.push({ serviceName: 'ps_pmm' });
  services.push({ serviceName: 'ms-single' });
  services.push({ serviceName: 'pxc_node__1' });
}

Before(async ({ I }) => {
  await I.Authorize();
});

Data(services).Scenario(
  'PMM-T2063 - Verify QAN has data for all services @qan @gssapi-nightly',
  async ({
    I, queryAnalyticsPage, inventoryAPI, current,
  }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByStartsWithName(current.serviceName);

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-120m', to: 'now' }));

    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilter(service_name);
    queryAnalyticsPage.waitForLoaded();
    const count = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(count > 0, `The queries for service ${service_name} instance do NOT exist, check QAN Data`);
  },
).retry(1);
