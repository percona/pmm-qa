import { Locator, Page } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';

export default class BasePage {
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

  switchPage = (page: Page) => {
    this.page = page;
  };

  public selectTimeRange = async (timeRange: string): Promise<void> => {
    await pmmTest.step(`Select time range: ${timeRange}`, async () => {
      await this.getTimeRangeOption(timeRange).click();
    });
  };

  private getTimeRangeOption = (timeRange: string): Locator => {
    return this.grafanaIframe().locator(`//*[contains(text(), "${timeRange}")]`);
  };

  private selectVariableValue = async (dashboardIndex: number): Promise<string> => {
    const frame = this.grafanaIframe();
    const allSelector = frame.getByText('All').nth(dashboardIndex);
    await allSelector.click();
    const options = frame.locator('[role="option"]');
    await options
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
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

  public selectService = async (dashboardIndex: number): Promise<string> => {
    return this.selectVariableValue(dashboardIndex);
  };

  public selectNode = async (dashboardIndex: number): Promise<string> => {
    return this.selectVariableValue(dashboardIndex);
  };
}
