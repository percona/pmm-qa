const { isJenkinsGssapiJob } = require('../helper/constants');

Feature('QAN details');

const { adminPage } = inject();

const querySources = new DataTable(['querySource']);

querySources.add(['slowlog']);
// querySources.add(['perfschema']);

Before(async ({ I, queryAnalyticsPage }) => {
  await I.Authorize();
  I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-1h' }));
  queryAnalyticsPage.waitForLoaded();
});

async function verifySupportedDBTabs({
  I, queryAnalyticsPage, inventoryAPI, serviceName, queryTypes, cluster,
}) {
  let service_name;

  if (serviceName === 'pdpgsql_') {
    service_name = (await inventoryAPI.getServiceDetailsByRegex('pdpgsql_pmm_.*$')).service_name;
  } else {
    service_name = (
      await inventoryAPI.getServiceDetailsByPartialDetails({ cluster, service_name: serviceName })
    ).service_name;
  }

  for (const query of queryTypes) {
    const parameters = { service_name, query };

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-6h', search: query, service_name }));
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.data.verifyQueriesDisplayed(parameters);
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    if (serviceName !== 'pgsql_pgss_pmm_') {
      // pg stat statement does not support examples.
      await queryAnalyticsPage.queryDetails.verifyExamples(parameters);
    }

    if (!serviceName.includes('pgsql_') && !query.includes('CREATE')) {
      // Explain is not for PostgreSQL and also not available for CREATE operations
      await queryAnalyticsPage.queryDetails.verifyExplain(parameters);
    }

    if (serviceName.includes('pgsql_') && !query.includes('CREATE')) {
      // Tables are not available for PostgreSQL and also not available for CREATE operations
      await queryAnalyticsPage.queryDetails.verifyTables(parameters);
    }

    if (serviceName === 'pdpgsql_' && query.includes('SELECT')) {
      await queryAnalyticsPage.queryDetails.verifyPlan(parameters);
    }
  }
}

Scenario(
  'PMM-T13 - Check Example, Explain, Plan and Table tabs for PS @qan',
  async ({ I, queryAnalyticsPage, inventoryAPI }) => {
    await verifySupportedDBTabs({
      I,
      queryAnalyticsPage,
      inventoryAPI,
      serviceName: 'ps_',
      queryTypes: ['SELECT s.first_name', 'INSERT INTO classes', 'DELETE FROM students', 'CREATE TABLE classes'],
      cluster: 'ps-single-dev-cluster',
    });
  },
);

Scenario(
  'PMM-T13 - Check Example, Explain, Plan and Table tabs for PDPGSQL @qan @nightly-pdpgsql',
  async ({ I, queryAnalyticsPage, inventoryAPI }) => {
    await verifySupportedDBTabs({
      I,
      queryAnalyticsPage,
      inventoryAPI,
      serviceName: 'pdpgsql_',
      queryTypes: ['SELECT s.first_name', 'INSERT INTO classes', 'DELETE FROM', 'CREATE TABLE classes '],
      cluster: '',
    });
  },
);

Scenario(
  'PMM-T13 - Check Example, Explain, Plan and Table tabs for PSMDB @qan @gssapi-nightly',
  async ({ I, queryAnalyticsPage, inventoryAPI }) => {
    await verifySupportedDBTabs({
      I,
      queryAnalyticsPage,
      inventoryAPI,
      serviceName: isJenkinsGssapiJob ? 'rs101_gssapi' : 'rs101',
      queryTypes: ['db.students', 'db.runCommand', 'db.test'],
      cluster: 'replicaset',
    });
  },
);

Scenario(
  'PMM-T1790 - Verify that there is any no error on Explains after switching between queries from different DB servers @qan',
  async ({ I, queryAnalyticsPage }) => {
    queryAnalyticsPage.filters.selectContainFilter('ps-dev');
    queryAnalyticsPage.data.searchByValue('SELECT');
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.queryDetails.checkTab('Explain');
    queryAnalyticsPage.filters.selectContainFilter('ps-dev');
    queryAnalyticsPage.data.searchByValue('');
    queryAnalyticsPage.filters.selectFilterInGroup('mongodb', 'Service Type');
    queryAnalyticsPage.data.searchByValue('UPDATE');
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.queryDetails.checkTab('Explain');
  },
);

Scenario(
  'PMM-T1790 - Verify that there is any no error on Explains after switching between queries from different DB servers @gssapi-nightly',
  async ({ I, queryAnalyticsPage }) => {
    queryAnalyticsPage.filters.selectFilterInGroup('mongodb', 'Service Type');
    queryAnalyticsPage.data.searchByValue('UPDATE');
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.queryDetails.checkTab('Explain');
  },
);
