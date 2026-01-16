import InventoryApi from './inventory.api';
import { APIRequestContext, Page } from '@playwright/test';
import GrafanaApi from '@api/grafana.api';

export default class Api {
  public readonly grafanaApi: GrafanaApi;
  public readonly inventoryApi: InventoryApi;

  constructor(
    private page: Page,
    private request: APIRequestContext,
  ) {
    this.inventoryApi = new InventoryApi(page, request);
    this.grafanaApi = new GrafanaApi(page, request);
  }
}
