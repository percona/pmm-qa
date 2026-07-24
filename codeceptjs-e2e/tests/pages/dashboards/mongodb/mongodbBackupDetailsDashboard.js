class MongodbBackupDetailsDashboard {
  constructor() {
    this.url = 'graph/d/mongodb-backup-details/mongodb-backup-details';
    this.elements = {
      backUpConfiguredValue: locate('//section[contains(@data-testid, "Backup Configured")]//div[@data-testid="data-testid panel content"]//span'),
      pitrEnabledValue: locate('//section[contains(@data-testid, "PITR Status")]//div[@data-testid="data-testid panel content"]//span'),
      refresh: locate('//button[contains(@data-testid, "RefreshPicker run button")]'),
    };
    this.metrics = [
      'Backup Configured',
      'PITR Status',
      'Backup Agents',
      'Last Successful Backup',
      'Backup Agent Summary',
      'Backup Agent Status',
      'Backup agent status over time',
      'Backup history',
      'Backup Sizes',
      'Backup Duration',
    ];
  }

  async verifyBackupConfiguredValue(expectedValue) {
    const I = actor();

    I.waitForVisible(this.elements.backUpConfiguredValue, 15);
    const value = await I.grabTextFrom(this.elements.backUpConfiguredValue);

    if (value !== expectedValue) {
      throw new Error(`Expected Value for panel Backup configured on MongoDB PMM Details dashboard does not equal expected value. Expected: "${expectedValue}". Actual: "${value}".`);
    }
  }

  async verifyPitrEnabledValue(expectedValue) {
    const I = actor();

    I.waitForVisible(this.elements.pitrEnabledValue, 15);
    await I.asyncWaitFor(async () => {
      I.click(this.elements.refresh);
      const actualValue = await I.grabTextFrom(this.elements.pitrEnabledValue);

      return actualValue === expectedValue;
    }, 60, 'Pitr backup value is not correct');
  }
}

module.exports = new MongodbBackupDetailsDashboard();
module.exports.MongodbBackupDetailsDashboard = MongodbBackupDetailsDashboard;
