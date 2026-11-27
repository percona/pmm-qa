import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';

export default class RealTimeAnalyticsApi {
  constructor(private request: APIRequestContext) {}

  getRunningServiceIds = async () => {
    const response = await this.request.get(apiEndpoints.realtimeanalytics.sessions, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    const { sessions = [] } = (await response.json()) as {
      sessions?: { service_id: string; status: string }[];
    };

    return sessions
      .filter((session) => session.status === 'SESSION_STATUS_RUNNING')
      .map((session) => session.service_id);
  };

  startRealTimeAnalytics = async (serviceId: string) =>
    await this.request.post(apiEndpoints.realtimeanalytics.sessionsStart, {
      data: { serviceId: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });

  stopRealTimeAnalytics = async (serviceId: string) =>
    await this.request.post(apiEndpoints.realtimeanalytics.sessionsStop, {
      data: { serviceId: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });
}
