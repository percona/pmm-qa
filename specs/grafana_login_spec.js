var GrafanaLogin = require('../page_objects/grafana_login.po.js')
var global = require('../test_data/global_data.json')
var utils = require('../common/utils.js')
var url = 'https://qwe123:qwe1@10.10.11.52/graph/login'

describe('Grafana Login Test Case', function() {
/*:wq
  beforeEach(function () {
    browser.ignoreSynchronization = false;
 //   GrafanaLogin.get(global['url']);
    element.all(by.css('.alert.msg')).then(function(items)  {
      expect(items.length).toBe(0);
    });
  });

  afterEach(function() {
    browser.get(global['url'] + '/graph/logout');
  });

 /*it('should sign up new user', function() {
//  browser.get('https://qwe123:qwe1@10.10.11.50/graph/login');
//browser.sleep(3000);
//browser.waitForAngular();
   // element(by.xpath("//button[.='Sign up']")).click();
//    element(by.xpath("//div[@class='login-tab-header']//button[.='Sign up']")).click();
//var email = utils.getRandomEmail();
//    console.log(email)
//    GrafanaLogin.setEmail(email + '\n');       
//   element(by.xpath("//div[@class='gf-form-button-row']//button[.='Sign up']")).click();
//browser.sleep(1000);
//browser.waitForAngular();
//    value = element(by.name("name")).getAttribute('value');
   // expect(value).toContain("" + );
//    text = element(by.tagName('html')).getText();
//    expect(text).toContain("" + "Continue");
//element(by.id("inputPassword")).sendKeys("Mc'Adamson\n");
//    element(by.linkText("Home")).click();
 //   element(by.xpath("//div[@class='search-results-container']//span[.='Disk Performance']")).click();
/*browser.get("https://qwe123:qwe1@10.10.11.50/graph/login");
   element(by.xpath("//div[@class='login-tab-header']//button[.='Sign up']")).click();
  var email = utils.getRandomEmail();
    console.log(email); 
   browser.sleep(5000);
  browser.waitForAngular(); 
  element(by.xpath('//input[@placeholder="email"]')).sendKeys(email);
    element(by.xpath('//div[@class="gf-form-button-row"]//button[.="Sign up"]')).click();
    value = element(by.name("name")).getAttribute('value');
    expect(value).toContain("");
    text = element(by.tagName('html')).getText();
    expect(text).toContain("" + "Continue");
    element(by.css("h3")).click();
    element(by.xpath("//div[@class='invite-box']/form/div[2]/input")).click();
 
});
*/
  it('should login', function() {
    //pending('Force skip');    
browser.get("https://qwe123:qwe1@10.10.11.52/graph/login");
    browser.sleep(5000);
    browser.waitForAngular();
    element(by.name('username')).sendKeys('admin');
    element(by.id('inputPassword')).sendKeys('admin');
//    var EC = protractor.ExpectedConditions;
//    element(by.xpath('//div[@class="gf-form-button-row"]/button')).click();/*.then(function() {
 /*   var mainMenu = element(by.xpath('//.pointer.navbar-page-btn'));

    browser.wait(EC.visibilityOf(mainMenu), 8000);
    mainMenu.click();

    console.log("sub-menu item has been chosen in the ribbon");
  //  setTimeout(function() { d.fulfill('ok')}, 50000);
});

*/   
      // browser.driver.wait(function() {
      //      return browser.driver.getCurrentUrl().then(function(url) {
      //          return (url.indexOf('https://10.10.11.50/graph/dashboard/db/cross-server-graphs') !== -1);
      //      });
      //  });
  //Jasmine expect statement : compare actual and expected value
// browser.ignoreSynhronization = true;
       element(by.xpath("//div[@class='gf-form-button-row']//button[.='Log in']")).click();
browser.sleep(5000);
//browser.waitForAngular();    
element(by.linkText("Cross Server Graphs")).click();
    element(by.linkText("Home")).click(); 
browser.sleep(5000);
});

});
