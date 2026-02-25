import { expect } from '@playwright/test';
import BasePage from '../base.page';

export default class RealTimeAnalyticsPage extends BasePage {
  readonly url = 'pmm-ui/rta/overview';
  builders = {
    operationIdForRow: (rowIndex: string) =>
      this.page.locator(`//tbody//tr[position()=${rowIndex}]//td[position()=3]`),
  };
  buttons = {
    checkRunningAgents: this.page.getByRole('button', { name: 'Check' }),
    closeDropdown: this.page.getByRole('button', { name: 'Close' }),
    pauseRealTimeAnalytics: this.page.getByTestId('overview-table-pause-button'),
    resumeRealTimeAnalytics: this.page.getByTestId('overview-table-resume-button'),
    startSession: this.page.getByTestId('start-realtime-session'),
  };
  elements = {
    documentationLink: this.page.getByRole('link', { name: 'Documentation' }),
    dropdownOptions: this.page.locator('//div[@role="presentation"]//li'),
    feedbackLink: this.page.getByRole('link', { name: 'Provide feedback' }),
    mongodbNotice: this.page.getByText('Currently available for MongoDB only. More databases coming soon.'),
    mongoDbQuery: this.page.locator('//*[@class="language-mongodb"]'),
    pageDescription: this.page.getByText(
      'Select a service to monitor queries and performance metrics in real time.',
    ),
    pageTitle: this.page.getByText('Real-Time Query Analytics', { exact: true }),
    realTimeTab: this.page.getByTestId('qan-header-tabs-real-time-tab'),
    runningAgentsBanner: this.page.locator('//div[contains(text(), "agents running")]'),
    storedMetricsTab: this.page.getByTestId('qan-header-tabs-historical-tab'),
  };
  inputs = {
    clusterServiceDropdown: this.page.getByTestId('realtime-service-input'),
    clusterServiceSearch: this.page.getByTestId('realtime-service-input').locator('input'),
  };
  messages = {};

  getOperationIdFromRow = async (row: string) =>
    (await this.builders.operationIdForRow(row).first().textContent()) || '';

  getUrlWithServices = (services: string[]) => {
    let parsedUrl = this.url;

    for (let i = 0; i < services.length; i++) {
      if (i === 0) {
        parsedUrl += `?serviceIds=${services[i]}`;
      } else {
        parsedUrl += `&serviceIds=${services[i]}`;
      }
    }

    return parsedUrl;
  };

  navigateToRealTimeTab = async () => {
    await this.elements.realTimeTab.click();
    await this.waitForSelectionPageLoaded();
  };

  pauseRTA = async () => {
    await this.buttons.pauseRealTimeAnalytics.click();
  };

  resumeRTA = async () => {
    await this.buttons.resumeRealTimeAnalytics.click();
  };

  searchService = async (serviceName: string) => {
    await this.inputs.clusterServiceDropdown.click();
    await this.inputs.clusterServiceSearch.fill(serviceName);
  };

  selectFirstService = async () => {
    await this.inputs.clusterServiceDropdown.click();
    await expect(this.elements.dropdownOptions.first()).toBeVisible();
    await this.elements.dropdownOptions.first().click();
    await this.buttons.closeDropdown.click();
  };

  selectService = async (serviceName: string) => {
    await this.inputs.clusterServiceDropdown.click();
    await expect(this.elements.dropdownOptions.first()).toBeVisible();
    await this.elements.dropdownOptions.filter({ hasText: serviceName }).click();
    await this.buttons.closeDropdown.click();
  };

  startRealTimeSession = async () => {
    await expect(this.buttons.startSession).toBeEnabled();
    await this.buttons.startSession.click();
  };

  verifyDropdownOptions = async (expectedOptions: string[]) => {
    const dropdownTexts = await this.elements.dropdownOptions.allTextContents();

    for (const option of expectedOptions) {
      expect(dropdownTexts).toContain(option);
    }
  };

  verifyOperationIdChanged = async (operationId: string) => {
    await expect(
      this.builders.operationIdForRow('1').first(),
      'Operation ID of the newest query should change when RTA is resumed',
    ).not.toHaveText(operationId);
  };

  verifyOperationIdIsSame = async (operationId: string) => {
    await expect(
      this.builders.operationIdForRow('1').first(),
      'Operation ID of the newest query should not change when RTA is paused',
    ).toHaveText(operationId);
  };

  verifyRedirectToOverview = async (serviceId: string) => {
    await expect(this.page).toHaveURL(/.*rta\/overview.*/);
    await expect(this.page).toHaveURL(new RegExp(`serviceIds=${serviceId}`));
  };

  verifySelectionPageUI = async () => {
    await expect(this.elements.pageTitle).toBeVisible();
    await expect(this.elements.pageDescription).toBeVisible();
    await expect(this.elements.mongodbNotice).toBeVisible();
    await expect(this.elements.documentationLink).toBeVisible();
    await expect(this.elements.feedbackLink).toBeVisible();
    await expect(this.elements.realTimeTab).toBeVisible();
    await expect(this.elements.storedMetricsTab).toBeVisible();
  };

  verifySingleDropdownOption = async (expectedOption: string) => {
    await expect(this.elements.dropdownOptions).toHaveCount(1);
    await expect(this.elements.dropdownOptions.first()).toHaveText(expectedOption);
  };

  verifyStartButtonDisabled = async () => {
    await expect(this.buttons.startSession).toBeDisabled();
  };

  verifyStartButtonEnabled = async () => {
    await expect(this.buttons.startSession).toBeEnabled();
  };

  waitForSelectionPageLoaded = async () => {
    await expect(this.elements.pageTitle).toBeVisible();
    await expect(this.elements.pageDescription).toBeVisible();
  };
}
