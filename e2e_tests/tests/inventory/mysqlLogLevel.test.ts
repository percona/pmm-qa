import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const serviceName = 'mysql_service';
const agentTypes = ['mysqld-exporter', 'qan-mysql-slowlog-agent', 'qan-mysql-perfschema-agent'] as const;
const logLevels = ['warn', 'debug', 'info', 'warn', 'error'] as const;
const fatalLevelError = '--log-level must be one of "debug","info","warn","error" but got "fatal"';
let containerName: string;
let port: number;
let pmmAgentId: string;

pmmTest.beforeEach(async ({ api, cliHelper }) => {
  ({ port } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(ServiceType.mysql, 'ps_'));
  containerName = cliHelper
    .execSilent("docker ps --filter 'name=ps_pmm' --format '{{.Names}}'")
    .assertSuccess()
    .getStdOutLines()[0];

  expect(containerName, 'ps_pmm docker container should exist').toContain('ps_pmm');

  pmmAgentId = cliHelper.getPmmAdminField(
    cliHelper.execSilent(`docker exec ${containerName} pmm-admin status`).assertSuccess().stdout,
    'Agent ID',
  );
});

pmmTest.afterEach(async ({ cliHelper }) => {
  cliHelper.execSilent(`docker exec ${containerName} pmm-admin remove mysql ${serviceName} || true`);
});

pmmTest(
  'PMM-T1307 + PMM-T1306 + PMM-T1305 + PMM-T1304 + PMM-T1290 + PMM-T1281 - Verify pmm-admin inventory add agent sets the requested log level on MySQL agents @not-ui-pipeline @exporters',
  async ({ api, cliHelper, credentials }) => {
    const { password, username } = credentials.perconaServer.ps_84;

    cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin add mysql --port=${port} --agent-password='testing' --password=${password} --username=${username} --query-source=slowlog --service-name=${serviceName}`,
      )
      .assertSuccess();

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mysql,
      serviceName,
    );

    for (const logLevel of logLevels) {
      for (const agentType of agentTypes) {
        const agentId = cliHelper.getPmmAdminField(
          cliHelper
            .execSilent(
              `docker exec ${containerName} pmm-admin inventory add agent ${agentType} --password=${password} ${agentType === 'mysqld-exporter' ? '--push-metrics' : ''} --log-level=${logLevel} ${pmmAgentId} ${service_id} ${username}`,
            )
            .assertSuccess().stdout,
          'Agent ID',
        );

        await expect
          .poll(
            async () =>
              (await api.inventoryApi.getServiceAgents(service_id)).find(
                (agent) => agent.agent_id === agentId,
              ),
            {
              message: `${agentType} added with --log-level=${logLevel}`,
              timeout: Timeouts.THIRTY_SECONDS,
            },
          )
          .toMatchObject({ log_level: `LOG_LEVEL_${logLevel.toUpperCase()}`, status: AgentStatus.running });
        cliHelper
          .execSilent(`docker exec ${containerName} pmm-admin inventory remove agent ${agentId}`)
          .assertSuccess();
      }
    }
  },
);

pmmTest(
  'PMM-T1351 + PMM-T1350 - Verify MySQL exporter cannot be added with --log-level=fatal @not-ui-pipeline @exporters',
  async ({ api, cliHelper, credentials }) => {
    const { password, username } = credentials.perconaServer.ps_84;
    const addMysqlCommand = `docker exec ${containerName} pmm-admin add mysql --port=${port} --agent-password='testing' --password=${password} --username=${username} --query-source=slowlog`;
    const fatalAdd = cliHelper.execSilent(
      `${addMysqlCommand} --log-level=fatal --service-name=${serviceName}`,
    );

    expect(fatalAdd.code).not.toEqual(0);
    expect(fatalAdd.stderr).toContain(fatalLevelError);

    cliHelper.execSilent(`${addMysqlCommand} --service-name=${serviceName}`).assertSuccess();

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mysql,
      serviceName,
    );
    const nodeId = cliHelper.getPmmAdminField(
      cliHelper.execSilent(`docker exec ${containerName} pmm-admin status`).assertSuccess().stdout,
      'Node ID',
    );
    const fatalExporter = cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin inventory add agent mysqld-exporter --log-level=fatal --password=msandbox --push-metrics ${pmmAgentId} ${service_id} msandbox`,
    );

    expect(fatalExporter.code).not.toEqual(0);
    expect(fatalExporter.stderr).toContain(fatalLevelError);

    const socketAndAddress = cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin inventory add service mysql --socket=/tmp/mysql_sandbox3307.sock temp ${nodeId} 127.0.0.1 3307`,
    );

    expect(socketAndAddress.code).not.toEqual(0);
    expect(`${socketAndAddress.stdout}${socketAndAddress.stderr}`).toContain(
      'Socket and address cannot be specified together.',
    );
  },
);
