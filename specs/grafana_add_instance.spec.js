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

