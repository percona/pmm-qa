const { I } = inject();

module.exports = {
  serviceName: '//label[@data-testid="data-testid Dashboard template variables submenu Label Service Name"]//following-sibling::*',
  serviceNameDropdownSelect: async (databaseName) => `//div[contains(@data-testid, "data-testid Dashboard template variables Variable Value DropDown option text ${databaseName}")]`,

  async getServiceName() {
    await I.waitForVisible(this.serviceName, 30);

    return I.grabTextFrom(this.serviceName);
  },

  async selectServiceName(expectedName) {
    if ((await this.getServiceName()) !== expectedName) {
      await I.click(this.serviceName);
      await I.click(await this.serviceNameDropdownSelect(expectedName));
    } else {
      await I.say(`Service ${expectedName} already selected.`);
    }
  },
};
