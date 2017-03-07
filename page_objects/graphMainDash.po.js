 'use strict';

module.exports = {
  graphPage: {
    pmmDemo: element(by.linkText("PMM Demo")),
    qanLink: element(by.linkText('Query Analytics')),
    orchLink: element(by.linkText('Orchestrator')),
    docLink: element(by.linkText('Documentation')),
    queryDistChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Query Response Time Distribution"]')),
    loadAvgChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Load Average"]')),
    memDistrChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Memory Distribution"]')),
    procChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Processes"]')),
    forksChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Forks"]')),
    cpuUsgChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "CPU Usage"]')),
    searchFld: element(by.xpath("//div[@class='search-field-wrapper']/span/input")),
    logList: element.all(by.repeater('log in agentLog'))
  },
    get: function(url) {
    browser.get(url + '/graph/');
  },

    clickPmmDemo: function() {
      this.graphPage.pmmDemo.click();
    },

    searchDashboard: function(name) {
      this.graphPage.searchFld.sendKeys(name);
      browser.sleep(5000);
      element(by.xpath("//span[@class='search-result-link']//span[.='" + name + "']")).click();
    },
};
