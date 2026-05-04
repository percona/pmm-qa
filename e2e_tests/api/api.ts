import InventoryApi from './inventory.api';
import { APIRequestContext, Page } from '@playwright/test';
import GrafanaApi from '@api/grafana.api';
import RealTimeAnalyticsApi from '@api/realtimeanalytics.api';
import SettingsApi from '@api/settings.api';
import AccessControlApi from '@api/accessControl.api';

export default class Api {
  readonly accessControlApi: AccessControlApi;
  readonly grafanaApi: GrafanaApi;
  readonly inventoryApi: InventoryApi;
  readonly realTimeAnalyticsApi: RealTimeAnalyticsApi;
  readonly settingsApi: SettingsApi;

  constructor(page: Page, request: APIRequestContext) {
    this.accessControlApi = new AccessControlApi(request);
    this.inventoryApi = new InventoryApi(request);
    this.grafanaApi = new GrafanaApi(page, request);
    this.realTimeAnalyticsApi = new RealTimeAnalyticsApi(request);
    this.settingsApi = new SettingsApi(request);
  }
}
