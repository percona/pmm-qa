import InventoryApi from './inventory.api';
import { APIRequestContext, Page } from '@playwright/test';
import BackupsApi from '@api/backups.api';
import GrafanaApi from '@api/grafana.api';
import RealTimeAnalyticsApi from '@api/realtimeanalytics.api';
import SettingsApi from '@api/settings.api';
import AccessControlApi from '@api/accessControl.api';
import ServerApi from '@api/server.api';
import AlertingApi from '@api/alerting.api';
import AnnotationsApi from '@api/annotations.api';
import RemoteInstanceApi from '@api/remoteInstance.api';
import HaApi from '@api/ha.api';
import PrometheusApi from '@api/prometheus.api';

export default class Api {
  readonly accessControlApi: AccessControlApi;
  readonly alertingApi: AlertingApi;
  readonly annotationsApi: AnnotationsApi;
  readonly backupsApi: BackupsApi;
  readonly grafanaApi: GrafanaApi;
  readonly haApi: HaApi;
  readonly inventoryApi: InventoryApi;
  readonly prometheusApi: PrometheusApi;
  readonly realTimeAnalyticsApi: RealTimeAnalyticsApi;
  readonly remoteInstanceApi: RemoteInstanceApi;
  readonly serverApi: ServerApi;
  readonly settingsApi: SettingsApi;

  constructor(page: Page, request: APIRequestContext) {
    this.accessControlApi = new AccessControlApi(request);
    this.alertingApi = new AlertingApi(request);
    this.annotationsApi = new AnnotationsApi(request);
    this.backupsApi = new BackupsApi(request);
    this.haApi = new HaApi(request);
    this.inventoryApi = new InventoryApi(request);
    this.prometheusApi = new PrometheusApi(request);
    this.grafanaApi = new GrafanaApi(page, request);
    this.realTimeAnalyticsApi = new RealTimeAnalyticsApi(request);
    this.remoteInstanceApi = new RemoteInstanceApi(request);
    this.serverApi = new ServerApi(request);
    this.settingsApi = new SettingsApi(request);
  }
}
