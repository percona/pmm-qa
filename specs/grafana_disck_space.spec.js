var graphMainDash = require('../page_objects/graphMainDash.po.js')
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

});
