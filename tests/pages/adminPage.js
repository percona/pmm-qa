const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/Fxvd1timk/home-dashboard?orgId=1",
    fields: {
        navigation: "//div[@class='navbar']//a",
        updateWidget: "//div[@id='pmm-update-widget']",
        checkUpdateButton: "//button[@class='check-update-button']",
        updateButton: "//button[@ng-if='shouldBeUpdated']"
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

    checkForUpdate (update) {
        I.click(this.fields.checkUpdateButton);
        I.wait(5);
        I.waitForVisible(this.fields.updateButton);
        if (update)
        {
            I.click(this.fields.updateButton);
            I.wait(600);
        }
    }
}