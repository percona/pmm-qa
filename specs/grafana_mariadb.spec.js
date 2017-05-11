var graphMainDash = require('../page_objects/graphMainDash.po.js')
var graphMariaDb = require('../page_objects/graphMariaDbDash.po.js')

describe('Grafana MariaDB test', function() {
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
 });

});
