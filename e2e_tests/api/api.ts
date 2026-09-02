import InventoryApi from './inventory.api';
import { APIRequestContext, Page } from '@playwright/test';
import GrafanaApi from '@api/grafana.api';
import AlertingApi from '@api/alerting.api';
import AnnotationsApi from '@api/annotations.api';
import RemoteInstanceApi from '@api/remoteInstance.api';
import ServerApi from '@api/server.api';
import SettingsApi from '@api/settings.api';

export default class Api {
  public readonly alertingApi: AlertingApi;
  public readonly annotationsApi: AnnotationsApi;
  public readonly grafanaApi: GrafanaApi;
  public readonly inventoryApi: InventoryApi;
  public readonly remoteInstanceApi: RemoteInstanceApi;
  public readonly serverApi: ServerApi;
  public readonly settingsApi: SettingsApi;

  constructor(
    private page: Page,
    private request: APIRequestContext,
  ) {
    this.alertingApi = new AlertingApi(request);
    this.annotationsApi = new AnnotationsApi(request);
    this.grafanaApi = new GrafanaApi(page, request);
    this.inventoryApi = new InventoryApi(page, request);
    this.remoteInstanceApi = new RemoteInstanceApi(request);
    this.serverApi = new ServerApi(request);
    this.settingsApi = new SettingsApi(request);
  }
}
