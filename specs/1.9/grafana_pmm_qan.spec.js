var graphMainDash = require('../../page_objects/graphMainDash.po.js')
var utils = require('../../common/utils.js')
var qan = require('../../page_objects/mainQan.po.js')

describe('Grafana PMM QAN test', function() {
  beforeEach(function () {
    browser.get(browser.baseUrl,10000);
    browser.ignoreSynchronization = true;
    browser.wait(function() {
      return browser.driver.getCurrentUrl().then(function(url) {
        return /home-dashboard/.test(url);
      });
    });
      expect(browser.getTitle()).toEqual('Grafana - Home Dashboard');
  });

  afterEach(function () {
  });


  it('should check PMM QAN dashboard exists', function() {
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("_PMM Query Analytics").then(function() {
      expect(browser.getCurrentUrl()).toContain('_pmm-query-analytics');
      browser.switchTo().frame(browser.findElement(by.xpath('//ng-transclude/iframe'))).then(function() {
      expect(element(by.css('.alert-warning')).isPresent()).toBe(false);
      expect(element(by.xpath('//*[@id="query_profile_heared"]')).isPresent()).toBe(true);
      expect(element(by.xpath('//*[@id="query_profile_top"]')).isPresent()).toBe(true);
      });
    });
    
  });
  
  it('should check PMM QAN Summary dashboard exists', function() {
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("_PMM System Summary");
    expect(browser.getCurrentUrl()).toContain('_pmm-system-summary');
    expect(element(by.css('.alert-warning')).isPresent()).toBe(false);
    browser.switchTo().frame(browser.findElement(by.xpath('//ng-transclude/iframe'))).then(function() {
      expect(element(by.xpath('//*[@id="system-summary-panel"]/div/text()')).isPresent()).toBe(false);
      expect(element(by.xpath('//*[@id="mysql-summary-panel"]/div/text()')).isPresent()).toBe(false);
    });
  });

  it('should check PMM Add Instance dashboard exists', function() {
    graphMainDash.clickOpenSearch();
    graphMainDash.searchDashboard("_PMM Add Instance");
    expect(browser.getCurrentUrl()).toContain('_pmm-add-instance');
  });
});
