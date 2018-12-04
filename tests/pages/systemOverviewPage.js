const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/qyzrQGHmk/system-overview",
    fields: {
        pageHeaderText: "System Overview",
        notAvailableMetrics: "//span[contains(text(), 'N/A')]"
    },
    metrics: ["System Uptime", "Virtual CPUs", "Load Average", "RAM", "Memory Available", "CPU Usage", "CPU Saturation and Max Core Usage"],

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