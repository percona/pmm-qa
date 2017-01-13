describe('Selenium Test Case', function() {
  it('should execute test case without errors', function() {
    browser.get("http://pmmdemo.percona.com/graph/");
    browser.sleep(15000);
    browser.ignoreSynchronization = true;
    //element(by.css("button.alert-close")).click();
    element(by.linkText("PMM Demo")).click();
    //browser.ignoreSynchronization = false;
    element(by.xpath("//div[@class='search-field-wrapper']/span/input")).sendKeys("disk space");
    browser.sleep(5000);
    element(by.xpath("//span[@class='search-result-link']//span[.='Disk Space']")).click();
    expect(browser.getCurrentUrl()).toContain('dashboard/db/disk-space');
  });
});
