import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';

interface RtaService {
  service_id: string;
  service_name: string;
}

export default class RealTimeAnalyticsApi {
  constructor(private request: APIRequestContext) {}

  listServices = async () => {
    const response = await this.request.get(apiEndpoints.realtimeanalytics.services, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), `Listing RTA services failed: ${await response.text()}`).toEqual(200);

    return (await response.json()) as Partial<Record<'mongodb' | 'mysql' | 'postgresql', RtaService[]>>;
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
