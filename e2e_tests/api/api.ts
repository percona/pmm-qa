import InventoryApi from './inventory.api';
import { APIRequestContext, Page } from '@playwright/test';

export default class Api {
  public readonly inventoryApi: InventoryApi;

  constructor(
    private page: Page,
    private request: APIRequestContext,
  ) {
    this.inventoryApi = new InventoryApi(page, request);
  }
}
