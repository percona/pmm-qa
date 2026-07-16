import * as cli from '@helpers/cli-helper';

async function sudoPrefix(): Promise<string> {
  const uid = await cli.exec('id -u');
  return uid.stdout.trim() === '0' ? '' : 'sudo ';
}

async function ensureHostSs(): Promise<void> {
  const check = await cli.exec('command -v ss');
  if (check.code === 0) {
    return;
  }
  await cli.exec('sudo apt-get update -qq && sudo apt-get install -y -qq iproute2');
}

export async function getContainerIp(container: string, network: string): Promise<string> {
  const result = await cli.exec(
    `docker inspect -f '{{(index .NetworkSettings.Networks "${network}").IPAddress}}' ${container}`,
  );
  await result.assertSuccess();
  return result.stdout.trim();
}

export async function getContainerPid(container: string): Promise<number> {
  const result = await cli.exec(`docker inspect -f '{{.State.Pid}}' ${container}`);
  await result.assertSuccess();
  return parseInt(result.stdout.trim(), 10);
}

function parseSourcePort(ssLine: string): number | null {
  const match = ssLine.match(/:(\d+)\s+\S+:8443/);
  return match ? parseInt(match[1], 10) : null;
}

export async function getPmmAgentSourcePort(
  clientContainer: string,
  serverIp: string,
): Promise<number | null> {
  await ensureHostSs();
  const pid = await getContainerPid(clientContainer);
  const sudo = await sudoPrefix();
  const result = await cli.exec(
    `${sudo}nsenter -t ${pid} -n ss -tapn 2>/dev/null | grep 'pmm-agent' | grep '${serverIp}:8443' | grep ESTAB | head -1`,
  );
  if (result.stdout.trim().length === 0) {
    return null;
  }
  return parseSourcePort(result.stdout);
}

export async function applyBilateralDrop(
  clientContainer: string,
  clientIp: string,
  serverIp: string,
  sourcePort: number,
): Promise<void> {
  const pid = await getContainerPid(clientContainer);
  const sudo = await sudoPrefix();
  await cli.exec(
    `${sudo}nsenter -t ${pid} -n iptables -A OUTPUT -p tcp -d ${serverIp} --dport=8443 -s ${clientIp} --sport=${sourcePort} -j DROP`,
  );
  await cli.exec(
    `${sudo}nsenter -t ${pid} -n iptables -A INPUT -p tcp -s ${serverIp} --sport=8443 -d ${clientIp} --dport=${sourcePort} -j DROP`,
  );
}

export async function flushClientNetnsIptables(clientContainer: string): Promise<void> {
  const pid = await getContainerPid(clientContainer);
  const sudo = await sudoPrefix();
  await cli.exec(`${sudo}nsenter -t ${pid} -n iptables -F INPUT 2>/dev/null || true`);
  await cli.exec(`${sudo}nsenter -t ${pid} -n iptables -F OUTPUT 2>/dev/null || true`);
}

export async function pmmAgentListStatus(clientContainer: string): Promise<string> {
  const result = await cli.exec(`docker exec ${clientContainer} timeout 10 pmm-admin list`);
  const match = result.stdout.match(/pmm_agent\s+(\S+)/);
  return match ? match[1] : 'unknown';
}
