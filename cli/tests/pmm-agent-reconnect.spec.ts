import { expect, test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import { waitForApiReady } from '@helpers/custom-assertions';
import {
  applyBilateralDrop,
  flushClientNetnsIptables,
  getContainerIp,
  getPmmAgentSourcePort,
  pmmAgentListStatus,
} from '@helpers/network-drop-helper';
import { clientDockerImage, dockerImage } from '@root/helpers/constants';

const NETWORK = 'pmm-agent-reconnect-net';
const SERVER = 'pmm-agent-reconnect-server';
const CLIENT = 'pmm-agent-reconnect-client';
const SERVER_HTTP_PORT = 4553;
const RECONNECT_TIMEOUT_MS = 90_000;

test.describe('PMM-15200 pmm-agent reconnect after silent connection drop', { tag: '@pmm-agent-reconnect' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(360_000);

  test.beforeAll(async () => {
    await cli.exec(`docker network create ${NETWORK} 2>/dev/null || true`);
    await cli.exec(`docker rm -f ${SERVER} ${CLIENT} 2>/dev/null || true`);
    await cli.exec(`docker pull ${dockerImage}`);
    await cli.exec(`docker pull ${clientDockerImage}`);

    await (await cli.exec(
      `docker run -d --restart always --name ${SERVER} --network ${NETWORK} -p ${SERVER_HTTP_PORT}:8080 -e PMM_DEBUG=1 ${dockerImage}`,
    )).assertSuccess();
    await waitForApiReady('127.0.0.1', SERVER_HTTP_PORT, 180);

    await (await cli.exec(
      `docker run -d --restart always --name ${CLIENT} --network ${NETWORK} -e PMM_AGENT_SETUP=1 -e PMM_AGENT_SERVER_ADDRESS=${SERVER}:8443 -e PMM_AGENT_SERVER_USERNAME=admin -e PMM_AGENT_SERVER_PASSWORD=admin -e PMM_AGENT_SERVER_INSECURE_TLS=1 -e PMM_AGENT_SETUP_FORCE=1 -e PMM_AGENT_SETUP_NODE_TYPE=container -e PMM_AGENT_CONFIG_FILE=/usr/local/percona/pmm/config/pmm-agent.yaml ${clientDockerImage}`,
    )).assertSuccess();

    await expect(async () => {
      const list = await cli.exec(`docker exec ${CLIENT} pmm-admin list`);
      await list.assertSuccess();
      await list.outContains('pmm_agent');
      await list.outContains('Connected');
    }).toPass({ timeout: 180_000, intervals: [5_000] });
  });

  test.afterAll(async () => {
    await flushClientNetnsIptables(CLIENT).catch(() => undefined);
    await cli.exec(`docker rm -f ${CLIENT} ${SERVER} 2>/dev/null || true`);
    await cli.exec(`docker network rm ${NETWORK} 2>/dev/null || true`);
  });

  test('@PMM-15200 pmm-agent reconnects after bilateral iptables DROP', async () => {
    const serverIp = await getContainerIp(SERVER, NETWORK);
    const clientIp = await getContainerIp(CLIENT, NETWORK);
    const sourcePort = await getPmmAgentSourcePort(CLIENT, serverIp);
    expect(sourcePort, 'pmm-agent should have an established connection to the server').not.toBeNull();

    await applyBilateralDrop(CLIENT, clientIp, serverIp, sourcePort as number);

    try {
      let reconnectedOnNewPort = false;
      await expect(async () => {
        const status = await pmmAgentListStatus(CLIENT);
        const currentPort = await getPmmAgentSourcePort(CLIENT, serverIp);
        if (status === 'Connected' && currentPort !== null && currentPort !== sourcePort) {
          reconnectedOnNewPort = true;
        }
        expect(reconnectedOnNewPort, 'pmm-agent should reconnect on a new TCP source port').toBeTruthy();
      }).toPass({ timeout: RECONNECT_TIMEOUT_MS, intervals: [5_000] });
    } finally {
      await flushClientNetnsIptables(CLIENT);
    }
  });
});
