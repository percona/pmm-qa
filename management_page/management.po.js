'use strict';

module.exports = {
  managementPage: {
    collectInterval: element(by.name('interval')),
    selectedConnection: element(by.className('btn btn-warning navbar-btn dropdown-toggle ng-binding')),
    statusTab: element(by.xpath('//a[text()="Status"]'))  
    logTab: element(by.xpath('//a[text()="Log"]'))  
    settingsTab: element(by.xpath('//a[text()="Settings"]'))  
},

  get: function() {
    browser.get('/qan/#/management/');
    browser.waitForAngular();
  },

  clickLogTab: function(connection)  {
    this.managementPage.logTab.click();
  },

  clickStatusTab: function(connection)  {
    this.managementPage.statusTab.click();
  },

  clickLogTab: function(connection)  {
    this.managementPage.settingsTab.click();
  },
};
