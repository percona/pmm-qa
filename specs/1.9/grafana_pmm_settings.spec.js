var graphMainDash = require('../../page_objects/graphMainDash.po.js')
var utils = require('../../common/utils.js')
var qan = require('../../page_objects/mainQan.po.js')

describe('Grafana PMM Settings dashboard tests', function() {
  beforeEach(function () {
    browser.get(browser.baseUrl+'/graph/dashboard/db/_pmm-query-analytics',10000);
    browser.ignoreSynchronization = true;
    browser.wait(function() {
      return browser.driver.getCurrentUrl().then(function(url) {
        return /_pmm-query-analytics/.test(url);
      });
    });
    expect(browser.getTitle()).toEqual('Grafana - _PMM Query Analytics');
  });

  afterEach(function () {
  });

  it('should check PMM Settings dashboard exists', function() {
    element(by.linkText("PMM")).click().then(function() {  
      element(by.linkText("_PMM Query Analytics Settings")).click().then(function() {  
        expect(browser.getCurrentUrl()).toContain('_pmm-query-analytics-settings');
        browser.switchTo().frame(browser.findElement(by.xpath('//ng-transclude/iframe'))).then(function() {
          expect(element(by.css('.alert-warning')).isPresent()).toBe(false);
          expect(element(by.id("inputSource")).$('option:checked').getText()).toContain("Slow log");
          });
       });
    });
  });
});
    
