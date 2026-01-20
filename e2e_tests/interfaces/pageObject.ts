import { Locator } from '@playwright/test';

export interface IPageObject {
  elements?: { [key: string]: Locator };
  buttons?: { [key: string]: Locator };
  inputs?: { [key: string]: Locator };
  messages?: { [key: string]: Locator };
}
