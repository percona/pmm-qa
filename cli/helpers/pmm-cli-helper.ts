import { expect } from '@playwright/test';
import ExecReturn from '@support/types/exec-return.class';
import { exec } from '@helpers/cli-helper';
import { getAgentPort } from '@helpers/pmm-admin';

/**
 * Command-line arguments of the exporter process an agent runs, found by its listen port
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentId         exporter agent ID
 */
export async function getExporterArgs(containerName: string, agentId: string): Promise<string[]> {
  let port: number | undefined;
  await expect(async () => {
    port = await getAgentPort(containerName, agentId);
    expect(port, `Agent ${agentId} has no listen port yet`).toBeTruthy();
  }).toPass({ intervals: [2_000], timeout: 30_000 });
  const output = await exec(`docker exec ${containerName} sh -c 'for p in $(pgrep -f "[e]xporters/"); do tr "\\0" " " < /proc/$p/cmdline | grep -q ":${port} " && tr "\\0" "\\n" < /proc/$p/cmdline; done'`);

  return output.getStdOutLines();
}

/**
 * Create a self-signed certificate and its key in a container, to give the TLS flags files to read
 *
 * @param   containerName   docker container with the openssl command
 * @param   name            name of the directory under /tmp that holds the files
 * @return  the directory and the paths of the certificate and the key
 */
export async function createSelfSignedCertificate(containerName: string, name: string) {
  const dir = `/tmp/${name}`;
  await (await exec(`docker exec ${containerName} sh -c 'mkdir -p ${dir} && openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=pmm-update -keyout ${dir}/key.pem -out ${dir}/cert.pem'`)).assertSuccess();

  return {
    dir, cert: `${dir}/cert.pem`, key: `${dir}/key.pem`,
  };
}

/**
 * Scrape an exporter's /metrics from the pmm-server container, the way an external scraper would reach it
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentId         exporter agent ID
 * @param   agentPassword   password of the exporter's /metrics endpoint
 */
export async function scrapeExporterFromPmmServer(containerName: string, agentId: string, agentPassword: string): Promise<ExecReturn> {
  return exec(`docker exec pmm-server curl -sSf -m 5 -u pmm:${agentPassword} http://${containerName}:${await getAgentPort(containerName, agentId)}/metrics`);
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
 * How many times pmm-agent has reported an agent as running, with or without its listen port; it grows by one each time pmm-agent (re)starts the agent. Needs pmm-agent in debug mode.
 *
 * @param   containerName   docker container running pmm-agent
 * @param   agentId         agent ID
 * @param   logFile         pmm-agent's log file in the container
 */
export async function countAgentRunningReports(containerName: string, agentId: string, logFile = '/var/log/pmm-agent.log'): Promise<number> {
  const output = await exec(`docker exec ${containerName} grep -cE 'Sending status: AGENT_STATUS_RUNNING( \\(port [0-9]+\\))?\\." agentID=${agentId}' ${logFile}`);

  return Number(output.stdout.trim()) || 0;
}

/**
 * Restart a container and bring its pmm-agent back. Where pmm-framework installed a pmm-agent systemd unit, a second
 * hand-started pmm-agent can leave its config empty, so pmm-agent is started here only in a container without the unit.
 *
 * @param   containerName   docker container running pmm-agent
 * @param   configFile      pmm-agent's config file in the container
 * @param   logFile         pmm-agent's log file in the container
 */
export async function restartContainerWithPmmAgent(containerName: string, configFile: string, logFile: string) {
  await (await exec(`docker restart ${containerName}`)).assertSuccess();
  await (await exec(
    `docker exec -d ${containerName} sh -c "test -f /etc/systemd/system/pmm-agent.service || exec pmm-agent --config-file=${configFile} >>${logFile} 2>&1"`,
  )).assertSuccess();
}

/**
 * Log lines matching a pattern that are timed at or after a point in time, read across the rotated files of the logs
 *
 * @param   containerName   docker container writing the logs
 * @param   files           log files, as a shell glob
 * @param   pattern         extended regular expression; must not contain quotes
 * @param   since           keep the lines timed at or after this
 */
export async function logLinesSince(containerName: string, files: string, pattern: string, since: Date): Promise<string[]> {
  const output = await exec(`docker exec ${containerName} sh -c "{ grep -hE '${pattern}' ${files}; echo grep_rc=\\$?; } | cut -c1-1000"`);
  const grepRc = output.stdout.match(/grep_rc=(\d+)/)?.[1];

  expect(output.code === 0 && (grepRc === '0' || grepRc === '1'), `Could not read ${files} in ${containerName}: ${output.stderr.text}`).toBeTruthy();

  return output.getStdOutLines().filter((line) => {
    const time = line.match(/time="([^"]+)"/)?.[1];

    return time !== undefined && Date.parse(time) >= since.getTime();
  });
}
