import InventoryApi from './inventory.api';
import { APIRequestContext, Page } from '@playwright/test';
import BackupsApi from '@api/backups.api';
import GrafanaApi from '@api/grafana.api';
import RealTimeAnalyticsApi from '@api/realtimeanalytics.api';
import SettingsApi from '@api/settings.api';
import AccessControlApi from '@api/accessControl.api';
import AlertingApi from '@api/alerting.api';
import AnnotationsApi from '@api/annotations.api';
import RemoteInstanceApi from '@api/remoteInstance.api';
import ServerApi from '@api/server.api';

export default class Api {
  readonly accessControlApi: AccessControlApi;
  readonly alertingApi: AlertingApi;
  readonly annotationsApi: AnnotationsApi;
  readonly backupsApi: BackupsApi;
  readonly grafanaApi: GrafanaApi;
  readonly inventoryApi: InventoryApi;
  readonly realTimeAnalyticsApi: RealTimeAnalyticsApi;
  readonly remoteInstanceApi: RemoteInstanceApi;
  readonly serverApi: ServerApi;
  readonly settingsApi: SettingsApi;

  constructor(page: Page, request: APIRequestContext) {
    this.accessControlApi = new AccessControlApi(request);
    this.alertingApi = new AlertingApi(request);
    this.annotationsApi = new AnnotationsApi(request);
    this.backupsApi = new BackupsApi(request);
    this.inventoryApi = new InventoryApi(request);
    this.grafanaApi = new GrafanaApi(page, request);
    this.realTimeAnalyticsApi = new RealTimeAnalyticsApi(request);
    this.remoteInstanceApi = new RemoteInstanceApi(request);
    this.serverApi = new ServerApi(request);
    this.settingsApi = new SettingsApi(request);
  }
}
