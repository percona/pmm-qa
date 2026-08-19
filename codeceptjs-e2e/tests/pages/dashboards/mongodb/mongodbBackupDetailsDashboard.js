class MongodbBackupDetailsDashboard {
  constructor() {
    this.url = 'graph/d/mongodb-backup-details/mongodb-backup-details';
    this.elements = {
      backUpConfiguredValue: locate('//section[contains(@data-testid, "Backup Configured")]//div[@data-testid="data-testid panel content"]//span'),
      pitrEnabledValue: locate('//section[contains(@data-testid, "PITR Status")]//div[@data-testid="data-testid panel content"]//span'),
      lastSuccessfulBackupValue: locate('//section[contains(@data-testid, "Last Successful Backup")]//div[@data-testid="data-testid panel content"]//span'),
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

  // mongodb_pbm_backup_size_bytes is published by a low-resolution collector, so the
  // series a completed snapshot produces shows up 30-60s after PBM finishes. Until it
  // does, this panel renders its noValue ("N/A"). Poll the panel instead of asserting
  // straight away, otherwise the result depends on where the scrape lands.
  //
  // Scroll back to the panel on every iteration: Grafana only re-runs a panel's query
  // while it is inside the viewport, and callers reach this after walking the dashboard
  // down to its last row. Refreshing with the panel off-screen leaves it stuck on the
  // "N/A" it rendered at page load, whatever the metric does afterwards.
  async waitForLastSuccessfulBackupValue() {
    const I = actor();

    I.waitForVisible(this.elements.lastSuccessfulBackupValue, 15);
    await I.asyncWaitFor(async () => {
      I.scrollTo(this.elements.lastSuccessfulBackupValue);
      I.click(this.elements.refresh);
      const actualValue = await I.grabTextFrom(this.elements.lastSuccessfulBackupValue);

      return actualValue !== 'N/A' && actualValue !== '';
    }, 120, 'Last Successful Backup panel still has no value');
  }
}

module.exports = new MongodbBackupDetailsDashboard();
module.exports.MongodbBackupDetailsDashboard = MongodbBackupDetailsDashboard;
