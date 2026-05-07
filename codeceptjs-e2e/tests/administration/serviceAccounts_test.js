Feature('Service Accounts tests');

Before(async ({ I }) => {
  await I.Authorize();
});

let serviceAccountUsername = '';
const newServiceName = 'mysql_service_service_token1';

Scenario('PMM-T1883 - Configuring pmm-agent to use service account @service-account', async ({
  I, codeceptjsConfig, serviceAccountsPage, dashboardPage, inventoryAPI, nodesOverviewPage, credentials,
}) => {
  serviceAccountUsername = `service_account_${Date.now()}`;
  await I.amOnPage(serviceAccountsPage.url);
  const pmmServerUrl = new URL(codeceptjsConfig.config.helpers.Playwright.url).hostname;

  await serviceAccountsPage.createServiceAccount(serviceAccountUsername, 'Admin');

  const tokenValue = await serviceAccountsPage.createServiceAccountToken(`token_name_${Date.now()}`);
  const psContainerName = await I.verifyCommand('docker ps | grep ps_pmm | awk \'{print $NF}\'');
  const oldNodeId = await I.verifyCommand(`sudo docker exec ${psContainerName} pmm-admin status | grep "Node ID" | awk -F " " '{ print $4 }'`);

  if (oldNodeId) {
    await inventoryAPI.deleteNode(oldNodeId, true);
  }

  await I.verifyCommand(`sudo docker exec ${psContainerName} pmm-agent setup --server-username=service_token --server-password=${tokenValue} --server-address=pmm-server:8443 --server-insecure-tls --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`);
  await I.wait(15);
  await I.verifyCommand(`sudo docker exec ${psContainerName} pmm-admin add mysql --username=msandbox --password=msandbox --host=127.0.0.1  --port=3307 --service-name=${newServiceName}`);
  await I.wait(60);
  const nodeName = (await inventoryAPI.getAllNodes()).find((node) => node.node_name !== 'pmm-server').node_name;
  const nodesUrl = I.buildUrlWithParams(nodesOverviewPage.url, {
    from: 'now-1m',
    to: 'now',
    service_name: nodeName,
  });

  await I.amOnPage(nodesUrl);
  await dashboardPage.waitForDashboardOpened();
  await dashboardPage.expandEachDashboardRow();
  await dashboardPage.waitForGraphsToHaveData(19, 300);

  await I.verifyCommand('sudo docker restart pmm-server');
  await I.wait(60);
  await I.amOnPage(nodesOverviewPage.url);
  await dashboardPage.waitForDashboardOpened();
  await dashboardPage.expandEachDashboardRow();
  await dashboardPage.waitForGraphsToHaveData(19, 300);

  const url = I.buildUrlWithParams(dashboardPage.mySQLInstanceOverview.clearUrl, {
    from: 'now-1m',
    to: 'now',
    service_name: newServiceName,
  });

  await I.amOnPage(url);
  await I.wait(5);
  await dashboardPage.waitForGraphsToHaveData(1, 300);
}).retry(1);

Scenario('PMM-T1884 - Verify disabling service account @service-account', async ({ I, serviceAccountsPage }) => {
  await I.amOnPage(serviceAccountsPage.url);
  await serviceAccountsPage.disableServiceAccount(serviceAccountUsername);
  await I.wait(10);
  const psContainerName = await I.verifyCommand('docker ps | grep ps_pmm | awk \'{print $NF}\'');
  const responseDisabled = await I.verifyCommand(`docker exec ${psContainerName} pmm-admin list`, '', 'fail');
  const expectedDisabledMessage = 'Auth method is not service account token. Please check username and password.';

  I.assertEqual(
    responseDisabled,
    expectedDisabledMessage,
    `Expected the message: '${expectedDisabledMessage} when sending command: 'pmm-admin list'. Actual message is: ${responseDisabled}`,
  );

  await serviceAccountsPage.enableServiceAccount(serviceAccountUsername);
  await I.wait(10);
  const responseEnabled = await I.verifyCommand('sudo -E env "PATH=$PATH" pmm-admin list');

  I.assertFalse(responseEnabled.includes(expectedDisabledMessage), 'Expected message for enabled user is not present');
});

Scenario('PMM-T1900 - PMM3 Client pmm-admin unregister w/o force removes nodes & pmm-admin config errors command if the node was removed and added @service-account', async ({
  I, codeceptjsConfig, serviceAccountsPage, dashboardPage, inventoryAPI, nodesOverviewPage, credentials,
}) => {
  const newServiceName = 'mysql_service_service_token2';

  serviceAccountUsername = `service_account_${Date.now()}`;
  await I.amOnPage(serviceAccountsPage.url);
  const pmmServerUrl = new URL(codeceptjsConfig.config.helpers.Playwright.url).hostname;

  await serviceAccountsPage.createServiceAccount(serviceAccountUsername, 'Admin');

  const tokenValue = await serviceAccountsPage.createServiceAccountToken(`token_name_${Date.now()}`);
  const psContainerName = await I.verifyCommand('docker ps | grep ps_pmm | awk \'{print $NF}\'');
  const oldNodeId = await I.verifyCommand(`sudo docker exec ${psContainerName} pmm-admin status | grep "Node ID" | awk -F " " '{ print $4 }'`);

  if (oldNodeId) {
    await inventoryAPI.deleteNode(oldNodeId, true);
  }

  await I.verifyCommand(`sudo docker exec ${psContainerName} pmm-agent setup --server-username=service_token --server-password=${tokenValue} --server-address=pmm-server:8443 --server-insecure-tls --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`);
  await I.asyncWaitFor(async () => await I.verifyCommand(`docker exec ${psContainerName} pmm-admin list | grep node_exporter | grep -q Running; echo $?`) === '0', 60);
  await I.verifyCommand(`sudo docker exec ${psContainerName} pmm-admin add mysql --username=msandbox --password=msandbox --host=127.0.0.1  --port=3307 --service-name=${newServiceName}`);
  await I.asyncWaitFor(async () => await I.verifyCommand(`docker exec ${psContainerName} pmm-admin list | grep mysqld_exporter | grep -q Running; echo $?`) === '0', 60);

  // Unregister Node Again and check if we are able to register back.
  const newNodeId = await I.verifyCommand(`sudo docker exec ${psContainerName} pmm-admin status | grep "Node ID" | awk -F " " '{ print $4 }'`);

  if (newNodeId) {
    await inventoryAPI.deleteNode(newNodeId, true);
  }

  await I.verifyCommand(`sudo docker exec ${psContainerName} pmm-agent setup --server-username=service_token --server-password=${tokenValue} --server-address=pmm-server:8443 --server-insecure-tls --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`);
  await I.asyncWaitFor(async () => await I.verifyCommand(`docker exec ${psContainerName} pmm-admin list | grep node_exporter | grep -q Running; echo $?`) === '0', 60);
  await I.verifyCommand(`sudo docker exec ${psContainerName} pmm-admin add mysql --username=msandbox --password=msandbox --host=127.0.0.1  --port=3307 --service-name=${newServiceName}`);
  await I.asyncWaitFor(async () => await I.verifyCommand(`docker exec ${psContainerName} pmm-admin list | grep mysqld_exporter | grep -q Running; echo $?`) === '0', 60);

  const nodeName = (await inventoryAPI.getAllNodes()).find((node) => node.node_name !== 'pmm-server').node_name;
  const nodesUrl = I.buildUrlWithParams(nodesOverviewPage.url, {
    from: 'now-1m',
    to: 'now',
    node_name: nodeName,
  });

  await I.amOnPage(nodesUrl);
  await dashboardPage.waitForDashboardOpened();
  await dashboardPage.expandEachDashboardRow();
  await dashboardPage.waitForGraphsToHaveData(19, 300);

  const url = I.buildUrlWithParams(dashboardPage.mysqlInstanceSummaryDashboard.clearUrl, {
    from: 'now-1m',
    to: 'now',
    service_name: newServiceName,
  });

  await I.amOnPage(url);
  await I.wait(5);
  await dashboardPage.waitForGraphsToHaveData(20, 300);
}).retry(1);
