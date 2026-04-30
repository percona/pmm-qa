const assert = require('assert');
const { isJenkinsGssapiJob } = require('../helper/constants');

Feature('Query tests for QAN');

const services = [];

services.push({ serviceName: 'rs101' });

if (!isJenkinsGssapiJob) {
  services.push({ serviceName: 'pdpgsql_' });
  services.push({ serviceName: 'pgsql_pgss_pmm' });
  services.push({ serviceName: 'ps_pmm' });
  services.push({ serviceName: 'mysql_pmm_' });
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
    let service_name;

    if (current.serviceName === 'pdpgsql_') {
      service_name = (await inventoryAPI.getServiceDetailsByRegex('pdpgsql_pmm_.*_1$')).service_name;
    } else {
      service_name = (await inventoryAPI.getServiceDetailsByStartsWithName(current.serviceName)).service_name;
    }

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-120m', to: 'now' }));

    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilter(service_name);
    queryAnalyticsPage.waitForLoaded();
    const count = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(count > 0, `The queries for service ${service_name} instance do NOT exist, check QAN Data`);
  },
).retry(1);
