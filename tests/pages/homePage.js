const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/pmm-home/home-dashboard?orgId=1",
    fields: {
        systemsUnderMonitoringCount: "//span[@class='panel-title-text' and contains(text(), 'Systems under monitoring')]//../../../..//span[@class='singlestat-panel-value']",
        dbUnderMonitoringCount: "//span[@class='panel-title-text' and contains(text(), 'Monitored DB Instances')]//../../../..//span[@class='singlestat-panel-value']",
        dashboardHeaderText: "Percona Monitoring and Management",
        dashboardHeaderLocator: "//div[contains(@class, 'dashboard-header')]",
        checkUpdateButton: "//button[@class='check-update-button']",
        triggerUpdate: "//button[@ng-click='update()']",
        updateProgressModal: "//div[@class='modal-content']",
        reloadButtonAfterUpgrade: "//button[@ng-click='reloadAfterUpdate()']",
        pmmUpdateWidget: "#pmm-update-widget"
    },

    // introducing methods
    getCount (field) {
        return I.grabTextFrom(field);
    },

    async upgradePMM(){
        I.click(this.fields.checkUpdateButton);
        I.wait(5);
        I.waitForElement(this.fields.triggerUpdate, 30);
        I.seeElement(this.fields.triggerUpdate);
        I.click(this.fields.triggerUpdate);
        I.waitForElement(this.fields.updateProgressModal, 30);
        I.waitForText("Update in progress", 30, this.fields.updateProgressModal);
        I.waitForText("Successfully updated", 240, this.fields.updateProgressModal);
        I.click(this.fields.reloadButtonAfterUpgrade);
        I.wait(10);
        I.waitForElement(this.fields.triggerUpdate, 30);
        I.seeElement(this.fields.triggerUpdate);
        I.click(this.fields.triggerUpdate);
        I.see("You are up to date", this.fields.pmmUpdateWidget);
    }
}