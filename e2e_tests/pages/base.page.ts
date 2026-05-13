import { APIRequestContext, expect, Page, Locator } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';
import GrafanaHelper from '@helpers/grafana.helper';

export type DropdownName = 'Service Name' | 'Node Name';

export interface NestedLocators {
  [key: string]: NestedLocator | boolean | undefined;
  locator?: Locator;
  verifyTimeRange?: boolean;
}

export type NestedLocator = Locator | NestedLocators;
export type NestedLocatorMap = Record<string, NestedLocator>;

export default abstract class BasePage {
  abstract builders: Record<string, (...args: string[]) => Locator>;
  abstract buttons: NestedLocatorMap;
  abstract elements: Record<string, Locator>;
  abstract inputs: Record<string, Locator>;
  abstract messages: Record<string, Locator>;

  constructor(protected page: Page) {}

  duplicateCurrentPage = async (): Promise<Page> => {
    const url = this.page.url();
    const newPage = await this.page.context().newPage();

    await newPage.goto(url);
    await newPage.locator('#grafana-iframe').waitFor({ state: 'visible' });
    this.page = newPage;

    return newPage;
  };

  protected grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');

  haEnableCheck = async (request: APIRequestContext): Promise<void> => {
    const haResponse = await request.get(apiEndpoints.ha.status, {
      headers: GrafanaHelper.getAuthHeader(),
    });
    const haStatus = (await haResponse.json()) as { status: string };

    expect(haStatus.status).toEqual('Enabled');
  };

  selectTimeRange = async (timeRange: string): Promise<void> => {
    await this.elements.timePickerOpenButton.click({ timeout: Timeouts.THIRTY_SECONDS });

    const timeRangeDialog = this.grafanaIframe().getByRole('dialog');
    const timeRangeLabel = timeRangeDialog
      .locator('label')
      .filter({
        hasText: timeRange,
      })
      .first();

    await timeRangeLabel.waitFor({ state: 'visible', timeout: Timeouts.THIRTY_SECONDS });
    await timeRangeLabel.click();
  };

  selectVariableValue = async (dropDownName: DropdownName, dropDownValue?: string): Promise<string> => {
    const frame = this.grafanaIframe();
    const wrapper = frame.getByTestId('data-testid template variable').filter({ hasText: dropDownName });
    const combobox = wrapper.getByRole('combobox');

    await wrapper.click({ timeout: Timeouts.THIRTY_SECONDS });

    const options = frame.getByRole('option');

    await options.first().waitFor({
      state: 'visible',
      timeout: Timeouts.THIRTY_SECONDS,
    });

    const valueToSelect = dropDownValue
      ? options.filter({
          hasText: new RegExp(`^${dropDownValue}$`, 'i'),
        })
      : options.filter({
          hasText: /^(?!All$).+/i,
        });
    const selectedOption = (await valueToSelect.first().textContent())?.trim() ?? '';

    await valueToSelect.first().click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.page.keyboard.press('Escape');

    await expect(combobox).toHaveAttribute('aria-expanded', 'false', { timeout: Timeouts.THIRTY_SECONDS });

    return selectedOption;
  };

  switchPage = (page: Page) => {
    this.page = page;
  };
}
