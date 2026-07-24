const { I } = inject();

class HomeDashboard {
  constructor() {
    this.url = 'graph/d/pmm-home/home-dashboard';
    this.panels = {
      monitoredServicesPanelLocator: locate('[data-testid^="data-testid Panel header Monitored DB Services"] [class*="panel-content"] span'),
      monitoredServicesPanel: {
        mysql: () => locate(this.panels.monitoredServicesPanelLocator).find('span').at(1),
        mongodb: () => locate(this.panels.monitoredServicesPanelLocator).find('span').at(2),
        pgsql: () => locate(this.panels.monitoredServicesPanelLocator).find('span').at(3),
        proxysql: () => locate(this.panels.monitoredServicesPanelLocator).find('span').at(4),
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
    const [
      countOfMysql,
      countOfMongoDb,
      countOfPgSql,
      countOfProxySql,
    ] = await I.grabTextFromAll(this.panels.monitoredServicesPanelLocator);

    I.assertEqual(mysql, parseInt(countOfMysql, 10), `Expected Count of Mysql Services: "${mysql}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfMysql}"`);
    I.assertEqual(mongodb, parseInt(countOfMongoDb, 10), `Expected Count of MongoDb Services: "${mongodb}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfMongoDb}"`);
    I.assertEqual(pgsql, parseInt(countOfPgSql, 10), `Expected Count of PostgreSQL Services: "${pgsql}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfPgSql}"`);
    I.assertEqual(proxysql, parseInt(countOfProxySql, 10), `Expected Count of ProxySQL Services: "${proxysql}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfProxySql}"`);
  }
}

module.exports = new HomeDashboard();
module.exports.HomeDashboard = HomeDashboard;
