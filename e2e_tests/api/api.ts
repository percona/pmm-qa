import InventoryApi from './inventory.api';
import { APIRequestContext, Page } from '@playwright/test';
import GrafanaApi from '@api/grafana.api';

export default class Api {
  readonly grafanaApi: GrafanaApi;
  readonly inventoryApi: InventoryApi;

  constructor(page: Page, request: APIRequestContext) {
    this.inventoryApi = new InventoryApi(request);
    this.grafanaApi = new GrafanaApi(page, request);
  }
}
