//var graphMongoDbRocks = require('../page_objects/mainQan.po.js')
var graphMainDash = require('../page_objects/graphMainDash.po.js')
var graphMariaDb = require('../page_objects/graphMariaDbDash.po.js')
var graphDiskSpace = require('../page_objects/graphDiskSpaceDash.po.js')

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
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("Disk Space");
    browser.sleep(25000);   
    text = element(by.tagName('html')).getText();
    expect(text).toContain("" + "Mountpoint Usage");
    expect(graphDiskSpace.getHostnameTitle().isDisplayed()).toBeTruthy();
    expect(graphDiskSpace.getMntPntUsgTitle().isDisplayed()).toBeTruthy();
    expect(graphDiskSpace.getMntPntTitle().isDisplayed()).toBeTruthy();
    expect(graphDiskSpace.getHostsTitle().isDisplayed()).toBeTruthy();
    expect(graphDiskSpace.getNginxTitle().isDisplayed()).toBeTruthy();
    expect(graphDiskSpace.getResolvTitle().isDisplayed()).toBeTruthy();
    expect(graphDiskSpace.getConsulTitle().isDisplayed()).toBeTruthy();
    expect(graphDiskSpace.getPromethTitle().isDisplayed()).toBeTruthy();
    expect(graphDiskSpace.getMysqlTitle().isDisplayed()).toBeTruthy();
 });

  it('should check MariaDB', function() {
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("MariaDB");
    expect(browser.getCurrentUrl()).toContain('dashboard/db/mariadb');
    browser.sleep(25000);
    expect(graphMariaDb.ariaPageCacheTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.ariaTransactTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.ariaPageTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.innodbOnlineTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.innodbDefrTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.innodbCondTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.innodbDeadTitle().isDisplayed()).toBeTruthy();

  }); 
});
