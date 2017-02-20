var global = require('../test_data/global_data.json')
var data = require('../test_data/grafana_page.json') 
var grafLoginPage = require('../page_objects/grafana_login.po.js')

describe('Grafana authentication tests', function() { 

  beforeEach(function () {
    browser.driver.manage().deleteAllCookies();
    browser.get(browser.baseUrl + '/graph/dashboard/db/cross-server-graphs');
    browser.sleep(5000);
    browser.waitForAngular();
    browser.ignoreSynchronization = true;
  });

  it('should redirect to the login page if trying to load protected page while not authenticated', function() {
    expect(browser.getCurrentUrl()).toContain('login');
  });

  it('should warn on missing/malformed credentials', function(){

  });

  it('should accept a valid email address and password', function() {
 
    grafLoginPage.setUsername(data['userValid']);
    grafLoginPage.setPassword(data['passwordValid']);
    grafLoginPage.clickLogin();
    browser.driver.wait(function() {
        return browser.driver.getCurrentUrl().then(function(url) {
            return (/dashboard/).test(url);
            });
        });
  expect(browser.getCurrentUrl()).toContain('dashboard/db/cross-server-graphs');
  });
 
  it('should return to the login page after logout', function() {

  });

});
