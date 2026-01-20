import { Locator } from '@playwright/test';

export interface NavigationInterface {
  buttons?: { [key: string]: Locator };
  elements?: { [key: string]: Locator };
}
