var graphMainDash = require('../page_objects/graphMainDash.po.js')
var graphMariaDb = require('../page_objects/graphMariaDbDash.po.js')
var graphDiskSpace = require('../page_objects/graphDiskSpaceDash.po.js')
var data = require('../test_data/grafana_data.json')
var random = require('../common/utils.js')

describe('Cross-Server dashboards tests', function() {
  beforeEach(function () {
    browser.get(browser.baseUrl+'/graph');
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


  it('should check main (Cross Server Graphs) dashboard', function() {
    expect(browser.getCurrentUrl()).toContain('dashboard/db/cross-server-graphs');
    /*expect(graphMainDash.graphPage.loadAvgChart.isDisplayed()).toBeTruthy();
  it('should check all charts exist', function() {
    elem =  element(by.xpath('//span[contains(@class, "panel-title-text drag-handle") and (text()) = "Load Average"]'));
    browser.wait(function() {
    return browser.isElementPresent(elem);
    }, 130000);
    expect(browser.getCurrentUrl()).toContain('dashboard/db/cross-server-graphs');
    expect(graphMainDash.graphPage.loadAvgChart.isDisplayed()).toBeTruthy();
>>>>>>> new-gui-qan
    expect(graphMainDash.graphPage.memUsgChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mysqlConnChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mysqlQueryChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mysqlTrafChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.netTrafChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.sysInfoChart.isDisplayed()).toBeTruthy();
    expect(graphMainDash.graphPage.mysqlInfoChart.isDisplayed()).toBeTruthy();
<<<<<<< HEAD
  */});

  it('should copy dashboard', function() {
    var n;
    var new_dashboard = data['new_dashboard'] + random.getRandomString(4);
    var alertElement = element(by.css('.alert-success'));
    graphMainDash.saveDashboardAs(new_dashboard);
    browser.wait(protractor.ExpectedConditions.visibilityOf(alertElement), 10000).then(function(){ 
      expect(alertElement.isDisplayed()).toBe(true);
      });
  });

 
});

