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

Scenario(
  'Verify Details section tabs @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    await queryAnalyticsPage.filters.selectFilter('pxc-dev-cluster');
    queryAnalyticsPage.data.selectRow(2);
    queryAnalyticsPage.waitForLoaded();
    for (const header of queryAnalyticsPage.data.labels.detailsHeaders) {
      I.waitForVisible(queryAnalyticsPage.queryDetails.buttons.tab(header), 5);
    }
  },
).retry(1);

Scenario(
  'PMM-T223 - Verify time metrics are AVG per query (not per second) @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { environment: 'pxc-dev', from: 'now-1h', search: 'insert' }));
    I.waitForElement(queryAnalyticsPage.data.elements.queryRows, 30);
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    I.waitForVisible(queryAnalyticsPage.queryDetails.elements.metricsCellDetailValue('Query Time', 3), 30);
    await queryAnalyticsPage.queryDetails.verifyAverageQueryCount(3600);
    await queryAnalyticsPage.queryDetails.verifyAverageQueryTime(3600);
  },
);

let databaseEnvironments;

if (isJenkinsGssapiJob) {
  databaseEnvironments = [
    { serviceName: 'rs101_gssapi', queryTypes: ['db.students', 'db.runCommand', 'db.test'], cluster: 'replicaset' },
  ];
} else {
  databaseEnvironments = [
    { serviceName: 'ps_', queryTypes: ['SELECT s.first_name', 'INSERT INTO classes', 'DELETE FROM students', 'CREATE TABLE classes'], cluster: 'ps-single-dev-cluster' },
    { serviceName: 'pdpgsql_', queryTypes: ['SELECT s.first_name', 'INSERT INTO classes', 'DELETE FROM', 'CREATE TABLE classes '], cluster: '' },
    { serviceName: 'rs101', queryTypes: ['db.students', 'db.runCommand', 'db.test'], cluster: 'replicaset' },
  ];
}

Data(databaseEnvironments).Scenario(
  'PMM-T13 - Check Example, Explain, Plan and Table tabs for supported DBs @qan @gssapi-nightly',
  async ({
    I, queryAnalyticsPage, current, inventoryAPI,
  }) => {
    let service_name;

    if (current.serviceName === 'pdpgsql_') {
      service_name = (await inventoryAPI.getServiceDetailsByRegex('pdpgsql_pmm_.*_1$')).service_name;
    } else {
      service_name = (await inventoryAPI.getServiceDetailsByPartialDetails(
        { cluster: current.cluster, service_name: current.serviceName },
      )).service_name;
    }

    for (const query of current.queryTypes) {
      const parameters = { service_name, query };

      I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-6h', search: query, service_name }));
      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.data.verifyQueriesDisplayed(parameters);
      queryAnalyticsPage.data.selectRow(1);
      queryAnalyticsPage.waitForLoaded();
      if (current.serviceName !== 'pgsql_pgss_pmm_') {
        // pg stat statement does not support examples.
        await queryAnalyticsPage.queryDetails.verifyExamples(parameters);
      }

      if (!current.serviceName.includes('pgsql_') && !query.includes('CREATE')) {
        // Explain is not for PostgreSQL and also not available for CREATE operations
        await queryAnalyticsPage.queryDetails.verifyExplain(parameters);
      }

      if (current.serviceName.includes('pgsql_') && !query.includes('CREATE')) {
        // Tables are not available for PostgreSQL and also not available for CREATE operations
        await queryAnalyticsPage.queryDetails.verifyTables(parameters);
      }

      if (current.serviceName === 'pdpgsql_' && query.includes('SELECT')) {
        await queryAnalyticsPage.queryDetails.verifyPlan(parameters);
      }
    }
  },
);

Scenario(
  'PMM-T1790 - Verify that there is any no error on Explains after switching between queries from different DB servers @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    queryAnalyticsPage.filters.selectContainFilter('pxc-dev');
    queryAnalyticsPage.data.searchByValue('SELECT');
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.queryDetails.checkTab('Explain');
    queryAnalyticsPage.filters.selectContainFilter('pxc-dev');
    queryAnalyticsPage.data.searchByValue('');
    queryAnalyticsPage.filters.selectFilterInGroup('mongodb', 'Service Type');
    queryAnalyticsPage.data.searchByValue('UPDATE');
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.queryDetails.checkTab('Explain');
  },
);

Scenario(
  'PMM-T1790 - Verify that there is any no error on Explains after switching between queries from different DB servers @gssapi-nightly',
  async ({
    I, queryAnalyticsPage,
  }) => {
    queryAnalyticsPage.filters.selectFilterInGroup('mongodb', 'Service Type');
    queryAnalyticsPage.data.searchByValue('UPDATE');
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.queryDetails.checkTab('Explain');
  },
);

Scenario(
  'PMM-T245 - Verify that user is able to close the Details section @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    I.waitForElement(queryAnalyticsPage.data.elements.queryRows, 30);
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    I.waitForElement(queryAnalyticsPage.queryDetails.buttons.close, 30);
    I.click(queryAnalyticsPage.queryDetails.buttons.close);
    I.waitForInvisible(queryAnalyticsPage.queryDetails.buttons.close, 30);
    I.dontSeeElement(queryAnalyticsPage.queryDetails.buttons.close);
  },
);

Scenario(
  'PMM-T144 - Verify that Details tab is the only one available when total row is selected @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.selectTotalRow();
    queryAnalyticsPage.queryDetails.checkTab('Details');
    I.dontSeeElement(queryAnalyticsPage.queryDetails.buttons.tab('Examples'));
    I.dontSeeElement(queryAnalyticsPage.queryDetails.buttons.tab('Explain'));
    I.dontSeeElement(queryAnalyticsPage.queryDetails.buttons.tab('Tables'));
    I.dontSeeElement(queryAnalyticsPage.queryDetails.buttons.tab('Plan'));
  },
);

// Skip until https://jira.percona.com/browse/PMM-12218 is fixed
// Data(querySources).Scenario(
//   'PMM-T1667 - Verify that SQL injection is filtered in placeholders on QAN tab @qan',
//   async ({
//     I, adminPage, current,
//   }) => {
//     const { querySource } = current;
//     const pmmFrameworkLoader = `bash ${adminPage.pathToFramework}`;
//     const port = '3307';
//     const containerName = `ps_${querySource}_8.0`;
//     const username = 'msandbox';

//     const password = 'msandbox';
//     const serviceName = `mysql_client_${querySource}`;
//     const mysqlCommandPrefix = `docker exec ${containerName} mysql -h 127.0.0.1 -u ${username} -p${password} test --port ${port} -e`;

//     await I.verifyCommand(`export PS_CONTAINER=${containerName} ; ${pmmFrameworkLoader} --setup-pmm-ps-integration --pmm2 --query-source=${querySource} --ps-version=8.0`);
//     await I.verifyCommand(`docker exec ${containerName} pmm-admin add mysql --username=${username} --password=${password} --port=${port} --query-source=${querySource} --disable-queryexamples ${serviceName}`);

//     await I.verifyCommand(`${mysqlCommandPrefix} "CREATE TABLE cities (ID int, Name varchar(255), Country varchar(255));"`);
//     await I.verifyCommand(`${mysqlCommandPrefix} "INSERT INTO cities VALUES (1,'New York','USA'),(2,'Atlanta','USA'), (3,'Paris','France');"`);
//     await I.verifyCommand(`${mysqlCommandPrefix} "SELECT * FROM test.cities WHERE ID = 1;"`);

//     I.amOnPage(I.buildUrlWithParams(anPage.clearUrl, { from: 'now-15m' }));
//     anOverview.waitForOverviewLoaded();
//     anOverview.waitForOverviewLoaded();
//     await anOverview.searchByValue('SELECT * FROM test.cities WHERE ID');
//     await I.asyncWaitFor(async () => {
//       I.click(anOverview.buttons.refresh);

//       return !(await I.grabNumberOfVisibleElements(anOverview.elements.noResultTableText));
//     }, 300);
//     anOverview.selectRowByText('select * from test.cities where id = ?');
//     I.click(anDetails.getTabLocator('Explain'));
//     anFilters.waitForFiltersToLoad();
//     I.fillField(anDetails.elements.firstPlaceholder, '1');
//     I.waitForVisible(anDetails.elements.explainTable);
//     I.assertEqual(await I.grabNumberOfVisibleElements(locate('$query-analytics-details').find('$table-row')), 1, 'Explain is expected to have one row in a table, but found more');
//   },
// );

Scenario(
  'PMM-T2014 - Verify explain tab in query analytics for query with explain in the name @fb-pmm-ps-integration',
  async ({
    I, queryAnalyticsPage, credentials,
  }) => {
    const dbName = 'sbtest3';
    const { root } = credentials.perconaServer;
    const { username, password } = credentials.perconaServer.msandbox;
    const psVersion = parseFloat((await I.verifyCommand('docker ps -f name=ps --format "{{.Image }}"')).split(':')[1]);
    const testContainerName = await I.verifyCommand('docker ps -f name=ps --format "{{.Names }}"');

    if (psVersion > 8.0) {
      await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 -u ${root.username} -p${root.password} --port 3306 -e "USE ${dbName}; CREATE TABLE t1 (c1 INT NOT NULL, c2 VARCHAR(100) NOT NULL, PRIMARY KEY (c1)); insert into t1 values(1,1),(2,2),(3,3),(4,5); explain select * from t1 where c1=1; explain select * from t1 where c2=1; explain select * from t1 where c2>1 and c2<=3;"`);
    } else {
      await I.verifyCommand(`mysql -h 127.0.0.1 -u ${username} -p${password} --port 3317 -e "USE ${dbName}; CREATE TABLE t1 (c1 INT NOT NULL, c2 VARCHAR(100) NOT NULL, PRIMARY KEY (c1)); insert into t1 values(1,1),(2,2),(3,3),(4,5); explain select * from t1 where c1=1; explain select * from t1 where c2=1; explain select * from t1 where c2>1 and c2<=3;"`);
    }

    I.wait(60);
    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-15m' }));
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.searchByValue('explain select * from t1');
    I.waitForInvisible(queryAnalyticsPage.data.elements.noResultTableText, 240);
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.queryDetails.openExplainTab();
    const expectedError = queryAnalyticsPage.queryDetails.messages.notSupportedExplain;

    await queryAnalyticsPage.queryDetails.verifyExplainError({
      classicError: expectedError,
      jsonError: expectedError,
    });
  },
);
