var global = require('../test_data/global_data.json')

describe('Grafana authentication tests', function() { 
var fail = function() { expect(true).toBe(false); }

  it('should redirect to the login page if trying to load protected page while not authenticated', function() {
    browser.get(global['url_graf']);
    browser.sleep(15000);
    browser.ignoreSynchronization = true;
    loginURL = browser.getCurrentUrl();

     
    expect(browser.getCurrentUrl()).toContain('login');
  });
  /*it('should warn on missing/malformed credentials', fail);
  it('should accept a valid email address and password', fail);
  it('should return to the login page after logout', fail);
*/
});
