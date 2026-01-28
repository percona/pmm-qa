import { Locator } from '@playwright/test';

type NestedLocators = Locator | { [key: string]: NestedLocators };

export interface IPageObject {
  elements?: NestedLocators;
  buttons?: NestedLocators;
  inputs?: NestedLocators;
  messages?: NestedLocators;
}
