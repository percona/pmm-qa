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
        for (var i in this.metrics) {
            I.seeElement(this.graphsLocator(this.metrics[i]));
        }
        I.dontSeeElement(this.fields.notAvailableMetrics);
    }
}