import { APIRequestContext } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { pmmUrl } from '../playwright.config';

export default class ServerApi {
  constructor(private request: APIRequestContext) {}

  waitForReady = async (overallTimeoutMs: Timeouts = Timeouts.ONE_MINUTE): Promise<void> => {
    const url = `${pmmUrl}/v1/server/readyz`;
    const pollIntervalMs = Timeouts.FIVE_SECONDS;
    const deadline = Date.now() + overallTimeoutMs;
    let lastError: unknown;
    let lastStatus: number | undefined;

    while (Date.now() < deadline) {
      try {
        const res = await this.request.get(url, { ignoreHTTPSErrors: true });

        if (res.status() === 200) {
          console.log(`PMM Server returned status: ${res.status()}`);

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
    throw new Error(`PMM Server was not ready in expected timeout: ${overallTimeoutMs}ms (${reason})`);
  };
}
