const {I, mysqlOverviewPage} = inject();
let screenshots =[];

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/mysql-instance-summary/mysql-instance-summary",
    urlWithRecent: "graph/d/MQWgroiiz/mysql-overview?refresh=1m&orgId=1&from=now-1m&to=now",
    fields: {
        pageHeaderText: "MySQL Overview",
        notAvailableMetrics: "//span[contains(text(), 'N/A')]",
        systemChartsToggle: "//a[contains(text(), 'Node Summary')]",
        graphId:"//div[contains(@id, 'panel')][div[@class='panel-height-helper']]",
        graphLegend:"//div[@class='graph-legend']",
        panelTitle:"//span[@class='panel-title-text']",
        panelContent: "//div[contains(@class, 'panel-content')]/ng-transclude[@class='panel-height-helper']",
        graphTooltipTime: "//div[@class='graph-tooltip-time']",
        dashboardName: "mysql_instance_summary_"
    },
    metrics: ["MySQL Uptime", "Current QPS", "InnoDB Buffer Pool Size", "Buffer Pool Size of Total RAM",
        "MySQL Connections", "MySQL Client Thread Activity", "MySQL Questions", "MySQL Thread Cache",
        "MySQL Temporary Objects", "MySQL Select Types", "MySQL Sorts", "MySQL Slow Queries", "MySQL Aborted Connections", "MySQL Table Locks",
        "Network Traffic", "MySQL Network Usage Hourly", "MySQL Internal Memory Overview", "Top Command Counters",
        "Top Command Counters Hourly", "MySQL Handlers", "MySQL Transaction Handlers", "Process States", "Top Process States Hourly",
        "MySQL Query Cache Memory", "MySQL Query Cache Activity", "MySQL File Openings", "MySQL Open Files", "MySQL Table Open Cache Status",
        "MySQL Open Tables", "MySQL Table Definition Cache"],

    graphsLocator (metricName){
        locator = "//span[contains(text(), '"+ metricName +"')]";
        return locator;
    },

    verifyMetricsExistence () {
        for (var i in this.metrics) {
            I.seeElement(this.graphsLocator(this.metrics[i]));
        }
        I.dontSeeElement(this.fields.notAvailableMetrics);
    },

    async grabPanelIdAttribute() {
        let panelId = await I.grabAttributeFrom(this.fields.graphId, 'id');
        return panelId;
    },

    async getIds() {
        let panelId = await this.grabPanelIdAttribute();
        console.log(panelId);
        let ids = [];
        for (let i = 0; i < panelId.length; i++) {
            ids.push(panelId[i].slice(6));
        };
        console.log(ids);
        return ids;
    },

    async waitForGraphLoaded() {
        await I.waitForVisible(this.fields.panelTitle, 30);
        await I.waitForVisible(this.fields.panelContent, 30);
        I.wait(2);
    },

    async checkForGraph() {
        if (await I.grabNumberOfVisibleElements(`${this.fields.panelContent}//canvas`) == 1) {
            I.wait(1);
        } else {
            console.log("no Graph");
        }
    },

    async createEachPanelScreenshot() {
        let ids = await this.getIds();
        ids.shift();
        console.log(ids);
        let currentURL = await I.grabCurrentUrl();
        for (let i = 0; i < ids.length; i++) {
            I.amOnPage(`${currentURL}&fullscreen&panelId=${ids[i]}`);
            await this.waitForGraphLoaded();
            let title = await I.grabTextFrom(this.fields.panelTitle);
            let screenshotName = this.fields.dashboardName + title.toString().toLowerCase().replace(' ','_') + ".png";
            I.saveScreenshot(screenshotName);
            screenshots.push(screenshotName);
        }
    },

    async compareEachScreenshot() {
        for (let screenshot in screenshots) {
            await I.seeVisualDiff(screenshots[screenshot], {tolerance: 10, prepareBaseImage:false});
        }
    }
}