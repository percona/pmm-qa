const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/000000205/compare-system-parameters",
    fields: {
        pageHeaderText: "Compare System Parameters",
        notAvailableMetrics: "//span[contains(text(), 'N/A')]"
    },
    metrics: ["System Info", "System Uptime", "CPU Cores", "RAM", "Saturation Metrics", "CPU Usage", "Network Traffic", "Load Average", "I/O Activity"],

    graphsLocator (metricName){
        locator = "//span[contains(text(), '"+ metricName +"')]";
        return locator;
    },

    verifyMetricsExistence () {
        I.click("/html/body/grafana-app/div/div/div/react-container/div/div[2]/div/div[1]/div/div[1]/dashboard-submenu/div/div[5]/dash-links-container/dash-link[2]/div/a");
        for(let i=0; i<300; i++)
            I.pressKey("ArrowDown")

        console.log("Hopefully was able to scroll down this time....");
        for (let i in this.metrics) {
            I.seeElement(this.graphsLocator(this.metrics[i]));
        }
        I.dontSeeElement(this.fields.notAvailableMetrics);
    }
};