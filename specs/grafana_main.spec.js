var graphMainDash = require('../page_objects/graphMainDash.po.js')
var graphMariaDb = require('../page_objects/graphMariaDbDash.po.js')
var graphDiskSpace = require('../page_objects/graphDiskSpaceDash.po.js')

describe('Cross-Server dashboards tests', function() {
  beforeEach(function () {
    graphMainDash.get(browser.baseUrl);
    browser.ignoreSynchronization = true;
    browser.sleep(15000);
       browser.wait(function() {
      return browser.driver.getCurrentUrl().then(function(url) {
        return /cross-server-graphs/.test(url);
      });
    });
    browser.sleep(60000)
  });

  afterEach(function () {
  });


  it('should check all charts exist', function() {
    expect(browser.getCurrentUrl()).toContain('dashboard/db/cross-server-graphs');
    expect(graphMainDash.graphPage.loadAvgChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.memUsgChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mysqlConnChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mysqlQueryChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mysqlTrafChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.netTrafChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.sysInfoChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mysqlInfoChart.isDisplayed()).toBeTruthy();
  });

});
