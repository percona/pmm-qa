import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';

export default class RealTimeAnalyticsApi {
  constructor(private request: APIRequestContext) {}

  startRealTimeAnalytics = async (serviceId: string) =>
    await this.request.post(apiEndpoints.realtimeanalytics.sessionsStart, {
      data: { serviceId: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });

  stopAllSessions = async () => {
    const response = await this.request.get(apiEndpoints.realtimeanalytics.sessions, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    const { sessions = [] } = (await response.json()) as { sessions?: { service_id: string }[] };

    for (const { service_id } of sessions) {
      const stop = await this.stopRealTimeAnalytics(service_id);

      expect(stop.status(), await stop.text()).toEqual(200);
    }
  };

  stopRealTimeAnalytics = async (serviceId: string) =>
    await this.request.post(apiEndpoints.realtimeanalytics.sessionsStop, {
      data: { serviceId: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });
}
