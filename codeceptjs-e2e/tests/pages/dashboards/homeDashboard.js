const { I } = inject();

class HomeDashboard {
  constructor() {
    this.url = 'graph/d/pmm-home/home-dashboard';
    this.panels = {
      monitoredServicesPanelLocator: '//*[@data-testid="data-testid Panel header Monitored DB Services"]',
      monitoredServicesPanel: {
        mysql: () => `(${this.panels.monitoredServicesPanelLocator}//span)[1]`,
        mongodb: () => `(${this.panels.monitoredServicesPanelLocator}//span)[2]`,
        pgsql: () => `(${this.panels.monitoredServicesPanelLocator}//span)[3]`,
        proxysql: () => `(${this.panels.monitoredServicesPanelLocator}//span)[4]`,
      },
      failedAdvisors: '//section[@data-testid="data-testid Panel header Failed advisors"]',

    };
    this.panelData = {
      failedAdvisors: {
        insufficientPrivilege: `${this.panels.failedAdvisors}//[@data-testid="unauthorized"]`,
        criticalFailedAdvisors: `${this.panels.failedAdvisors}//span[@data-testid="db-check-panel-critical"]`,
        errorFailedAdvisors: `${this.panels.failedAdvisors}//span[@data-testid="db-check-panel-error"]`,
        warningFailedAdvisors: `${this.panels.failedAdvisors}//span[@data-testid="db-check-panel-warning"]`,
        noticeFailedAdvisors: `${this.panels.failedAdvisors}//span[@data-testid="db-check-panel-notice"]`,
      },
    };
    this.metrics = [
      'CPU Busy',
      'Mem Avail',
      'Disk Reads',
      'Disk Writes',
      'Network IO',
      'DB Conns',
      'DB QPS',
      'Virtual CPUs',
      'RAM',
      'Host uptime',
      'DB uptime',
    ];
  }

  async verifyCountOfServices(mysql, mongodb, pgsql, proxysql) {
    const countOfMysql = parseInt(await I.grabTextFrom(this.panels.monitoredServicesPanel.mysql()), 10);
    const countOfMongoDb = parseInt(await I.grabTextFrom(this.panels.monitoredServicesPanel.mongodb()), 10);
    const countOfPgSql = parseInt(await I.grabTextFrom(this.panels.monitoredServicesPanel.pgsql()), 10);
    const countOfProxySql = parseInt(await I.grabTextFrom(this.panels.monitoredServicesPanel.proxysql()), 10);

    I.assertEqual(mysql, countOfMysql, `Expected Count of Mysql Services: "${mysql}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfMysql}"`);
    I.assertEqual(mongodb, countOfMongoDb, `Expected Count of MongoDb Services: "${mongodb}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfMongoDb}"`);
    I.assertEqual(pgsql, countOfPgSql, `Expected Count of PostgreSQL Services: "${pgsql}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfPgSql}"`);
    I.assertEqual(proxysql, countOfProxySql, `Expected Count of ProxySQL Services: "${proxysql}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfProxySql}"`);
  }
}

module.exports = new HomeDashboard();
module.exports.HomeDashboard = HomeDashboard;
