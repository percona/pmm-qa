const { I, inventoryAPI } = inject();

const assert = require('assert');
const paginationPart = require('./paginationFragment');
const servicesTab = require('./servicesTab');
const NodesTab = require('./nodesTab');

const service = (serviceName) => `//span[contains(text(),'${serviceName}')]`;
const node = (nodeName) => `//td[@title='${nodeName}'][2]`;

module.exports = {
  url: 'graph/inventory?orgId=1',
  fields: {
    servicesLink: locate('[role="tablist"] a').withText('Services').withAttr({ 'aria-label': 'Tab Services' }),
    serviceRow: (serviceName) => locate('tr').withChild(locate('td').withAttr({ title: serviceName })),
    showServiceDetails: (serviceName) => `${service(serviceName)}//ancestor::tr//button[@data-testid="show-row-details"]`,
    hideServiceDetails: (serviceName) => `${service(serviceName)}//ancestor::tr//button[@data-testid="hide-row-details"]`,
    showNodeDetails: (nodeName) => `${node(nodeName)}//ancestor::tr//button[@data-testid="show-row-details"]`,
    showAgentDetails: (agentName) => `//td[contains(text(), '${agentName}')]//ancestor::tr//button[@data-testid="show-row-details"]`,
    showRowDetails: '//button[@data-testid="show-row-details"]',
    agentStatus: locate('$details-row-content').find('a'),
    backToServices: '//span[text()="Go back to services"]',
    agentsLinkNew: '//div[contains(@data-testid,"status-badge")]',
    detailsLabelByText: (label) => locate('[aria-label="Tags"]').find(`//li/span[contains(text(), "${label}")]`),
    agentDetailsLabelByText: (label) => locate('$details-row-content').find('li').withText(label),
    agentsLink: locate('[role="tablist"] a').withText('Agents').withAttr({ 'aria-label': 'Tab Agents' }),
    agentsLinkOld: locate('a').withText('Agents'),
    cluster: '$cluster-text-input',
    deleteButton: locate('span').withText('Delete'),
    environment: '$environment-text-input',
    externalExporter: locate('td').withText('External exporter'),
    editButton: locate('span').withText('Edit'),
    editText: locate('h3').withText('Editing'),
    forceModeCheckbox: locate('$force-field-label'),
    inventoryTable: locate('table'),
    inventoryTableColumn: locate('table').find('td'),
    inventoryTableRows: locate('tr').after('table'),
    inventoryTableRowCount: (count) => locate('span').withText(`${count}`),
    kebabMenu: (serviceName) => `${service(serviceName)}//ancestor::tr//button[@data-testid="dropdown-menu-toggle"]`,
    mongoServiceName: locate('td').withText('mongodb'),
    mysqlServiceName: locate('td').withText('ms-single'),
    // cannot be changed to locate because it's failing in I.waitForVisible()
    nodesLink: locate('[role="tablist"] a').withText('Nodes').withAttr({ 'aria-label': 'Tab Nodes' }),
    nodesLinkOld: locate('a').withText('Nodes'),
    pdphsqlServiceName: locate('td').withText('PGSQL'),
    pmmAgentLocator: locate('td').withText('PMM Agent'),
    pmmServerPostgresLocator: locate('td').withText('pmm-server-postgresql'),
    pmmServicesSelector: locate('[role="tablist"] a').withText('Services').withAttr({ 'aria-label': 'Tab Services' }),
    postgresExporter: locate('td').withText('Postgres exporter'),
    postgresPgStatements: locate('td').withText('QAN PostgreSQL PgStatements'),
    postgresPgstatmonitor: locate('td').withText('QAN PostgreSQL Pgstatmonitor'),
    proceedButton: locate('span').withText('Proceed'),
    runningStatus: locate('span').withText('RUNNING'),
    rowsPerPage: locate('$pagination').find('div'),
    serviceIdLocatorPrefix: '//table//tr/td[4][contains(text(),"',
    nodeIdLocatorPrefix: '//table//tr[1]/td[4]/a[contains(text(),"',
    tableCheckbox: locate('$select-row').find('span'),
    // cannot be changed to locate() because of method: getCellValue()
    tableRow: '//tr[@data-testid="table-tbody-tr"]',
    processExecPathExporters: '//td[contains(text(), "exporter")]//ancestor::tr[@data-testid="table-row"]//span[contains(text(), "process_exec_path")]',
    nodeExporterStatus: '//td[contains(text(), "Node exporter")]//ancestor::tr[@data-testid="table-row"]//span[contains(text(), "status")]',
    agentId: '//td[contains(text(), "agent_id") and not(following-sibling::td[text()="PMM Agent"])]',
    selectAllCheckbox: locate('$select-all'),
    selectRowCheckbox: locate('$select-row'),
    removalDialogMessage: '//form/h4',
    replicationSet: '$replication_set-text-input',
    selectedCheckbox: '//div[descendant::input[@value="true"] and @data-testid="select-row"]',
    saveButton: locate('button').withChild('div').withText('Save Changes'),
    saveConfirmButton: locate('span').withText('Confirm and save changes'),
    savePopupMessage: locate('p').withText('Changing existing labels can affect other parts of PMM dependent on it'),
    runningStatusAgent: '//td/div[contains(text(), "Running")]',
    serviceNames: locate('//tr[@role="row"]//td[3]//span'),
  },
  servicesTab,
  nodesTab: NodesTab,
  pagination: paginationPart,

  async open() {
    I.amOnPage(this.url);
    await I.waitForVisible(this.fields.nodesLink, 30);
  },

  async openServices() {
    await I.waitForVisible(this.fields.pmmServicesSelector, 20);
    I.click(this.fields.pmmServicesSelector);
    await this.changeRowsPerPage(100);
    I.waitForElement(this.fields.inventoryTable, 60);
    I.scrollPageToBottom();
  },

  openAgents(serviceId) {
    I.amOnPage(`graph/inventory/services/${serviceId}/agents`);
    this.changeRowsPerPage(100);
  },

  changeRowsPerPage(count) {
    I.waitForElement(this.fields.rowsPerPage, 30);
    I.scrollPageToBottom();
    I.click(this.fields.rowsPerPage);
    I.waitForElement(this.fields.inventoryTableRowCount(count), 30);
    // Temp Hack for making 100 in the page count rows
    I.pressKey('ArrowDown');
    I.pressKey('ArrowDown');
    I.pressKey('Enter');
    I.wait(2);
  },

  verifyRemoteServiceIsDisplayed(serviceName) {
    I.waitForVisible(this.fields.inventoryTableColumn, 30);
    I.scrollPageToBottom();
    I.see(serviceName, this.fields.inventoryTableColumn);
  },

  async verifyAgentHasStatusRunning(service_name) {
    const serviceId = await this.getServiceId(service_name);

    await inventoryAPI.waitForRunningState(serviceId);
    this.openAgents(serviceId);
    // I.waitForElement(this.fields.pmmAgentLocator, 60);
    await this.changeRowsPerPage(100);
    I.waitForElement(this.fields.inventoryTable, 60);
    I.scrollPageToBottom();

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
    const nodeLink = await this.getNodeLink(serviceName);

    I.amOnPage(nodeLink);
    this.changeRowsPerPage(100);
    await I.click(this.fields.showNodeDetails(serviceName));
    await I.click(this.fields.agentsLinkNew);
    const rdsAgentExporter = '//td[@title=\'rds_exporter\']';

    I.waitNumberOfVisibleElements(rdsAgentExporter, 1, 30);
  },

  async getServiceIdWithStatus(status) {
    const serviceIds = [];
    const locator = locate('span')
      .withText('service_id:')
      .before(locate('span')
        .withText(`status: ${status}`));

    const strings = await I.grabTextFromAll(locator);

    // we need to cut "service_id: " prefix from grabbed strings
    strings.forEach((item) => serviceIds.push(item.split(': ')[1]));

    return serviceIds;
  },

  async checkAgentOtherDetailsSection(agentType, expectedResult, isDisplayed = true) {
    I.click(this.fields.showAgentDetails(agentType));

    if (isDisplayed) {
      I.waitForVisible(this.fields.agentDetailsLabelByText(expectedResult), 10);
    } else {
      I.dontSeeElement(this.fields.agentDetailsLabelByText(expectedResult));
    }
  },

  async checkAgentsLabel(expectedResult) {
    await I.waitForVisible(this.fields.agentDetailsLabelByText(expectedResult), 10);
  },

  async checkAgentOtherDetailsMissing(detailsSection, serviceId) {
    const locator = locate('span').withText(detailsSection).after(locate('span').withText(`service_id: ${serviceId}`));

    I.dontSeeElement(locator);
  },

  async verifyMetricsFlags(serviceName) {
    const servicesLink = this.fields.pmmServicesSelector;

    I.waitForElement(servicesLink, 20);
    I.click(servicesLink);
    await this.changeRowsPerPage(100);
    // const nodeId = await this.getNodeId(serviceName);

    // await I.click(this.fields.showServiceDetails(serviceName));
    // await I.click(this.fields.agentsLinkNew);
    await this.changeRowsPerPage(100);

    await I.click(this.fields.showServiceDetails(serviceName));
    await I.click(this.fields.agentsLinkNew);
    const rows = await I.grabNumberOfVisibleElements(this.fields.showRowDetails);

    for (let i = 1; i <= rows; i++) {
      await I.click(`(${this.fields.showRowDetails})[1]`);
    }

    const enhanceMetricsDisabled = '//span[contains(text(),"enhanced_metrics_disabled: true")]';

    I.waitForElement(enhanceMetricsDisabled, 30);
    I.seeElement(enhanceMetricsDisabled);
    const basicMetricsDisabled = '//span[contains(text(),"basic_metrics_disabled: true")]';

    I.seeElement(basicMetricsDisabled);
  },

  async getNodeLink(serviceName) {
    const nodeIdLocator = `${this.fields.nodeIdLocatorPrefix + serviceName}")]`;

    return await I.grabAttributeFrom(nodeIdLocator, 'href');
  },

  async getServiceId(serviceName) {
    await I.waitForVisible(this.fields.showServiceDetails(serviceName), 60);
    await I.click(this.fields.showServiceDetails(serviceName));
    const serviceIdLocator = '//span[text()="Service ID"]/following-sibling::div//span';

    I.waitForVisible(serviceIdLocator, 30);
    const matchedServices = await I.grabNumberOfVisibleElements(serviceIdLocator);

    await assert.equal(
      matchedServices,
      1,
      `There must be only one entry for the newly added service with name ${serviceName}`,
    );

    const serviceId = await I.grabTextFrom(serviceIdLocator);

    await I.click(this.fields.hideServiceDetails(serviceName));

    return serviceId;
  },

  selectService(serviceName) {
    const serviceLocator = `${this.fields.serviceIdLocatorPrefix}${serviceName}")]/preceding-sibling::td/div[@data-testid="select-row"]`;

    I.waitForVisible(serviceLocator, 30);
    I.click(serviceLocator);
  },

  serviceExists(serviceName, deleted) {
    const serviceLocator = `${this.fields.serviceIdLocatorPrefix}${serviceName}")]`;

    if (deleted) {
      I.waitForInvisible(serviceLocator, 30);
    } else {
      I.waitForVisible(serviceLocator, 30);
    }
  },

  checkNodeExists(serviceName) {
    const nodeName = `${this.fields.serviceIdLocatorPrefix}${serviceName}")]`;

    I.waitForVisible(nodeName, 20);
  },

  getServicesId(serviceName) {
    return `${this.fields.serviceIdLocatorPrefix}${serviceName}")]/preceding-sibling::td[2]`;
  },

  async getCountOfAgents(serviceId) {
    const countOfAgents = await I.grabNumberOfVisibleElements(serviceId);

    assert.equal(countOfAgents, 0, 'The agents should be removed!');
  },

  async getCountOfRunningAgents() {
    return await I.grabNumberOfVisibleElements(this.fields.runningStatus);
  },

  async getCountOfPMMAgents() {
    return await I.grabNumberOfVisibleElements(this.fields.pmmAgentLocator);
  },

  selectAgent(agentType) {
    const agentLocator = `//table//tr/td[3][contains(text(),"${agentType}")]/preceding-sibling::td/div[@data-testid="select-row"]`;

    I.waitForVisible(agentLocator, 30);
    I.click(agentLocator);
  },

  async getAgentServiceID(agentType) {
    const serviceIdLocator = `//table//tr/td[3][contains(text(),"${agentType}")]/following-sibling::td//span[contains(text(), 'service_id:')]`;

    I.waitForVisible(serviceIdLocator, 30);
    const serviceIDs = await I.grabTextFrom(serviceIdLocator);

    return serviceIDs[0].slice(12, serviceIDs[0].lenght);
  },

  async getAgentID(agentType) {
    const agentIdLocator = `//table//tr/td[3][contains(text(),"${agentType}")]/preceding-sibling::td[1]`;

    I.waitForVisible(agentIdLocator, 30);

    return await I.grabTextFrom(agentIdLocator);
  },

  async getNodeCount() {
    I.waitForVisible(this.fields.tableCheckbox);

    return await I.grabNumberOfVisibleElements(this.fields.tableCheckbox);
  },

  verifyNodesCount(before, after) {
    assert.equal(before, after, 'The count of nodes should be same! Check the data!');
  },

  existsByid(id, deleted) {
    const agentIdLocator = `//table//tr/td[2][contains(text(),"${id}")]`;

    if (deleted) {
      I.waitForInvisible(agentIdLocator, 30);
    } else {
      I.waitForVisible(agentIdLocator, 30);
    }
  },

  selectAgentByID(id) {
    const agentIdLocator = `//table//tr/td[2][contains(text(),"${id}")]/preceding-sibling::td/div[@data-testid="select-row"]`;

    I.waitForVisible(agentIdLocator, 30);
    I.click(agentIdLocator);
  },

  deleteWithForceOpt() {
    I.click(this.fields.deleteButton);
    I.click(this.fields.forceModeCheckbox);
    I.click(this.fields.proceedButton);
  },

  async getCountOfItems() {
    return await I.grabNumberOfVisibleElements('$select-row');
  },

  async checkAllNotDeletedAgents(countBefore) {
    const countAfter = await this.getCountOfItems();

    /* we are using count 10 because we have two agents for RDS Instance also,
    hence (pmm-agent, Node exporter, postgres exporter, mysql exporter, QAN RDS,
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
    await I.click(this.fields.showServiceDetails(serviceName));
    I.click(this.fields.agentsLinkNew);
    await I.waitForVisible(agent, 30);
    I.click(this.fields.backToServices);
  },

  async saveAndConfirm() {
    I.click(this.fields.saveButton);
    I.seeElement(this.fields.savePopupMessage);
    I.click(this.fields.saveConfirmButton);
  },

  openEditServiceWizard(serviceName) {
    I.waitForElement(this.fields.kebabMenu(serviceName), 30);
    I.click(this.fields.kebabMenu(serviceName));
    I.waitForElement(this.fields.editButton, 30);
    I.click(this.fields.editButton);
    I.waitForElement(this.fields.editText, 30);
    I.seeElement(this.fields.editText);
  },

  updateServiceLabels(serviceParameters) {
    I.usePlaywrightTo('clear fields', async ({ page }) => {
      await page.locator(I.useDataQA('environment-text-input')).fill(serviceParameters.environment);
      await page.locator(I.useDataQA('replication_set-text-input')).fill(serviceParameters.replicationSet);
      await page.locator(I.useDataQA('cluster-text-input')).fill(serviceParameters.cluster);
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
