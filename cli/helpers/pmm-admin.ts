import { expect, test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import { clientCredentialsFlags, psConnection } from '@helpers/constants';
import ExecReturn from '@support/types/exec-return.class';

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
 * Remove a service with "pmm-admin remove"
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceType     pmm-admin service type, e.g. mongodb, mysql, postgresql, proxysql, valkey, haproxy, external
 * @param   serviceName     service name
 */
export const removeService = async (containerName: string, serviceType: string, serviceName: string) => {
  await test.step(`remove ${serviceType} "${serviceName}" service`, async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove ${serviceType} ${serviceName}`);
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });
};

export const removePGService = (containerName: string, serviceName: string) => removeService(containerName, 'postgresql', serviceName);

export const removeMySQLService = (containerName: string, serviceName: string) => removeService(containerName, 'mysql', serviceName);

export const removeMongoService = (containerName: string, serviceName: string) => removeService(containerName, 'mongodb', serviceName);

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
 * IDs of a MySQL service's mysqld_exporter and QAN slowlog agent from "pmm-admin list --json", empty when absent
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceId       ID of the MySQL service
 */
export async function mysqlAgentIds(containerName: string, serviceId: string) {
  const agents = (await listAgents(containerName)).filter((agent) => agent.service_id === serviceId);
  const agentOfType = (type: string) => agents.find((agent) => agent.agent_type === type)?.agent_id ?? '';

  return { exporterId: agentOfType('AGENT_TYPE_MYSQLD_EXPORTER'), slowlogId: agentOfType('AGENT_TYPE_QAN_MYSQL_SLOWLOG_AGENT') };
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
 * Add the MySQL service of the Percona Server setup, replacing one of the same name
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceName     service name
 * @param   querySource     value of --query-source
 * @param   onAdded         called once the service exists, so the caller can remember to remove it
 * @param   flags           more flags of pmm-admin add mysql
 * @return  ID of the service
 */
export async function addMySQLService(containerName: string, serviceName: string, querySource: string, onAdded: () => void, flags = ''): Promise<string> {
  await (await cli.exec(`docker exec ${containerName} pmm-admin remove mysql ${serviceName} || true`)).assertSuccess();
  const output = await cli.exec(
    `docker exec ${containerName} pmm-admin add mysql --query-source=${querySource} ${flags} --username=${psConnection.username} --password=${psConnection.password} ${serviceName} ${psConnection.address}`,
  );
  await output.assertSuccess();
  onAdded();

  return getServiceId(containerName, serviceName);
}

/**
 * Run the mysql client as the root user of the Percona Server setup
 *
 * @param   containerName   docker container running mysqld
 * @param   args            arguments of the mysql client
 */
export async function runMySQL(containerName: string, args: string): Promise<ExecReturn> {
  return cli.exec(`docker exec ${containerName} mysql -u${psConnection.username} -p${psConnection.password} ${args}`);
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

export type UpdateServiceType = 'mongodb' | 'mysql' | 'postgresql' | 'proxysql' | 'valkey' | 'haproxy' | 'external' | 'external-serverless';

export interface UpdateResult {
  service_id: string;
  service_name: string;
  dry_run: boolean;
  changed: boolean;
  changes: { flag: string, before: string, after: string }[];
  settings: { flag: string, value: string }[];
  warning?: string;
}

export interface ListService {
  service_id: string;
  service_name: string;
  service_type: string;
  address_port: string;
  external_group: string;
}

/**
 * Build a "pmm-admin update" command
 *
 * @param   containerName   docker container running pmm-agent; empty for the pmm-admin of the host
 * @param   serviceType     type of the Service to update
 * @param   args            Service name and flags
 * @param   json            true for the JSON output
 */
export function updateServiceCommand(containerName: string, serviceType: UpdateServiceType, args: string, json = false): string {
  const pmmAdmin = containerName ? `docker exec ${containerName} pmm-admin` : 'sudo pmm-admin';

  return `${pmmAdmin} ${json ? '--json ' : ''}update ${serviceType} ${args}`;
}

/**
 * Run "pmm-admin update" and return its result, which may be a failure
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceType     type of the Service to update
 * @param   args            Service name and flags
 */
export async function updateService(containerName: string, serviceType: UpdateServiceType, args: string): Promise<ExecReturn> {
  return cli.exec(updateServiceCommand(containerName, serviceType, args));
}

/**
 * Run "pmm-admin update" that has to succeed, and return its text output
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceType     type of the Service to update
 * @param   args            Service name and flags
 */
export async function updateServiceOk(containerName: string, serviceType: UpdateServiceType, args: string): Promise<ExecReturn> {
  const output = await updateService(containerName, serviceType, args);
  await output.assertSuccess();

  return output;
}

/**
 * Run "pmm-admin --json update" that has to succeed, and parse its result
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceType     type of the Service to update
 * @param   args            Service name and flags
 */
export async function updateServiceJson(containerName: string, serviceType: UpdateServiceType, args: string): Promise<UpdateResult> {
  const output = await cli.exec(updateServiceCommand(containerName, serviceType, args, true));
  await output.assertSuccess();

  return JSON.parse(output.stdout) as UpdateResult;
}

const settingsAfter = (stdout: string, header: string): string[] => {
  const lines = stdout.split('\n');
  const start = lines.findIndex((line) => line.trim() === header);
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && line.trim() === '');

  return lines.slice(start + 1, end < 0 ? undefined : end).map((line) => line.trim());
};

/**
 * Settings listed under "Changed settings:", or "Settings the update would change:" for a dry run
 *
 * @param   output   result of pmm-admin update
 */
export function getChangedSettings(output: ExecReturn): string[] {
  return [
    ...settingsAfter(output.stdout, 'Changed settings:'),
    ...settingsAfter(output.stdout, 'Settings the update would change:'),
  ];
}

/**
 * Value of a setting in the JSON result of pmm-admin update
 *
 * @param   result   result of pmm-admin --json update
 * @param   flag     flag of the setting, e.g. --environment
 */
export function getSettingValue(result: UpdateResult, flag: string): string | undefined {
  return result.settings.find((setting) => setting.flag === flag)?.value;
}

/**
 * Settings listed under "Current settings:"
 *
 * @param   output   result of pmm-admin update
 */
export function getCurrentSettings(output: ExecReturn): string[] {
  return settingsAfter(output.stdout, 'Current settings:');
}

/**
 * List Services from "pmm-admin list --json" in a client container
 *
 * @param   containerName   docker container running pmm-agent
 */
export async function listServices(containerName: string): Promise<ListService[]> {
  return (JSON.parse((await cli.exec(`docker exec ${containerName} pmm-admin list --json`)).stdout) as { service: ListService[] }).service;
}

/**
 * ID of a Service found by name in "pmm-admin list"
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceName     service name
 */
export async function getServiceId(containerName: string, serviceName: string): Promise<string> {
  const service = (await listServices(containerName)).find((item) => item.service_name === serviceName);
  expect(service, `Service ${serviceName} not found in pmm-admin list`).toBeTruthy();

  return service!.service_id;
}

/**
 * Sorted IDs of the Agents that monitor a Service, as the Service's identity across an update
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceId       ID of the Service
 */
export async function getServiceAgentIds(containerName: string, serviceId: string): Promise<string[]> {
  return (await listAgents(containerName)).filter((agent) => agent.service_id === serviceId).map((agent) => agent.agent_id).sort();
}

/**
 * Agent of a type that monitors a Service
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceId       ID of the Service
 * @param   agentType       agent type as "pmm-admin list --json" shows it, e.g. AGENT_TYPE_MONGODB_EXPORTER
 * @return  the agent, or undefined when the Service has none
 */
export async function findServiceAgent(containerName: string, serviceId: string, agentType: string): Promise<ListAgent | undefined> {
  return (await listAgents(containerName)).find((agent) => agent.service_id === serviceId && agent.agent_type === agentType);
}

/**
 * ID of the agent of a type that monitors a Service
 *
 * @param   containerName   docker container running pmm-agent
 * @param   serviceId       ID of the Service
 * @param   agentType       agent type as "pmm-admin list --json" shows it, e.g. AGENT_TYPE_MONGODB_EXPORTER
 * @return  the agent ID, or undefined when the Service has none
 */
export async function findServiceAgentId(containerName: string, serviceId: string, agentType: string): Promise<string | undefined> {
  return (await findServiceAgent(containerName, serviceId, agentType))?.agent_id;
}
