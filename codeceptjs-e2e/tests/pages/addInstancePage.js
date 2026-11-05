const { I } = inject();

module.exports = {
  url: 'pmm-ui/add-instance',
  addMySQLRemoteURL: 'pmm-ui/add-instance/mysql',
  fields: {
    breadcrumbs: locate('h2').withText('Select service type'),
    addAmazonRDSbtn: '$rds-instance',
  },

  async open() {
    I.amOnPage(this.url);
    I.waitForElement(this.fields.breadcrumbs, 60);
  },
};
