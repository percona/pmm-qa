const { I } = inject();

module.exports = {
  url: 'graph/add-instance',
  addMySQLRemoteURL: 'graph/add-instance?instance_type=mysql',
  fields: {
    breadcrumbs: locate('.page-toolbar').withText('Inventory / Add service / Step 1 of 2'),
    addAmazonRDSbtn: '$rds-instance',
  },

  async open() {
    I.amOnPage(this.url);
    I.waitForElement(this.fields.breadcrumbs, 60);
  },
};
