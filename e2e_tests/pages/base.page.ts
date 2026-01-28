import { Page, Locator } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

export default abstract class BasePage {
  abstract builders: Record<string, (...args: string[]) => Locator>;
  abstract buttons: Record<string, Locator>;
  abstract elements: Record<string, Locator>;
  abstract inputs: Record<string, Locator>;
  abstract messages: Record<string, Locator>;

  constructor(protected page: Page) {}

  protected grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');

  newTab = async (): Promise<Page> => {
    const url = this.page.url();
    const newPage = await this.page.context().newPage();

    await newPage.goto(url);
    await newPage.locator('#grafana-iframe').waitFor({ state: 'visible' });
    this.page = newPage;

    return newPage;
  };

  selectNode = async (dashboardIndex: number): Promise<string> => this.selectVariableValue(dashboardIndex);

  selectService = async (dashboardIndex: number): Promise<string> => this.selectVariableValue(dashboardIndex);

  selectTimeRange = async (timeRange: string): Promise<void> => {
    await this.getTimeRangeOption(timeRange).click();
  };

  switchPage = (page: Page) => {
    this.page = page;
  };

  private getTimeRangeOption = (timeRange: string): Locator =>
    this.grafanaIframe().locator(`//*[contains(text(), "${timeRange}")]`);

  private selectVariableValue = async (dashboardIndex: number): Promise<string> => {
    const frame = this.grafanaIframe();
    const allSelector = frame.getByText('All').nth(dashboardIndex);

    await allSelector.click();

    const options = frame.locator('[role="option"]');

    await options
      .first()
      .waitFor({ state: 'visible', timeout: Timeouts.TEN_SECONDS })
      .catch(() => null);

    const count = await options.count();

    for (let i = 0; i < count; i++) {
      const opt = options.nth(i);
      const text = (await opt.innerText().catch(() => ''))?.trim() ?? '';

      if (text && text.toLowerCase() !== 'all') {
        await opt.click();
        await this.page.keyboard.press('Escape');

        return text;
      }
    }

    return '';
  };
}
