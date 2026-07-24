const Helper = codecept_helper;

class BrowserHelper extends Helper {
  async getTabs() {
    const { Playwright } = this.helpers;
    const { browserContext } = Playwright;

    return await browserContext.pages();
  }

  async openNewTabs(numberOfTabs) {
    const { Playwright } = this.helpers;
    const { browserContext } = Playwright;
    const tabs = [];

    for (let i = 0; i < numberOfTabs; i++) {
      const newTab = await browserContext.newPage();

      tabs.push(newTab);
    }

    return tabs;
  }

  async navigateTabTo(tab, address) {
    if (!address.includes('http')) {
      tab.goto(process.env.PMM_UI_URL + address);
    } else {
      tab.goto(address);
    }
  }

  async downloadFile(clickElementXpath) {
    const { page } = this.helpers.Playwright;

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click(clickElementXpath.value),
    ]);

    return await download.path();
  }

  async getClipboardText() {
    const { Playwright } = this.helpers;
    const { browserContext, page } = Playwright;

    await browserContext.grantPermissions(['clipboard-read']);

    return await page.evaluate(() => navigator.clipboard.readText());
  }

  async goBack() {
    const { page } = this.helpers.Playwright;

    await page.goBack();
  }
}

module.exports = BrowserHelper;
