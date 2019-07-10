const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/wjZRrTiiz/trends-dashboard",
    fields: {
        pageHeaderText: "Trends Dashboard",
        notAvailableMetrics: "//span[contains(text(), 'N/A')]"
    },
    metrics: ["CPU Usage", "I/O Read Activity", "I/O Write Activity", "MySQL Questions", "InnoDB Rows Read", "InnoDB Rows Changed"],

    graphsLocator (metricName){
        locator = "//span[contains(text(), '"+ metricName +"')]";
        return locator;
    },

    verifyMetricsExistence () {
        I.click("/html/body/grafana-app/div/div/div/react-container/div/div[2]/div/div[1]/div/div[1]/dashboard-submenu/div/div[6]/dash-links-container/dash-link[2]/div/a");
        for(let i=0; i<300; i++)
            I.pressKey("ArrowDown")

        for (let i in this.metrics) {
            I.seeElement(this.graphsLocator(this.metrics[i]));
        }
        I.dontSeeElement(this.fields.notAvailableMetrics);
    }
};
