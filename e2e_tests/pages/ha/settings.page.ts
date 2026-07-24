import BasePage from '../base.page';
import pmmTest from '../../fixtures/pmmTest';

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
  builders = {};
  buttons = {
    applyAdvancedChanges: this.page.getByTestId('advanced-button'),
    applyMetricsChanges: this.page.getByTestId('metrics-resolution-button'),
    applySshKeyChanges: this.page.getByTestId('ssh-key-button'),
    getPublicAddressFromBrowser: this.page.getByRole('button', { name: 'Get from browser' }),
    metricsResolutionCustom: this.page.getByTestId('radio-option-custom'),
    metricsResolutionFrequent: this.page.getByTestId('radio-option-frequent'),
    metricsResolutionRare: this.page.getByTestId('radio-option-rare'),
    metricsResolutionStandard: this.page.getByTestId('radio-option-standard'),
    toggles: {
      accessControl: { locator: this.page.getByTestId('switch-input-access-control') },
      advisors: { locator: this.page.getByTestId('switch-input-stt') },
      azureDiscover: { locator: this.page.getByTestId('switch-input-azure-discover') },
      backupManagement: { locator: this.page.getByTestId('switch-input-backup') },
      checkForUpdates: { locator: this.page.getByTestId('switch-input-updates') },
      perconaAlerting: { locator: this.page.getByTestId('switch-input-alerting') },
      qanForPmmServer: { locator: this.page.getByTestId('switch-input-enable-internal-pg-qan') },
      telemetry: { locator: this.page.getByTestId('switch-input-telemetry') },
    },
  };
  elements = {
    //review this selector - seems redundant
    pageBody: this.page.locator('body'),
    pageTitle: this.page.getByRole('heading', { name: 'Settings' }),
  };
  inputs = {
    high: this.page.locator('[name="hr"]'),
    low: this.page.locator('[name="lr"]'),
    medium: this.page.locator('[name="mr"]'),
    publicAddress: this.page.getByTestId('text-input-public-address'),
    sshKey: this.page.getByTestId('text-input-ssh-key'),
  };
  messages = {};

  enableToggleAndApplyChanges = async (toggleName: keyof typeof this.buttons.toggles): Promise<void> =>
    await pmmTest.step(`Enable ${toggleName} and apply changes`, async () => {
      await this.page.goto(this.urls.advanced);
      await this.buttons.toggles[toggleName].locator.click();
      await this.buttons.applyAdvancedChanges.click();
    });
}
