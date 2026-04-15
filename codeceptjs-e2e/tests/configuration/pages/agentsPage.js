const { I } = inject();
const paginationPart = require('./paginationFragment');

/**
 * All elements and methods for the PMM Inventory / Services : "Service Agents" Page
 */
module.exports = {
  fields: {
    backLink: locate('span').withText('Go back to services'),
    inventoryTable: locate('table'),
    agentIdByAgentName: (agentName) => `//td[contains(text(), '${agentName}')]//following-sibling::td`,
    showAgentDetails: (agentName) => `//td[contains(text(), '${agentName}')]//ancestor::tr//button[@data-testid="show-row-details"]`,
    agentDetailsLabelByText: (label) => locate('[aria-label="Tags"]').find('li').withText(label),
  },
  pagination: paginationPart,

  async open(serviceId) {
    I.amOnPage(`graph/inventory/services/${serviceId}/agents`);
    await I.waitForVisible(this.fields.backLink, 30);
  },

  /**
   * Check "Other Details" cell for specified agent by "Agent Type" on the Agents page
   * TODO: describe agent type or update it to enum
   *
   * @param   agentType       agent type label on UI to search the agent
   * @param   expectedResult  attribute and value to expect in the cell
   * @param   isDisplayed     select expected result evaluation isVisible|isNotVisible
   * @return  {Promise<void>} fails test if check fails.
   */
  async verifyAgentOtherDetailsSection(agentType, expectedResult, isDisplayed = true) {
    I.click(this.fields.showAgentDetails(agentType));

    if (isDisplayed) {
      I.waitForVisible(this.fields.agentDetailsLabelByText(expectedResult), 10);
    } else {
      I.dontSeeElement(this.fields.agentDetailsLabelByText(expectedResult));
    }
  },
};
