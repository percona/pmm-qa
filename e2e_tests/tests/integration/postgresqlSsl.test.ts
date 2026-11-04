import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const version = '16';
const container = `pdpgsql_pgsm_ssl_${version}`;
const localServicePrefix = `${container}_ssl_service`;
const remoteServiceName = `remote_pgsql_${version}_ssl_service`;
const noSslCheckServiceName = 'pg_no_ssl_check';
const services = [localServicePrefix, remoteServiceName, noSslCheckServiceName];
const uiServiceName = `pgsql_${version}_ssl_ui_service`;
const maxQueryLengthServiceName = `pgsql_${version}_ssl_max_query_length`;
const tlsServiceName = 'PG_tls_1';
const maxQueryLength = '7';
const serviceAdded = 'PostgreSQL Service added.';
const remoteFields = {
  cluster: 'pgsql_remote_cluster',
  environment: 'pgsql_remote_cluster',
  host: container,
  password: 'pmm',
  port: '5432',
  username: 'pmm',
};
const readCertificates = (cliHelper: CliHelper) => ({
  ca: cliHelper.readContainerFile(container, 'certificates/ca.crt'),
  cert: cliHelper.readContainerFile(container, 'certificates/client.crt'),
  key: cliHelper.readContainerFile(container, 'certificates/client.pem'),
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.describe('SSL PostgreSQL services monitored over TLS', () => {
  // One worker, so beforeAll adds the shared services once.
  pmmTest.describe.configure({ mode: 'default' });

  const removeServices = async (api: Api, cliHelper: CliHelper) => {
    await api.inventoryApi.removeNodesByName([remoteServiceName]);
    cliHelper.removeService(container, ServiceType.postgresql, noSslCheckServiceName);
  };

  pmmTest.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const api = new Api(page, page.request);
    const cliHelper = new CliHelper();
    const { ca, cert, key } = readCertificates(cliHelper);

    await removeServices(api, cliHelper);
    await cliHelper
      .execSilent(
        `docker exec ${container} pmm-admin add postgresql --username=pmm --password=pmm --query-source="pgstatements" --tls --tls-skip-verify ${noSslCheckServiceName}`,
      )
      .assertSuccess()
      .outContains(serviceAdded);
    await api.managementApi.addService({
      postgresql: {
        add_node: { node_name: remoteServiceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
        address: container,
        cluster: remoteFields.cluster,
        environment: remoteFields.environment,
        password: remoteFields.password,
        pmm_agent_id: 'pmm-server',
        port: 5_432,
        qan_postgresql_pgstatements_agent: true,
        service_name: remoteServiceName,
        tls: true,
        tls_ca: ca,
        tls_cert: cert,
        tls_key: key,
        username: remoteFields.username,
      },
    });
    await page.close();
  });

  pmmTest.afterAll(async ({ browser }) => {
    const page = await browser.newPage();

    await removeServices(new Api(page, page.request), new CliHelper());
    await page.close();
  });

  pmmTest(
    'PMM-T1859 - Verify adding PG with --tls-skip-verify option @ssl-postgres @not-ui-pipeline',
    async ({ api }) => {
      await api.grafanaApi.waitForMetric(
        `pg_up{service_name="${noSslCheckServiceName}"}`,
        Timeouts.TWO_MINUTES,
      );
    },
  );

  pmmTest(
    'PMM-T2492 - Verify metrics from SSL instances on PMM-Server @ssl-postgres @not-ui-pipeline',
    async ({ api }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(`^${localServicePrefix}`);

      await api.grafanaApi.waitForMetric(`pg_up{service_name="${service_name}"}`);
      await api.grafanaApi.waitForMetric(`pg_up{service_name="${remoteServiceName}"}`, Timeouts.TWO_MINUTES);
    },
  );

  for (const service of services) {
    pmmTest(
      `Verify dashboard after PGSQL SSL Instances are added @ssl-postgres @not-ui-pipeline | ${service}`,
      async ({ api, dashboard, page, urlHelper }) => {
        const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(`^${service}`);
        const overview = dashboard.postgresql.postgresqlInstancesOverview;

        await page.goto(
          urlHelper.buildUrlWithParameters(overview.url, {
            from: 'now-5m',
            refresh: '10s',
            serviceName: service_name,
          }),
        );
        await dashboard.verifyAllPanelsHaveData(overview.noDataMetrics, Timeouts.TWO_MINUTES);
      },
    );
  }

  for (const service of services) {
    pmmTest(
      `PMM-T2063 - Verify QAN after PGSQL SSL Instances is added @ssl-postgres @not-ui-pipeline | ${service}`,
      async ({ api, qanStoredMetrics, urlHelper }) => {
        const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(`^${service}`);

        await expect(async () => {
          await qanStoredMetrics.openFilteredByService(
            urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }),
            service_name,
          );
          expect(
            await qanStoredMetrics.getQueryCount(),
            `The queries for service ${service_name} instance do NOT exist, check QAN Data`,
          ).toBeGreaterThan(0);
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
      },
    );
  }
});

pmmTest.describe('SSL PostgreSQL options checked on their own services', () => {
  pmmTest.afterEach(async ({ api, cliHelper }) => {
    cliHelper.removeService(container, ServiceType.postgresql, tlsServiceName);
    await api.inventoryApi.removeNodesByName([uiServiceName, maxQueryLengthServiceName]);
  });

  pmmTest(
    'PMM-T948 + PMM-T947 - Verify Adding SSL services remotely @ssl-postgres @not-ui-pipeline',
    async ({ addInstancePage, api, cliHelper, servicesPage }) => {
      await pmmTest.step('Add the SSL PostgreSQL server as a remote instance', async () => {
        await addInstancePage.fillRemotePostgresqlWithTls(
          { ...remoteFields, serviceName: uiServiceName },
          readCertificates(cliHelper),
        );
        expect((await addInstancePage.addService()).status()).toEqual(200);
      });

      await expect
        .poll(() => api.inventoryApi.verifyAgentsAreRunning(uiServiceName), {
          message: `One or more agents are not running for ${uiServiceName}`,
          timeout: Timeouts.FIVE_MINUTES,
        })
        .toBe(true);
      await expect(servicesPage.builders.serviceRow(uiServiceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await api.grafanaApi.waitForMetric(`pg_up{service_name="${uiServiceName}"}`, Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T946 - Verify adding PostgreSQL with --tls flag and with missing TLS options @ssl-postgres @not-ui-pipeline',
    async ({ cliHelper }) => {
      const pmmAdminAddTls = (options: string, serviceName: string) =>
        `docker exec ${container} pmm-admin add postgresql --tls ${options} --query-source="pgstatements" --port=5432 --username=pmm --password=pmm --service-name=${serviceName}`;
      const unknownAuthority = 'Connection check failed: x509: certificate signed by unknown authority.';
      const missingKey = cliHelper.execSilent(
        pmmAdminAddTls(
          '--tls-ca-file=./certificates/ca.crt --tls-cert-file=./certificates/client.crt',
          'PG_tls',
        ),
      );

      expect(missingKey.code, `"${missingKey.command}" should exit with an error`).not.toEqual(0);
      expect(missingKey.stdout.trim()).toEqual(
        'Connection check failed: stat /root/.postgresql/postgresql.key: no such file or directory.',
      );
      await cliHelper
        .execSilent(
          pmmAdminAddTls(
            '--tls-ca-file=./certificates/ca.crt --tls-key-file=./certificates/client.pem',
            tlsServiceName,
          ),
        )
        .assertSuccess()
        .outContains(serviceAdded);

      for (const [options, serviceName] of [
        ['--tls-cert-file=./certificates/client.crt --tls-key-file=./certificates/client.pem', 'PG_tls'],
        ['', 'PG_tls_2'],
      ]) {
        const result = cliHelper.execSilent(pmmAdminAddTls(options, serviceName));

        expect(result.code, `"${result.command}" should exit with an error`).not.toEqual(0);
        expect(result.stdout.trim(), `Output of "${result.command}"`).toEqual(unknownAuthority);
      }
    },
  );

  pmmTest(
    'PMM-T1426 - Verify remote PostgreSQL can be added with specified Max Query Length @ssl-postgres @not-ui-pipeline',
    async ({
      addInstancePage,
      agentsPage,
      api,
      cliHelper,
      page,
      qanStoredMetrics,
      servicesPage,
      urlHelper,
    }) => {
      await pmmTest.step(
        `Add the SSL PostgreSQL server remotely with Max Query Length ${maxQueryLength}`,
        async () => {
          await addInstancePage.fillRemotePostgresqlWithTls(
            { ...remoteFields, serviceName: maxQueryLengthServiceName },
            readCertificates(cliHelper),
          );
          await addInstancePage.inputs.maxQueryLength.fill(maxQueryLength);
          expect((await addInstancePage.addService()).status()).toEqual(200);
        },
      );

      await expect(servicesPage.builders.serviceRow(maxQueryLengthServiceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect
        .poll(() => api.inventoryApi.verifyAgentsAreRunning(maxQueryLengthServiceName), {
          message: `One or more agents are not running for ${maxQueryLengthServiceName}`,
          timeout: Timeouts.FIVE_MINUTES,
        })
        .toBe(true);

      const { service_id } = await api.inventoryApi.getServiceDetailsByPartialName(maxQueryLengthServiceName);

      await page.goto(agentsPage.serviceAgentsUrl(service_id));
      await agentsPage.verifyAgentDetailsLabel(
        'QAN PostgreSQL pg_stat_statements agent',
        `max_query_length=${maxQueryLength}`,
      );

      await expect(async () => {
        await qanStoredMetrics.openFilteredByService(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }),
          maxQueryLengthServiceName,
        );
        await expect(qanStoredMetrics.builders.queryRowQueryText(1)).toHaveText(
          new RegExp(`^.{1,${maxQueryLength}}$`),
          { timeout: Timeouts.THIRTY_SECONDS },
        );
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    },
  );
});
