 'use strict';

module.exports = {
  graphPage: {
    pmmDemo: element(by.linkText("PMM Demo")),
    qanLink: element(by.linkText('Query Analytics')),
    orchLink: element(by.linkText('Orchestrator')),
    docLink: element(by.linkText('Documentation')),
    queryDistChart: element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Query Response Time Distribution"]')),
    timeRange: element(by.model('logTimeFrame')),
    instancesBtn: element(by.id('dropdownMenu1')),
    instancesAll: element.all(by.repeater('db in instances')),
    logList: element.all(by.repeater('log in agentLog'))
  },
    get: function(url) {
    browser.get(url + '/graph/');
  },

    clickPmmDemo: function() {
      this.graphPage.pmmDemo.click();
    },

};
