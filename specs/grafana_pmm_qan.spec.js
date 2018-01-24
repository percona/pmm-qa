var graphMainDash = require('../page_objects/graphMainDash.po.js')
var graphMariaDb = require('../page_objects/graphMariaDbDash.po.js')

describe('Grafana PMM QAn dashboard test', function() {
  beforeEach(function () {
    browser.get(browser.baseUrl +'/graph',10000);
    browser.ignoreSynchronization = true;
    browser.wait(function() {
      return browser.driver.getCurrentUrl().then(function(url) {
        return /cross-server-graphs/.test(url);
      });
    });
      browser.sleep(60000);
      expect(browser.getTitle()).toEqual('Grafana - Cross Server Graphs');
  });

  afterEach(function () {

  });


  it('should check PMM QAN dashboard exists', function() {
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("_PMM Query Analytics");
    expect(browser.getCurrentUrl()).toContain('_pmm-query-analytics');
    /*elem =  element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Aria Pagecache Reads/Writes"]'));
    browser.wait(function() {
    return browser.isElementPresent(elem);
    }, 130000);

expect(browser.isElementPresent(elem)).toBeTruthy();
   //browser.sleep(65000);
  it('should check chart titles', function() {
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("MariaDB");
    expect(browser.getCurrentUrl()).toContain('dashboard/db/mariadb');
    //browser.ignoreSynchronization = false;
    elem =  element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Aria Pagecache Reads/Writes"]'));
    browser.wait(function() {
    return browser.isElementPresent(elem);
    }, 130000);
    expect(browser.isElementPresent(elem)).toBeTruthy();
    expect(graphMariaDb.ariaPageCacheTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.ariaTransactTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.ariaPageTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.innodbOnlineTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.innodbDefrTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.innodbCondTitle().isDisplayed()).toBeTruthy();
    expect(graphMariaDb.innodbDeadTitle().isDisplayed()).toBeTruthy();
<<<<<<< HEAD
 */ });
});
