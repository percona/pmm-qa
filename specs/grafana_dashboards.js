//var graphMongoDbRocks = require('../page_objects/mainQan.po.js')
var graphMainDash = require('../page_objects/graphMainDash.po.js')
var graphMariaDbDash = require('../page_objects/graphMariaDbDash.po.js')

describe('Selenium Test Case', function() {
  beforeEach(function () {
    graphMainDash.get(browser.baseUrl);
    browser.ignoreSynchronization = true;
    browser.sleep(15000);
       browser.wait(function() {
      return browser.driver.getCurrentUrl().then(function(url) {
        return /cross-server-graphs/.test(url);
      });
    });
  });

  afterEach(function () {

  });


  it('should check main (Cross Server Graphs) dashboard', function() {
    browser.sleep(25000);
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

  it('should check Disk Space dashboard', function() {
   // graphMainDash.clickPmmDemo();
    graphMainDash.clickOpenSearch();
    browser.sleep(25000);
    graphMainDash.searchDashboard("Disk Space");
    expect(browser.getCurrentUrl()).toContain('dashboard/db/disk-space');
    browser.sleep(25000);
    expect(graphMainDash.graphPage.mntPntUsgChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mntPntChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mntBootChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mntPntRemChart.isDisplayed()).toBeTruthy();
  });

  it('should check MariaDB', function() {
    //graphMainDash.clickPmmDemo();
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("MariaDB");
    expect(browser.getCurrentUrl()).toContain('dashboard/db/mariadb');
    browser.sleep(25000);
    expect(graphMariaDbDash.graphPage.ariaPageCache.isDisplayed()).toBeTruthy();

  });
});
