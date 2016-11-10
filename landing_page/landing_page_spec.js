var landingPage = require('./landing.po.js');
var global = require('../test_data/global_data.json')

describe('Landing Page', function () {

  beforeEach(function () {
    browser.ignoreSynchronization = true;
    browser.get(global['url']);
    expect(browser.getCurrentUrl()).toContain(browser.baseUrl)
  });

  afterEach(function() {
    browser.manage().logs().get('browser').then(function(browserLog) {
    console.log('log: ' + require('util').inspect(browserLog));
    });
  });

var urlChanged = function() {
  return browser.getCurrentUrl().then(function(url) {
    return url === 'https://www.percona.com/doc/percona-monitoring-and-management/index.html';
  });
};

  it('should click on QAN link', function () {
    landingPage.clickQan();
//expect(browser.getCurrentUrl()).toContain(browser.baseUrl+'/qan/#')
  });

  it('should click on Grafana link', function () {
    landingPage.clickGrafana();
  });

  it('should click on Orchestrator link', function () {
    landingPage.clickOrchestrator();
  });

  it('should click on Documentation link', function () {
    landingPage.clickDocs();
//var EC = protractor.ExpectedConditions;
//var condition = EC.and(urlChanged);
//browser.wait(condition, 10000);
});

});

