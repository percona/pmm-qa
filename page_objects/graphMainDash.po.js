 'use strict';

module.exports = {
  graphPage: {
    pmmDemo: element(by.linkText("PMM Demo")),
    logTab: element(by.linkText('LOG')),
    statusTab: element(by.linkText('STATUS')),
    settingsTab: element(by.linkText('SETTINGS')),
    backMain: element(by.buttonText('Go back to queries page')),
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
