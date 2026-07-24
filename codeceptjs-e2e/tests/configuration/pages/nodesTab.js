const { I } = inject();

class NodesTab {
  constructor() {
    this.url = 'graph/inventory/nodes';
    this.elements = {
      nodesRow: locate('//tbody//tr[@data-testid="table-tbody-tr"]'),
      nodesMonitoringValue: locate('//tbody//tr[@data-testid="table-tbody-tr"]').find('//td[position()="5"]//a'),
      backToNodes: locate('span').withText('Go back to nodes'),
      agentType: locate('//tbody//tr[@data-testid="table-tbody-tr"]//td[position()="3"]'),
    };
  }

  async verifyAllNodesHaveAgent(agentType) {
    const countOfRows = await I.grabNumberOfVisibleElements(this.elements.nodesRow);

    for (let i = 1; i <= countOfRows; i++) {
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
    const countOfRows = await I.grabNumberOfVisibleElements(this.elements.nodesRow);

    for (let i = 1; i <= countOfRows; i++) {
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
