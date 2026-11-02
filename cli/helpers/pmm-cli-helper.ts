import { expect } from '@playwright/test';
import ExecReturn from '@support/types/exec-return.class';
import { exec, getMetrics } from '@helpers/cli-helper';

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
    const serverLines = (await exec(`docker exec ${containerName} pmm-admin list`)).getStdOutLines();
    const localStatusOutput = await exec(`docker exec ${containerName} pmm-admin status`);
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
      const output = await exec(command);
      await output.assertSuccess();

      for (const value of expectedOutput) {
        await output.outContains(value);
      }
    }

    await persisted();
  }).toPass({ intervals: [5_000], timeout });
}

/**
 * Run JavaScript with the mongo shell once the container's mongod is a writable primary.
 * Connect with directConnection: replica-set discovery from inside the container resolves the primary to loopback,
 * so an election makes mongosh fail with ECONNREFUSED.
 *
 * @param   containerName   docker container running mongod
 * @param   mongoUri        connection string with directConnection=true
 * @param   js              JavaScript to evaluate; must not contain single quotes
 */
export async function runOnPrimary(containerName: string, mongoUri: string, js: string) {
  await expect(async () => {
    const isPrimary = `if (!db.hello().isWritablePrimary) throw new Error("${containerName} is not primary yet");`;
    await (await exec(mongoEval(containerName, mongoUri, `${isPrimary} ${js}`))).assertSuccess();
  }).toPass({ intervals: [5_000], timeout: 120_000 });
}

/**
 * Command-line arguments of the exporter process an agent runs, found by its listen port
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentId         exporter agent ID
 */
export async function getExporterArgs(containerName: string, agentId: string): Promise<string[]> {
  const port = await getAgentPort(containerName, agentId);
  expect(port, `Agent ${agentId} has no listen port yet`).toBeTruthy();
  const output = await exec(`docker exec ${containerName} sh -c 'for p in $(pgrep -f "[e]xporters/"); do tr "\\0" " " < /proc/$p/cmdline | grep -q ":${port} " && tr "\\0" "\\n" < /proc/$p/cmdline; done'`);

  return output.getStdOutLines();
}

/**
 * Scrape an exporter's /metrics from the pmm-server container, the way an external scraper would reach it
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentId         exporter agent ID
 * @param   agentPassword   password of the exporter's /metrics endpoint
 */
export async function scrapeExporterFromPmmServer(containerName: string, agentId: string, agentPassword: string): Promise<ExecReturn> {
  return exec(`docker exec pmm-server curl -sS -m 5 -u pmm:${agentPassword} http://${containerName}:${await getAgentPort(containerName, agentId)}/metrics`);
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
  await (await exec(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName} || true`)).assertSuccess();
  const output = await exec(`docker exec ${containerName} pmm-admin add mongodb ${addFlags} ${serviceName} ${address}`);
  await output.assertSuccess();
  const serviceId = output.stdout.match(/Service ID\s*:\s*(\S+)/)?.[1];
  expect(serviceId, `Service ID not found in: ${output.stdout}`).toBeTruthy();

  const agents = await listAgents(containerName);
  const agentOfType = (type: string) => agents.find((agent) => agent.agent_type === type && agent.service_id === serviceId)?.agent_id ?? '';

  return { exporterId: agentOfType('AGENT_TYPE_MONGODB_EXPORTER'), profilerId: agentOfType('AGENT_TYPE_QAN_MONGODB_PROFILER_AGENT') };
}

/**
 * Run every step even when an earlier one fails, then rethrow the first failure, so one failed cleanup does not skip the rest
 *
 * @param   steps   cleanup steps
 */
export async function runEach(steps: (() => Promise<unknown>)[]) {
  const errors: unknown[] = [];

  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) throw errors[0];
}

/**
 * How many times pmm-agent has reported an agent as running; it grows by one each time pmm-agent (re)starts the agent
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentId         agent ID
 */
export async function countAgentRunningReports(containerName: string, agentId: string): Promise<number> {
  const output = await exec(`docker exec ${containerName} grep -cF 'Sending status: AGENT_STATUS_RUNNING." agentID=${agentId}' /var/log/pmm-agent.log`);

  return Number(output.stdout.trim()) || 0;
}
