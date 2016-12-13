var GrafanaLogin = require('../page_objects/grafana_login.po.js')
var global = require('../test_data/global_data.json')


describe('Grafana Login Test Case', function() {
  beforeEach(function () {
    browser.ignoreSynchronization = false;
    GrafanaLogin.get(global['url']);
    element.all(by.css('.alert.msg')).then(function(items)  {
      expect(items.length).toBe(0);
    });
    //expect(element(by.css('.alert-danger')).isPresent()).toBe(false);
    //expect(mainQANPage.returnTopTitle()).toContain('Top');
  });

/*  afterEach(function() {
    browser.manage().logs().get('browser').then(function(browserLog) {
    console.log('log: ' + require('util').inspect(browserLog));
    });
  });
*/
  it('should sign up new user', function() {
    var text, value, bool, source,  title;
    var TestVars = {};
   // var url = 'https://10.10.11.50:8888/graph';
   // browser.get("http://10.10.11.50:8888/graph/login");
    element(by.xpath("//div[@class='login-tab-header']//button[.='Sign up']")).click();
    browser.waitForAngular();
    element(by.model("formModel.email")).sendKeys("qwe@qwe.com\n");
    element(by.id("inputPassword")).sendKeys("Mc'Adamson");
    element(by.css("button.btn.btn-primary")).click();
    browser.ignoreSynchronization=true;
    browser.sleep(2000);    
element(by.linkText("Home")).click();
    element(by.xpath("//div[@class='search-results-container']//span[.='Disk Performance']")).click();
    GrafanaLogin.get(global['url']+'/logout');    
//element(by.css("i.fa.fa-caret-down")).click();
    //element(by.linkText("Sign out")).click();
   browser.ignoreSynchronization=false; 
   element(by.name("username")).sendKeys("qwe@qwe.com");
    element(by.id("inputPassword")).sendKeys("Mc'Adams");
    element(by.xpath("//div[@class='gf-form-button-row']//button[.='Log in']")).click();
     browser.waitForAngular();
element(by.css("a.navbar-brand-btn.pointer")).click();
    element(by.css("span.sidemenu-org-user.sidemenu-item-text")).click();
    // TODO: setElementSelected: "//div[@class='page-container']//select[.='DefaultDarkLight']//option[3]"    element(by.xpath("//div[@class='page-container']/prefs-control/form/div[4]/button")).click();
    element(by.css("a.navbar-brand-btn.pointer")).click();
    element(by.linkText("Sign out")).click();
    element(by.name("username")).sendKeys("admin");
    element(by.id("inputPassword")).sendKeys("adminn");
    element(by.xpath("//div[@class='gf-form-button-row']//button[.='Log in']")).click();
    text = element(by.tagName('html')).getText();
    expect(text).toContain("" + "Unauthorized");
    element(by.id("inputPassword")).sendKeys("admin");
    element(by.xpath("//div[@class='gf-form-button-row']//button[.='Log in']")).click();
    element(by.css("a.navbar-brand-btn.pointer")).click();
    element(by.linkText("Sign out")).click();
    element(by.linkText("Forgot your password?")).click();
    element(by.name("username")).sendKeys("Test user Mc'Adams");
    element(by.xpath("//div[@class='login-inner-box']//button[.='Send reset instructions']")).click();
    element(by.name("username")).sendKeys("qwe@qwe.com");
    element(by.xpath("//div[@class='login-inner-box']//button[.='Send reset instructions']")).click();
    element(by.linkText("Back to login")).click();
  });
});
