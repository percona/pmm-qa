const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/IvhES05ik/postgresql-overview",
    urlWithRecent: "graph/d/IvhES05ik/postgresql-overview?refresh=1m&orgId=1&from=now-1m&to=now",
    fields: {
        pageHeaderText: "PostgreSQL Overview",
        notAvailableMetrics: "//span[contains(text(), 'N/A')]",
        notAvailableDataPoints: "//div[contains(text(),'No data points')]"
    },
    metrics: ["Version", "Max Connections", "Shared Buffers", "Disk-Page Buffers", "Memory Size for each Sort",
        "Disk Cache Size", "Autovacuum", "PostgreSQL Connections", "Active Connections",
        "Tuples", "Read Tuple Activity", "Transactions", "Duration of Transactions", "Checkpoint stats",
        "Number of Locks", "Conflicts/Deadlocks"],

    graphsLocator (metricName){
        locator = "//span[contains(text(), '"+ metricName +"')]";
        return locator;
    },

    verifyMetricsExistence () {
        for (var i in this.metrics) {
            I.seeElement(this.graphsLocator(this.metrics[i]));
        }
        I.dontSeeElement(this.fields.notAvailableMetrics);
        I.dontSeeElement(this.fields.notAvailableDataPoints);
    }
}