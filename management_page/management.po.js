'use strict';

module.exports = {
  managementPage: {
    collectInterval: element(by.name('interval')),
    selectedConnection: element(by.className('btn btn-warning navbar-btn dropdown-toggle ng-binding')),
  },

  get: function() {
    browser.get('/qan/#/management/new-mysql/');
    browser.waitForAngular();
  },

  selectConnection: function(connection)  {
    this.mysqlConnectionPage.selectedConnection.click();
    //element(by.xpath('//*span[contains(@text,"' + connection  + '")]')).click();
    element(by.xpath('//span[text()="MySQL: ' + connection + '"]')).click();
  },

};
