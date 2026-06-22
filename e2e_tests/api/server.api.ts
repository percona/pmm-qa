import { APIRequestContext } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';

export default class ServerApi {
  constructor(private request: APIRequestContext) {}

  waitForReady = async (overallTimeoutMs: Timeouts = Timeouts.ONE_MINUTE): Promise<void> => {
    const pollIntervalMs = Timeouts.FIVE_SECONDS;
    const deadline = Date.now() + overallTimeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        console.log(`Retrying! ${Date.now()}`);

        const res = await this.request.get(apiEndpoints.server.readyz, { ignoreHTTPSErrors: true });

        if (res.status() === 200) {
          return;
        }
      } catch (err) {
        console.error(`Error is: ${err}`);
        lastError = err;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `PMM Server was not ready in expected timeout: ${overallTimeoutMs}ms (last error: ${lastError})`,
    );
  };
}
