import BasePage from '../base.page';
import pmmTest from '../../fixtures/pmmTest';

export default class AdvancedSettingsPage extends BasePage {
  url = 'pmm-ui/graph/settings/advanced-settings';
  haQanErrorMessage = "Enabling QAN on PMM's own database is not supported in HA mode.";
  // TODO: Remove Grafana iframe-based locators once the settings page is rebuilt.
  builders = {
    enableToggleByName: (name: string) =>
      this.grafanaIframe().locator(`input[role="switch"][name="${name}"] + label`),
    inputByTestId: (testId: string) => this.grafanaIframe().getByTestId(testId),
  };
  buttons = {
    applyChanges: this.grafanaIframe().getByTestId('advanced-button'),
    getPublicAddressFromBrowser: this.grafanaIframe().getByTestId('public-address-button'),
    toggles: {
      accessControl: { locator: this.builders.enableToggleByName('accessControl') },
      advisors: { locator: this.builders.enableToggleByName('stt') },
      backupManagement: { locator: this.builders.enableToggleByName('backup') },
      checkForUpdates: { locator: this.builders.enableToggleByName('updates') },
      microsoftAzureMonitoring: { locator: this.builders.enableToggleByName('azureDiscover') },
      perconaAlerting: { locator: this.builders.enableToggleByName('alerting') },
      qanForPmmServer: { locator: this.builders.enableToggleByName('enableInternalPgQan') },
      telemetry: { locator: this.builders.enableToggleByName('telemetry') },
    },
  };
  elements = {
    pageTitle: this.grafanaIframe().getByRole('heading', { name: 'Advanced Settings' }),
  };
  inputs = {
    dataRetention: this.builders.inputByTestId('retention-number-input'),
    frequentInterval: this.builders.inputByTestId('frequentInterval-number-input'),
    publicAddress: this.builders.inputByTestId('publicAddress-text-input'),
    rareInterval: this.builders.inputByTestId('rareInterval-number-input'),
    standardInterval: this.builders.inputByTestId('standardInterval-number-input'),
  };
  messages = {};

  enableToggleAndApplyChanges = async (toggleName: keyof typeof this.buttons.toggles): Promise<void> =>
    await pmmTest.step(`Enable ${toggleName} and apply changes`, async () => {
      await this.buttons.toggles[toggleName].locator.click();
      await this.buttons.applyChanges.click();
    });
}
