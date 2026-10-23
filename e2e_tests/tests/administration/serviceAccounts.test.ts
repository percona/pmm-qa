import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import { Timeouts } from '@helpers/timeouts';
import ServiceAccountsPage from '@pages/serviceAccounts.page';
import { expect, Page } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const psContainerCommand = "docker ps | grep ps_pmm | awk '{print $NF}'";
const nodeIdCommand = (container: string) =>
  `sudo docker exec ${container} pmm-admin status | grep "Node ID" | awk -F " " '{ print $4 }'`;
const agentSetupCommand = (container: string, token: string) =>
  `sudo docker exec ${container} pmm-agent setup --server-username=service_token --server-password=${token} --server-address=pmm-server:8443 --server-insecure-tls --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`;
const exporterRunningCommand = (container: string, exporter: string) =>
  `docker exec ${container} pmm-admin list | grep ${exporter} | grep -q Running; echo $?`;
const addMysqlCommand = (container: string, credentials: Credentials, serviceName: string) =>
  `sudo docker exec ${container} pmm-admin add mysql --username=${credentials.perconaServer.username} --password=${credentials.perconaServer.password} --host=127.0.0.1 --port=3306 --service-name=${serviceName}`;
const adminSetupCommand = (container: string) =>
  `docker exec ${container} pmm-agent setup --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=pmm-server:8443 --server-insecure-tls --server-username=admin --server-password=${process.env.ADMIN_PASSWORD || 'admin'}`;
const expectedDisabledMessage =
  'Auth method is not service account token. Please check username and password.';
const newServiceName = 'mysql_service_service_token1';
const loadDatabase = 'pmm_t1883_load';
let serviceAccountUsername = '';

const expectExporterRunning = async (
  cliHelper: CliHelper,
  container: string,
  exporter: string,
  message: string,
) => {
  await expect
    .poll(() => cliHelper.execSilent(exporterRunningCommand(container, exporter)).stdout.trim(), {
      message,
      timeout: Timeouts.ONE_MINUTE,
    })
    .toBe('0');
};

const createAccountWithToken = async (
  page: Page,
  serviceAccountsPage: ServiceAccountsPage,
  cliHelper: CliHelper,
  api: Api,
) => {
  serviceAccountUsername = `service_account_${Date.now()}`;

  await page.goto(serviceAccountsPage.url);
  await serviceAccountsPage.createServiceAccount(serviceAccountUsername, 'Admin');
  await expect(serviceAccountsPage.messages.successPopUp).toContainText(
    serviceAccountsPage.accountEditedMessage,
    { timeout: Timeouts.THIRTY_SECONDS },
  );
  await serviceAccountsPage.closeSuccessPopUp();

  const tokenValue = await serviceAccountsPage.createServiceAccountToken(`token_name_${Date.now()}`);
  const psContainerName = cliHelper.execute(psContainerCommand).assertSuccess().stdout.trim();
  const oldNodeId = cliHelper.execute(nodeIdCommand(psContainerName)).assertSuccess().stdout.trim();

  if (oldNodeId) {
    await api.inventoryApi.deleteNode(oldNodeId, true);
  }

  return { psContainerName, tokenValue };
};

const registerAgent = async (cliHelper: CliHelper, container: string, token: string, message: string) => {
  cliHelper.execute(agentSetupCommand(container, token)).assertSuccess();
  await expectExporterRunning(cliHelper, container, 'node_exporter', message);
};

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ cliHelper }) => {
  cliHelper
    .execute(`sudo docker exec $(${psContainerCommand}) pkill -f "${loadDatabase}.write_load" || true`)
    .assertSuccess();
});

// Runs before PMM-T1883, which re-registers the client with a token of its own: this case needs the client
// still running with its Node's service account token, as pmm-framework registered it.
pmmTest(
  'PMM-T2400 - Verify re-running client setup while its service account is disabled keeps the Node and its services @service-account',
  async ({ api, cliHelper, nodesPage, page, serviceAccountsPage, servicesPage }) => {
    const psContainerName = cliHelper.execute(psContainerCommand).assertSuccess().stdout.trim();
    const status = cliHelper
      .execute(`docker exec ${psContainerName} pmm-admin status`)
      .assertSuccess().stdout;
    const agentId = /^Agent ID\s*:\s*(\S+)/m.exec(status)?.[1];
    const nodeName = /^Node name\s*:\s*(\S+)/m.exec(status)?.[1];

    if (!agentId || !nodeName) throw new Error(`No Agent ID or Node name in pmm-admin status:\n${status}`);

    const nodeServiceAccount = `pmm-agent-sa-${nodeName}`;

    try {
      const before = await pmmTest.step('The Node is listed once with its MySQL service', async () => {
        const registered = await api.inventoryApi.getNodeWithMysqlService(nodeName);

        await nodesPage.verifyNodeListedOnce(nodeName);
        await servicesPage.verifyServiceListedOnce(registered.serviceName);

        return registered;
      });

      await pmmTest.step("Disable the Node's service account", async () => {
        await page.goto(serviceAccountsPage.url);
        await serviceAccountsPage.builders
          .disableAccountButton(nodeServiceAccount)
          .click({ timeout: Timeouts.ONE_MINUTE });
        await serviceAccountsPage.buttons.confirmDisable.click();
        await expect(serviceAccountsPage.messages.successPopUp).toContainText(
          serviceAccountsPage.accountEditedMessage,
          { timeout: Timeouts.THIRTY_SECONDS },
        );
        await serviceAccountsPage.closeSuccessPopUp();
        await expect(serviceAccountsPage.builders.enableAccountButton(nodeServiceAccount)).toBeVisible();
      });

      await pmmTest.step('pmm-admin list fails with the credentials hint', async () => {
        const listCommand = `docker exec ${psContainerName} pmm-admin list`;

        await expect
          .poll(() => cliHelper.execSilent(listCommand).code, {
            message: `"${listCommand}" should exit with an error while the service account is disabled`,
            // pmm-managed caches a token's auth result for up to a minute.
            timeout: Timeouts.TWO_MINUTES + Timeouts.ONE_MINUTE,
          })
          .not.toBe(0);
        expect(cliHelper.execSilent(listCommand).stdout.trim()).toBe(expectedDisabledMessage);
      });

      await pmmTest.step('Setup without --force keeps the registration and names the Node', async () => {
        const setup = cliHelper.execSilent(adminSetupCommand(psContainerName)).assertSuccess();

        expect(`${setup.stdout}${setup.stderr}`).toContain(
          `PMM Server has pmm-agent ${agentId} on Node ${nodeName}, but does not accept the token pmm-agent runs with.`,
        );
      });

      await pmmTest.step('The same Node is still listed once with its MySQL service', async () => {
        expect(await api.inventoryApi.getNodeWithMysqlService(nodeName)).toEqual(before);
        await nodesPage.verifyNodeListedOnce(nodeName);
        await servicesPage.verifyServiceListedOnce(before.serviceName);
      });

      await pmmTest.step("Enable the Node's service account again", async () => {
        await page.goto(serviceAccountsPage.url);
        await serviceAccountsPage.builders
          .enableAccountButton(nodeServiceAccount)
          .click({ timeout: Timeouts.ONE_MINUTE });
        await expect(serviceAccountsPage.messages.successPopUp).toContainText(
          serviceAccountsPage.accountEditedMessage,
          { timeout: Timeouts.THIRTY_SECONDS },
        );
        await serviceAccountsPage.closeSuccessPopUp();
      });
    } finally {
      await api.grafanaApi.enableServiceAccount(nodeServiceAccount);
    }

    await expect
      .poll(() => cliHelper.execSilent(`docker exec ${psContainerName} pmm-admin list`).code, {
        message: 'pmm-admin list should work again once the service account is enabled',
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBe(0);
  },
);

pmmTest.describe(() => {
  pmmTest.describe.configure({ retries: 1 });

  pmmTest(
    'PMM-T1883 - Configuring pmm-agent to use service account @service-account',
    async ({ api, cliHelper, credentials, dashboard, page, serviceAccountsPage, urlHelper }) => {
      const { psContainerName, tokenValue } = await createAccountWithToken(
        page,
        serviceAccountsPage,
        cliHelper,
        api,
      );

      await pmmTest.step('Register the pmm-agent with the service account token', async () => {
        await registerAgent(
          cliHelper,
          psContainerName,
          tokenValue,
          'node_exporter should be Running after the pmm-agent was set up',
        );
        cliHelper.execute(addMysqlCommand(psContainerName, credentials, newServiceName)).assertSuccess();
      });

      const monitoredNode = (await api.inventoryApi.getAllNodes()).find(
        (node) => node.node_name !== 'pmm-server',
      );

      if (!monitoredNode) throw new Error('No monitored node other than pmm-server is registered');

      const nodesUrl = urlHelper.buildUrlWithParameters(dashboard.os.nodesOverview.url, {
        from: 'now-1m',
        serviceName: monitoredNode.node_name,
        to: 'now',
      });

      await pmmTest.step('Nodes Overview reports data for the re-registered node', async () => {
        await dashboard.waitForNoDataPanelsAtMost(nodesUrl, 19, Timeouts.FIVE_MINUTES + Timeouts.ONE_MINUTE);
      });

      await pmmTest.step('Nodes Overview still reports data after a PMM Server restart', async () => {
        cliHelper.execute('sudo docker restart pmm-server').assertSuccess();
        await api.serverApi.waitForReady(Timeouts.ONE_MINUTE);
        await dashboard.waitForNoDataPanelsAtMost(dashboard.os.nodesOverview.url, 19);
      });

      const mysqlCredentials = `-h 127.0.0.1 --port 3306 -u${credentials.perconaServer.username} -p${credentials.perconaServer.password}`;

      await pmmTest.step('Start a write load against the monitored MySQL instance', async () => {
        cliHelper
          .execute(
            `sudo docker exec ${psContainerName} mysql ${mysqlCredentials} -e "CREATE DATABASE IF NOT EXISTS ${loadDatabase}; CREATE TABLE IF NOT EXISTS ${loadDatabase}.write_load (id INT AUTO_INCREMENT PRIMARY KEY, value CHAR(36))"`,
          )
          .assertSuccess();
        cliHelper
          .execute(
            `sudo docker exec -d ${psContainerName} timeout 420 bash -c 'while true; do mysql ${mysqlCredentials} -e "INSERT INTO ${loadDatabase}.write_load (value) VALUES (UUID())"; sleep 1; done'`,
          )
          .assertSuccess();
      });

      const overviewUrl = urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceOverview.url, {
        from: 'now-1m',
        refresh: '10s',
        serviceName: newServiceName,
        to: 'now',
      });

      await page.goto(overviewUrl);
      await expect
        .poll(() => dashboard.elements.noDataPanelName.count(), {
          message: 'MySQL Instances Overview should show at most 1 panel without data',
          timeout: Timeouts.FIVE_MINUTES + Timeouts.FIVE_SECONDS,
        })
        .toBeLessThanOrEqual(1);
    },
  );
});

pmmTest(
  'PMM-T1884 - Verify disabling service account @service-account',
  async ({ cliHelper, page, serviceAccountsPage }) => {
    await page.goto(serviceAccountsPage.url);
    await serviceAccountsPage.builders
      .disableAccountButton(serviceAccountUsername)
      .click({ timeout: Timeouts.ONE_MINUTE });
    await serviceAccountsPage.buttons.confirmDisable.click();
    await expect(serviceAccountsPage.messages.successPopUp).toContainText(
      serviceAccountsPage.accountEditedMessage,
      { timeout: Timeouts.THIRTY_SECONDS },
    );
    await serviceAccountsPage.closeSuccessPopUp();

    const psContainerName = cliHelper.execute(psContainerCommand).assertSuccess().stdout.trim();
    const containerListCommand = `docker exec ${psContainerName} pmm-admin list`;

    await expect
      .poll(() => cliHelper.execSilent(containerListCommand).code, {
        message: `"${containerListCommand}" should exit with an error while the service account is disabled`,
        // pmm-managed caches a token's auth result for up to a minute.
        timeout: Timeouts.TWO_MINUTES,
      })
      .not.toBe(0);

    const responseDisabled = cliHelper.execute(containerListCommand).stdout.trim();

    expect(
      responseDisabled,
      `Expected the message: '${expectedDisabledMessage} when sending command: 'pmm-admin list'. Actual message is: ${responseDisabled}`,
    ).toBe(expectedDisabledMessage);

    await serviceAccountsPage.builders
      .enableAccountButton(serviceAccountUsername)
      .click({ timeout: Timeouts.ONE_MINUTE });
    await expect(serviceAccountsPage.messages.successPopUp).toContainText(
      serviceAccountsPage.accountEditedMessage,
      { timeout: Timeouts.THIRTY_SECONDS },
    );
    await serviceAccountsPage.closeSuccessPopUp();

    const hostListCommand = 'sudo -E env "PATH=$PATH" pmm-admin list';

    await expect
      .poll(() => cliHelper.execSilent(hostListCommand).code, {
        message: `"${hostListCommand}" should exit with 0 once the service account is enabled again`,
        timeout: Timeouts.ONE_MINUTE,
      })
      .toBe(0);

    expect(
      cliHelper.execute(hostListCommand).stdout.trim(),
      'Expected message for enabled user is not present',
    ).not.toContain(expectedDisabledMessage);
  },
);

pmmTest.describe(() => {
  pmmTest.describe.configure({ retries: 1 });

  pmmTest(
    'PMM-T1900 - PMM3 Client pmm-admin unregister w/o force removes nodes & pmm-admin config errors command if the node was removed and added @service-account',
    async ({ api, cliHelper, credentials, dashboard, page, serviceAccountsPage, urlHelper }) => {
      const newServiceName = 'mysql_service_service_token2';
      const { psContainerName, tokenValue } = await createAccountWithToken(
        page,
        serviceAccountsPage,
        cliHelper,
        api,
      );

      await pmmTest.step('Register the pmm-agent with the service account token', async () => {
        await registerAgent(
          cliHelper,
          psContainerName,
          tokenValue,
          'node_exporter should be Running after the pmm-agent was set up',
        );
        cliHelper.execute(addMysqlCommand(psContainerName, credentials, newServiceName)).assertSuccess();
        await expectExporterRunning(
          cliHelper,
          psContainerName,
          'mysqld_exporter',
          'mysqld_exporter should be Running after the MySQL service was added',
        );
      });

      const newNodeId = cliHelper.execute(nodeIdCommand(psContainerName)).assertSuccess().stdout.trim();

      if (newNodeId) {
        await api.inventoryApi.deleteNode(newNodeId, true);
      }

      await pmmTest.step('Register the unregistered node with the same token again', async () => {
        await registerAgent(
          cliHelper,
          psContainerName,
          tokenValue,
          'node_exporter should be Running after the node was registered back',
        );
        cliHelper.execute(addMysqlCommand(psContainerName, credentials, newServiceName)).assertSuccess();
        await expectExporterRunning(
          cliHelper,
          psContainerName,
          'mysqld_exporter',
          'mysqld_exporter should be Running after the MySQL service was added back',
        );
      });

      const monitoredNode = (await api.inventoryApi.getAllNodes()).find(
        (node) => node.node_name !== 'pmm-server',
      );

      if (!monitoredNode) throw new Error('No monitored node other than pmm-server is registered');

      const nodesUrl = urlHelper.buildUrlWithParameters(dashboard.os.nodesOverview.url, {
        from: 'now-1m',
        nodeName: monitoredNode.node_name,
        to: 'now',
      });

      await pmmTest.step('Nodes Overview reports data for the re-registered node', async () => {
        await page.goto(nodesUrl);
        await dashboard.loadAllPanels();
        await expect
          .poll(() => dashboard.elements.noDataPanelName.count(), {
            message: 'Nodes Overview should show at most 19 panels without data',
            timeout: Timeouts.FIVE_MINUTES,
          })
          .toBeLessThanOrEqual(19);
      });

      const summaryUrl = urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceSummary.url, {
        from: 'now-1m',
        serviceName: newServiceName,
        to: 'now',
      });

      await page.goto(summaryUrl);
      await expect
        .poll(() => dashboard.elements.noDataPanelName.count(), {
          message: 'MySQL Instance Summary should show at most 20 panels without data',
          timeout: Timeouts.FIVE_MINUTES + Timeouts.FIVE_SECONDS,
        })
        .toBeLessThanOrEqual(20);
    },
  );
});
