//var graphMongoDbRocks = require('../page_objects/mainQan.po.js')
var graphMainDash = require('../page_objects/graphMainDash.po.js')
var url = 'http://pmmdemo.percona.com'

describe('Selenium Test Case', function() {
  beforeEach(function () {
    graphMainDash.get(url);
    browser.ignoreSynchronization = true;
    browser.sleep(15000);
    expect(browser.getCurrentUrl()).toContain('db/pmm-demo');
  });

  it('should check all links on top', function() {
    expect(element(by.linkText('Query Analytics'))).toBeTruthy();
  });

  it('should execute test case without errors', function() {
    graphMainDash.clickPmmDemo();
    element(by.xpath("//div[@class='search-field-wrapper']/span/input")).sendKeys("disk space");
    browser.sleep(5000);
    element(by.xpath("//span[@class='search-result-link']//span[.='Disk Space']")).click();
    expect(browser.getCurrentUrl()).toContain('dashboard/db/disk-space');
    
  });
});
