import InventoryApi from './inventory.api';
import { APIRequestContext, Page } from '@playwright/test';
import GrafanaApi from '@api/grafana.api';
import RealTimeAnalyticsApi from '@api/realtimeanalytics.api';

export default class Api {
  readonly grafanaApi: GrafanaApi;
  readonly inventoryApi: InventoryApi;
  readonly realTimeAnalyticsApi: RealTimeAnalyticsApi;

  constructor(page: Page, request: APIRequestContext) {
    this.inventoryApi = new InventoryApi(request);
    this.grafanaApi = new GrafanaApi(page, request);
    this.realTimeAnalyticsApi = new RealTimeAnalyticsApi(request);
  }
}
