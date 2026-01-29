import { Locator } from '@playwright/test';

type NestedLocators =
  | Locator
  | {
      locator?: Locator;
      verifyTimeRange?: boolean;
      elements?: { [key: string]: NestedLocators };
      [key: string]: any;
    };

export interface IPageObject {
  elements?: NestedLocators;
  buttons?: NestedLocators;
  inputs?: NestedLocators;
  messages?: NestedLocators;
}
