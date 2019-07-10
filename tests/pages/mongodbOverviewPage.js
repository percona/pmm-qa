const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/6Lk9wMHik/mongodb-overview",
    urlWithRecent: "graph/d/6Lk9wMHik/mongodb-overview?refresh=1m&orgId=1&from=now-1m&to=now",
    fields: {
        pageHeaderText: "MongoDB Overview",
        notAvailableMetrics: "//span[contains(text(), 'N/A')]",
        notAvailableDataPoints: "//div[contains(text(),'No data points')]"
    },
    metrics: ["Command Operations", "Connections", "Cursors", "Document Operations", "Queued Operations",
        "Query Efficiency", "Scanned and Moved Objects", "getLastError Write Time", "getLastError Write Operations",
        "Assert Events", "Page Faults"],

    graphsLocator (metricName){
        locator = "//span[contains(text(), '"+ metricName +"')]";
        return locator;
    },

    verifyMetricsExistence () {
        I.click("/html/body/grafana-app/div/div/div/react-container/div/div[2]/div/div[1]/div/div[1]/dashboard-submenu/div/div[7]/dash-links-container/dash-link[2]/div/a");
        for (let i = 0; i < 300; i++) {
            console.log(i);
            I.pressKey("ArrowDown")
        }

        for (let i in this.metrics) {
            I.seeElement(this.graphsLocator(this.metrics[i]));
        }
        I.dontSeeElement(this.fields.notAvailableMetrics);
        I.dontSeeElement(this.fields.notAvailableDataPoints);
    }
}