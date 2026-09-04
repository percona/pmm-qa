import { Page, Route } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';

export default class mocksHelper {
  constructor(public page: Page) {}

  // mock api for fresh install
  mockFreshInstall = async (): Promise<void> => {
    let productTourCompleted = false;

    await this.page.route(apiEndpoints.users.me, (route: Route) => {
      const method = route.request().method();

      if (method === 'GET') {
        return route.fulfill({
          body: JSON.stringify({
            alerting_tour_completed: false,
            product_tour_completed: productTourCompleted,
            user_id: 1,
          }),
          contentType: 'application/json',
          status: 200,
        });
      }
      if (method === 'PATCH' || method === 'PUT') {
        productTourCompleted = true;

        return route.fulfill({
          body: JSON.stringify({
            product_tour_completed: true,
          }),
          contentType: 'application/json',
          status: 200,
        });
      }

      return route.continue();
    });
  };

  // mock no services
  mockNoServices = async (): Promise<void> => {
    const fulfillNoServices = async (route: Route) =>
      route.fulfill({
        body: JSON.stringify({
          external: [],
          haproxy: [],
          mongodb: [],
          mysql: [],
          postgresql: [],
          proxysql: [],
          valkey: [],
        }),
        contentType: 'application/json',
        status: 200,
      });

    await this.page.route(apiEndpoints.inventory.services, fulfillNoServices);
    await this.page.route(apiEndpoints.management.services, fulfillNoServices);
  };

  mockRealTimeAnalyticsSessions = async (): Promise<void> => {
    const sessions = Array.from({ length: 26 }, (_, index) => ({
      cluster_name: `mock-cluster-${String(index + 1).padStart(2, '0')}`,
      collect_interval: '2s',
      service_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      service_name: `mock-service-${String(index + 1).padStart(2, '0')}`,
      start_time: '2026-01-01T00:00:00Z',
      status: 'SESSION_STATUS_RUNNING',
    }));

    await this.page.route(apiEndpoints.realtimeanalytics.sessions, (route) =>
      route.fulfill({
        body: JSON.stringify({ sessions }),
        contentType: 'application/json',
        status: 200,
      }),
    );
  };

  mockSnoozedUpdate = async (updateVersion: string): Promise<{ snoozedAt: number }> => {
    const state = { snoozedAt: 0, snoozedVersion: '' };

    await this.page.context().unroute(apiEndpoints.users.me);
    await this.page.context().unroute(apiEndpoints.server.updates);
    await this.page.route(apiEndpoints.users.me, async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() as { snoozed_pmm_version?: string };

        state.snoozedAt = Date.now();
        state.snoozedVersion = body.snoozed_pmm_version ?? '';
      }

      await route.fulfill({
        body: JSON.stringify({
          alerting_tour_completed: true,
          product_tour_completed: true,
          snoozed_at: state.snoozedAt ? new Date(state.snoozedAt).toISOString() : null,
          snoozed_pmm_version: state.snoozedVersion,
          user_id: 1,
        }),
        contentType: 'application/json',
        status: 200,
      });
    });
    await this.page.route(apiEndpoints.server.updates, (route) =>
      route.fulfill({
        body: JSON.stringify({
          installed: {},
          last_check: new Date().toISOString(),
          latest: {
            timestamp: new Date(0).toISOString(),
            version: updateVersion,
          },
          update_available: true,
        }),
        contentType: 'application/json',
        status: 200,
      }),
    );

    return state;
  };

  mockUpdateAvailable = async (updateAvailable: boolean): Promise<void> => {
    await this.page.route(apiEndpoints.server.updates, async (route: Route) => {
      const installedTimestamp = new Date();
      const now = new Date();
      const millisecond = now.getMilliseconds().toString().padStart(3, '0');
      const nanosecondTimestamp = now.toISOString().split('.')[0] + '.' + millisecond + '000000Z';

      await route.fulfill({
        body: JSON.stringify({
          installed: {
            full_version: '',
            timestamp: installedTimestamp,
            version: '',
          },
          last_check: nanosecondTimestamp,
          latest: {
            release_notes_text: 'New features',
            release_notes_url: 'https://example.com',
            tag: '',
            timestamp: null,
            version: '',
          },
          latest_news_url: 'https://example.com',
          update_available: updateAvailable,
        }),
        contentType: 'application/json',
        status: 200,
      });
    });
  };
}
