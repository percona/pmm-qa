const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/Fxvd1timk/home-dashboard?orgId=1",
    fields: {
        navigation: "//div[@class='navbar']//a",
        timePickerMenu: "//button[@ng-click='ctrl.openDropdown()']",
        fromTime: "(//input[@input-datetime])[1]",
        applyCustomTimer: "//button[@ng-click=\"ctrl.applyCustom();\"]"
    },

    // introducing methods
    navigateToDashboard (folderName, dashboardName) {
        I.click(this.fields.navigation);
        I.waitForElement(this.prepareFolderLocator(folderName), 30);
        I.click(this.prepareFolderLocator(folderName));
        I.waitForElement(this.prepareDashboardLocator(dashboardName), 30);
        I.click(this.prepareDashboardLocator(dashboardName));
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
        I.waitForElement("//span[@class='dropdown-item-text' and contains(text(), 'View')]", 30);
        I.click("//span[@class='dropdown-item-text' and contains(text(), 'View')]");
        I.wait(10);
    }
}