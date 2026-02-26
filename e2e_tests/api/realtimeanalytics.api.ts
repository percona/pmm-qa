import { APIRequestContext } from '@playwright/test';
import GrafanaHelper from '../helpers/grafana.helper';

export default class RealTimeAnalyticsApi {
  constructor(private request: APIRequestContext) {}

  startRealTimeAnalytics = async (serviceId: string) =>
    await this.request.post('/v1/realtimeanalytics/sessions:start', {
      data: { serviceId: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });

  stopRealTimeAnalytics = async (serviceId: string) =>
    await this.request.post('/v1/realtimeanalytics/sessions:stop', {
      data: { serviceId: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });
}
