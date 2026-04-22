import { APIRequestContext } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';

export default class RealTimeAnalyticsApi {
  constructor(private request: APIRequestContext) {}

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
