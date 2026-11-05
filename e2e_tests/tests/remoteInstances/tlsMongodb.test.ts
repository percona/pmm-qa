import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const container = 'psmdb-server';
const clientServicePattern = `^${container}_`;
const exporterDir = '/usr/local/percona/pmm/tmp/mongodb_exporter';
const partialTlsServiceName = 'TLS_MongoDB_Service';
const maxQueryLength = '7';

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api, cliHelper }) => {
  cliHelper.removeService(container, ServiceType.mongodb, partialTlsServiceName);

  const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);

  await api.inventoryApi.removeNodesByName([`MaxQueryLength_remote_${service_name}`]);
});

pmmTest.afterAll(async ({ api }) => {
  const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);

  await api.inventoryApi.removeNodesByName([`remote_${service_name}`]);
});

pmmTest(
  'PMM-T888 + PMM-T919 - Verify Adding SSL services remotely @ssl-mongo',
  async ({ addInstancePage, api, cliHelper, page, servicesPage }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);
    const remoteServiceName = `remote_${service_name}`;

    await pmmTest.step('Add the SSL MongoDB server as a remote instance with TLS certificates', async () => {
      await page.goto(addInstancePage.url);
      await addInstancePage.addRemoteTlsMongodb(
        remoteServiceName,
        container,
        cliHelper.readMongodbTlsCertificates(container),
      );
      expect((await addInstancePage.addService()).status()).toEqual(200);
    });

    await expect
      .poll(() => api.inventoryApi.verifyAgentsAreRunning(remoteServiceName), {
        message: `One or more agents are not running for ${remoteServiceName}`,
        timeout: Timeouts.FIVE_MINUTES,
      })
      .toBe(true);
    await expect(servicesPage.builders.serviceRow(remoteServiceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest('PMM-T2494 - Verify metrics from SSL instances on PMM-Server @ssl-mongo', async ({ api }) => {
  const metric = 'mongodb_connections';
  const { service_id, service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);
  const remoteService = await api.inventoryApi.getServiceDetailsByRegex(`^remote_${service_name}$`);

  await api.grafanaApi.waitForMetric(`${metric}{service_id="${service_id}"}`, Timeouts.TWO_MINUTES);
  await api.grafanaApi.waitForMetric(
    `${metric}{service_id="${remoteService.service_id}"}`,
    Timeouts.TWO_MINUTES,
  );
});

pmmTest(
  'PMM-T926 + PMM-T927 - Verify MongoDB cannot be added with only the CA file or only the certificate key file specified @ssl-mongo',
  async ({ cliHelper }) => {
    for (const flags of [
      '--tls-skip-verify --tls-ca-file=/mongodb_certs/certificate.crt',
      '--tls-certificate-key-file=/mongodb_certs/client.pem',
    ]) {
      const result = cliHelper.execute(
        `docker exec ${container} pmm-admin add mongodb --tls --authentication-mechanism=MONGODB-X509 --authentication-database='$external' ${flags} ${partialTlsServiceName}`,
      );

      expect(result.code, `"${result.command}" should exit with an error`).not.toEqual(0);
      expect(result.stdout, `Output of "${result.command}"`).toContain(
        'Connection check failed: server selection error: server selection timeout, current topology:',
      );
    }
  },
);

pmmTest(
  'PMM-T307 - Verify dashboard after MongoDB SSL Instances are added @ssl-mongo',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);
    const overview = dashboard.mongo.instancesOverview;

    for (const serviceName of [service_name, `remote_${service_name}`]) {
      await pmmTest.step(`Verify MongoDB Instances Overview has data for ${serviceName}`, async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(overview.url, { from: 'now-5m', serviceName, to: 'now' }),
        );
        await dashboard.verifyAllPanelsHaveData(overview.noDataMetrics, Timeouts.TWO_MINUTES);
      });
    }
  },
);

pmmTest(
  'PMM-T2063 - Verify QAN after MongoDB SSL Instances is added @ssl-mongo',
  async ({ api, qanStoredMetrics, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);

    for (const serviceName of [service_name, `remote_${service_name}`]) {
      await expect(async () => {
        await qanStoredMetrics.openFilteredByService(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
            from: 'now-5m',
            refresh: '10s',
            to: 'now',
          }),
          serviceName,
        );
        expect(
          await qanStoredMetrics.getQueryCount(),
          `The queries for service ${serviceName} instance do NOT exist, check QAN Data`,
        ).toBeGreaterThan(0);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    }
  },
);

pmmTest(
  'PMM-T1276 - Verify tlsCa, tlsCert, tlsKey are generated on every MongoDB exporter (added with TLS flags) restart @ssl-mongo',
  async ({ cliHelper }) => {
    const agentId = cliHelper
      .execute(`docker exec ${container} pmm-admin list | grep mongodb_exporter | awk -F" " '{print $4}'`)
      .assertSuccess()
      .stdout.trim();

    expect(agentId, `${container} must list one mongodb_exporter agent id`).toMatch(/^[\w-]+$/);
    cliHelper
      .execute(`docker exec ${container} ls -la ${exporterDir}/${agentId}/ | grep caFile`)
      .assertSuccess();
    cliHelper.execute(`docker exec ${container} rm -r ${exporterDir}/`).assertSuccess();
    cliHelper
      .execute(`docker exec ${container} ls -la ${exporterDir}/`)
      .assertFailure(`ls: cannot access '${exporterDir}/': No such file or directory`);
    cliHelper
      .execute(`docker exec ${container} pmm-admin list | grep mongodb_exporter | grep Running`)
      .assertSuccess();
    cliHelper.execute(`docker exec ${container} pkill -f mongodb_exporter`).assertSuccess();
    await expect(() => {
      cliHelper
        .execSilent(`docker exec ${container} pmm-admin list | grep mongodb_exporter | grep Running`)
        .assertSuccess();
      cliHelper
        .execSilent(`docker exec ${container} ls -la ${exporterDir}/${agentId}/ | grep caFile`)
        .assertSuccess();
    }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS });
  },
);

pmmTest(
  'PMM-T1431 - Verify adding MongoDB instance via UI with specified Max Query Length option @ssl-mongo',
  async ({ addInstancePage, agentsPage, api, cliHelper, page, servicesPage }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);
    const remoteServiceName = `MaxQueryLength_remote_${service_name}`;

    await pmmTest.step(
      `Add the SSL MongoDB server remotely with Max Query Length ${maxQueryLength}`,
      async () => {
        await page.goto(addInstancePage.url);
        await addInstancePage.addRemoteTlsMongodb(
          remoteServiceName,
          container,
          cliHelper.readMongodbTlsCertificates(container),
        );
        await addInstancePage.inputs.maxQueryLength.fill(maxQueryLength);
        expect((await addInstancePage.addService()).status()).toEqual(200);
      },
    );

    await expect(servicesPage.builders.serviceRow(remoteServiceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect
      .poll(() => api.inventoryApi.verifyAgentsAreRunning(remoteServiceName), {
        message: `One or more agents are not running for ${remoteServiceName}`,
        timeout: Timeouts.FIVE_MINUTES,
      })
      .toBe(true);

    const { service_id } = await api.inventoryApi.getServiceDetailsByRegex(`^${remoteServiceName}$`);

    await page.goto(agentsPage.serviceAgentsUrl(service_id));
    await agentsPage.verifyAgentDetailsLabel(
      'QAN MongoDB Profiler agent',
      `max_query_length=${maxQueryLength}`,
    );
  },
);
