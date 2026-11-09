import { expect, test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import { clientCredentialsFlags } from '@helpers/constants';

/**
 * Agent subcommands of "pmm-admin inventory change agent"
 */
export enum ChangeAgentType {
  NodeExporter = 'node-exporter',
  MysqldExporter = 'mysqld-exporter',
  MongodbExporter = 'mongodb-exporter',
  PostgresExporter = 'postgres-exporter',
  ProxysqlExporter = 'proxysql-exporter',
  ExternalExporter = 'external-exporter',
  RdsExporter = 'rds-exporter',
  AzureDatabaseExporter = 'azure-database-exporter',
  ValkeyExporter = 'valkey-exporter',
  NomadAgent = 'nomad-agent',
  QanMysqlPerfschemaAgent = 'qan-mysql-perfschema-agent',
  QanMysqlSlowlogAgent = 'qan-mysql-slowlog-agent',
  QanMongodbProfilerAgent = 'qan-mongodb-profiler-agent',
  QanMongodbMongologAgent = 'qan-mongodb-mongolog-agent',
  QanPostgresqlPgstatementsAgent = 'qan-postgresql-pgstatements-agent',
  QanPostgresqlPgstatmonitorAgent = 'qan-postgresql-pgstatmonitor-agent',
  RtaMongodbAgent = 'rta-mongodb-agent',
}

export const removePGService = async (containerName: string, serviceName: string) => {
  await test.step(`remove postgresql "${serviceName}" service`, async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove postgresql ${serviceName}`);
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });
};

export const removeMySQLService = async (containerName: string, serviceName: string) => {
  await test.step(`remove mysql "${serviceName}" service`, async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove mysql ${serviceName}`);
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });
};

export const removeMongoService = async (containerName: string, serviceName: string) => {
  await test.step(`remove mongodb "${serviceName}" service`, async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName}`);
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });
};

export const getPmmAdminVersion = async (containerName: string): Promise<string> => {
  return test.step('get pmm admin full version', async () => {
    const prefix = containerName ? `docker exec ${containerName} ` : '';
    const output: { Version: string } = JSON.parse((await cli.exec(`${prefix}pmm-admin --version --json`)).stdout);

    return output.Version.split('-')[0];
  });
};

export const getPmmAdminMinorVersion = async (containerName: string) => {
  return test.step('get pmm admin version', async () => {
    const output = JSON.parse((await cli.exec(`docker exec ${containerName} pmm-admin --version --json`)).stdout);

    return Number(output.Version.split('-')[0].split('.')[1]);
  });
};

export const addMongoServiceAndGetExporterId = async (containerName: string, serviceName: string, address: string, onCreated: () => void) => {
  return test.step(`add mongodb "${serviceName}" service and get its mongodb_exporter id`, async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} ${serviceName} ${address}`);
    await output.assertSuccess();
    onCreated();
    const serviceId = output.stdout.match(/Service ID\s*:\s*(\S+)/)?.[1];
    expect(serviceId, `Service ID not found in: ${output.stdout}`).toBeTruthy();

    const list = JSON.parse((await cli.exec(`docker exec ${containerName} pmm-admin list --json`)).stdout);
    const exporter = list.agent.find((a: { agent_type: string, service_id: string }) => a.agent_type === 'AGENT_TYPE_MONGODB_EXPORTER' && a.service_id === serviceId);
    expect(exporter, `mongodb_exporter for service ${serviceId} not found`).toBeTruthy();

    return exporter.agent_id as string;
  });
};

export interface ListAgent {
  agent_id: string;
  agent_type: string;
  service_id: string;
  port?: number;
}

/**
 * List agents from "pmm-admin list --json" in a client container
 *
 * @param   containerName   docker container running pmm-agent
 */
export async function listAgents(containerName: string): Promise<ListAgent[]> {
  return (JSON.parse((await cli.exec(`docker exec ${containerName} pmm-admin list --json`)).stdout) as { agent: ListAgent[] }).agent;
}

/**
 * Listen port of an agent from "pmm-admin list --json" in a client container
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentId         ID of the agent
 */
export async function getAgentPort(containerName: string, agentId: string): Promise<number | undefined> {
  return (await listAgents(containerName)).find((agent) => agent.agent_id === agentId)?.port;
}

/**
 * Add a MongoDB service, replacing one of the same name, and find its mongodb_exporter and QAN profiler agents
 *
 * @param   containerName   docker container running pmm-agent
 * @param   addFlags        flags for pmm-admin add mongodb
 * @param   serviceName     service name
 * @param   address         MongoDB host:port
 * @return  agent IDs; empty when an agent is not found
 */
export async function addMongoServiceAgents(containerName: string, addFlags: string, serviceName: string, address: string) {
  await (await cli.exec(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName} || true`)).assertSuccess();
  const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${addFlags} ${serviceName} ${address}`);
  await output.assertSuccess();
  const serviceId = output.stdout.match(/Service ID\s*:\s*(\S+)/)?.[1];
  expect(serviceId, `Service ID not found in: ${output.stdout}`).toBeTruthy();

  const agents = await listAgents(containerName);
  const agentOfType = (type: string) => agents.find((agent) => agent.agent_type === type && agent.service_id === serviceId)?.agent_id ?? '';

  return { exporterId: agentOfType('AGENT_TYPE_MONGODB_EXPORTER'), profilerId: agentOfType('AGENT_TYPE_QAN_MONGODB_PROFILER_AGENT') };
}

/**
 * Build a "pmm-admin inventory change agent mongodb-exporter" command
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentId         mongodb_exporter agent ID
 * @param   flags           flags to change
 */
export function changeMongoExporter(containerName: string, agentId: string, flags: string): string {
  return `docker exec ${containerName} pmm-admin inventory change agent mongodb-exporter ${agentId} ${flags}`;
}

/**
 * Build a "pmm-admin inventory change agent qan-mongodb-profiler-agent" command
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentId         mongodb_profiler_agent agent ID
 * @param   flags           flags to change
 */
export function changeMongoProfiler(containerName: string, agentId: string, flags: string): string {
  return `docker exec ${containerName} pmm-admin inventory change agent qan-mongodb-profiler-agent ${agentId} ${flags}`;
}

/**
 * Build the change agent commands applying the same flags to a mongodb_exporter and a QAN profiler agent
 *
 * @param   containerName   docker container running pmm-agent
 * @param   exporterId      mongodb_exporter agent ID
 * @param   profilerId      mongodb_profiler_agent agent ID
 * @param   flags           flags to change
 */
export function changeMongoAgents(containerName: string, exporterId: string, profilerId: string, flags: string): string[] {
  return [changeMongoExporter(containerName, exporterId, flags), changeMongoProfiler(containerName, profilerId, flags)];
}

/**
 * Run change agent commands, then assert what PMM Server stored, re-applying the change until it sticks.
 * A status report that pmm-agent sends while an agent restarts can overwrite a change saved at the same moment,
 * so a change that succeeded can be silently reverted (PMM-15835).
 * Each retry restarts the agent, so an assertion on runtime state must wait for the restart within itself.
 *
 * @param   commands          change agent commands to run
 * @param   expectedOutput    strings every command's output must contain
 * @param   persisted         assertion on the stored state; throws while the change is missing
 * @param   timeout           milliseconds to keep re-applying
 */
export async function changeAgentsUntilPersisted(
  commands: string[],
  expectedOutput: string[],
  persisted: () => Promise<void>,
  timeout = 60_000,
) {
  await expect(async () => {
    for (const command of commands) {
      const output = await cli.exec(command);
      await output.assertSuccess();

      for (const value of expectedOutput) {
        await output.outContains(value);
      }
    }

    await persisted();
  }).toPass({ intervals: [5_000], timeout });
}

/**
 * Wait until agents are running, or disabled, as seen by both PMM Server and pmm-agent.
 * PMM Server marks a disabled agent "Done" as soon as it is changed, before pmm-agent gets the new state,
 * so also wait for pmm-agent's own view: a disable and enable that reach it together never stop the process.
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentIds        IDs of the agents to check
 * @param   running         true to wait for Running, false for disabled
 * @param   timeout         milliseconds to wait
 */
export async function expectAgentsRunning(containerName: string, agentIds: string[], running: boolean, timeout = 60_000) {
  const serverStatus = running ? 'Running' : 'Done (disabled)';
  const localStatus = running ? 'Running' : 'not running';

  await expect(async () => {
    const serverLines = (await cli.exec(`docker exec ${containerName} pmm-admin list`)).getStdOutLines();
    const localStatusOutput = await cli.exec(`docker exec ${containerName} pmm-admin status`);
    await localStatusOutput.assertSuccess();
    const localLines = localStatusOutput.getStdOutLines();

    for (const agentId of agentIds) {
      expect(serverLines.find((line) => line.includes(agentId)), `PMM Server should report ${agentId} as "${serverStatus}"`).toContain(serverStatus);
      expect(localLines.find((line) => line.includes(agentId)) ?? 'not running', `pmm-agent should report ${agentId} as "${localStatus}"`)
        .toContain(localStatus);
    }
  }).toPass({ intervals: [5_000], timeout });
}

/**
 * Build a "pmm-admin inventory change agent" command
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentType       agent or exporter to change
 * @param   agentId         ID of the agent
 * @param   flags           flags to change
 */
export function inventoryChangeAgent(containerName: string, agentType: ChangeAgentType, agentId: string, flags: string): string {
  return `docker exec ${containerName} pmm-admin inventory change agent ${agentType} ${agentId} ${flags}`;
}
