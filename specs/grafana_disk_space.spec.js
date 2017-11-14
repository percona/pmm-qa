var graphMainDash = require('../page_objects/graphMainDash.po.js')
var graphDiskSpace = require('../page_objects/graphDiskSpaceDash.po.js')

describe('Disk Space dashboards tests', function() {
  beforeEach(function () {
    browser.get(browser.baseUrl +'/graph',50000);
    browser.ignoreSynchronization = true;
    browser.sleep(15000);

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

  it('should check Disk Space dashboard', function() {
   graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("Disk Space");
/* browser.ignoreSynchronization = false;    
elem = element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Mountpoint Usage"]'));
    browser.wait(function() {
    return browser.isElementPresent(elem);
    }, 130000);

expect(browser.isElementPresent(elem)).toBeTruthy();    
browser.sleep(75000);   
    text = element(by.tagName('html')).getText();
    expect(text).toContain("" + "Mountpoint Usage");
    /*expect(graphDiskSpace.getHostnameTitle().isDisplayed()).toBeTruthy();
=======
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
>>>>>>> new-gui-qan
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
