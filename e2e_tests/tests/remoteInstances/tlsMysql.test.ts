import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const version = '8.4';
const container = `mysql_ssl_${version}`;
const clientServicePattern = `^${container}_ssl_service_`;
const exporterDir = '/usr/local/percona/pmm/tmp/mysqld_exporter';
const skipVerifyServiceName = `TLS_mysql_${version}`;
const partialTlsServices = [
  { flags: '--tls-cert=/var/lib/mysql/client-cert.pem', name: 'TLS_mysql_no_tls_key' },
  { flags: '--tls-key=/var/lib/mysql/client-key.pem', name: 'TLS_mysql_no_tls_cert' },
  { flags: '', name: 'TLS_mysql_only_ca' },
] as const;
const maxQueryLengths = ['10', '-1', ''];

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api, cliHelper }) => {
  for (const serviceName of [...partialTlsServices.map(({ name }) => name), skipVerifyServiceName]) {
    cliHelper.removeService(container, ServiceType.mysql, serviceName);
  }

  const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);

  await api.inventoryApi.removeNodesByName(
    maxQueryLengths.map(
      (maxQueryLength) => `MaxQueryLength_remote_${service_name}_${maxQueryLength || 'unset'}`,
    ),
  );
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  const { inventoryApi } = new Api(page, page.request);
  const { service_name } = await inventoryApi.getServiceDetailsByRegex(clientServicePattern);

  await inventoryApi.removeNodesByName([`remote_${service_name}_faker`]);
  await page.close();
});

pmmTest(
  'PMM-T802 - Verify Adding SSL Mysql services remotely @ssl @ssl-remote @ssl-mysql @not-ui-pipeline',
  async ({ addInstancePage, api, cliHelper, page, servicesPage }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);
    const remoteServiceName = `remote_${service_name}_faker`;

    cliHelper
      .execute(`docker exec ${container} bash -c 'source ~/.bash_profile || true; pmm-admin list'`)
      .assertSuccess();

    await pmmTest.step('Add the SSL MySQL server as a remote instance with TLS certificates', async () => {
      await page.goto(addInstancePage.url);
      await addInstancePage.builders.instanceType('mysql').click({ timeout: Timeouts.THIRTY_SECONDS });
      await addInstancePage.selectNode('pmm-server');
      await addInstancePage.fillRemoteFields({
        cluster: 'mysql_remote_cluster',
        environment: 'mysql_remote_cluster',
        host: container,
        password: 'pmm',
        port: '3306',
        serviceName: remoteServiceName,
        username: 'pmm',
      });
      await addInstancePage.verifyTlsFieldsHidden();
      await addInstancePage.fillTlsCertificates(cliHelper.readMysqlTlsCertificates(container));
      await addInstancePage.configureRemoteInstance('mysql');
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

pmmTest(
  'PMM-T2487 - Verify metrics from mysql SSL instances on PMM-Server @ssl @ssl-mysql @ssl-remote @not-ui-pipeline',
  async ({ api }) => {
    const metric = 'mysql_global_status_max_used_connections';
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);

    await api.grafanaApi.waitForMetric(`${metric}{service_name="${service_name}"}`, Timeouts.TWO_MINUTES);
    await api.grafanaApi.waitForMetric(
      `${metric}{service_name="remote_${service_name}_faker"}`,
      Timeouts.TWO_MINUTES,
    );
  },
);

pmmTest(
  'PMM-T937 + PMM-T938 + PMM-T2093 - Verify MySQL can be added with TLS without --tls-key, without --tls-cert or with --tls-ca only @ssl @ssl-mysql @ssl-remote @not-ui-pipeline',
  async ({ cliHelper }) => {
    for (const { flags, name } of partialTlsServices) {
      await cliHelper
        .execute(
          `docker exec ${container} pmm-admin add mysql --username=pmm --password=pmm --port=3306 --query-source=perfschema --tls --tls-skip-verify --tls-ca=/var/lib/mysql/ca.pem ${flags} ${name}`,
        )
        .assertSuccess()
        .outContains('MySQL Service added.');
    }
  },
);

pmmTest(
  'PMM-T319 - Verify dashboard after MySQL SSL Instances are added @ssl @ssl-mysql @ssl-remote @not-ui-pipeline',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);
    const overview = dashboard.mysql.mysqlInstanceOverview;

    for (const serviceName of [service_name, `remote_${service_name}_faker`]) {
      await pmmTest.step(`Verify MySQL Instances Overview has data for ${serviceName}`, async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(overview.url, { from: 'now-5m', serviceName, to: 'now' }),
        );
        await dashboard.verifyAllPanelsHaveData(overview.noDataMetrics, Timeouts.FIVE_MINUTES);
      });
    }
  },
);

pmmTest(
  'PMM-T2063 - Verify QAN after MySQL SSL Instances is added @ssl @ssl-mysql @ssl-remote @not-ui-pipeline',
  async ({ api, qanStoredMetrics, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);

    for (const serviceName of [service_name, `remote_${service_name}_faker`]) {
      await expect(async () => {
        await qanStoredMetrics.openFilteredByService(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }),
          serviceName,
        );
        expect(
          await qanStoredMetrics.getQueryCount(),
          `The queries for service ${serviceName} instance do NOT exist, check QAN Data`,
        ).toBeGreaterThan(0);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
    }
  },
);

pmmTest(
  'PMM-T1277 - Verify tlsCa, tlsCert, tlsKey are generated on every MySQL exporter (added with TLS flags) restart @ssl-mysql @ssl @ssl-remote @not-ui-pipeline',
  async ({ cliHelper }) => {
    const agentId = cliHelper
      .execute(`docker exec ${container} pmm-admin list | grep mysqld_exporter | awk -F" " '{print $4}'`)
      .assertSuccess()
      .stdout.trim();

    expect(agentId, `${container} must list one mysqld_exporter agent id`).toMatch(/^[\w-]+$/);
    cliHelper.execute(`docker exec ${container} ls -R ${exporterDir}/${agentId} | grep tls`).assertSuccess();
    cliHelper.execute(`docker exec ${container} rm -r ${exporterDir}/`).assertSuccess();
    cliHelper
      .execute(`docker exec ${container} ls -R ${exporterDir}/`)
      .assertFailure(`ls: cannot access '${exporterDir}/': No such file or directory`);
    cliHelper
      .execute(`docker exec ${container} pmm-admin list | grep mysqld_exporter | grep Running`)
      .assertSuccess();
    cliHelper.execute(`docker exec ${container} pkill -f mysqld_exporter`).assertSuccess();
    await expect(() => {
      cliHelper
        .execSilent(`docker exec ${container} pmm-admin list | grep mysqld_exporter | grep Running`)
        .assertSuccess();
      cliHelper
        .execSilent(`docker exec ${container} ls -R ${exporterDir}/${agentId} | grep tls`)
        .assertSuccess();
    }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS });
  },
);

for (const maxQueryLength of ['---;', 'aa', '^', '`', '"']) {
  pmmTest(
    `PMM-T1405 - Verify validation of Max Query Length option on Add remote MySQL page @max-length @ssl @ssl-mysql @ssl-remote @not-ui-pipeline | ${maxQueryLength}`,
    async ({ addInstancePage, page }) => {
      await page.goto(addInstancePage.url);
      await addInstancePage.builders.instanceType('mysql').click({ timeout: Timeouts.THIRTY_SECONDS });
      await addInstancePage.inputs.maxQueryLength.fill(maxQueryLength, { timeout: Timeouts.ONE_MINUTE });
      await expect(addInstancePage.messages.maxQueryLengthError).toContainText(
        'Value should be greater or equal to -1',
        { timeout: Timeouts.THIRTY_SECONDS },
      );
    },
  );
}

for (const maxQueryLength of maxQueryLengths) {
  pmmTest(
    `PMM-T1403 + PMM-T1404 + PMM-T1426 + PMM-T1431 - Verify remote MySQL with TLS can be added with a Max Query Length @max-length @ssl @ssl-remote @ssl-mysql @not-ui-pipeline | '${maxQueryLength}'`,
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
      const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(clientServicePattern);
      const remoteServiceName = `MaxQueryLength_remote_${service_name}_${maxQueryLength || 'unset'}`;
      const limited = maxQueryLength !== '' && maxQueryLength !== '-1';
      const exampleQueryMarker = 'character_sets';
      const qanUrl = urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' });

      await pmmTest.step('Add the SSL MySQL server remotely with the Max Query Length', async () => {
        await page.goto(addInstancePage.url);
        await addInstancePage.builders.instanceType('mysql').click({ timeout: Timeouts.THIRTY_SECONDS });
        await addInstancePage.selectNode('pmm-server');
        await addInstancePage.fillRemoteFields({
          cluster: 'mysql_remote_cluster',
          environment: 'mysql_remote_cluster',
          host: container,
          password: 'pmm',
          port: '3306',
          serviceName: remoteServiceName,
          username: 'pmm',
        });
        await addInstancePage.verifyTlsFieldsHidden();
        await addInstancePage.fillTlsCertificates(cliHelper.readMysqlTlsCertificates(container));
        await addInstancePage.configureRemoteInstance('mysql');
        await addInstancePage.inputs.maxQueryLength.fill(maxQueryLength);
        expect((await addInstancePage.addService()).status()).toEqual(200);
      });

      await expect(servicesPage.builders.serviceRow(remoteServiceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect
        .poll(() => api.inventoryApi.verifyAgentsAreRunning(remoteServiceName), {
          message: `One or more agents are not running for ${remoteServiceName}`,
          timeout: Timeouts.FIVE_MINUTES,
        })
        .toBe(true);

      if (maxQueryLength !== '') {
        const { service_id } = await api.inventoryApi.getServiceDetailsByPartialName(remoteServiceName);

        await page.goto(agentsPage.serviceAgentsUrl(service_id));
        await agentsPage.verifyAgentDetailsLabel(
          'QAN MySQL Performance Schema agent',
          `max_query_length=${maxQueryLength}`,
        );
      }
      if (!limited) {
        cliHelper
          .execute(
            `docker exec -d ${container} bash -c '{ echo "SELECT * FROM information_schema.${exampleQueryMarker};"; sleep 120; } | mysql -upmm -ppmm'`,
          )
          .assertSuccess();
      }

      await expect(async () => {
        await qanStoredMetrics.openFilteredByService(qanUrl, remoteServiceName);
        await expect(qanStoredMetrics.builders.queryRow(1)).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
      await expect(qanStoredMetrics.builders.queryRowQueryText(1)).toHaveText(
        limited ? new RegExp(`^[\\s\\S]{1,${maxQueryLength}}$`) : /^[\s\S]{6,}$/,
      );

      if (!limited) {
        await qanStoredMetrics.searchFilteredByService(qanUrl, remoteServiceName, exampleQueryMarker);
        await qanStoredMetrics.selectRow(1);
        await qanStoredMetrics.openExamplesTab();
        await expect(qanStoredMetrics.elements.noExamples).toBeHidden();
        await qanStoredMetrics.verifyNoExplainErrors();
      }
    },
  );
}

pmmTest(
  'PMM-T1896 - Verify MySQL w/ tls/ssl certs can be added when specified with --tls-skip-verify @ssl @ssl-mysql @not-ui-pipeline',
  async ({ cliHelper, page, servicesPage }) => {
    await cliHelper
      .execute(
        `docker exec ${container} pmm-admin add mysql --username=pmm_tls --port=3306 --query-source=perfschema --tls --tls-skip-verify --tls-ca=/var/lib/mysql/ca.pem --tls-cert=/var/lib/mysql/client-cert.pem --tls-key=/var/lib/mysql/client-key.pem ${skipVerifyServiceName}`,
      )
      .assertSuccess()
      .outContains('MySQL Service added');
    await page.goto(servicesPage.url);
    await expect(servicesPage.builders.serviceRow(skipVerifyServiceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);
