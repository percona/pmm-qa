var graphMainDash = require('../page_objects/graphMainDash.po.js')
var data = require('../test_data/grafana_data.json')
var random = require('../common/utils.js')

describe('Home dashboards tests', function() {
  beforeEach(function () {
    browser.get(browser.baseUrl+'/graph');
    browser.ignoreSynchronization = true;
    browser.sleep(15000);
       browser.wait(function() {
      return browser.driver.getCurrentUrl().then(function(url) {
        return /home-dashboard/.test(url);
      });
    });
    browser.sleep(60000);
    expect(browser.getTitle()).toEqual('Grafana - Home Dashboard');
  });

  afterEach(function () {
  });


  it('should check main (Home) dashboard', function() {
    expect(browser.getCurrentUrl()).toContain('dashboard/db/home-dashboard');
  });

  it('should copy (using Save As..) dashboard', function() {
    var n;
    var new_dashboard = data['new_dashboard'] + random.getRandomString(4);
    var alertElement = element(by.css('.alert-success'));
    graphMainDash.saveDashboardAs(new_dashboard);
    browser.wait(protractor.ExpectedConditions.visibilityOf(alertElement), 10000).then(function(){ 
      expect(alertElement.isDisplayed()).toBe(true);
      });
  });

});

