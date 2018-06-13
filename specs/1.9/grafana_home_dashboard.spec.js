var graphMainDash = require('../../page_objects/graphMainDash.po.js')
var data = require('../../test_data/grafana_data.json')
var utils = require('../../common/utils.js')

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
    browser.sleep(40000);
    expect(browser.getTitle()).toEqual('Grafana - Home Dashboard');
    // wait while any singlestat element is presented
    utils.waitForElementPresent(element(by.xpath('//span[contains(text(),"Percona Monitoring and Management")]')));
  });

  afterEach(function () {
  });

  it('should check dashboards elements', function() {
    expect(browser.getCurrentUrl()).toContain('/home-dashboard');
  //  expect(element(by.css('.text-center dashboard-header')).getAttribute('src')).toBe('public/img/pmm-logo.svg');
  });

  it('should copy Home dashboard (using Save As..) dashboard', function() {
    var n;
    var new_dashboard = data['new_dashboard'] + utils.getRandomString(4);
    var alertS = element(by.css('div.alert-title'));
    graphMainDash.saveDashboardAs(new_dashboard);
    utils.waitForElementPresent(alertS); 
     expect(browser.getCurrentUrl()).toContain('/new-dashboard');
  });
});

