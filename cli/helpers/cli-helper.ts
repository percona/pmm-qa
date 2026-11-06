import { expect, test } from '@playwright/test';
import ExecReturn from '@support/types/exec-return.class';
import shell from 'shelljs';
import { performance } from 'node:perf_hooks';

/**
 * Shell(sh) echo().to() wrapper to use in tests with handy logs creation
 *
 * @param   pathToFile  path to the file including file name
 * @param   content     content {@code string} to insert as file content
 * @param   stepTitle   optional custom test step label
 */
export async function createFile(pathToFile: string, content: string, stepTitle: string | null = null) {
  const stepName = stepTitle || `Create "${pathToFile}" file with content:\n"${content}"`;

  await test.step(stepName, async () => {
    console.log(`echo: "${content}" >> ${pathToFile}`);
    shell.echo(content).to(pathToFile);
  });
}

/**
 * Shell(sh) exec() wrapper to use outside of {@link test}
 * returns handy {@link ExecReturn} object.
 *
 * @param       command   sh command to execute
 * @return      {@link ExecReturnClass} instance
 */
export function execute(command: string): ExecReturn {
  console.log(`exec: "${command}"`);
  const start = performance.now();
  const { stdout, stderr, code } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: false });
  const durationMs = performance.now() - start;
  if (stdout.length > 0) console.log(`Out: "${stdout}"`);
  if (stderr.length > 0) console.log(`Error: "${stderr}"`);
  return new ExecReturn(command, code, stdout, stderr, durationMs);
}

/**
 * Shell(sh) exec() wrapper to return handy {@link ExecReturn} object.
 *
 * @param       command   sh command to execute
 * @return      {@link ExecReturnClass} instance
 */
export async function exec(command: string): Promise<ExecReturn> {
  return test.step(`Run "${command}" command`, async () => {
    return execute(command);
  });
}

/**
 * Silent Shell(sh) exec() wrapper to return handy {@link ExecReturn} object.
 * Provides no logs to skip huge outputs.
 *
 * @param       command   sh command to execute
 * @return      {@link ExecReturnClass} instance
 */
export async function execSilent(command: string): Promise<ExecReturn> {
  const { stdout, stderr, code } = await test.step(`Run "${command}" command`, async () => {
    return shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: false });
  });

  return new ExecReturn(command, code, stdout, stderr);
}

/**
 * Scrape all metrics from exporter found by Service Name
 * **Note** will not work for versions earlier 2.29.0
 * as "port" was not included in pmm-admin output
 *
 * @param   serviceName         name of the service to search for the exporter
 * @param   agentUser           username to authenticate to exporter
 * @param   agentPassword       password for specified username to authenticate to exporter
 * @param   dockerContainer     Optional! docker container name to scrape metrics from
 */
export async function getMetrics(
  serviceName: string,
  agentUser: string,
  agentPassword: string,
  dockerContainer: string | null = null,
): Promise<string> {
  const output = await test.step(
    `Scraping "${serviceName}" metrics${dockerContainer ? `in "${dockerContainer}" container` : ''}`,
    async () => {
      const prefix = dockerContainer ? `docker exec ${dockerContainer} ` : '';
      const adminList = (await execute(`${prefix || 'sudo '}pmm-admin list`).assertSuccess()).getStdOutLines();
      const serviceId: string = adminList.find((item) => item.includes(serviceName))
        ?.trim()
        .split(' ')
        .pop() ?? ''; // Get the last item in the split result

      if (!serviceId) {
        throw new Error(`Failed to find '${serviceName}' service is in pmm-admin list output:\n${adminList}`);
      }

      const listenPort = adminList.filter((item) => item.includes(serviceId))
        .find((item: string) => item.includes('_exporter'))!
        .split(' ').filter((item) => item.trim().length > 0)
        .at(-1) ?? '';

      if (!listenPort) {
        throw new Error(`Failed to find port of '${serviceId}' exporter is in pmm-admin list output:\n${adminList}`);
      }

      return execute(`${prefix}curl -s "http://${agentUser}:${agentPassword}@127.0.0.1:${listenPort}/metrics"`);
    },
  );

  await output.assertSuccess();
  // TODO: parse into map(k => v) or json
  return output.stdout;
}

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

/**
 * Build the change agent commands applying the same flags to a mongodb_exporter and a QAN mongolog agent
 *
 * @param   containerName   docker container running pmm-agent
 * @param   exporterId      mongodb_exporter agent ID
 * @param   mongologId      mongodb_mongolog_agent agent ID
 * @param   flags           flags to change
 */
export function changeMongoMongologAgents(containerName: string, exporterId: string, mongologId: string, flags: string): string[] {
  return [
    inventoryChangeAgent(containerName, ChangeAgentType.MongodbExporter, exporterId, flags),
    inventoryChangeAgent(containerName, ChangeAgentType.QanMongodbMongologAgent, mongologId, flags),
  ];
}

/**
 * Execute command and verify output contains expected content
 * Wrapper around {@link execute} that automatically asserts success and optionally verifies output
 *
 * @param   command         sh command to execute
 * @param   expectedOutput  optional string or array of strings to verify in command output
 * @return  command stdout as string
 */
export async function executeAndVerify(command: string, expectedOutput?: string | string[]): Promise<string> {
  return test.step(`Run "${command}" command and verify output contains "${expectedOutput}"`, async () => {
    const output = await execute(command);
    await output.assertSuccess();
    if (expectedOutput) {
      if (Array.isArray(expectedOutput)) {
        await output.outContainsMany(expectedOutput);
      } else {
        await output.outContains(expectedOutput);
      }
    }
    return output.stdout;
  });
}

export interface ListAgent {
  agent_id: string;
  agent_type: string;
  service_id: string;
  port?: number;
}

/**
 * Assert a command failed and its stdout or stderr contains the expected message
 *
 * @param   output    result of the failed command
 * @param   message   expected error message
 */
export async function expectFailure(output: ExecReturn, message: string) {
  expect(output.code, `"${output.command}" should fail`).not.toEqual(0);
  expect(`${output.stdout}${output.stderr.text}`).toContain(message);
}

/**
 * Quote a value as one shell word, so spaces, $, & or ' in it reach the command unchanged
 *
 * @param   value   value to quote
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Read an agent from the PMM Server inventory API through the pmm-server container
 *
 * @param   agentId         ID of the agent
 * @param   adminPassword   PMM Server admin password
 * @return  the agent's fields, whatever its type
 */
export async function getServerAgent(agentId: string, adminPassword = process.env.ADMIN_PASSWORD || 'admin'): Promise<Record<string, unknown>> {
  const output = await exec(`docker exec pmm-server curl -sSf -u ${shellQuote(`admin:${adminPassword}`)} http://127.0.0.1:8080/v1/inventory/agents/${agentId}`);
  await output.assertSuccess();
  const response = JSON.parse(output.stdout) as Record<string, Record<string, unknown> | undefined>;

  return Object.values(response)[0] ?? {};
}

/**
 * List agents from "pmm-admin list --json" in a client container
 *
 * @param   containerName   docker container running pmm-agent
 */
export async function listAgents(containerName: string): Promise<ListAgent[]> {
  return (JSON.parse((await exec(`docker exec ${containerName} pmm-admin list --json`)).stdout) as { agent: ListAgent[] }).agent;
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
 * Build a command that runs JavaScript with the mongo shell in a container
 *
 * @param   containerName   docker container running mongod
 * @param   mongoUri        connection string
 * @param   js              JavaScript to evaluate; must not contain single quotes
 */
export function mongoEval(containerName: string, mongoUri: string, js: string): string {
  return `docker exec ${containerName} mongo "${mongoUri}" --quiet --eval '${js}'`;
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
  return [
    inventoryChangeAgent(containerName, ChangeAgentType.MongodbExporter, exporterId, flags),
    inventoryChangeAgent(containerName, ChangeAgentType.QanMongodbProfilerAgent, profilerId, flags),
  ];
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
    const serverLines = (await (await exec(`docker exec ${containerName} pmm-admin list`)).assertSuccess()).getStdOutLines();
    const localLines = (await (await exec(`docker exec ${containerName} pmm-admin status`)).assertSuccess()).getStdOutLines();

    for (const agentId of agentIds) {
      expect(serverLines.find((line) => line.includes(agentId)), `PMM Server should report ${agentId} as "${serverStatus}"`).toContain(serverStatus);
      expect(localLines.find((line) => line.includes(agentId)) ?? 'not running', `pmm-agent should report ${agentId} as "${localStatus}"`)
        .toContain(localStatus);
    }
  }).toPass({ intervals: [5_000], timeout });
}

/**
 * Wait until the service's mongodb_exporter reports mongodb_up 1
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceName     name of the MongoDB service
 * @param   agentPassword   password of the exporter's /metrics endpoint
 * @param   timeout         milliseconds to wait
 */
export async function expectMongoUp(containerName: string, serviceName: string, agentPassword: string, timeout = 120_000) {
  await expect(async () => {
    const metrics = await getMetrics(serviceName, 'pmm', agentPassword, containerName);

    expect(metrics).toMatch(/^mongodb_up(\{[^}]*\})? 1$/m);
  }).toPass({ intervals: [5_000], timeout });
}

/**
 * Wait until a mongo shell probe succeeds, reporting mongod's journal while it fails
 *
 * @param   containerName   docker container running mongod
 * @param   probe           command that exits 0 once mongod serves
 * @param   timeout         milliseconds to wait
 */
export async function waitForMongod(containerName: string, probe: string, timeout = 120_000) {
  await expect(async () => {
    const output = await exec(probe);
    const journal = output.code === 0 ? '' : (await exec(`docker exec ${containerName} journalctl -u mongod --no-pager -n 20`)).stdout;

    expect(output.code, `mongod is not serving. mongod journal:\n${journal}`).toEqual(0);
  }).toPass({ intervals: [5_000], timeout });
}

/**
 * Run change agent commands, then assert what PMM Server stored, re-applying the change until it sticks.
 * A status report that pmm-agent sends while an agent restarts can overwrite a change saved at the same moment,
 * so a change that succeeded can be silently reverted (PMM-15835).
 * The assertion must read stored state (the inventory API), not runtime state: each retry restarts the agent.
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
      const output = await exec(command);
      await output.assertSuccess();

      for (const value of expectedOutput) {
        await output.outContains(value);
      }
    }

    await persisted();
  }).toPass({ intervals: [5_000], timeout });
}
