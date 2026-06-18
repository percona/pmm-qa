import { APIRequestContext } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { pmmUrl } from '../playwright.config';
import CliHelper from '@helpers/cli.helper';

export default class ServerApi {
  constructor(private request: APIRequestContext) {}

  waitForReady = async (
    serverUrl = `${pmmUrl}/v1/server/readyz`,
    overallTimeoutMs: Timeouts = Timeouts.ONE_MINUTE,
  ): Promise<void> => {
    const pollIntervalMs = Timeouts.FIVE_SECONDS;
    const deadline = Date.now() + overallTimeoutMs;
    let lastError: unknown;
    let lastStatus: number | undefined;

    while (Date.now() < deadline) {
      try {
        const res = await this.request.get(serverUrl, { ignoreHTTPSErrors: true });

        if (res.status() === 200) {
          // ready — resolve normally
          return;
        }
      } catch (err) {
        lastError = err;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    const reason = lastError
      ? `last error: ${(lastError as Error).message}`
      : `last status: ${lastStatus ?? 'no response'}`;

    console.log(new CliHelper().execSilent('docker ps'));
    console.log(new CliHelper().execSilent('docker logs pmm-server-external-clickhouse'));

    throw new Error(`PMM Server was not ready in expected timeout: ${overallTimeoutMs}ms (${reason})`);
  };
}
