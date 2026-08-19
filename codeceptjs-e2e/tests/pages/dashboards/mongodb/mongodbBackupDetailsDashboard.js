class MongodbBackupDetailsDashboard {
  constructor() {
    this.url = 'graph/d/mongodb-backup-details/mongodb-backup-details';
    this.elements = {
      backUpConfiguredValue: locate('//section[contains(@data-testid, "Backup Configured")]//div[@data-testid="data-testid panel content"]//span'),
      pitrEnabledValue: locate('//section[contains(@data-testid, "PITR Status")]//div[@data-testid="data-testid panel content"]//span'),
      lastSuccessfulBackupValue: locate('//section[contains(@data-testid, "Last Successful Backup")]//div[@data-testid="data-testid panel content"]//span'),
      refresh: locate('//button[contains(@data-testid, "RefreshPicker run button")]'),
    };
    // Panels fed by the same low-resolution mongodb_pbm_* collectors as the
    // Last Successful Backup stat, so they are empty for the same 30-60s after a
    // backup finishes -- and they sit at the bottom of the dashboard.
    this.lateMetricPanels = [
      'Backup history',
      'Backup Sizes',
      'Backup Duration',
    ];
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

  // Same viewport rule as above, applied to the panels the previous wait scrolls away
  // from. Grafana unmounts a panel that leaves the viewport and only re-runs its query
  // when it comes back, so the bottom row keeps whatever it rendered on page load -- the
  // "N/A" from before PBM published a status="done" sample -- through every refresh
  // waitForLastSuccessfulBackupValue does at the top of the dashboard. Bring each one
  // back into view and refresh it there, so an empty-panel check sees current state
  // instead of a stale render.
  async waitForLateMetricPanels() {
    const I = actor();

    for (const panel of this.lateMetricPanels) {
      const panelSection = locate(`//section[contains(@data-testid, "${panel}")]`);
      const noData = locate(`//section[contains(@data-testid, "${panel}")]//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="No Data") or (text()="-")]`);

      I.waitForElement(panelSection, 30);
      await I.asyncWaitFor(async () => {
        I.scrollTo(panelSection);
        I.click(this.elements.refresh);

        return await I.grabNumberOfVisibleElements(noData) === 0;
      }, 120, `${panel} panel still has no data`);
    }
  }
}

module.exports = new MongodbBackupDetailsDashboard();
module.exports.MongodbBackupDetailsDashboard = MongodbBackupDetailsDashboard;
