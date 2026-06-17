import { APIRequestContext } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { pmmUrl } from '../playwright.config';

export default class ServerApi {
  constructor(private request: APIRequestContext) {}

  waitForReady = async (overallTimeoutMs: Timeouts = Timeouts.ONE_MINUTE): Promise<void> => {
    const url = `${pmmUrl}/v1/server/readyz`;
    const pollIntervalMs = Timeouts.FIVE_SECONDS;
    const deadline = Date.now() + overallTimeoutMs;

    while (Date.now() < deadline) {
      try {
        const res = await this.request.get(url, { ignoreHTTPSErrors: true });

        if (res.status() === 200) {
          // ready — resolve normally
          return;
        }
      } catch {
        /* ignored */
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`PMM Server was not ready in expected timeout: ${overallTimeoutMs}`);
  };
}
