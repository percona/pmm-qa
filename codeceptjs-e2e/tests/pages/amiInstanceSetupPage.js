const { I } = inject();

module.exports = {
  // insert your locators and methods here
  // setting locators
  url: '/setup',
  fields: {
    instanceId: '//input[@placeholder="Instance ID"]',
    docLink: '//a[text()="Where can I get my instance ID?"]',
  },
  submitButton: 'Submit',
  docLinkUrl: 'https://www.percona.com/doc/percona-monitoring-and-management/2.x/setting-up/server/aws.html#running-the-instance',

  // introducing methods
  async verifyInstanceID(instanceID) {
    I.waitForElement(this.fields.instanceId, 60);
    I.fillField(this.fields.instanceId, instanceID);
    I.click(this.submitButton);
    I.wait(10);
    // I.waitForElement(loginPage.fields.username, 60);
  },
};
