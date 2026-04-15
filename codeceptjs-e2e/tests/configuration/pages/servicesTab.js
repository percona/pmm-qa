const { I } = inject();
const paginationPart = require('./paginationFragment');

const getServiceRowLocator = (serviceName) => `//span[contains(text(), '${serviceName}')]//ancestor::tr`;

/**
 * All elements and methods for the PMM Inventory / Services Page
 */
module.exports = {
  url: 'graph/inventory/services',
  fields: {
    serviceRow: (serviceName) => getServiceRowLocator(serviceName),
    serviceCellMonitoring: (serviceName) => `${getServiceRowLocator(serviceName)}/td[5]`,
    serviceCellAddress: (serviceName) => `${getServiceRowLocator(serviceName)}/td[6]`,
    inventoryTable: locate('table'),
  },
  buttons: {
    addService: locate('button').withText('Add Service'),
  },
  pagination: paginationPart,

  async open() {
    I.amOnPage(this.url);
    I.waitForVisible(this.buttons.addService, 30);
  },

  async getServiceMonitoringStatus(serviceName) {
    I.waitForVisible(this.fields.serviceRow(serviceName), 60);

    return (await I.grabTextFrom(this.fields.serviceCellMonitoring(serviceName))).trim();
  },

  async getServiceMonitoringAddress(serviceName) {
    I.waitForVisible(this.fields.serviceRow(serviceName), 60);

    return (await I.grabTextFrom(this.fields.serviceCellAddress(serviceName))).trim();
  },
};
