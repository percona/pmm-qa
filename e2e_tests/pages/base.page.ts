import { Page, Locator } from '@playwright/test';
import SnackbarComponent from '@components/snackbar.component';

export interface NestedLocators {
  [key: string]: NestedLocator | boolean | undefined;
  locator?: Locator;
  verifyTimeRange?: boolean;
}

export type NestedLocator = Locator | NestedLocators;
export type NestedLocatorMap = Record<string, NestedLocator>;

export default abstract class BasePage {
  snackbar: SnackbarComponent;
  abstract builders: Record<string, (...args: string[]) => Locator>;
  abstract buttons: NestedLocatorMap;
  abstract elements: Record<string, Locator>;
  abstract inputs: Record<string, Locator>;
  abstract messages: Record<string, Locator>;

  constructor(protected page: Page) {
    this.snackbar = new SnackbarComponent(this.page);
  }

  protected grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');
}
