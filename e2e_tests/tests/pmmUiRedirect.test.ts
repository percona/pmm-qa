import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const deepLinkParameters = { from: 'now-6h', nodeName: 'a b', to: 'now-1h', viewPanel: 'panel-2' };

pmmTest(
  'PMM-T2369 - Verify top-level Grafana URLs redirect to PMM UI on the server while API, render, auth pages and share links stay on /graph @new-navigation',
  async ({ api, dashboard, loginPage, urlHelper }) => {
    const deepLink = urlHelper.buildUrlWithParameters(dashboard.os.nodeSummary.url, deepLinkParameters);

    await pmmTest.step(
      'dashboard deep link opened as a document redirects with its query intact',
      async () => {
        const response = await api.serverApi.getWithoutRedirect(deepLink, 'document');

        expect(response.status()).toEqual(302);
        expect(response.headers().location).toEqual(`/pmm-ui/${deepLink}`);
      },
    );

    await pmmTest.step('root and the Grafana home go straight to the shell', async () => {
      for (const path of ['', 'graph/']) {
        const response = await api.serverApi.getWithoutRedirect(path, 'document');

        expect(response.headers().location, `/${path}`).toEqual('/pmm-ui/graph/');
      }
    });

    await pmmTest.step('iframe loads and clients without Sec-Fetch-Dest reach Grafana', async () => {
      for (const dest of ['iframe', undefined] as const) {
        const response = await api.serverApi.getWithoutRedirect(deepLink, dest);

        expect(response.headers().location ?? '', `Sec-Fetch-Dest: ${dest}`).not.toContain('/pmm-ui/');
      }
    });

    await pmmTest.step('API, renderer and auth pages stay on /graph', async () => {
      const exempt = [
        'graph/api/health',
        loginPage.url,
        'graph/signup',
        'graph/verify',
        'graph/invite/pmm-t2369',
        'graph/user/password/send-reset-email',
        'graph/user/password/reset?code=pmm-t2369',
        'graph/%6Cogin',
        `${dashboard.os.nodeSummary.url}?render=1`,
      ];

      for (const path of exempt) {
        const response = await api.serverApi.getWithoutRedirect(path, 'document');

        expect(response.headers().location ?? '', path).not.toContain('/pmm-ui/');
      }

      const health = await api.serverApi.getWithoutRedirect('graph/api/health', 'document');

      expect(health.status()).toEqual(200);
      expect(health.headers()['content-type']).toContain('application/json');
    });

    await pmmTest.step(
      'share links stay on /graph while the share list pages open in the shell',
      async () => {
        const shareLinks = [
          'graph/public-dashboards/pmm-t2369',
          'graph/dashboard/snapshot/pmm-t2369',
          'graph/dashboard-solo/snapshot/pmm-t2369?panelId=1',
        ];

        for (const path of shareLinks) {
          const response = await api.serverApi.getWithoutRedirect(path, 'document');

          expect(response.status(), path).toEqual(200);
        }

        // Grafana itself sends the unmerged-slash form to login; nginx must still leave it on /graph.
        const obfuscated = await api.serverApi.getWithoutRedirect(
          'graph/dashboard//snapshot/pmm-t2369',
          'document',
        );

        expect(obfuscated.headers().location ?? '').not.toContain('/pmm-ui/');

        for (const path of ['graph/dashboard/snapshots', 'graph/dashboard/public']) {
          const response = await api.serverApi.getWithoutRedirect(path, 'document');

          expect(response.headers().location, path).toEqual(`/pmm-ui/${path}`);
        }
      },
    );
  },
);

pmmTest(
  'PMM-T2370 - Verify a logged-out dashboard deep link returns to the same dashboard after login @new-navigation',
  async ({ dashboard, loginPage, page, urlHelper }) => {
    const deepLink = urlHelper.buildUrlWithParameters(dashboard.os.nodeSummary.url, deepLinkParameters);

    await pmmTest.step('open a dashboard deep link while logged out', async () => {
      await page.goto(deepLink);
      await page.waitForURL(new RegExp(loginPage.url), { timeout: Timeouts.ONE_MINUTE });
    });

    await pmmTest.step('log in and land on the requested dashboard', async () => {
      await loginPage.login(
        process.env.ADMIN_PASSWORD || 'admin',
        new RegExp(`/pmm-ui/${dashboard.os.nodeSummary.url}`),
      );

      const landed = new URL(page.url()).searchParams;

      expect(landed.get('from')).toEqual(deepLinkParameters.from);
      expect(landed.get('to')).toEqual(deepLinkParameters.to);
      expect(landed.get('viewPanel')).toEqual(deepLinkParameters.viewPanel);
    });
  },
);
