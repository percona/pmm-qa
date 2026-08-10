const apiEndpoints = {
  accessControl: {
    roles: '/v1/accesscontrol/roles',
    rolesAssign: '/v1/accesscontrol/roles:assign',
  },
  alerting: {
    rules: '/v1/alerting/rules',
    templates: '/v1/alerting/templates',
  },
  backups: {
    artifacts: '/v1/backups/artifacts',
    locations: '/v1/backups/locations',
    schedule: '/v1/backups:schedule',
    scheduled: '/v1/backups/scheduled',
  },
  ha: {
    nodes: '/v1/ha/nodes',
    status: '/v1/ha/status',
  },
  inventory: {
    services: '/v1/inventory/services',
  },
  management: {
    services: '/v1/management/services',
  },
  platform: {
    connect: '/v1/platform:connect',
  },
  prometheus: {
    // Queries go through the Grafana datasource proxy rather than PMM's own
    // /prometheus route: the proxy targets whatever metrics backend Grafana is
    // configured with, so it works on standalone PMM and on HA, where
    // /prometheus fronts an external VictoriaMetrics cluster.
    datasourceProxy: '/graph/api/datasources/proxy/uid',
    datasources: '/graph/api/datasources',
  },
  realtimeanalytics: {
    queriesSearch: '/v1/realtimeanalytics/queries:search',
    sessionsStart: '/v1/realtimeanalytics/sessions:start',
    sessionsStop: '/v1/realtimeanalytics/sessions:stop',
  },
  server: {
    readyz: '/v1/server/readyz',
    settings: '/v1/server/settings',
    updates: '**/v1/server/updates?force=**',
  },
  users: {
    me: '**/v1/users/me',
  },
} as const;

export default apiEndpoints;
