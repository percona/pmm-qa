import { Page, Route } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import { SupportDiagnosticsBatchRequest, SupportDiagnosticsExecution } from '@interfaces/supportDiagnostics';
import {
  logExtractorSchema,
  supportDiagnosticsCatalog,
  supportDiagnosticsHosts,
  supportDiagnosticsIncident,
} from '@testdata/supportDiagnostics';

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

  mockServicesList = async (count: number) => {
    let requests = 0;
    const route = await this.page.route(apiEndpoints.management.services, (route) => {
      requests++;

      return route.fulfill({
        body: JSON.stringify({
          services: Array.from({ length: count }, (_, index) => ({
            address: `127.0.0.${index + 1}`,
            agents: [],
            cluster: '',
            custom_labels: {},
            database_name: 'postgres',
            environment: '',
            external_group: '',
            node_id: 'pmm-server',
            node_name: `mocked-service-node-${index + 1}`,
            port: 5_432,
            replication_set: '',
            service_id: `30edfcf1-bea1-4422-b111-d2d263bdcfc${index + 1}`,
            service_name: `mocked-service-${index + 1}`,
            service_type: 'postgresql',
            socket: '',
            status: 'STATUS_UP',
            version: '',
          })),
        }),
        contentType: 'application/json',
        status: 200,
      });
    });

    return Object.assign(route, { requests: () => requests });
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

  mockSupportDiagnostics = async (executions: SupportDiagnosticsExecution[] = []) => {
    const state = { batchRequests: [] as SupportDiagnosticsBatchRequest[], executions: [...executions] };
    const incidentPath = `/apps/atw/incidents/${supportDiagnosticsIncident.id}`;
    const responses: Record<string, unknown> = {
      '/apps/atw/': supportDiagnosticsCatalog,
      '/apps/atw/config/': { case_search_available: false, send_disabled_reasons: [] },
      '/apps/atw/execution-schema/': logExtractorSchema,
      '/extensions/app-info/': { footer_text: 'PMM Extensions', version: 'v3.10.0' },
      '/extensions/hosts/': supportDiagnosticsHosts,
      '/oauth/session/exchange': { access_token: 'mocked-token', expires_in: 300 },
      [`${incidentPath}/send-jobs/`]: { items: [], limit: 50, offset: 0, total: 0 },
      [incidentPath]: supportDiagnosticsIncident,
    };

    await this.page.route(apiEndpoints.server.settings, async (route: Route) => {
      const response = await route.fetch();
      const body = await response.json();

      await route.fulfill({
        json: { ...body, settings: { ...body.settings, extensions_enabled: true } },
        response,
      });
    });

    await this.page.route(apiEndpoints.extensions.api, (route: Route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^.*\/extensions\/api/, '');
      const fulfillJson = (body: unknown, status = 200) =>
        route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });

      if (path !== `${incidentPath}/executions/`) {
        return path in responses ? fulfillJson(responses[path]) : fulfillJson({ detail: 'Not mocked' }, 404);
      }
      if (request.method() === 'POST') {
        const batch = request.postDataJSON() as SupportDiagnosticsBatchRequest;
        const now = new Date().toISOString();

        state.batchRequests.push(batch);

        for (const item of batch.items) {
          state.executions.unshift({
            args_withheld: false,
            created_at: now,
            failure_reason: null,
            finished_at: null,
            has_logs: false,
            id: crypto.randomUUID(),
            masked_args: Object.entries(item.args)
              .map(([name, value]) => `--${name} ${value}`)
              .join(' '),
            snippet_filename: item.snippet_filename,
            snippet_title:
              supportDiagnosticsCatalog
                .flatMap((category) => category.snippets)
                .find((snippet) => snippet.name === item.snippet_filename)?.title ?? item.snippet_filename,
            started_at: now,
            task_history_id: state.executions.length + 1,
            task_status: 'running',
          });
        }

        return fulfillJson(
          {
            items: batch.items.map((item, index) => ({
              error: null,
              snippet_filename: item.snippet_filename,
              task_history_id: state.executions.length + index,
              task_name: 'atw__exec-artifact',
            })),
          },
          201,
        );
      }

      return fulfillJson({ items: state.executions, limit: 20, offset: 0, total: state.executions.length });
    });

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
