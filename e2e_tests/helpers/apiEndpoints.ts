const apiEndpoints = {
  inventory: {
    services: '**/v1/inventory/services',
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
    updates: '**/v1/server/updates?force=**',
  },
  users: {
    me: '**/v1/users/me',
  },
} as const;

export default apiEndpoints;
