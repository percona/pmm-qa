//var graphMongoDbRocks = require('../page_objects/mainQan.po.js')
var graphMainDash = require('../page_objects/graphMainDash.po.js')
var url = 'http://pmmdemo.percona.com'

describe('Selenium Test Case', function() {
  beforeEach(function () {
    graphMainDash.get(url);
    browser.ignoreSynchronization = true;
    browser.sleep(15000);
       browser.wait(function() {
      return browser.driver.getCurrentUrl().then(function(url) {
        return /pmm-demo/.test(url);
      });
    });
  });

  afterEach(function () {

  });

  it('should check all links on top', function() {
    browser.sleep(25000);
    expect(graphMainDash.graphPage.qanLink.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.orchLink.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.docLink.isDisplayed()).toBeTruthy();
    
    expect(graphMainDash.graphPage.queryDistChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.loadAvgChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.memDistrChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.procChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.forksChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.cpuUsgChart.isDisplayed()).toBeTruthy();
  });

  it('should check Disk Space dashboard', function() {
    graphMainDash.clickPmmDemo();
    graphMainDash.searchDashboard("Disk Space");
    expect(browser.getCurrentUrl()).toContain('dashboard/db/disk-space');
    browser.sleep(25000);
    expect(graphMainDash.graphPage.mntPntUsgChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mntPntChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mntBootChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mntPntRemChart.isDisplayed()).toBeTruthy();
  });

  it('should check Cross Server Graphs dashboard', function() {
    graphMainDash.clickPmmDemo();
    graphMainDash.searchDashboard("Cross Server Graphs");
    expect(browser.getCurrentUrl()).toContain('dashboard/db/cross-server-graphs');
    browser.sleep(25000);
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
