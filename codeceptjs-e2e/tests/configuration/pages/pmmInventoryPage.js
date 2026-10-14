const { I, inventoryAPI } = inject();

const assert = require('assert');
const paginationPart = require('./paginationFragment');
const servicesTab = require('./servicesTab');
const NodesTab = require('./nodesTab');
const { tableDataRows } = require('../../helper/locatorHelper');

// Services and nodes columns: expand, select, status, name, ...; agents columns: expand, select, status, type, ID
const rowByName = (name) => `${tableDataRows}[td[4]/div/span[text()="${name}"]]`;
const agentRow = (agentType) => `${tableDataRows}[td[4][text()="${agentType}"]]`;
const expandButton = '//button[@aria-label="Expand"]';
const selectRowCheckbox = '//input[@aria-label="Toggle select row"]';

module.exports = {
  url: '/pmm-ui/inventory',
  fields: {
    serviceRow: (serviceName) => rowByName(serviceName),
    // The same button collapses the row again
    showServiceDetails: (serviceName) => `${rowByName(serviceName)}${expandButton}`,
    hideServiceDetails: (serviceName) => `${rowByName(serviceName)}${expandButton}`,
    showNodeDetails: (nodeName) => `${rowByName(nodeName)}${expandButton}`,
    showAgentDetails: (agentName) => `${agentRow(agentName)}${expandButton}`,
    showRowDetails: `//tbody${expandButton}`,
    backToServices: '$agents-go-back',
    agentsLinkNew: '//*[@data-testid="agents-status-chip"]//a',
    detailsLabelByText: (label) => locate('$service-details').find('.MuiChip-label').withText(label),
    agentDetailsLabelByText: (label) => locate('$agent-details').find('.MuiChip-label').withText(label),
    agentsLink: locate('[role="tablist"] a').withText('Agents').withAttr({ 'aria-label': 'Tab Agents' }),
    deleteButton: '[data-testid="delete-services-button"], [data-testid="delete-nodes-button"], [data-testid="delete-agents-button"]',
    externalExporter: locate('td').withText('External exporter'),
    editButton: '//*[@role="menuitem"][normalize-space()="Edit"]',
    editForm: '$edit-service-form',
    editText: locate('h2').withText('Editing'),
    forceModeCheckbox: '$inventory-delete-modal-force',
    inventoryTableColumn: locate('table').find('td'),
    kebabMenu: (serviceName) => `${rowByName(serviceName)}//button[@aria-label="Row Actions"]`,
    nodesLink: '$inventory-tab-nodes',
    pmmServicesSelector: '$inventory-tab-services',
    proceedButton: '$inventory-delete-modal-confirm',
    rowCheckbox: (name) => `${rowByName(name)}${selectRowCheckbox}`,
    serviceIdValue: '//*[@data-testid="service-details"]//span[.//p[text()="Service ID"]]/following-sibling::div[1]',
    // cannot be changed to locate() because of method: getCellValue()
    tableRow: tableDataRows,
    saveButton: '$edit-service-submit',
    saveConfirmButton: '$confirm-changes-modal-confirm',
    savePopupMessage: locate('$confirm-changes-modal').find('p').withText('Changing existing labels can affect other parts of PMM dependent on it'),
    runningStatusAgent: '//*[@data-testid="agent-status-chip"][normalize-space()="Running"]',
    serviceNames: `${tableDataRows}/td[4]/div/span`,
    servicesMonitoringStatus: `${tableDataRows}//*[@data-testid="monitoring-status-link"]`,
    serviceNameByIndex: (index) => `(${tableDataRows}/td[4]/div/span)[${index}]`,
  },
  servicesTab,
  nodesTab: NodesTab,
  pagination: paginationPart,

  async open() {
    I.amOnPage(this.url);
    await I.waitForVisible(this.fields.nodesLink, 30);
  },

  openAgents(serviceId) {
    I.amOnPage(`/pmm-ui/inventory/services/${serviceId}/agents`);
    I.waitForVisible(this.fields.tableRow, 30);
  },

  async changeRowsPerPage(count) {
    await this.pagination.selectRowsPerPage(count);
  },

  verifyRemoteServiceIsDisplayed(serviceName) {
    I.waitForVisible(locate('td').withText(serviceName), 30);
  },

  async verifyAgentHasStatusRunning(service_name) {
    const serviceId = await this.getServiceId(service_name);

    await inventoryAPI.waitForRunningState(serviceId);
    this.openAgents(serviceId);

    const numberOfAgents = await I.grabNumberOfVisibleElements(this.fields.runningStatusAgent);

    if (service_name.includes('azure')) {
      assert.equal(
        numberOfAgents,
        3,
        ` Service ID must have 3 Agents running, Actual Number of Agents found is ${numberOfAgents} for ${service_name}`,
      );
    } else if (/mysql|mongo|psmdb|postgres|pgsql|rds/gim.test(service_name)) {
      assert.equal(
        numberOfAgents,
        2,
        ` Service ID must have 2 Agents running, Actual Number of Agents found is ${numberOfAgents} for ${service_name}`,
      );
    } else {
      assert.equal(numberOfAgents, 1, ` Service ID must have only 1 Agent running ${serviceId} , Actual Number of Agents found is ${numberOfAgents} for ${service_name}`);
    }

    await I.click(this.fields.backToServices);
  },

  async verifyNodeAgentHasRDSExporter(serviceName) {
    await this.changeRowsPerPage(100);
    // The node name column of the services table
    const nodeLink = await I.grabAttributeFrom(`${tableDataRows}/td[5]//a[contains(text(), "${serviceName}")]`, 'href');

    I.amOnPage(nodeLink);
    I.waitForVisible(this.fields.showNodeDetails(serviceName), 30);
    I.click(this.fields.showNodeDetails(serviceName));
    I.click(this.fields.agentsLinkNew);
    I.waitNumberOfVisibleElements(agentRow('RDS exporter'), 1, 30);
  },

  async checkAgentOtherDetailsSection(agentType, expectedResult, isDisplayed = true) {
    I.waitForVisible(this.fields.showAgentDetails(agentType), 30);
    I.click(this.fields.showAgentDetails(agentType));

    if (isDisplayed) {
      I.waitForVisible(this.fields.agentDetailsLabelByText(expectedResult), 10);
    } else {
      I.waitForVisible('$agent-details', 10);
      I.dontSeeElement(this.fields.agentDetailsLabelByText(expectedResult));
    }
  },

  async checkAgentsLabel(expectedResult) {
    await I.waitForVisible(this.fields.agentDetailsLabelByText(expectedResult), 10);
  },

  async getServiceId(serviceName) {
    await I.waitForVisible(this.fields.showServiceDetails(serviceName), 60);
    await I.click(this.fields.showServiceDetails(serviceName));

    I.waitForVisible(this.fields.serviceIdValue, 30);
    const matchedServices = await I.grabNumberOfVisibleElements(this.fields.serviceIdValue);

    await assert.equal(
      matchedServices,
      1,
      `There must be only one entry for the newly added service with name ${serviceName}`,
    );

    const serviceId = await I.grabTextFrom(this.fields.serviceIdValue);

    await I.click(this.fields.hideServiceDetails(serviceName));

    return serviceId;
  },

  selectService(serviceName) {
    const serviceLocator = this.fields.rowCheckbox(serviceName);

    I.waitForVisible(serviceLocator, 30);
    I.click(serviceLocator);
  },

  serviceExists(serviceName, deleted) {
    if (deleted) {
      I.waitForInvisible(rowByName(serviceName), 30);
    } else {
      I.waitForVisible(rowByName(serviceName), 30);
    }
  },

  checkNodeExists(serviceName) {
    I.waitForVisible(rowByName(serviceName), 20);
  },

  getServicesId(serviceName) {
    return rowByName(serviceName);
  },

  async getCountOfAgents(serviceId) {
    const countOfAgents = await I.grabNumberOfVisibleElements(serviceId);

    assert.equal(countOfAgents, 0, 'The agents should be removed!');
  },

  selectAgent(agentType) {
    const agentLocator = `${agentRow(agentType)}${selectRowCheckbox}`;

    I.waitForVisible(agentLocator, 30);
    I.click(agentLocator);
  },

  async getAgentServiceID(agentType) {
    const serviceIdLabel = this.fields.agentDetailsLabelByText('service_id=');

    I.waitForVisible(this.fields.showAgentDetails(agentType), 30);
    I.click(this.fields.showAgentDetails(agentType));
    I.waitForVisible(serviceIdLabel, 30);
    const serviceIdTag = await I.grabTextFrom(serviceIdLabel);

    return serviceIdTag.split('=')[1];
  },

  async getAgentID(agentType) {
    const agentIdLocator = `${agentRow(agentType)}/td[5]`;

    I.waitForVisible(agentIdLocator, 30);

    return await I.grabTextFrom(agentIdLocator);
  },

  async getNodeCount() {
    I.waitForVisible(this.fields.tableRow, 30);

    return await I.grabNumberOfVisibleElements(this.fields.tableRow);
  },

  verifyNodesCount(before, after) {
    assert.equal(before, after, 'The count of nodes should be same! Check the data!');
  },

  existsByid(id, deleted) {
    const idLocator = `${tableDataRows}/td[contains(text(), "${id}")]`;

    if (deleted) {
      I.waitForInvisible(idLocator, 30);
    } else {
      I.waitForVisible(idLocator, 30);
    }
  },

  selectAgentByID(id) {
    const agentIdLocator = `${tableDataRows}[td[contains(text(), "${id}")]]${selectRowCheckbox}`;

    I.waitForVisible(agentIdLocator, 30);
    I.click(agentIdLocator);
  },

  deleteWithForceOpt() {
    I.click(this.fields.deleteButton);
    I.waitForVisible(this.fields.forceModeCheckbox, 10);
    I.click(this.fields.forceModeCheckbox);
    I.click(this.fields.proceedButton);
  },

  async getCountOfItems() {
    return await I.grabNumberOfVisibleElements(this.fields.tableRow);
  },

  async checkAllNotDeletedAgents(countBefore) {
    const countAfter = await this.getCountOfItems();

    /* we are using count 10 because we have two agents for RDS Instance also,
    hence (pmm-agent, Node exporter, PostgreSQL exporter, mysql exporter, QAN RDS,
    QAN postgres, RDS exporter, QAN PostgreSQL PgStatements Agent,
    QAN PostgreSQL PgStatements Agent, QAN MySQL Slowlog Agent)
     */
    // need to be fixed later
    // we need to avoid hardcoded values
    /* assert.ok((otherDetails <= 10 && otherDetails >= 4),
     'Total Agents running on PMM-Server Instance can not be greater then 10'); */
    assert.ok(countBefore > countAfter, `Some PMM Agents should have been deleted, Agents running before deleting ${countBefore} and after deleting ${countAfter}`);
  },

  async getCellValue(rowNumber, columnNumber) {
    const value = await I.grabTextFrom(`${this.fields.tableRow}[${rowNumber}]/td[${columnNumber}]`);

    return value.toLowerCase();
  },

  async checkSort(columnNumber) {
    I.waitForVisible(this.fields.tableRow, 20);
    const rowCount = await I.grabNumberOfVisibleElements(this.fields.tableRow);
    let tmp;

    for (let i = 0; i < rowCount; i++) {
      const cellValue = await this.getCellValue(i + 1, columnNumber);

      if (i === 0) {
        // Do nothing for the first run
        tmp = cellValue;
      } else {
        if (tmp.localeCompare(cellValue) === 1) {
          assert.fail(
            `The array is not sorted correctly from a-z: value ${cellValue} should come after ${tmp}, not before`,
          );
          break;
        }

        // Update the tmp value for the next comparison
        tmp = cellValue;
      }
    }
  },

  async checkExistingAgent(agent, serviceName) {
    I.waitForVisible(this.fields.showServiceDetails(serviceName), 30);
    await I.click(this.fields.showServiceDetails(serviceName));
    I.click(this.fields.agentsLinkNew);
    await I.waitForVisible(agent, 30);
    I.click(this.fields.backToServices);
  },

  async saveAndConfirm() {
    I.click(this.fields.saveButton);
    I.waitForVisible(this.fields.savePopupMessage, 10);
    I.click(this.fields.saveConfirmButton);
    // Saving goes back to the services list
    I.waitForVisible(this.fields.tableRow, 30);
  },

  openEditServiceWizard(serviceName) {
    I.waitForElement(this.fields.kebabMenu(serviceName), 30);
    I.click(this.fields.kebabMenu(serviceName));
    I.waitForElement(this.fields.editButton, 30);
    I.click(this.fields.editButton);
    I.waitForElement(this.fields.editText, 30);
    I.seeElement(this.fields.editText);
    // The form shows up once the service and its credentials are loaded
    I.waitForVisible(this.fields.editForm, 30);
  },

  updateServiceLabels(serviceParameters) {
    I.usePlaywrightTo('clear fields', async ({ page }) => {
      await page.locator('input[name="environment"]').fill(serviceParameters.environment);
      await page.locator('input[name="replicationSet"]').fill(serviceParameters.replicationSet);
      await page.locator('input[name="cluster"]').fill(serviceParameters.cluster);
    });

    this.saveAndConfirm();
  },

  verifyServiceLabels(serviceParameters) {
    // Verify new values for labels in details
    I.waitForVisible(this.fields.detailsLabelByText(`environment=${serviceParameters.environment}`), 20);
    I.seeElement(this.fields.detailsLabelByText(`environment=${serviceParameters.environment}`));
    I.seeElement(this.fields.detailsLabelByText(`cluster=${serviceParameters.cluster}`));
    I.seeElement(this.fields.detailsLabelByText(`replication_set=${serviceParameters.replicationSet}`));
  },

  async verifyDisplayedServices(expectedServicesNames) {
    const actualServices = await I.grabTextFromAll(this.fields.serviceNames);

    if (expectedServicesNames.length !== actualServices.length) return false;

    const expectedServicesNamesSorted = [...expectedServicesNames].sort();
    const actualServicesSorted = [...actualServices].sort();

    return expectedServicesNamesSorted.every((val, index) => val === actualServicesSorted[index]);
  },
};
