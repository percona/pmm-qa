const { I, adminPage } = inject();
var assert = require('assert');
module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/pmm-inventory/pmm-inventory?orgId=1",
    fields: {
        iframe: "//div[@class='panel-content']//iframe",
        inventoryTable: "//table",
        inventoryTableRows: "//table//tr",
        inventoryTableColumn: "//table//td",
        agentsLink: "//div[@role='tab'][contains(text(),'Agents')]",
        nodesLink: "//div[@role='tab'][contains(text(),'Nodes')]",
        pmmAgentLocator: "//table//td[contains(text(), 'PMM Agent')]",
    },

    async getServiceId (serviceName)
    {
        let totalServices = await I.grabNumberOfVisibleElements(this.fields.inventoryTableRows);
        var matchedServices = 0;
        for (var i = 1; i < totalServices; i++)
        {
            var currentServiceName = await I.grabTextFrom(this.fields.inventoryTableRows + "[" + i + "]/" + "td[3]");
            if (serviceName == currentServiceName) {
                var currentServiceId = await I.grabTextFrom(this.fields.inventoryTableRows + "[" + i + "]/" + "td[1]");
                matchedServices += 1;
            }
        }
        assert.equal(matchedServices, 1, "Their must only be one entry for the newly added service with name " + serviceName );
        return currentServiceId;
    },

    async checkAgentStatus (serviceId) {
        I.click(this.fields.agentsLink);
        I.waitForElement(this.fields.pmmAgentLocator, 60);
        adminPage.peformPageDown(5);
        I.waitForElement(this.fields.inventoryTable, 60);
        let totalAgents = await I.grabNumberOfVisibleElements(this.fields.inventoryTableRows);
        var agentMatched = 0;
        for (var i = 1; i < totalAgents; i++)
        {
            var agentForServiceId = await I.grabNumberOfVisibleElements(this.fields.inventoryTableRows + "[" + i + "]/" + "td[3]//span[contains(text(), '" + serviceId + "')]");
            if (agentForServiceId == 1){
                agentMatched += 1;
                var statusIsRunning = await I.grabNumberOfVisibleElements(this.fields.inventoryTableRows + "[" + i + "]/" + "td[3]//span[contains(text(), 'status: RUNNING')]" );
                assert.equal(statusIsRunning, 1, "status for serviceId " + serviceId + " is not equal to Running, hence failing");
            }
        }
        assert.equal(agentMatched, 2, " Service ID must have only 2 Agents running for different services" + serviceId );
    }
}