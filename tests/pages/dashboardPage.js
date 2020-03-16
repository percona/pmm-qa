const {I} = inject();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/login",
    fields: {
        notAvailableMetrics: "//span[contains(text(), 'N/A')]",
        metricTitle: "//span[@class='panel-title']",
        collapsedDashboardRow: "//div[@class='dashboard-row dashboard-row--collapsed']/a"
    },

    // introducing methods
    verifyMetricsExistence (metrics) {
        for (var i in metrics) {
            I.seeElement(this.graphsLocator(metrics));
        }
        I.dontSeeElement(this.fields.notAvailableMetrics);
    },

    graphsLocator (metricName){
        let locator = "//span[contains(text(), '"+ metricName +"')]";
        return locator;
    },

    verifyThereIsNoGraphsWithNA() {
        I.dontSeeElement(this.fields.notAvailableMetrics);
        I.dontSeeElementInDOM(this.fields.notAvailableMetrics);
    },

    async expandEachDashboardRow(halfToExpand) {
        let sectionsToExpand;
        let sections = await I.grabTextFrom(this.fields.collapsedDashboardRow);
        if (halfToExpand == 1) {
            sectionsToExpand = sections.slice(0,sections.length/2);
        } else if (halfToExpand == 2) {
            sectionsToExpand = sections.slice(sections.length/2 , sections.length);
        } else {
            sectionsToExpand = sections;
        }
        await this.expandRows(sectionsToExpand);
    },

    async expandRows(sectionsToExpand){
        let sections;
        if (typeof sectionsToExpand == "string") {
            sections = [sectionsToExpand];
        } else {
            sections = sectionsToExpand;
        }
        for (let i = 0; i < sections.length; i++ ) {
            let sectionName = sections[i].toString().split("(");
            let rowToExpand = `${this.fields.collapsedDashboardRow}[contains(text(), '${sectionName[0]}')]`;
            I.click(rowToExpand);
            I.wait(1);
        }
    },
    waitForDashboardOpened() {
        I.waitForElement(this.fields.metricTitle, 30);
    }
}