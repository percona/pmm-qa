import {
  APIRequestContext, expect, request, test,
} from '@playwright/test';
import * as cli from '@helpers/cli-helper';

export async function waitForPmmServerToBeReady(containerName: string, timeout = 60) {
  await expect(async () => {
    const logs = await cli.exec(`docker logs ${containerName} 2>&1`);
    await logs.outContains('pmm-managed entered RUNNING state');
  }).toPass({
    // Probe, wait 1s, probe, wait 2s, probe, wait 2s, probe, wait 2s, probe, ....
    intervals: [5_000, 5_000, 5_000],
    timeout: timeout * 1000,
  });
}

/**
 * Fluent wait wrapper for the PMM Server to be ready using API: /v1/readyz
 *
 * @param   address   PMM Server IP Address or Hostname
 * @param   httpPort  HTTP Port to access PMM Server
 * @param   timeout   number of seconds to wait
 */
export async function waitForApiReady(address: string, httpPort = 80, timeout = 100) {
  const baseURL = `http://${address}:${httpPort}`;
  const path = '/v1/readyz';
  const httpClient: Promise<APIRequestContext> = request.newContext({ baseURL, ignoreHTTPSErrors: true });
  await test.step(`Waiting for ${baseURL}:${httpPort}${path} to return 200(${timeout} sec)`, async () => {
    await expect(async () => {
      console.log(`GET: ${baseURL}${path}`);
      const response = await (await httpClient).get(path);
      console.log(`Status: ${response.status()} ${response.statusText()}`);
      await expect(response, `${baseURL}:${httpPort}${path} should return 200`).toBeOK();
    }).toPass({
      intervals: [2_000, 2_000, 2_000],
      timeout: timeout * 1000,
    });
  });
}
