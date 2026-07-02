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
  realtimeanalytics: {
    queriesSearch: '/v1/realtimeanalytics/queries:search',
    sessionsStart: '/v1/realtimeanalytics/sessions:start',
    sessionsStop: '/v1/realtimeanalytics/sessions:stop',
  },
  server: {
    readyz: '/v1/server/readyz',
    settings: '/v1/server/settings',
    updates: '**/v1/server/updates?force=**',
    updatesStart: '/v1/server/updates:start',
    updatesStatus: '/v1/server/updates:getStatus',
  },
  users: {
    me: '**/v1/users/me',
  },
} as const;

export default apiEndpoints;
