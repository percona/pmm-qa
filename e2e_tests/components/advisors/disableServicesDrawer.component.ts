import BasePage from '@pages/base.page';

export default class DisableServicesDrawerComponent extends BasePage {
  builders = {
    disabledService: (serviceName: string) =>
      this.elements.disabledList
        .getByRole('listitem')
        .filter({ has: this.page.getByText(serviceName, { exact: true }) }),
    enableButton: (serviceId: string) => this.page.getByTestId(`disable-services-enable-${serviceId}`),
    serviceOption: (serviceId: string) => this.page.getByTestId(`service-option-${serviceId}`),
    title: (summary: string) =>
      this.elements.drawer.getByRole('heading', { exact: true, name: `Disable "${summary}" for services` }),
  };
  buttons = {
    close: this.page.getByTestId('disable-services-close'),
    disable: this.page.getByTestId('disable-services-submit'),
  };
  elements = {
    disabledList: this.page.getByTestId('disable-services-list'),
    drawer: this.page.getByTestId('disable-services-drawer'),
    globallyDisabledNotice: this.page.getByTestId('disable-services-globally-disabled'),
    noDisabledServices: this.page.getByTestId('disable-services-empty'),
  };
  inputs = {
    services: this.page.getByTestId('disable-services-picker').getByRole('combobox'),
  };
  messages = {};

  disableFor = async (serviceIds: string[]) => {
    await this.inputs.services.click();

    for (const serviceId of serviceIds) await this.builders.serviceOption(serviceId).click();

    await this.page.keyboard.press('Escape');
    await this.buttons.disable.click();
  };
}
