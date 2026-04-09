import { test, expect } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import { waitForApiReady } from '@helpers/custom-assertions';

const DOCKER_IMAGE = process.env.DOCKER_VERSION && process.env.DOCKER_VERSION.length > 0
  ? process.env.DOCKER_VERSION
  : 'perconalab/pmm-server:3-dev-latest';
const CLIENT_IMAGE = process.env.CLIENT_IMAGE && process.env.CLIENT_IMAGE.length > 0
  ? process.env.CLIENT_IMAGE
  : 'perconalab/pmm-client:3-dev-latest';
const stopList: string[] = [];
const removeList: string[] = [];

/**
 * TODO: investigate computability mode(the latest server with old client) and exclude tests if they do not work.
 */
test.describe('PMM Server Configuration impacts on client tests', { tag: '@server-docker-generic' }, async () => {
  test.afterEach(async () => {
    while (stopList.length > 0) {
      await (await cli.exec(`docker stop ${stopList.shift()}`)).assertSuccess();
    }
    while (removeList.length > 0) {
      await (await cli.exec(`docker rm ${removeList.shift()}`)).assertSuccess();
    }
  });

  test('@PMM-T1665 Verify custom value for vm_agents -promscrape.maxScapeSize parameter for client container', async () => {
    test.skip(true, 'Skipping this test, bug https://perconadev.atlassian.net/browse/PMM-13089');
    const customScrapeSize = '128';
    const serverContainer = 'PMM-T1665';
    const clientContainer = 'PMM-T1665-client';
    await cli.exec('docker network create -d bridge scrape-interval');

    await (await cli.exec(`docker run -d --restart always -p 279:8080 -p 2444:8443 --name ${serverContainer}
      -e PMM_DEBUG=1 -e PMM_PROMSCRAPE_MAX_SCRAPE_SIZE=${customScrapeSize}MiB
      --network scrape-interval ${DOCKER_IMAGE}`)).assertSuccess();
    stopList.push(serverContainer);
    removeList.push(serverContainer);
    await waitForApiReady('127.0.0.1', 279);
    await (await cli.exec(`docker run -d --restart always --name ${clientContainer}
      -e PMM_AGENT_SETUP=1
      -e PMM_AGENT_SERVER_ADDRESS=${serverContainer}:8443
      -e PMM_AGENT_SERVER_USERNAME=admin
      -e PMM_AGENT_SERVER_PASSWORD=admin
      -e PMM_AGENT_PORTS_MIN=41000
      -e PMM_AGENT_PORTS_MAX=41500
      -e PMM_AGENT_SERVER_INSECURE_TLS=1
      -e PMM_AGENT_CONFIG_FILE=config/pmm-agent.yaml
      -e PMM_AGENT_SETUP_NODE_NAME=${clientContainer}
      -e PMM_AGENT_SETUP_FORCE=1
      -e PMM_AGENT_SETUP_NODE_TYPE=container
     --network scrape-interval ${CLIENT_IMAGE}`)).assertSuccess();
    stopList.push(clientContainer);
    removeList.push(clientContainer);

    await expect(async () => {
      const scrapeSizeLog = await cli.exec(`docker logs ${clientContainer} 2>&1 | grep 'promscrape.maxScrapeSize.*vm_agent' | tail -1`);
      await scrapeSizeLog.outContains(`promscrape.maxScrapeSize=\\"${customScrapeSize}MiB\\"`);
    }).toPass({ intervals: [2_000], timeout: 60_000 });
  });

  test('@PMM-T1861 PMM does not honor the environment variables for VictoriaMetrics', async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const search_maxQueryLen = '1';
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const search_maxQueryDuration = '100';
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const search_latencyOffset = '6';
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const search_maxQueueDuration = '40';
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const search_logSlowQueryDuration = '40';
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const search_maxSamplesPerQuery = '1500000000';
    const serverContainer = 'PMM-T1861';
    await (await cli.exec(`docker run -d --restart always -p 290:8080 -p 2443:8443 --name ${serverContainer} 
    -e VM_search_maxQueryLen=${search_maxQueryLen}MB 
    -e VM_search_maxQueryDuration=${search_maxQueryDuration}s 
    -e VM_search_latencyOffset=${search_latencyOffset}s 
    -e VM_search_maxQueueDuration=${search_maxQueueDuration}s 
    -e VM_search_logSlowQueryDuration=${search_logSlowQueryDuration}s 
    -e VM_search_maxSamplesPerQuery=${search_maxSamplesPerQuery} 
    ${DOCKER_IMAGE}`)).assertSuccess();
    stopList.push(serverContainer);
    removeList.push(serverContainer);
    await waitForApiReady('127.0.0.1', 290);

    await expect(async () => {
      const scrapeSizeLog = await cli.exec(`docker exec ${serverContainer} cat /etc/supervisord.d/victoriametrics.ini`);
      await scrapeSizeLog.outContainsMany([`--search.maxQueryLen=${search_maxQueryLen}MB`,
        `--search.maxQueryDuration=${search_maxQueryDuration}s`,
        `--search.latencyOffset=${search_latencyOffset}s`,
        `--search.maxQueueDuration=${search_maxQueueDuration}s`,
        `--search.logSlowQueryDuration=${search_logSlowQueryDuration}s`,
        `--search.maxSamplesPerQuery=${search_maxSamplesPerQuery}`]);
    }).toPass({
      // Probe, wait 1s, probe, wait 2s, probe, wait 2s, probe, wait 2s, probe, ....
      intervals: [1_000, 2_000, 2_000],
      timeout: 10_000,
    });
  });
});
