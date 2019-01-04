const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/Fxvd1timk/home-dashboard?orgId=1",
    fields: {
        systemsUnderMonitoringCount: "//span[@class='panel-title-text' and contains(text(), 'Systems under monitoring')]//../../../..//span[@class='singlestat-panel-value']",
        dbUnderMonitoringCount: "//span[@class='panel-title-text' and contains(text(), 'Monitored DB Instances')]//../../../..//span[@class='singlestat-panel-value']",
        dashboardHeaderText: "Percona Monitoring and Management",
        dashboardHeaderLocator: "//div[contains(@class, 'dashboard-header')]"
    },

    // introducing methods
    getCount (field) {
        return I.grabTextFrom(field);
    }
}