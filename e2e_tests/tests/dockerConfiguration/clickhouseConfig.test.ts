import pmmTest from '@fixtures/pmmTest';
import dataTest from '@fixtures/dataTest';

pmmTest.describe('PMM Tests to verify clickhouse configuration file', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const dockerContainerName = 'pmm-server-clickhouse-config';
  const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
  const configuration = [
    {
      command: `docker run --detach --restart always --network="pmm-qa" -e PMM_CLICKHOUSE_CONFIG=default -e PMM_ENABLE_TELEMETRY=0 --publish 83:8080 --publish 446:8443 --name ${dockerContainerName} ${dockerVersion}`,
      configName: 'default-config',
      port: 446,
    },
    {
      command: `docker run --detach --restart always --network="pmm-qa" -e PMM_CLICKHOUSE_CONFIG=low-memory -e PMM_ENABLE_TELEMETRY=0 --publish 84:8080 --publish 447:8443 --name ${dockerContainerName} ${dockerVersion}`,
      configName: 'docker volume',
      port: 447,
    },
    {
      command: `docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 --publish 83:8080 --publish 448:8443 --name ${dockerContainerName} ${dockerVersion}`,
      configName: 'default-config',
      port: 448,
    },
  ];

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker stop ${dockerContainerName}`);
    cliHelper.execSilent(`docker rm -f ${dockerContainerName}`);
  });

  dataTest(configuration).pmmTest('PMM-T9999 @docker-configuration', async (data, { api, cliHelper }) => {
    const baseUrl = `https://127.0.0.1:${data.port}/`;

    cliHelper.execSilent(data.command);
    await api.serverApi.waitForReady(baseUrl);

    const configName = cliHelper.execSilent(
      `docker exec ${dockerContainerName} cat /srv/logs/clickhouse-server.log | grep "config"`,
    );

    console.log(configName);
  });
});
