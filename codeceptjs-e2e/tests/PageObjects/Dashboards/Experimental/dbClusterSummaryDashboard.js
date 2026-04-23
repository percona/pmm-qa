const { I } = inject();

module.exports = {
  url: 'graph/d/db-cluster-summary/db-cluster-summary?from=now-15m&to=now',
  elements: {
    podName: '//label[@for="var-pod"]//following-sibling::*',
    podNameDropdownSelect: async (podName) => `//*[@id="options-pod"]//span[contains(@data-testid, "${podName}")]`,
  },
  metrics: [
    'Uptime',
    'Amount of Pods',
    'CPU',
    'Avg CPU Load',
    'RAM',
    'Disk Space',
    'RAM',
    'Swap',
    'Memory',
    'CPU',
    'Total Duration of Throttling',
    'Total Throttled Period Intervals',
    'Disk I/O',
    'Swap Activity',
    'Network Traffic',
    'Errors / Dropped Packets',
  ],
  fields: {},
  buttons: {},
  messages: {},

  async selectPod(podName) {
    await I.waitForVisible(this.elements.podName, 10);
    await I.click(this.elements.podName);
    await I.click(await this.elements.podNameDropdownSelect(podName));
  },
};
