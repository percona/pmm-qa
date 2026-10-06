import BasePage from '../base.page';
import pmmTest from '../../fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';

export type SettingsFieldLabel = 'advanced' | 'advanced-telemetry' | 'metrics-resolution' | 'public-address';

export default class SettingsPage extends BasePage {
  url = '/pmm-ui/settings';
  urls = {
    advanced: '/pmm-ui/settings/advanced-settings',
    metrics: '/pmm-ui/settings/metrics-resolution',
    ssh: '/pmm-ui/settings/ssh-key',
  };
  haQanErrorMessage = "Enabling QAN on PMM's own database is not supported in HA mode.";
  tabs = {
    advanced: this.page.getByTestId('settings-tab-advanced'),
    metrics: this.page.getByTestId('settings-tab-metrics'),
    ssh: this.page.getByTestId('settings-tab-ssh'),
  };
  builders = {
    fieldDescription: (label: SettingsFieldLabel) => this.page.getByTestId(`${label}-label-description`),
    fieldReadMoreLink: (label: SettingsFieldLabel) => this.builders.fieldDescription(label).getByRole('link'),
  };
  buttons = {
    applyAdvancedChanges: this.page.getByTestId('advanced-button'),
    applyMetricsChanges: this.page.getByTestId('metrics-resolution-button'),
    applySshKeyChanges: this.page.getByTestId('ssh-key-button'),
    getPublicAddressFromBrowser: this.page.getByTestId('public-address-button'),
    metricsResolutionCustom: this.page.getByTestId('radio-option-custom'),
    metricsResolutionFrequent: this.page.getByTestId('radio-option-frequent'),
    metricsResolutionRare: this.page.getByTestId('radio-option-rare'),
    metricsResolutionStandard: this.page.getByTestId('radio-option-standard'),
    telemetrySummaries: this.page.getByTestId('telemetry-summaries-link'),
    toggles: {
      accessControl: { locator: this.page.getByTestId('switch-input-access-control') },
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
      telemetry: { locator: this.page.getByTestId('switch-input-telemetry') },
    },
  };
  elements = {
    advancedLabel: this.page.getByTestId('advanced-label'),
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
  };
  inputs = {
    dataRetention: this.page.getByTestId('retention-number-input'),
    high: this.page.getByTestId('hr-number-input'),
    low: this.page.getByTestId('lr-number-input'),
    medium: this.page.getByTestId('mr-number-input'),
    publicAddress: this.page.getByTestId('publicAddress-text-input'),
    sshKey: this.page.getByTestId('text-input-ssh-key'),
  };
  messages = {
    popUp: this.page.getByRole('status').or(this.page.getByRole('alert')),
  };

  applyAdvancedChanges = async (): Promise<void> => {
    const saved = this.page.waitForResponse(
      (response) =>
        response.url().includes(apiEndpoints.server.settings) && response.request().method() === 'PUT',
      { timeout: Timeouts.THIRTY_SECONDS },
    );

    await this.buttons.applyAdvancedChanges.click();
    await saved;
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
