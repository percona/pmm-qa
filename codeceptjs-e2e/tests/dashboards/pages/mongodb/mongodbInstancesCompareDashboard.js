const { I, dashboardPage } = inject();

class MongodbInstancesCompareDashboard {
  constructor() {
    this.url = 'graph/d/mongodb-instance-compare/mongodb-instances-compare';
    this.elements = {
      variableLabel: (variableName) => locate(`//label[contains(@data-testid, "Label ${variableName}")]`),
      removeSelectedVariable: (variableName) => locate(`//label[contains(@data-testid, "Label ${variableName}")]//parent::div//button[@aria-label="Remove"]`),
      variableInput: (variableName) => locate(`//label[contains(@data-testid, "Label ${variableName}")]//parent::div//input`),
    };
    this.metrics = [
      'Service Info',
      'MongoDB Uptime',
      'Current QPS',
      'DB Connections',
      'Latency',
      'Opened Cursors',
      'Replica Set',
      'ReplSet State',
      'Connections',
      'Cursors ',
      'Latency',
      'Scan Ratios',
      'Index Filtering Effectiveness',
      'Requests',
      'Document Operations',
      'Queued Operations',
      'Used Memory',
    ];
  }

  selectVariable(variable, value) {
    I.waitForVisible(this.elements.variableLabel(variable), 10);
    I.click(this.elements.removeSelectedVariable(variable));
    I.fillField(this.elements.variableInput(variable), value);
    I.pressKey('Enter');
    I.pressKey('Escape');
    I.wait(1);
  }

  unSelectVariable(variable) {
    I.waitForVisible(this.elements.variableLabel(variable), 10);
    I.click(this.elements.removeSelectedVariable(variable));
    I.pressKey('Escape');
    I.wait(1);
  }

  selectEnvironment(envName) {
    this.selectVariable('Environment', envName);
  }

  unselectEnvironment() {
    this.unSelectVariable('Environment');
  }

  selectCluster(clusterName) {
    this.selectVariable('Cluster', clusterName);
  }

  unselectCluster() {
    this.unSelectVariable('Cluster');
  }

  selectReplicationSet(replicationSet) {
    this.selectVariable('Replication Set', replicationSet);
  }

  unselectReplicationSet() {
    this.unSelectVariable('Replication Set');
  }

  selectNode(serviceName) {
    this.selectVariable('Node', serviceName);
  }

  verifyServicesInfoPanelDisplayed(services = []) {
    for (const service of services) {
      I.waitForVisible(dashboardPage.graphsLocator(`${service} - Service Info`));
    }
  }
}

module.exports = new MongodbInstancesCompareDashboard();
module.exports.MongodbInstancesCompareDashboard = MongodbInstancesCompareDashboard;
