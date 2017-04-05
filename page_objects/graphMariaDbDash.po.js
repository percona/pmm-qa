 'use strict';

module.exports = {
  graphPage: {
    areaPageCache: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Aria Pagecache Reads/Writes"]')),
    memUsgChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Memory Usage"]')),
    mysqlConnChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "MySQL Connections"]')),
    mysqlQueryChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "MySQL Queries"]')),
    mysqlTrafChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "MySQL Traffic"]')),
    netTrafChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Network Traffic"]')),
    sysInfoChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "System Info"]')),
    mysqlInfoChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "MySQL Info"]')),
    searchFld: element(by.xpath("//div[@class='search-field-wrapper']/span/input")),
    logList: element.all(by.repeater('log in agentLog'))
  },
    get: function(url) {
    browser.get(url + '/graph/');
    browser.sleep(5000);
  },

    areaPageCacheTitle: function() {
      this.graphPage.areaPageCache;
    },
};
