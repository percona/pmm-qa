const { I } = inject();

module.exports = {
  url: 'graph/pmm-dump',
  fields: {
    status: (uid) => locate('td').withDescendant(locate('label').withAttr({ for: `input-table-select-${uid}-id` })),
    downloadButton: locate('span').withText('Download'),
    deleteButton: locate('span').withText('Delete'),
    sendSupportButton: locate('span').withText('Send to Support'),
    sendSupportDialog: locate('h2').withText('Send to Support'),
    kebabMenu: (uid) => `//label[@for='input-table-select-${uid}-id']//ancestor::tr//button[@data-testid="dropdown-menu-toggle"]`,
    viewLogs: locate('span').withText('View logs'),
    log: (uid) => locate('div').withText(`Logs for ${uid}`),
    showServiceDetails: (uid) => `//label[@for='input-table-select-${uid}-id']//ancestor::tr//button[@data-testid="show-row-details"]`,
    addressField: locate('input').withAttr({ id: 'address' }),
    nameField: locate('input').withAttr({ id: 'name' }),
    passwordField: locate('input').withAttr({ id: 'password' }),
    directoryField: locate('input').withAttr({ id: 'directory' }),
    saveAndExit: locate('button').withAttr({ type: 'submit' }),
    sftpMessage: 'The message was send successfully!',
  },

  /**
   * User action to authenticate to PMM Server.
   * **should be used inside async with `await`**
   *
   * @param uid
   */
  verifyDumpVisible(uid) {
    I.seeElement(this.fields.status(uid));
  },

  verifyDownloadEnabled() {
    I.seeElement(this.fields.downloadButton);
  },

  verifyDeleteEnabled() {
    I.seeElement(this.fields.deleteButton);
  },

  verifySFTPEnabled() {
    I.seeElement(this.fields.sendSupportButton);
  },

  verifySFTP(sftp) {
    const {
      address, username, password, directory,
    } = sftp;

    I.seeElement(this.fields.sendSupportDialog);
    I.fillField(this.fields.addressField, address);
    I.fillField(this.fields.nameField, username);
    I.fillField(this.fields.passwordField, password);
    I.fillField(this.fields.directoryField, directory);
    I.click(this.fields.saveAndExit);
    I.waitForText(this.fields.sftpMessage, 60);
  },

  verifyLogsVisible(uid) {
    I.seeElement(this.fields.kebabMenu(uid));
    I.click(this.fields.kebabMenu(uid));
    I.seeElement(this.fields.viewLogs);
    I.click(this.fields.viewLogs);
    I.seeElement(this.fields.log(uid));
  },

  async verifyService(uid) {
    await I.waitForVisible(this.fields.showServiceDetails(uid), 10);
    I.click(this.fields.showServiceDetails(uid));
  },
};
