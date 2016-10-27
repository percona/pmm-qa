var mysqlPage = require('./mysql_conn_page.po.js');

describe('Management Page', function () {

  beforeEach(function () {
    browser.ignoreSynchronization = false;
    mysqlPage.get();
    expect(browser.getCurrentUrl()).toContain(browser.baseUrl + '/qan/#/management');
  });

  afterEach(function() {
     browser.manage().logs().get('browser').then(function(browserLog) {
     console.log('log: ' + require('util').inspect(browserLog));
     });
  });

  it('should click on status, log, settings tabs', function () {
    mysqlPage.clickAddNewMysql();
    expect(mysqlPage.getMysqlName()).toEqual('');
  });

