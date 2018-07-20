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

  it('should check PMM Settings elements exist exists', function() {
    element(by.linkText("PMM")).click().then(function() {  
      element(by.linkText("_PMM Query Analytics Settings")).click().then(function() {  
        expect(browser.getCurrentUrl()).toContain('_pmm-query-analytics-settings');
        browser.switchTo().frame(browser.findElement(by.xpath('//ng-transclude/iframe'))).then(function() {
          element(by.id("inputSource")).$('option:checked').getText().then(function(querySource) {
            if (querySource.trim() === "Slow log" ) {
              expect(element(by.xpath('//label[@for="RetainSlowLogs"]')).getText()).toContain("Slow logs to retain on disk");
              expect(element(by.xpath('//label[@for="SlowLogRotation"]')).getText()).toContain("Slow logs rotation");
              expect(element(by.id('SlowLogRotation')).getText()).toContain("ON");
            }
          });
          });
       });
    });
  });
});
    
