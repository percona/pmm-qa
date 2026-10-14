const { I } = inject();
const { tableDataRows } = require('../../helper/locatorHelper');

// Columns: expand, select, status, agent type, agent ID
const getAgentRowLocator = (agentName) => `${tableDataRows}[td[4][text()="${agentName}"]]`;

/**
 * All elements and methods for the PMM Inventory / Services : "Service Agents" Page
 */
module.exports = {
  fields: {
    backLink: '$agents-go-back',
    agentIdByAgentName: (agentName) => `${getAgentRowLocator(agentName)}/td[5]`,
    showAgentDetails: (agentName) => `${getAgentRowLocator(agentName)}//button[@aria-label="Expand"]`,
    agentDetailsLabelByText: (label) => locate('$agent-details').find('.MuiChip-label').withText(label),
  },

  async open(serviceId) {
    I.amOnPage(`/pmm-ui/inventory/services/${serviceId}/agents`);
    await I.waitForVisible(this.fields.backLink, 30);
  },

  /**
   * Check "Properties" in the details of the agent specified by "Agent Type" on the Agents page
   * TODO: describe agent type or update it to enum
   *
   * @param   agentType       agent type label on UI to search the agent
   * @param   expectedResult  property and value to expect in the details
   * @param   isDisplayed     select expected result evaluation isVisible|isNotVisible
   * @return  {Promise<void>} fails test if check fails.
   */
  async verifyAgentOtherDetailsSection(agentType, expectedResult, isDisplayed = true) {
    I.waitForVisible(this.fields.showAgentDetails(agentType), 30);
    I.click(this.fields.showAgentDetails(agentType));

    if (isDisplayed) {
      I.waitForVisible(this.fields.agentDetailsLabelByText(expectedResult), 10);
    } else {
      I.waitForVisible('$agent-details', 10);
      I.dontSeeElement(this.fields.agentDetailsLabelByText(expectedResult));
    }
  },
};
