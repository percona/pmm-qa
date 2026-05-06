const { adminPage } = inject();

Feature('Test PMM server with external PostgreSQL');

const DOCKER_IMAGE = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const data = new DataTable(['composeName', 'containerName', 'postgresqlAddress', 'serverPort', 'pdpgsqlContainerName']);

data.add(['docker-compose-external-pg', 'pmm-server-external-postgres', 'external-postgres:5432', '8081', 'external-postgres']);
data.add(['docker-compose-external-pg-ssl', 'pmm-server-external-postgres-ssl', 'external-postgres-ssl:5432', '8082', 'external-postgres-ssl']);

AfterSuite(async ({ I }) => {
  await I.verifyCommand('docker compose -f docker-compose-external-pg.yml down -v || true');
  await I.verifyCommand('docker compose -f docker-compose-external-pg-ssl.yml down -v || true');
});

Data(data).Scenario(
  'PMM-T1678 - Verify PMM with external PostgreSQL including upgrade @docker-configuration',
  async ({
    I, dashboardPage, pmmInventoryPage, current, queryAnalyticsPage,
  }) => {
    const {
      postgresqlAddress, composeName, containerName, serverPort, pdpgsqlContainerName,
    } = current;
    const basePmmUrl = `http://127.0.0.1:${serverPort}/`;
    const serviceName = 'pmm-server-postgresql';
    const postgresDataSourceLocator = locate('div').withChild(locate('h2 > a').withText('PostgreSQL'));

    await I.verifyCommand(`PMM_SERVER_IMAGE=${DOCKER_IMAGE} docker compose -f ${composeName}.yml up -d`);
    await I.verifyCommand(`docker exec ${pdpgsqlContainerName} psql "postgresql://postgres:pmm_password@localhost/grafana" -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;'`);
    await I.verifyCommand(`docker container restart ${containerName}`);
    await I.wait(60);

    await I.Authorize('admin', 'admin', basePmmUrl);
    I.amOnPage(`${basePmmUrl}graph/datasources`);
    I.waitForVisible(postgresDataSourceLocator, 30);
    I.seeTextEquals(`${'PostgreSQL\n'
      + '|\n'}${
      postgresqlAddress}`, locate(postgresDataSourceLocator).find('//div[2]'));

    I.amOnPage(`${basePmmUrl}${pmmInventoryPage.url}`);
    await I.waitForVisible(pmmInventoryPage.fields.serviceRow(serviceName), 30);

    I.assertEqual(
      await pmmInventoryPage.servicesTab.getServiceMonitoringAddress(serviceName),
      current.pdpgsqlContainerName,
      `'${serviceName}' is expected to have '${current.pdpgsqlContainerName}' address`,
    );

    I.assertEqual(
      await pmmInventoryPage.servicesTab.getServiceMonitoringStatus(serviceName),
      'OK',
      `'${serviceName}' is expected to have 'OK' monitoring status`,
    );

    I.amOnPage(I.buildUrlWithParams(`${basePmmUrl}${queryAnalyticsPage.url}`, {
      service_name: serviceName, node_name: 'pmm-server-db', from: 'now-5m', refresh: '30s',
    }));
    queryAnalyticsPage.waitForLoaded();
    I.waitForInvisible(queryAnalyticsPage.data.elements.noResultTableText, 480);
    I.assertTrue((await queryAnalyticsPage.data.getRowCount()) > 0, 'QAN does not have data!');
  },
);
