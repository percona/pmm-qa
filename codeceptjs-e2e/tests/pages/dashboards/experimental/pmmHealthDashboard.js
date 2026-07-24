const { I } = inject();

class PmmHealthDashboard {
  constructor(props) {
    this.url = 'graph/d/pmm-health/pmm-health';
    this.elements = {
      statuses: {
        managedD: 'ManageD Status',
        victoriaMetrics: 'VictoriaMetrics Status',
        pgsql: 'PostgreSQL Status',
        qanApi: 'QAN API Status',
        grafana: 'Grafana Status',
        node: 'Node Status',
        clickHouse: 'Clickhouse Status',
      },
      statusLocator: (statusName) => `//section[contains(@data-testid, "${statusName}")]//div[contains(@data-testid, "panel content")]`,
    };
  }

  async verifyStatuses() {
    for (const status of Object.values(this.elements.statuses)) {
      I.waitForVisible(this.elements.statusLocator(status));
      I.waitForText('UP', 10, this.elements.statusLocator(status));
    }
  }
}

module.exports = new PmmHealthDashboard();
module.exports.PmmHealthDashboard = PmmHealthDashboard;
