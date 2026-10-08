import pmmTest from '@fixtures/pmmTest';
import { APIResponse, expect } from '@playwright/test';
import { pmmUrl } from '../playwright.config';
import { Timeouts } from '@helpers/timeouts';

const deepLink =
  'graph/d/node-cpu/cpu-utilization-details?from=now-6h&to=now-1h&viewPanel=panel-22&var-node_name=a%20b';
const fetchAs = (dest: string | undefined) => ({
  headers: dest ? { 'Sec-Fetch-Dest': dest } : ({} as Record<string, string>),
  maxRedirects: 0,
});

const redirectTarget = (response: APIResponse) => {
  const location = response.headers().location;

  if (!location) return '';

  const url = new URL(location, pmmUrl);

  return url.pathname + url.search;
};

pmmTest(
  'PMM-T2369 - Verify top-level Grafana URLs redirect to PMM UI on the server while API, render and auth pages stay on /graph @new-navigation',
  async ({ request }) => {
    await pmmTest.step(
      'dashboard deep link opened as a document redirects with its query intact',
      async () => {
        const response = await request.get(deepLink, fetchAs('document'));

        expect(response.status()).toEqual(302);
        expect(redirectTarget(response)).toEqual(`/pmm-ui/${deepLink}`);
      },
    );

    await pmmTest.step('root and the Grafana home go straight to the shell', async () => {
      for (const path of ['', 'graph/']) {
        const response = await request.get(path, fetchAs('document'));

        expect(redirectTarget(response), `/${path}`).toEqual('/pmm-ui/graph/');
      }
    });

    await pmmTest.step('iframe loads and clients without Sec-Fetch-Dest reach Grafana', async () => {
      for (const dest of ['iframe', undefined]) {
        const response = await request.get(deepLink, fetchAs(dest));

        expect(redirectTarget(response), `Sec-Fetch-Dest: ${dest}`).not.toContain('/pmm-ui/');
      }
    });

    await pmmTest.step('API, renderer and auth pages stay on /graph', async () => {
      const exempt = [
        'graph/api/health',
        'graph/login',
        'graph/signup',
        'graph/verify',
        'graph/invite/pmm-t2369',
        'graph/user/password/send-reset-email',
        'graph/user/password/reset?code=pmm-t2369',
        'graph/%6Cogin',
        'graph/d/node-cpu/cpu-utilization-details?render=1',
      ];

      for (const path of exempt) {
        const response = await request.get(path, fetchAs('document'));

        expect(redirectTarget(response), path).not.toContain('/pmm-ui/');
      }

      const health = await request.get('graph/api/health', fetchAs('document'));

      expect(health.status()).toEqual(200);
      expect(health.headers()['content-type']).toContain('application/json');
    });
  },
);

pmmTest(
  'PMM-T2370 - Verify a logged-out dashboard deep link returns to the same dashboard after login @new-navigation',
  async ({ loginPage, page }) => {
    await pmmTest.step('open a dashboard deep link while logged out', async () => {
      await page.goto(deepLink);
      await page.waitForURL(/\/graph\/login/, { timeout: Timeouts.ONE_MINUTE });
    });

    await pmmTest.step('log in and land on the requested dashboard', async () => {
      await loginPage.inputs.username.fill('admin');
      await loginPage.inputs.password.fill(process.env.ADMIN_PASSWORD || 'admin');
      await loginPage.buttons.login.click();
      await page.waitForURL(/\/pmm-ui\/graph\/d\/node-cpu\//, { timeout: Timeouts.ONE_MINUTE });

      const landed = new URL(page.url()).searchParams;

      expect(landed.get('from')).toEqual('now-6h');
      expect(landed.get('to')).toEqual('now-1h');
      expect(landed.get('viewPanel')).toEqual('panel-22');
    });
  },
);
