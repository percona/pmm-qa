describe('Selenium Test Case', function() {
  it('should execute test case without errors', function() {
    var text, value, bool, source, url, title;
    var TestVars = {};
    browser.get("http://pmmdemo.percona.com/graph/login");
    element(by.xpath("//div[@class='login-tab-header']//button[.='Sign up']")).click();
    var EC = protractor.ExpectedConditions;
    browser.actions().sendKeys(protractor.Key.TAB).perform();
    var passwordInput = element(by.xpath('//input[@placeholder="email"]'));

    browser.wait(EC.presenceOf(passwordInput), 15000);
    passwordInput.sendKeys(protractor.Key.TAB);
    passwordInput.sendKeys("qrrddd477@qweer.com");
    element(by.xpath("//div[@class='gf-form-button-row']//button[.='Sign up']")).click();
    value = element(by.name("name")).getAttribute('value');
    expect(value).toContain("");
    text = element(by.tagName('html')).getText();
    expect(text).toContain("" + "Continue");
    element(by.css("h3")).click();
    element(by.xpath("//div[@class='invite-box']/form/div[2]/input")).click();
  });
});

