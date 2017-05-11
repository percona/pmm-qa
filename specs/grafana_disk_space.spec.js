var graphMainDash = require('../page_objects/graphMainDash.po.js')
var graphDiskSpace = require('../page_objects/graphDiskSpaceDash.po.js')

describe('Disk Space dashboards tests', function() {
  beforeEach(function () {
    graphMainDash.get(browser.baseUrl);
    browser.ignoreSynchronization = true;
    browser.sleep(15000);
    elem = element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Load Average"]'));

browser.wait(function() {
      return browser.driver.getCurrentUrl().then(function(url) {
        return /cross-server-graphs/.test(url);
      });
    });
   var EC = protractor.ExpectedConditions;
   browser.wait(EC.visibilityOf(elem),100000);
   browser.sleep(10000);
   expect(browser.getTitle()).toEqual('Grafana - Cross Server Graphs');
  });

  afterEach(function () {

  });

  it('should check charts titles', function() {
    /*graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("Disk Space");
    
    elem = element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint Usage"]'));
    browser.wait(function() {
       return browser.isElementPresent(elem);
    }, 130000);

    expect(browser.isElementPresent(elem)).toBeTruthy();    
   /* browser.ignoreSynchronization = false;  
    browser.sleep(75000);   
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
 */});

});
