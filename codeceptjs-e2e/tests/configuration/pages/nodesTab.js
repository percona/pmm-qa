const { I } = inject();
const { tableDataRows } = require('../../helper/locatorHelper');

class NodesTab {
  constructor() {
    this.url = '/pmm-ui/inventory/nodes';
    this.elements = {
      nodesRow: tableDataRows,
      nodesMonitoringValue: locate(`${tableDataRows}//*[@data-testid="monitoring-status-link"]`),
      backToNodes: '$agents-go-back',
      // Columns of the agents table: expand, select, status, agent type, agent ID
      agentType: `${tableDataRows}/td[4]`,
    };
  }

  async verifyAllNodesHaveAgent(agentType) {
    I.waitForVisible(this.elements.nodesRow, 30);
    const countOfRows = await I.grabNumberOfVisibleElements(this.elements.nodesRow);

    for (let i = 1; i <= countOfRows; i++) {
      I.waitForVisible(this.elements.nodesMonitoringValue.at(i), 30);
      I.click(this.elements.nodesMonitoringValue.at(i));
      I.waitForVisible(this.elements.agentType);
      const agents = await I.grabTextFromAll(this.elements.agentType);

      if (!agents.includes(agentType)) {
        throw new Error(`Nomad agent is not running on node ${(await I.grabCurrentUrl()).split('nodes/')[1].split('/')[0]}`);
      }

      I.click(this.elements.backToNodes);
    }
  }

  async verifyAllNodesDontHaveAgent(agentType) {
    I.waitForVisible(this.elements.nodesRow, 30);
    const countOfRows = await I.grabNumberOfVisibleElements(this.elements.nodesRow);

    for (let i = 1; i <= countOfRows; i++) {
      I.waitForVisible(this.elements.nodesMonitoringValue.at(i), 30);
      I.click(this.elements.nodesMonitoringValue.at(i));
      I.waitForVisible(this.elements.agentType);
      const agents = await I.grabTextFromAll(this.elements.agentType);

      if (agents.includes(agentType)) {
        throw new Error(`Nomad agent is not running on node ${(await I.grabCurrentUrl()).split('nodes/')[1].split('/')[0]}`);
      }

      I.click(this.elements.backToNodes);
    }
  }
}

module.exports = new NodesTab();
module.exports.NodesTab = NodesTab;
