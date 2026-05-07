const Helper = codecept_helper;
const assert = require('assert');
const fs = require('fs');
const shell = require('shelljs');
const config = require('../../pr.codecept');
const { locateOption } = require('./locatorHelper');

class Grafana extends Helper {
  constructor(config) {
    super(config);
    this.resultFilesFolder = `${global.output_dir}/`;
    this.signInWithSSOButton = '//a[contains(@href,"login/generic_oauth")]';
    this.ssoLoginUsername = '//input[@id="idp-discovery-username"]';
    this.ssoLoginNext = '//input[@id="idp-discovery-submit"]';
    this.ssoLoginPassword = '//input[@id="okta-signin-password"]';
    this.ssoLoginSubmit = '//input[@id="okta-signin-submit"]';
    this.mainView = '//main[contains(@class, "main-view")]';
  }

  async loginWithSSO(username, password) {
    const { page } = this.helpers.Playwright;

    await page.isVisible(this.mainView);
    await page.click(this.signInWithSSOButton);
    await page.fill(this.ssoLoginUsername, username);
    await page.click(this.ssoLoginNext);
    await page.click(this.ssoLoginPassword);
    await page.fill(this.ssoLoginPassword, password);
    await page.click(this.ssoLoginSubmit);
  }

  async Authorize(username = 'admin', password = process.env.ADMIN_PASSWORD, baseUrl = '') {
    const { Playwright, REST } = this.helpers;
    const basicAuthEncoded = await this.getAuth(username, password);

    Playwright.setPlaywrightRequestHeaders({ Authorization: `Basic ${basicAuthEncoded}` });
    let resp;

    try {
      resp = await REST.sendPostRequest(`${baseUrl}graph/login`, { user: username, password });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Login API call was not successful.');

      return;
    }

    const cookies = resp.headers['set-cookie'];

    if (!cookies) {
      // eslint-disable-next-line no-console
      console.warn('Authentication was not successful, verify base url and credentials.');

      return;
    }

    cookies.forEach((cookie) => {
      const urlToParse = baseUrl || config.config.helpers.Playwright.url;
      const parsedCookie = {
        name: cookie.split('=')[0],
        value: cookie.split('=')[1].split(';')[0],
        domain: new URL(urlToParse).hostname,
        path: '/',
      };

      Playwright.setCookie(parsedCookie);
    });
  }

  async enableProductTour(snooze = false) {
    const { Playwright } = this.helpers;

    await Playwright.page.route('**/v1/users/me', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            user_id: 1,
            product_tour_completed: false,
            alerting_tour_completed: false,
            snoozed_pmm_version: snooze ? '3.2.0' : '',
          }),
        });
      } else {
        await route.continue();
      }
    });
  }

  async stopMockingProductTourApi() {
    const { Playwright } = this.helpers;

    await Playwright.page.unroute('**/v1/users/me');
  }

  async stopMockingUpgrade() {
    const { Playwright } = this.helpers;

    await Playwright.page.unroute('**/v1/server/updates?force=**');
  }

  async unAuthorize() {
    const { Playwright } = this.helpers;
    const { browserContext } = Playwright;

    await browserContext.clearCookies();
    Playwright.setPlaywrightRequestHeaders({});
  }

  async getBrowserCookies() {
    const { Playwright } = this.helpers;
    const { browserContext } = Playwright;

    return await browserContext.cookies();
  }

  async getBrowserGrafanaSessionCookies() {
    const { Playwright } = this.helpers;
    const { browserContext } = Playwright;

    const cookies = await browserContext.cookies();

    return await cookies.find((cookie) => cookie.name === 'grafana_session');
  }

  async getAuth(username = 'admin', password = process.env.ADMIN_PASSWORD) {
    return Buffer.from(`${this.config.username || username}:${this.config.password || password}`).toString(
      'base64',
    );
  }

  async readFile(path) {
    try {
      return fs.readFileSync(path, 'utf8');
    } catch (e) {
      assert.ok(false, `Could not read the file ${path}`);
    }

    return null;
  }

  /**
   * Mock Response of a Request from Server
   *
   * example Usage: await I.mockServer(endPoint, responseBody);
   *
   * @param requestToBeMocked       Request end point which needs to be routed and mocked.
   * @param responseBody            Response we want to Mock for the API call.
   * for example: Add Remote Instance, Access Inventory List
   * @returns {Promise<void>}
   */
  async mockServer(requestToBeMocked, responseBody) {
    const { browserContext } = this.helpers.Playwright;
    const existingPages = await browserContext.pages();
    const mainPage = existingPages[0];

    mainPage.route(requestToBeMocked, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          responseBody,
        ]),
      });
    });
  }

  /**
   * Wait for Request to be triggered from User Action
   *
   * example Usage: await I.waitForEndPointRequest(endPoint, element);
   *
   * @param endpoint       Endpoint which will be called on click of an element
   * @param element        Playwright to wait for the request
   * for example: Download Zip log request via Settings get diagnostics button
   * @returns {Promise<void>}
   */
  async waitForEndPointRequest(endpoint, element) {
    const { browserContext } = this.helpers.Playwright;
    const existingPages = await browserContext.pages();
    const mainPage = existingPages[0];

    const [request] = await Promise.all([
      // Waits for the next request with the specified url
      mainPage.waitForRequest(endpoint),
      // Triggers the request
      mainPage.click(element),
    ]);
  }

  async grabNumberOfTabs() {
    const { browserContext } = this.helpers.Playwright;
    const existingPages = await browserContext.pages();

    return existingPages.length;
  }

  async moveCursor(locator) {
    const { page } = this.helpers.Playwright;

    page.hover(locator);
  }

  async createUser(username, password) {
    const apiContext = this.helpers.REST;
    const body = {
      name: username,
      email: '',
      login: username,
      password,
    };
    const headers = { Authorization: `Basic ${await this.getAuth()}` };
    let resp;

    try {
      resp = await apiContext.sendPostRequest('graph/api/admin/users', body, headers);
    } catch (e) {
      throw Error(`Api call to create user failed with errors: ${e.errors}`);
    }

    return resp.data.id;
  }

  async setRole(userId, role = 'Viewer') {
    const apiContext = this.helpers.REST;
    const body = {
      role,
    };
    const headers = { Authorization: `Basic ${await this.getAuth()}` };

    await apiContext.sendPatchRequest(`graph/api/orgs/1/users/${userId}`, body, headers);
  }

  async deleteUser(userId) {
    const apiContext = this.helpers.REST;
    const headers = { Authorization: `Basic ${await this.getAuth()}` };

    await apiContext.sendDeleteRequest(`graph/api/admin/users/${userId}`, headers);
  }

  async listUsers() {
    const apiContext = this.helpers.REST;
    const headers = { Authorization: `Basic ${await this.getAuth()}` };
    const resp = await apiContext.sendGetRequest('graph/api/users/search', headers);

    return resp.data;
  }

  async listOrgUsers() {
    const apiContext = this.helpers.REST;
    const headers = { Authorization: `Basic ${await this.getAuth()}` };
    const resp = await apiContext.sendGetRequest('graph/api/org/users', headers);

    return resp.data;
  }

  async verifyCommand(command, output = null, result = 'pass', returnErrorPipe = false) {
    const { stdout, stderr, code } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: true });

    if (output && result === 'pass') {
      assert.ok(stdout.includes(output), `The "${command}" output expected to include "${output}" but found "${stdout}"`);
    }

    if (result === 'pass') {
      assert.ok(code === 0, `The "${command}" command was expected to run without any errors, but the error found: "${stderr || stdout}"`);
    } else {
      assert.ok(code !== 0, `The "${command}" command was expected to exit with error code, but exited with success code: "${code}"`);
    }

    if (returnErrorPipe) return stderr.trim();

    return stdout.trim();
  }

  async clickIfVisible(element, timeout = 30) {
    const { Playwright } = this.helpers;

    for (let i = 0; i < timeout; i++) {
      const numVisible = await Playwright.grabNumberOfVisibleElements(element);

      if (numVisible) {
        await Playwright.click(element);

        return element;
      }

      await Playwright.wait(1);
    }

    return element;
  }

  async selectGrafanaDropdownOption(dropdownName, optionText) {
    const { Playwright } = this.helpers;
    const context = Playwright.context || Playwright.page;
    const dropdownLocator = `//label[text()="${dropdownName}"]/ancestor::*[(self::span) or (self::div and @data-testid="data-testid template variable")]//*[contains(@data-testid, "-input")]`;

    await context.locator(dropdownLocator).first().waitFor({ state: 'attached', timeout: 5000 });
    await context.locator(dropdownLocator).first().click();
    await Playwright.wait(0.5);

    const optionLocator = context.locator('div[role="option"]  span');

    for (let i = 0; i < await optionLocator.count(); i++) {
      if ((await optionLocator.nth(i).textContent()) === optionText) {
        await optionLocator.nth(i).click();
      }
    }

    await context.locator('body').press('Escape');
  }

  async isElementDisplayed(locator, timeoutInSeconds = 60) {
    const { Playwright } = this.helpers;
    const context = Playwright.context || Playwright.page;
    const elementLocator = context.locator(locate(locator).toXPath());

    for (let i = 0; i < timeoutInSeconds; i++) {
      await Playwright.wait(1);

      if (await elementLocator.first().isVisible()) {
        return true;
      }
    }

    return false;
  }
}

module.exports = Grafana;
