'use strict';

module.exports = {
  managementPage: {
    managementBtn: element(by.xpath('//*[contains(@title,"Configure query analitics")]')),    
    collectInterval: element(by.name('interval')),
    selectedConnection: element(by.className('btn btn-warning navbar-btn dropdown-toggle ng-binding')),
    statusTab: element(by.xpath('//a[text()="STATUS"]')),  
    logTab: element(by.xpath('//a[text()="LOG"]')),  
    settingsTab: element(by.xpath('//a[text()="SETTINGS"]'))  
},

  get: function() {
    browser.get('/qan/');
    this.managementPage.managementBtn.click();
    browser.sleep(1000);
    browser.waitForAngular();
  },

  clickLogTab: function(connection)  {
    this.managementPage.logTab.click();
  },

  clickStatusTab: function(connection)  {
    this.managementPage.statusTab.click();
  },

  clickSettingsTab: function(connection)  {
    this.managementPage.settingsTab.click();
  }
};
