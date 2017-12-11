var mainQANPage = require('../page_objects/mainQan.po.js')
var data = require('../test_data/main_page_data.json')
var utils = require('../common/utils.js')
   
describe('Main QAN Page', function () {
 
  beforeEach(function () {
    mainQANPage.get(browser.baseUrl);
    expect(browser.getCurrentUrl()).not.toContain('add-instance');
    utils.waitForElementPresent(mainQANPage.mainPage.topTitle);
    expect(element(by.css('.alert-warning')).isPresent()).toBe(false);
  });
  
  it('should search Select query', function () {
    browser.executeScript("sauce:context=Search SELECT query");
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectExists']);
    mainQANPage.doSearch();
  });

});
