var managementPage = require('./management.po.js');

describe('Management Page', function () {

  beforeEach(function () {
    browser.ignoreSynchronization = false;
    managementPage.get();
    expect(browser.getCurrentUrl()).toContain('/qan/#/management/');
  });

  afterEach(function() {
     browser.manage().logs().get('browser').then(function(browserLog) {
     console.log('log: ' + require('util').inspect(browserLog));
     });
/*    element.all(by.css('.alert.msg')).then(function(items)  {
      expect(items.length).toBe(0);
    });
    expect(element(by.css('.alert-danger')).isPresent()).toBe(false);
*/  });
/*
  it('should click on status, log, settings tabs', function () {
    //managementPage.clickLogTab();
    //managementPage.clickStatusTab();
    //managementPage.clickSettingsTab();
  });
 */ it('should change collect interval', function () {
    managementPage.inputCollectInterval(2);
  //    managementPage.clickApply();
  //  expect(element(by.css('.alert.msa')).isPresent()).toBe(true);
  });
})
