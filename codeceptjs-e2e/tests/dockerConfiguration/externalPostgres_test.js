const { adminPage } = inject();

Feature('Test PMM server with external PostgreSQL');

const dockerImage = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const data = new DataTable(['ansibleName', 'postgresqlAddress', 'pdpgsqlContainerName']);

data.add(['external-pgsql', 'external-postgres:5432', 'external-postgres']);
data.add(['external-pgsql-ssl', 'external-postgres-ssl:5432', 'external-postgres-ssl']);

After(async ({ I }) => {
  await I.verifyCommand('docker stop external-postgres || true');
  await I.verifyCommand('docker stop pmm-server-external-postgres || true');
  await I.verifyCommand('docker volume rm pmm-server-external-pg || true');
  await I.verifyCommand('docker stop external-postgres-ssl || true');
  await I.verifyCommand('docker stop pmm-server-external-postgres-ssl || true');
  await I.verifyCommand('docker volume rm pmm-server-external-pg-ssl || true');
});

Data(data).Scenario(
  'PMM-T1678 - Verify PMM with external PostgreSQL including upgrade @docker-configuration',
  async ({
    I, pmmInventoryPage, current, queryAnalyticsPage,
  }) => {
    const {
      postgresqlAddress, ansibleName, pdpgsqlContainerName,
    } = current;
    const basePmmUrl = 'http://127.0.0.1:8082/';
    const serviceName = 'pmm-server-postgresql';
    const postgresDataSourceLocator = locate('div').withChild(locate('h2 > a').withText('PostgreSQL'));

    await I.verifyCommand(`ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 testdata/external-services/${ansibleName}.yml --extra-vars "pmm_server_image=${dockerImage} ansible_python_interpreter=/usr/bin/python3"`);

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
      pdpgsqlContainerName,
      `'${serviceName}' is expected to have '${pdpgsqlContainerName}' address`,
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
