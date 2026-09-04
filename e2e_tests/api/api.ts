import InventoryApi from './inventory.api';
import { APIRequestContext, Page } from '@playwright/test';
import GrafanaApi from '@api/grafana.api';
import RealTimeAnalyticsApi from '@api/realtimeanalytics.api';
import AlertingApi from '@api/alerting.api';
import AnnotationsApi from '@api/annotations.api';
import RemoteInstanceApi from '@api/remoteInstance.api';
import ServerApi from '@api/server.api';
import SettingsApi from '@api/settings.api';

export default class Api {
  readonly alertingApi: AlertingApi;
  readonly annotationsApi: AnnotationsApi;
  readonly grafanaApi: GrafanaApi;
  readonly inventoryApi: InventoryApi;
  readonly realTimeAnalyticsApi: RealTimeAnalyticsApi;
  readonly remoteInstanceApi: RemoteInstanceApi;
  readonly serverApi: ServerApi;
  readonly settingsApi: SettingsApi;

  constructor(page: Page, request: APIRequestContext) {
    this.alertingApi = new AlertingApi(request);
    this.annotationsApi = new AnnotationsApi(request);
    this.inventoryApi = new InventoryApi(request);
    this.grafanaApi = new GrafanaApi(page, request);
    this.realTimeAnalyticsApi = new RealTimeAnalyticsApi(request);
    this.remoteInstanceApi = new RemoteInstanceApi(request);
    this.serverApi = new ServerApi(request);
    this.settingsApi = new SettingsApi(request);
  }
}
