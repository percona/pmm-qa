var graphMainDash = require('../../page_objects/graphMainDash.po.js')
var data = require('../../test_data/grafana_data.json')
var utils = require('../../common/utils.js')
var originalTimeout
describe('Home dashboards tests', function() {
  beforeEach(function () {
    browser.driver.get(browser.baseUrl);
    browser.wait(function() {
      return browser.driver.getCurrentUrl().then(function(url) {
        return /home-dashboard/.test(url);
      });
    });
    expect(browser.getTitle()).toEqual('Grafana - Home Dashboard');
    // wait while any singlestat element is presented
    utils.waitForElementVisible(element(by.xpath('//span[contains(text(),"Percona Monitoring and Management")]')));
    expect(browser.getCurrentUrl()).toContain('/home-dashboard');
  });

  afterEach(function () {
  });

  it('should check all dashboards present', function() {
    expect(browser.getCurrentUrl()).toContain('/home-dashboard');
  });

  it('should check Update widget', function() {
    expect(graphMainDash.graphPage.updateTitle.getText()).toBe('Updates');
    expect(graphMainDash.graphPage.noUpdateAvail.getText()).toBe('No updates are available');
  });

  it('should copy Home dashboard (using Save As..) dashboard', function() {
    var new_dashboard = data['new_dashboard'] + utils.getRandomString(4);
    graphMainDash.saveDashboardAs(new_dashboard);
    expect(browser.getCurrentUrl()).toContain('/new-dashboard');
  });
});

