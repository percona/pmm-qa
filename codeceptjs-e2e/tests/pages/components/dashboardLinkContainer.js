class DashboardLinkContainer {
  constructor() {
    this.buttons = {
      queryAnalytics: '//div[a/span[text()="Query Analytics"]]',
    };
  }
}

module.exports = new DashboardLinkContainer();
module.exports.DashboardLinkContainer = DashboardLinkContainer;
