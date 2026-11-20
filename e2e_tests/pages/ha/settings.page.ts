import BasePage from '../base.page';
import pmmTest from '../../fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';
import { Response } from '@playwright/test';

export type SettingsFieldLabel = 'advanced' | 'advanced-telemetry' | 'metrics-resolution' | 'public-address';
export type AdvisorSeverity = 'critical' | 'error' | 'info' | 'warning';

export default class SettingsPage extends BasePage {
  url = '/pmm-ui/settings';
  urls = {
    advanced: '/pmm-ui/settings/advanced-settings',
    advisors: '/pmm-ui/settings/advisors',
    metrics: '/pmm-ui/settings/metrics-resolution',
    ssh: '/pmm-ui/settings/ssh-key',
  };
  haDataRetentionErrorMessage =
    'Data retention cannot be changed at runtime when high availability is enabled. ' +
    "Set it with the pmm-ha chart's dataRetentionDays value (rendered as PMM_DATA_RETENTION) and apply it with helm upgrade.";
  haDataRetentionHelperText =
    "Fixed by your high availability deployment. Change it with the chart's dataRetentionDays value and run helm upgrade.";
  haQanErrorMessage = "Enabling QAN on PMM's own database is not supported in HA mode.";
  tabs = {
    advanced: this.page.getByTestId('settings-tab-advanced'),
    advisors: this.page.getByTestId('settings-tab-advisors'),
    metrics: this.page.getByTestId('settings-tab-metrics'),
    ssh: this.page.getByTestId('settings-tab-ssh'),
  };
  builders = {
    advisorRecipientInvalid: (address: string) =>
      this.elements.advisorSettings.getByText(`Not a valid address: ${address}`),
    advisorSeverity: (severity: AdvisorSeverity) =>
      this.page.getByTestId(`advisorSeverities-${severity}-checkbox-input`),
    advisorTestEmailSent: (recipients: string) => this.alertWithText(`Test email sent to ${recipients}`),
    fieldDescription: (label: SettingsFieldLabel) => this.page.getByTestId(`${label}-label-description`),
    fieldReadMoreLink: (label: SettingsFieldLabel) => this.builders.fieldDescription(label).getByRole('link'),
  };
  buttons = {
    applyAdvancedChanges: this.page.getByTestId('advanced-button'),
    applyAdvisorsChanges: this.page.getByTestId('advisors-button'),
    applyMetricsChanges: this.page.getByTestId('metrics-resolution-button'),
    applySshKeyChanges: this.page.getByTestId('ssh-key-button'),
    getPublicAddressFromBrowser: this.page.getByTestId('public-address-button'),
    metricsResolutionCustom: this.page.getByTestId('radio-option-custom'),
    metricsResolutionFrequent: this.page.getByTestId('radio-option-frequent'),
    metricsResolutionRare: this.page.getByTestId('radio-option-rare'),
    metricsResolutionStandard: this.page.getByTestId('radio-option-standard'),
    sendAdvisorTestEmail: this.page.getByTestId('advisor-test-email-button'),
    telemetrySummaries: this.page.getByTestId('telemetry-summaries-link'),
    toggles: {
      accessControl: { locator: this.page.getByTestId('switch-input-access-control') },
      advisorNotifications: {
        input: this.page.getByTestId('switch-input-advisor-notifications').getByRole('switch'),
        locator: this.page.getByTestId('switch-input-advisor-notifications'),
      },
      advisors: {
        input: this.page.getByTestId('switch-input-stt').getByRole('switch'),
        locator: this.page.getByTestId('switch-input-stt'),
      },
      azureDiscover: {
        input: this.page.getByTestId('switch-input-azure-discover').getByRole('switch'),
        locator: this.page.getByTestId('switch-input-azure-discover'),
      },
      backupManagement: {
        input: this.page.getByTestId('switch-input-backup').getByRole('switch'),
        locator: this.page.getByTestId('switch-input-backup'),
      },
      checkForUpdates: { locator: this.page.getByTestId('switch-input-updates') },
      perconaAlerting: {
        input: this.page.getByTestId('switch-input-alerting').getByRole('switch'),
        locator: this.page.getByTestId('switch-input-alerting'),
      },
      qanForPmmServer: { locator: this.page.getByTestId('switch-input-enable-internal-pg-qan') },
      telemetry: {
        input: this.page.getByTestId('switch-input-telemetry').getByRole('switch'),
        locator: this.page.getByTestId('switch-input-telemetry'),
      },
    },
  };
  elements = {
    advancedLabel: this.page.getByTestId('advanced-label'),
    advisorNotificationsLabel: this.page.getByTestId('advisor-notifications-label'),
    advisorRetentionLabel: this.page.getByTestId('advisor-retention-label'),
    advisorSchedulerLink: this.page.getByTestId('advisor-schedules-override').getByRole('link'),
    advisorSettings: this.page.getByTestId('advisors-settings'),
    advisorsLabel: this.page.getByTestId('advisors-label'),
    alertingInfoIcon: this.page.getByTestId('advanced-alerting').getByTestId('info-icon'),
    checkForUpdatesLabel: this.page.getByTestId('advanced-updates'),
    errorAlert: this.page.getByTestId('data-testid Alert error'),
    infoTooltip: this.page.getByTestId('info-tooltip'),
    infoTooltipLink: this.page.getByTestId('info-tooltip').getByRole('link'),
    metricsResolutionLabel: this.page.getByTestId('metrics-resolution-label'),
    //review this selector - seems redundant
    pageBody: this.page.locator('body'),
    pageTitle: this.page.getByRole('heading', { name: 'Settings' }),
    publicAddressLabel: this.page.getByTestId('public-address-label'),
    sshKeyLabel: this.page.getByTestId('ssh-key-label'),
    tabContent: this.page.getByTestId('settings-tab-content'),
    telemetryLabel: this.page.getByTestId('advanced-telemetry'),
    telemetrySummariesContent: this.page.getByTestId('telemetry-summaries-dialog'),
    unauthorized: this.page.getByTestId('unauthorized'),
  };
  inputs = {
    advisorRecipients: this.page.getByTestId('advisorNotificationEmails-text-input'),
    advisorRetention: this.page.getByTestId('advisorRetention-number-input'),
    dataRetention: this.page.getByTestId('retention-number-input'),
    high: this.page.getByTestId('hr-number-input'),
    low: this.page.getByTestId('lr-number-input'),
    medium: this.page.getByTestId('mr-number-input'),
    publicAddress: this.page.getByTestId('publicAddress-text-input'),
    sshKey: this.page.getByTestId('text-input-ssh-key'),
  };
  messages = {
    advisorRecipientsMax: this.elements.advisorSettings.getByText('Enter up to 20 recipients'),
    advisorRecipientsRequired: this.elements.advisorSettings.getByText(
      'Add at least one recipient, or turn Advisor notifications off',
    ),
    advisorSeveritiesRequired: this.elements.advisorSettings.getByText(
      'Select at least one severity, or turn Advisor notifications off',
    ),
    popUp: this.page.getByRole('status').or(this.page.getByRole('alert')),
    settingsUpdated: this.alertWithText('Settings updated'),
  };

  applyAdvancedChanges = async (): Promise<Response> => {
    const saved = this.page.waitForResponse(
      (response) =>
        response.url().includes(apiEndpoints.server.settings) && response.request().method() === 'PUT',
      { timeout: Timeouts.THIRTY_SECONDS },
    );

    await this.buttons.applyAdvancedChanges.click();

    return await saved;
  };

  enableToggleAndApplyChanges = async (toggleName: keyof typeof this.buttons.toggles): Promise<void> =>
    await pmmTest.step(`Enable ${toggleName} and apply changes`, async () => {
      await this.page.goto(this.urls.advanced);
      await this.buttons.toggles[toggleName].locator.click();
      await this.buttons.applyAdvancedChanges.click();
    });

  waitForPageLoaded = async (): Promise<void> =>
    await this.elements.tabContent.waitFor({ state: 'visible', timeout: Timeouts.THIRTY_SECONDS });
}
