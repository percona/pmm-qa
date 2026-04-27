const { locateOption } = require('../../helper/locatorHelper');

const { I } = inject();

const scheduleCell = (name) => `//tr[td[contains(text(), "${name}")]]`;

module.exports = {
  url: 'graph/backup/scheduled',
  elements: {
    noData: '$table-no-data',
    modalHeader: 'h1',
    modalContent: '$modal-content',
    dropdownOption: (text) => locateOption(text),
    selectedLocation: '//label[@data-testid="location-field-label"]/parent::div/following-sibling::div[1]//div[contains(@class, "-singleValue")]',
    selectedService: locate('div[class*="-singleValue"]').inside(locate('span').withChild('$service-select-label')),
    retentionValidation: '$retention-field-error-message',
    scheduleName: (name) => locate('//td[1]').inside(scheduleCell(name)),
    scheduleVendorByName: (name) => locate('//td[2]').inside(scheduleCell(name)),
    frequencyByName: (name) => locate('//td[3]').inside(scheduleCell(name)),
    retentionByName: (name) => locate('//td[4]').inside(scheduleCell(name)),
    scheduleTypeByName: (name) => locate('//td[5]').inside(scheduleCell(name)),
    scheduleLocationByName: (name) => locate('//td[6]').inside(scheduleCell(name)),
    toggleByName: (name) => locate('$toggle-scheduled-backpup').inside(scheduleCell(name)),
    lastBackupByName: (name) => locate('$detailed-date').inside(scheduleCell(name)),
    scheduleBlockInModal: '$advanced-backup-fields',
    detailedInfoRow: {
      backupName: locate('$scheduled-backup-details-name').find('span').at(2),
      description: 'pre',
      dataModel: locate('$scheduled-backup-details-data-model').find('span').at(2),
      cronExpression: locate('$scheduled-backup-details-cron').find('span').at(2),
    },
    advancedSettingsSection: '$add-backup-advanced-settings',
  },
  buttons: {
    openAddScheduleModal: '$scheduled-backup-add-button',
    createSchedule: '$backup-add-button',
    actionsMenuByName: (name) => locate('$dropdown-menu-toggle').inside(scheduleCell(name)),
    editByName: (name) => locate('$edit-scheduled-backpup-button').inside(scheduleCell(name)),
    deleteByName: (name) => locate('$delete-scheduled-backpup-button').inside(scheduleCell(name)),
    copyByName: (name) => locate('$copy-scheduled-backup-button').inside(scheduleCell(name)),
    enableDisableByName: (name) => locate('label').after('$toggle-scheduled-backpup').inside(scheduleCell(name)),
    backupOnDemand: locate('button').withText('On Demand'),
    backupTypeSwitch: (type) => locate('label').after('$mode-radio-button').withText(type),
    showDetails: (name) => locate('$show-row-details').inside(scheduleCell(name)),
    hideDetails: (name) => locate('$hide-row-details').inside(scheduleCell(name)),
    confirmDelete: '$confirm-delete-modal-button',
    cancelDelete: '$cancel-delete-modal-button',
  },
  fields: {
    backupName: '$backupName-text-input',
    vendor: '$vendor-text-input',
    description: '$description-textarea-input',
    serviceNameDropdown: locate('div[class$="-select-value-container"]').inside(locate('span').withChild('$service-select-label')),
    locationDropdown: '//label[@data-testid="location-field-label"]/parent::div/following-sibling::div[1]//div[contains(@class, "-select-value-container")]',
    everyDropdown: '//label[@data-testid="period-field-label"]/parent::div/following-sibling::div[1]//div[contains(@class, "-select-value-container")]',
    retention: '$retention-number-input',
    folder: '$folder-text-input',
    schedule: {
      scheduledTime: '//div[div[label[@data-testid="period-field-label"]]]//div[contains(@class, "select")]/div[1]',
      months: '//div[div[label[@data-testid="month-field-label"]]]//div[contains(@class, "select")]/div[1]',
      days: '//div[div[label[@data-testid="day-field-label"]]]//div[contains(@class, "select")]/div[1]',
      weekdays: '//div[div[label[@data-testid="weekDay-field-label"]]]//div[contains(@class, "select")]/div[1]',
    },
  },
  messages: {
    modalHeaderText: 'Create Scheduled backup',
    requiredField: 'Required field',
    outOfRetentionRange: 'Value should be in the range from 0 to 99',
    backupScheduled: 'Backup successfully scheduled',
    confirmDelete: (name) => `Are you sure you want to delete the scheduled backup "${name}"?`,
    successfullyDeleted: (name) => `Scheduled backup "${name}" successfully deleted.`,
    scheduleInModalLabel: 'UTC time',
    mustBeMemberOfCluster: (name) => `Service ${name} must be a member of a cluster`,
    clusterHasPitrNoMoreAllowed: (cluster) => `A PITR backup for the cluster '${cluster}' can be enabled only if there are no other scheduled backups for this cluster.`,
    snapshotNotAllowedWhenClusterHasPitr: (cluster) => `A snapshot backup for cluster '${cluster}' can be performed only if there is no enabled PITR backup for this cluster.`,
  },
  locationType: {},

  openScheduledBackupsPage() {
    I.amOnPage(this.url);
    I.waitForText('Create scheduled backup', 30, this.buttons.openAddScheduleModal);
  },

  openScheduleBackupModal() {
    I.click(this.buttons.openAddScheduleModal);
    I.waitForVisible(this.elements.modalHeader, 20);
    I.seeTextEquals(this.messages.modalHeaderText, this.elements.modalHeader);
  },

  selectDropdownOption(dropdownLocator, text) {
    I.waitForVisible(dropdownLocator, 10);
    I.click(dropdownLocator);
    I.waitForVisible(this.elements.dropdownOption(text), 30);
    I.click(this.elements.dropdownOption(text));
    I.dontSeeElement(this.elements.dropdownOption(text));
  },

  clearRetentionField() {
    // clearField method doesn't work for this field
    I.usePlaywrightTo('clear field', async ({ page }) => {
      await page.locator(I.useDataQA('retention-number-input')).fill('');
    });
  },

  copySchedule(name) {
    I.waitForVisible(this.buttons.actionsMenuByName(name), 10);
    I.click(this.buttons.actionsMenuByName(name));
    I.click(this.buttons.copyByName(name));
  },

  openDeleteModal(scheduleName) {
    I.waitForVisible(this.buttons.actionsMenuByName(scheduleName), 10);
    I.click(this.buttons.actionsMenuByName(scheduleName));
    I.waitForVisible(this.buttons.deleteByName(scheduleName), 2);
    I.click(this.buttons.deleteByName(scheduleName));
    I.waitForVisible(this.buttons.confirmDelete, 10);
  },

  verifyBackupValues(scheduleObj) {
    const {
      name, vendor, frequency, description, retention, type, location, dataModel, cronExpression,
    } = scheduleObj;

    this.verifyBackupRowValues(name, vendor, frequency, retention, type, location);
    this.verifyBackupDetailsRow(name, description, dataModel, cronExpression);
  },

  verifyBackupRowValues(name, vendor, frequency, retention, type, location) {
    I.waitForVisible(this.elements.scheduleName(name), 10);
    I.seeElement(this.elements.scheduleName(name));
    I.seeTextEquals(vendor, this.elements.scheduleVendorByName(name));
    I.seeTextEquals(frequency, this.elements.frequencyByName(name));
    I.seeTextEquals(`${retention} backups`, this.elements.retentionByName(name));
    I.seeTextEquals(type, this.elements.scheduleTypeByName(name));
    I.seeTextEquals(location, this.elements.scheduleLocationByName(name));
  },

  verifyBackupDetailsRow(name, description, dataModel, cronExpression) {
    I.seeElement(this.buttons.showDetails(name));
    I.click(this.buttons.showDetails(name));
    I.waitForVisible(this.elements.detailedInfoRow.backupName, 2);
    I.seeTextEquals(name, this.elements.detailedInfoRow.backupName);
    I.seeTextEquals(description, this.elements.detailedInfoRow.description);
    I.seeTextEquals(dataModel, this.elements.detailedInfoRow.dataModel);
    I.seeTextEquals(cronExpression, this.elements.detailedInfoRow.cronExpression);
  },
};
