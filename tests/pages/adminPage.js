const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/Fxvd1timk/home-dashboard?orgId=1",
    fields: {
        navigation: "//i[contains(@class, 'navbar-page-btn__search')]",
        timePickerMenu: "//button[@ng-click='ctrl.openDropdown()']",
        fromTime: "(//input[@input-datetime])[1]",
        applyCustomTimer: "//button[@ng-click=\"ctrl.applyCustom();\"]",
        backToDashboard: "//button[@ng-click='ctrl.close()']",
        discardChanges: "//button[@ng-click='ctrl.discard()']",
        metricTitle: "//span[@class='panel-title']"
    },

    // introducing methods
    async navigateToDashboard (folderName, dashboardName) {
        I.click(this.fields.navigation);
        I.waitForElement(this.prepareFolderLocator(folderName), 30);
        I.click(this.prepareFolderLocator(folderName));
        I.waitForElement(this.prepareDashboardLocator(dashboardName), 30);
        I.click(this.prepareDashboardLocator(dashboardName));
        let numOfElements = await I.grabNumberOfVisibleElements(this.fields.discardChanges);
        if(numOfElements > 0)
        {
            I.click('Discard');
        }
        I.wait(10);
        I.see(dashboardName);
    },

    prepareFolderLocator (folderName) {
        locator = "//span[contains(text(),'" + folderName + "') and @class='search-section__header__text']";
        return locator;
    },

    prepareDashboardLocator (dashboardName) {
        locator = "(//a[@ng-repeat]//div[contains(text(),'" + dashboardName + "') and @class='search-item__body-title'])[1]";
        return locator;
    },

    applyTimer (timeDiff) {
        I.click(this.fields.timePickerMenu);
        I.waitForElement(this.fields.fromTime, 30);
        I.fillField(this.fields.fromTime, "now-" + timeDiff);
        I.click(this.fields.applyCustomTimer);
        I.wait(5);
    },

    viewMetric (metricName) {
        I.click("//span[contains(text(), '"+ metricName +"')]");
        I.waitForElement("//span[contains(text(), '" + metricName + "')]/../span/ul/li[1]", 30);
        I.click("//span[contains(text(), '" + metricName + "')]/../span/ul/li[1]");
        I.wait(10);
    },

    async handleLazyLoading (timesPageDown) {
        I.click(this.fields.metricTitle);
        I.wait(10);
        I.click(this.fields.metricTitle);
        for (var i = 0; i < timesPageDown; i++)
        {
            I.pressKey('PageDown');
            I.wait(2);
        }
    }
}