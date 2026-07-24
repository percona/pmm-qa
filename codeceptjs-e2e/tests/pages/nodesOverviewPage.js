const { I, dashboardPage } = inject();

module.exports = {
  url: 'graph/d/node-instance-overview/nodes-overview',
  elements: {},
  fields: {},
  buttons: {
    environment: '//button[@id="var-environment"]/span',
    selectEnvironment: (envName) => `//a[@role="checkbox"]//span[text()="${envName}"]`,
    refreshDashboard: '//button[@aria-label="Refresh dashboard"]',
  },
  messages: {},

  async selectEnvironment(envName) {
    await I.waitForVisible(this.buttons.environment);
    await I.click(this.buttons.environment);
    await I.click(this.buttons.selectEnvironment(envName));
    await I.click(dashboardPage.fields.metricPanel);
    await I.waitForText('dev', 30, this.buttons.environment);
  },
};
