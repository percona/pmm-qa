const { I } = inject();

module.exports = {
  url: 'graph/admin/settings',
  fields: {
    settingsTitle: '[class*="title-info-container"]',
    typeLabel: locate('tr').withChild(locate('td').withText('type')).find('td').at(2),
  },

  async open() {
    I.amOnPage(this.url);
    I.waitForElement(this.fields.settingsTitle, 60);
  },

  async verifyDatabaseType(expectedValue) {
    I.waitForElement(this.fields.typeLabel, 30);
    const actualValue = await I.grabTextFrom(this.fields.typeLabel);

    I.assertEqual(actualValue, expectedValue, `The 'database' type is expected to be '${expectedValue}'!`);
  },
};
