var landingPage = require('../page_objects/landing.po.js');
var global = require('../test_data/global_data.json')

describe('Landing Page', function () {

  beforeEach(function () {
    browser.ignoreSynchronization = true;
    browser.get(browser.baseUrl);
    expect(browser.getCurrentUrl()).toContain(browser.baseUrl)
  });

  afterEach(function() {
//    browser.manage().logs().get('browser').then(function(browserLog) {
//    console.log('log: ' + require('util').inspect(browserLog));
//    });
  });

var urlChanged = function() {
  return browser.getCurrentUrl().then(function(url) {
    return url === 'https://www.percona.com/doc/percona-monitoring-and-management/index.html';
  });
};

  it('should click on QAN link', function () {
    element(by.xpath('//*[contains(text(),"Query")]')).click().then(function() {
     browser.sleep(1500);
        browser.getAllWindowHandles().then(function (handles) {
          newWindowHandle = handles[1]; 
            browser.switchTo().window(newWindowHandle).then(function () {
              expect(browser.getCurrentUrl()).toContain('/dashboard/db/_pmm-query-analytics')
              .then(function(){
                    browser.close(); //close the current browser
              }).then(function(){
                    browser.switchTo().window(handles[0]);
                 });
              
            });
          });  
    });
  });

  it('should click on Grafana link', function () {
    element(by.xpath('//*[contains(text(),"Metrics")]')).click().then(function() {
     browser.sleep(5500);
        browser.getAllWindowHandles().then(function (handles) {
          newWindowHandle = handles[1]; 
            browser.switchTo().window(newWindowHandle).then(function () {
              expect(browser.driver.getCurrentUrl()).toContain('/dashboard/db/cross-server-graphs')
              .then(function(){
                    browser.close(); //close the current browser
              }).then(function(){
                    browser.switchTo().window(handles[0]);
                 });
            });
          });  
    });
  });


  it('should click on Documentation link', function () {
    landingPage.clickDocs();
});

});

