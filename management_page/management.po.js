'use strict';

module.exports = {
  managementPage: {
    managementBtn: element(by.xpath('//*[contains(@title,"Configure query analitics")]')),    
    collectInterval: element(by.name('interval')),
    selectedConnection: element(by.className('btn btn-warning navbar-btn dropdown-toggle ng-binding')),
    statusTab: element(by.xpath('//a[text()="STATUS"]')),  
    logTab: element(by.xpath('//a[text()="LOG"]')),  
    settingsTab: element(by.xpath('//a[text()="SETTINGS"]')),
    applyBtn: element(by.css('[ng-click="setQanConfig(selected_agent)"]')),
    sendQueryExamples: element(by.model('qanConf.ExampleQueries')), 
    collectFrom: element(by.name('source'))     
},

  get: function() {
    browser.get('/qan/');
    browser.waitForAngular();
    this.managementPage.managementBtn.click();
   browser.wait(10000);
    // var element = this.managementPage.statusTab;
    //browser.wait(protractor.ExpectedConditions.elementToBeClickable(element), 15000, 'Element not clickable');

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
  },

  inputCollectInterval: function(interval)  {
    this.managementPage.collectInterval.clear();
    this.managementPage.collectInterval.sendKeys(interval);
  },

  clickApply: function(connection)  {
    this.managementPage.applyBtn.click();
  },

  returnCollectInterval: function()  {
    return this.managementPage.collectInterval.getAttribute('value');
  },

 openAlertDialog() {
    return browser.wait(() => {
      this.pressSubmitButton();

      return browser.switchTo().alert().then(
        function(alert) { alert.dismiss(); return true; },
        function() { return false; }
      );
    });
  }
};
