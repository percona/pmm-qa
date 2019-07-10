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
        I.click("/html/body/grafana-app/div/div/div/react-container/div/div[2]/div/div[1]/div/div[1]/dashboard-submenu/div/div[46]/dash-links-container/dash-link[2]/div/a");
        for(let i=0; i<300; i++)
            I.pressKey("ArrowDown")

        for (let i in this.metrics) {
            I.seeElement(this.graphsLocator(this.metrics[i]));
        }
        I.dontSeeElement(this.fields.notAvailableMetrics);
        I.dontSeeElement(this.fields.notAvailableDataPoints);
    }
};