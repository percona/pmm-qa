import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const serviceName = 'mysql_service';
const agentTypes = ['mysqld-exporter', 'qan-mysql-slowlog-agent', 'qan-mysql-perfschema-agent'] as const;
const logLevels = ['debug', 'info', 'warn', 'error'] as const;
const fatalLevelError = '--log-level must be one of "debug","info","warn","error" but got "fatal"';
let containerName: string;
let pmmAdmin: string;
let addMysql: string;
let pmmAgentId: string;

pmmTest.beforeEach(async ({ api, cliHelper, credentials }) => {
  const { port } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(ServiceType.mysql, 'ps_');
  const { password, username } = credentials.perconaServer.ps_84;

  containerName = cliHelper
    .execSilent("docker ps --filter 'name=ps_pmm' --format '{{.Names}}'")
    .assertSuccess()
    .getStdOutLines()[0];

  expect(containerName, 'ps_pmm docker container should exist').toContain('ps_pmm');

  pmmAdmin = `docker exec ${containerName} pmm-admin`;
  addMysql = `${pmmAdmin} add mysql --port=${port} --agent-password='testing' --password=${password} --username=${username} --query-source=slowlog`;
  pmmAgentId = cliHelper.getPmmAdminStatusField(containerName, 'Agent ID');
});

pmmTest.afterEach(async ({ cliHelper }) => {
  cliHelper.execSilent(`${pmmAdmin} remove mysql ${serviceName} || true`);
});

pmmTest(
  'PMM-T1307 + PMM-T1306 + PMM-T1305 + PMM-T1304 + PMM-T1290 + PMM-T1281 - Verify pmm-admin inventory add agent sets the requested log level on MySQL agents @not-ui-pipeline @exporters',
  async ({ api, cliHelper, credentials }) => {
    const { password, username } = credentials.perconaServer.ps_84;

    cliHelper.execSilent(`${addMysql} --service-name=${serviceName}`).assertSuccess();

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mysql,
      serviceName,
    );

    for (const logLevel of logLevels) {
      for (const agentType of agentTypes) {
        const agentId = cliHelper.getPmmAdminField(
          cliHelper
            .execSilent(
              `${pmmAdmin} inventory add agent ${agentType} --password=${password} ${agentType === 'mysqld-exporter' ? '--push-metrics' : ''} --log-level=${logLevel} ${pmmAgentId} ${service_id} ${username}`,
            )
            .assertSuccess().stdout,
          'Agent ID',
        );

        await expect
          .poll(
            async () =>
              (await api.inventoryApi.getAgents())[agentType.replaceAll('-', '_')]?.find(
                (agent) => agent.agent_id === agentId,
              ),
            { message: `${agentType} added with --log-level=${logLevel}`, timeout: Timeouts.THIRTY_SECONDS },
          )
          .toMatchObject({ log_level: `LOG_LEVEL_${logLevel.toUpperCase()}`, status: AgentStatus.running });
        cliHelper.execSilent(`${pmmAdmin} inventory remove agent ${agentId}`).assertSuccess();
      }
    }
  },
);

pmmTest(
  'PMM-T1351 + PMM-T1350 - Verify MySQL exporter cannot be added with --log-level=fatal @not-ui-pipeline @exporters',
  async ({ api, cliHelper, credentials }) => {
    const { password, username } = credentials.perconaServer.ps_84;

    cliHelper
      .execSilent(`${addMysql} --log-level=fatal --service-name=${serviceName}`)
      .assertFailure(fatalLevelError);
    cliHelper.execSilent(`${addMysql} --service-name=${serviceName}`).assertSuccess();

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mysql,
      serviceName,
    );
    const nodeId = cliHelper.getPmmAdminStatusField(containerName, 'Node ID');

    cliHelper
      .execSilent(
        `${pmmAdmin} inventory add agent mysqld-exporter --log-level=fatal --password=${password} --push-metrics ${pmmAgentId} ${service_id} ${username}`,
      )
      .assertFailure(fatalLevelError);
    cliHelper
      .execSilent(
        `${pmmAdmin} inventory add service mysql --socket=/tmp/mysql_sandbox3307.sock temp ${nodeId} 127.0.0.1 3307`,
      )
      .assertFailure('Socket and address cannot be specified together.');
  },
);
