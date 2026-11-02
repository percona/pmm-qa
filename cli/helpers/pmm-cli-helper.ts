import { expect } from '@playwright/test';
import ExecReturn from '@support/types/exec-return.class';
import { exec, getMetrics } from '@helpers/cli-helper';
import { getAgentPort } from '@helpers/pmm-admin-helper';

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
