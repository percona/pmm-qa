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
    expect(graphMainDash.graphPage.qanLink).toBeTruthy();
    expect(graphMainDash.graphPage.orchLink).toBeTruthy();
    expect(graphMainDash.graphPage.docLink).toBeTruthy();
    expect(graphMainDash.graphPage.queryDistChart).toBeTruthy();
    expect(graphMainDash.graphPage.loadAvgChart).toBeTruthy();
    expect(graphMainDash.graphPage.memDistrChart).toBeTruthy();
    expect(graphMainDash.graphPage.procChart).toBeTruthy();
    expect(graphMainDash.graphPage.forksChart).toBeTruthy();
    expect(graphMainDash.graphPage.cpuUsgChart).toBeTruthy();
  });

  it('should execute test case without errors', function() {
    graphMainDash.clickPmmDemo();
    graphMainDash.searchDashboard("Disk Space");
    expect(browser.getCurrentUrl()).toContain('dashboard/db/disk-space');
    
  });
});
