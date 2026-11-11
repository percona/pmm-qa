import { Page, Route } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';

interface RtaQueryMock {
  database?: string;
  duration?: string;
  mongoDb?: boolean;
  mySqlPayload?: Record<string, unknown>;
  postgreSqlPayload?: Record<string, unknown>;
  queryId: string;
  queryText: string;
  username?: string;
}

interface RtaSessionMock {
  serviceId: string;
  serviceType:
    'SERVICE_TYPE_MONGODB_SERVICE' | 'SERVICE_TYPE_MYSQL_SERVICE' | 'SERVICE_TYPE_POSTGRESQL_SERVICE';
  statusMessage?: string;
}

const rtaMockServiceId = (query: RtaQueryMock) => {
  if (query.mongoDb) return 'mock-mongo-service';

  return query.postgreSqlPayload ? 'mock-postgresql-service' : 'mock-mysql-service';
};

const sqlPayloadWireFormat = (query: RtaQueryMock) =>
  query.postgreSqlPayload
    ? {
        postgresql_payload: {
          application_name: 'pgbench',
          blocked_status: 'BLOCKED_STATUS_NOT_BLOCKED',
          database_name: query.database ?? 'pgbench',
          db_instance_address: '127.0.0.1:5432',
          pid: Number(query.queryId),
          query_id: '-6094915464410306043',
          query_start_time: new Date().toISOString(),
          state: 'active',
          transaction_start_time: new Date().toISOString(),
          username: query.username ?? 'pgbench',
          wait_event: '',
          wait_event_type: '',
          ...query.postgreSqlPayload,
        },
      }
    : {
        my_sql_payload: {
          blocked_status: 'BLOCKED_STATUS_NOT_BLOCKED',
          command: 'Query',
          database_name: query.database ?? 'sbtest',
          db_instance_address: '127.0.0.1:3306',
          full_scan: false,
          program_name: 'sysbench',
          rows_examined: '100',
          rows_sent: '10',
          state: 'executing',
          username: query.username ?? 'sbtest@localhost',
          ...query.mySqlPayload,
        },
      };
// Snake_case, as the API sends it; the UI camelizes it.
const rtaQueryWireFormat = (query: RtaQueryMock) => ({
  client_address: '127.0.0.1:52134',
  ...(query.mongoDb
    ? {
        mongo_db_payload: {
          client_app_name: 'mongosh',
          collection: 'mycollection',
          database_name: 'admin',
          db_instance_address: '127.0.0.1:27017',
          operation: 'query',
          operation_start_time: new Date().toISOString(),
          plan_summary: 'COLLSCAN',
          username: 'pmm-mongo',
        },
      }
    : sqlPayloadWireFormat(query)),
  query_collect_time: new Date().toISOString(),
  query_execution_duration: query.duration ?? '2s',
  query_id: query.queryId,
  query_raw_json: JSON.stringify({ current_statement: query.queryText }),
  query_text: query.queryText,
  service_id: rtaMockServiceId(query),
  service_name: rtaMockServiceId(query),
});

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

  mockRealTimeAnalyticsQueries = async (queries: RtaQueryMock[]): Promise<void> => {
    await this.page.route(apiEndpoints.realtimeanalytics.queriesSearch, (route) =>
      route.fulfill({
        body: JSON.stringify({ queries: queries.map(rtaQueryWireFormat) }),
        contentType: 'application/json',
        status: 200,
      }),
    );
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

  mockRealTimeAnalyticsSessionsOf = async (sessions: RtaSessionMock[]): Promise<void> => {
    await this.page.route(apiEndpoints.realtimeanalytics.sessions, (route) =>
      route.fulfill({
        body: JSON.stringify({
          sessions: sessions.map((session) => ({
            cluster_name: '',
            collect_interval: '2s',
            service_id: session.serviceId,
            service_name: session.serviceId,
            service_type: session.serviceType,
            start_time: new Date().toISOString(),
            status: 'SESSION_STATUS_RUNNING',
            status_message: session.statusMessage,
          })),
        }),
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
