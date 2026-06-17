import pmmTest from '@fixtures/pmmTest';
import dataTest from '@fixtures/dataTest';

pmmTest.describe('PMM Tests to verify clickhouse configuration file', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const dockerContainerName = 'pmm-server-clickhouse-config';
  const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
  const configuration = [
    {
      command: `docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 --publish 83:8080 --publish 446:8443 --name ${dockerContainerName} ${dockerVersion}`,
      configName: 'default-config',
      port: 444,
    },
    {
      command: `docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 --publish 84:8080 --publish 447:8443 --name ${dockerContainerName} ${dockerVersion}`,
      configName: 'docker volume',
      port: 445,
    },
  ];

  dataTest(configuration).pmmTest('PMM-T9999', async (data, { api, cliHelper }) => {
    cliHelper.execSilent(data.command);
    await api.serverApi.waitForReady();

    const configName = cliHelper.execSilent(
      `docker exec ${dockerContainerName} cat /srv/logs/clickhouse-server.log | grep "config"`,
    );

    console.log(configName);
  });
});
