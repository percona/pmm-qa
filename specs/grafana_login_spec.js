var GrafanaLogin = require('../page_objects/grafana_login.po.js')
var global = require('../test_data/global_data.json')
var utils = require('../common/utils.js')

describe('Grafana Login Test Case', function() {
  beforeEach(function () {
    browser.ignoreSynchronization = false;
    GrafanaLogin.get(global['url']);
    element.all(by.css('.alert.msg')).then(function(items)  {
      expect(items.length).toBe(0);
    });
  });

  afterEach(function() {
    browser.get(global['url'] + '/graph/logout');
  });

 it('should sign up new user', function() {
  GrafanaLogin.get(global['url']);
    element(by.xpath("//div[@class='login-tab-header']//button[.='Sign up']")).click();
var email = utils.getRandomEmail();
    console.log(email)
    GrafanaLogin.setEmail(email);       
   element(by.xpath("//div[@class='gf-form-button-row']//button[.='Sign up']")).click();
    value = element(by.name("name")).getAttribute('value');
   // expect(value).toContain("" + );
    text = element(by.tagName('html')).getText();
    expect(text).toContain("" + "Continue");
element(by.id("inputPassword")).sendKeys("Mc'Adamson\n");
   browser.sleep(5000);    
    element(by.linkText("Home")).click();
    element(by.xpath("//div[@class='search-results-container']//span[.='Disk Performance']")).click();
  });
});
