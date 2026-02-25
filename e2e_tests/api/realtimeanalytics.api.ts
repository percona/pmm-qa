import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '../helpers/grafana.helper';

export default class RealTimeAnalyticsApi {
  constructor(private request: APIRequestContext) {}

  listSessions = async () => {
    const response = await this.request.get('/v1/realtimeanalytics/sessions', {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toBe(200);

    return await response.json();
  };

  startRealTimeAnalytics = async (serviceId: string) =>
    await this.request.post('/v1/realtimeanalytics/sessions:start', {
      data: { serviceId: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });

  stopAllSessions = async () => {
    const response = await this.listSessions();
    const sessions = response.sessions || [];

    for (const session of sessions) {
      await this.stopRealTimeAnalytics(session.service_id);
    }
  };

  stopRealTimeAnalytics = async (serviceId: string) =>
    await this.request.post('/v1/realtimeanalytics/sessions:stop', {
      data: { serviceId: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });
}
