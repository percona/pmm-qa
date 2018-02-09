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
    expect(element(by.css('.alert-warning')).isPresent()).toBe(true);
  });

  it('should check PMM QAN Summary dashboard exists', function() {
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("_PMM System Summary");
    expect(browser.getCurrentUrl()).toContain('_pmm-system-summary');
    expect(element(by.css('.alert-warning')).isPresent()).toBe(true);
  });

  it('should check PMM Add Instance dashboard exists', function() {
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("_PMM Add Instance");
    expect(browser.getCurrentUrl()).toContain('_pmm-add-instance');
  });

});
