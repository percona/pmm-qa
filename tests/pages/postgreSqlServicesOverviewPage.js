const I = actor();
const { openPanel } = require("./adminPage.js");

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/ieOKKVDWk/postgresql-services-overview",
    urlWithRecent: "graph/d/ieOKKVDWk/postgresql-services-overview?refresh=1m&orgId=1&from=now-1m&to=now",
    fields: {
        pageHeaderText: "PostgreSQL Services Overview",
        notAvailableMetrics: "//span[contains(text(), 'N/A')]",
        notAvailableDataPoints: "//div[contains(text(),'No data points')]"
    },

    graphsLocator(metricName) {
        locator = "//span[contains(text(), '" + metricName + "')]";
        return locator;
    },

    panelsToOpen: ["Checkpoint Stats Details", "Buffers Operations Details", "Blocks Operations Details", "Canceled Queries Details", "Cache Hit Details",
        "Conflicts & Locks Details", "Temp Files Details", "Transactions Details", "Tuples Details", "Autovacuum Details", "Connections Details"],

    openPanels() {
        for (let i in this.panelsToOpen) openPanel(this.panelsToOpen[i]);
    },

    metrics: ["Services", "Total Connections", "Total Disk-Page Buffers", "Total Memory Size for each Sort", "Total Shared Buffers", "Services Autovacuum",
        "Top 5 PostgreSQL Connections", "Total Connections", "Top 5 Active Connections", "Active Connections", "Autovacuum",
        "Total Tuples", "Max Fetched Tuples", "Max Returned Tuples", "Max Inserted Tuples", "Max Updated Tuples", "Max Deleted Tuples",
        "Top 5 Fetched Tuples Rate", "Fetched Tuples Rate", "Top 5 Returned Tuples Rate", "Returned Tuples Rate", "Inserted Tuples Rate", "Top 5 Inserted Tuples Rate",
        "Top 5 Updated Tuples Rate", "Updated Tuples Rate", "Top 5 Deleted Tuples Rate", "Deleted Tuples Rate",
        "Total  Transactions", "Max Commits  Transactions", "Max Rollback  Transactions", "Max  Transaction Duration", "Max  Number of Temp Files", "Max  Size of Temp Files",
        "Commit Transactions", "Top 5 Commit Transactions", "Rollback Transactions", "Top 5 Rollbacks Transactions", "Duration of Active Transactions", "Top 5 Duration of Active Transactions",
        "Duration of Other Transactions", "Top 5 Duration of Other Transactions", "Number of Temp Files", "Top 5 Number of Temp Files", "Size of Temp Files", "Top 5 Size of Temp Files",
        "Total Locks", "Total Deadlocks", "Total Conflicts", "Min Cache Hit Ratio", "Max Cache Hit Ratio", "Total Canceled Queries",
        "Locks", "Top 5 Locks", "Deadlocks", "Top 5 Deadlocks", "Conflicts", "Top 5 Conflicts", "Cache Hit Ratio", "Top 5 Lowest Cache Hit Ratio", "Canceled Queries", "Top 5 Canceled Queries",
        "Total Blocks Operations", "Max Blocks Writes", "Max Blocks Reads", "Max Allocated Buffers", "Total Written Files to disk", "Total Files Synchronization to Disk",
        "Read Operations with Blocks", "Top 5 Read Operations with Blocks", "Write Operations with Blocks", "Top 5 Write Operations with Blocks", "Allocated Buffers", "Top 5 Allocated Buffers",
        "Fsync calls by a backend", "Top 5 Fsync calls by a backend", "Written directly by a backend", "Top 5 Written directly by a backend", "Written by the background writer", "Top 5 Written by the background writer",
        "Written during checkpoints", "Top 5 Written during checkpoints", "Files Synchronization to disk", "Top 5 Files Synchronization to disk", "Written Files to Disk", "Top 5 Written Files to Disk"],

    verifyMetricsExistence () {
        for (let i in this.metrics) I.seeElement(this.graphsLocator(this.metrics[i]));

        I.dontSeeElement(this.fields.notAvailableMetrics);
        I.dontSeeElement(this.fields.notAvailableDataPoints);
    }
};