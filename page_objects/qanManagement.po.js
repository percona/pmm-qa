'use strict';

module.exports = {
  managementPage: {
    alertDang: element(by.css('.alert-danger')),
    logTab: element(by.linkText('LOG')),
    statusTab: element(by.linkText('STATUS')),
    settingsTab: element(by.linkText('SETTINGS')),
    backMain: element(by.buttonText('Go back to queries page')),
    timeRange: element(by.model('logTimeFrame')),
    instancesBtn: element(by.id('dropdownMenu1')),
    instancesAll: element.all(by.repeater('db in instances')),
    logList: element.all(by.repeater('log in agentLog'))
  },

  clickLog: function() {
    this.managementPage.logTab.click();
  },


  clickInstancesMenu: function() {
    this.managementPage.instancesBtn.click();
  },


  returnInstancesCount: function() {
    return this.managementPage.instancesAll.count();
  },

  clickEachInstance: function() {
    this.managementPage.instancesAll.each(function(element, index) {
        element.getText().then(function (text) {
      });
    });
  },

  returnInstanceList: function() {
    return this.managementPage.instancesAll;
  }
};
