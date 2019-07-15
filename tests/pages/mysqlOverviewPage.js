const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/MQWgroiiz/mysql-overview",
    urlWithRecent: "graph/d/MQWgroiiz/mysql-overview?refresh=1m&orgId=1&from=now-1m&to=now",
    fields: {
        pageHeaderText: "MySQL Overview",
        notAvailableMetrics: "//span[contains(text(), 'N/A')]",
        systemChartsToggle: "//a[contains(text(), 'System Charts')]"
    },
    metrics: ["MySQL Uptime", "Current QPS", "InnoDB Buffer Pool Size", "Buffer Pool Size of Total RAM",
        "MySQL Connections", "MySQL Client Thread Activity", "MySQL Questions", "MySQL Thread Cache",
        "MySQL Temporary Objects", "MySQL Select Types", "MySQL Sorts", "MySQL Aborted Connections", "MySQL Table Locks",
        "Network Traffic", "Disk Latency"],

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