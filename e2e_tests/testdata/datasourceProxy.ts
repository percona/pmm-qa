import { ProxyUser } from '@api/datasourceProxy.api';
import { AccessRole } from '@interfaces/accessControl';

export const viewer: ProxyUser = { password: 'pmm-15379-viewer', username: 'pmm-15379-viewer' };
export const editor: ProxyUser = { password: 'pmm-15379-editor', username: 'pmm-15379-editor' };
export const probe: ProxyUser = { password: 'pmm-15379-probe', username: 'pmm-15379-probe' };

export const noAccessRole: AccessRole = {
  filter: '{environment="pmm-none-15379"}',
  title: 'pmm-15379-no-access',
};
export const fullAccessRoleTitle = 'Full access';

export const metricsDataSourceUrl = 'http://127.0.0.1:8430/';
export const queryUp = 'api/v1/query?query=up';
export const exportUp = 'api/v1/export?match%5B%5D=up';
export const canaryMetric = 'pmm15379_canary';
export const deleteCanary = `api/v1/admin/tsdb/delete_series?match%5B%5D=${canaryMetric}`;

export const internalPaths = [
  'snapshot/list',
  'metrics',
  'flags',
  'debug/pprof/heap',
  'api/v1/status/config',
  'api/v1/targets',
];

export const refusalLogLine = 'outside the read-only allow-list';
export const serverContainer = process.env.PMM_SERVER_CONTAINER || 'pmm-server';

export const dataSourceRoutes = (id: number, uid: string) => ({
  proxyById: `/graph/api/datasources/proxy/${id}/`,
  proxyByUid: `/graph/api/datasources/proxy/uid/${uid}/`,
  resourcesById: `/graph/api/datasources/${id}/resources/`,
  resourcesByUid: `/graph/api/datasources/uid/${uid}/resources/`,
});

export const admin: ProxyUser = { password: process.env.ADMIN_PASSWORD || 'admin', username: 'admin' };

export const ruleGroup = (name: string, datasourceUid: string, expr: string) => ({
  interval: '30s',
  name,
  rules: [
    {
      for: '0s',
      grafana_alert: {
        condition: 'A',
        data: [
          {
            datasourceUid,
            model: { expr, instant: true, refId: 'A' },
            refId: 'A',
            relativeTimeRange: { from: 600, to: 0 },
          },
        ],
        exec_err_state: 'Error',
        no_data_state: 'NoData',
        title: name,
      },
    },
  ],
});
