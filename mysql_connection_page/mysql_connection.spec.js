var mysqlPage = require('./mysql_conn_page.po.js');  
var name = 'new-test-mysql-010';
var username = 'test-pmm-client-user';
var password = 'Q!@W#E$R%Ty^';
var hostname = 'test1-hostname.com';
var socket = '/var/run/mysqld/mysqld.sock';
var defaultMysqlConn = 'bm-dell02-qanqa01';
   
describe('MySQL Connection Page', function () {
 
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

  it('should not add new MySql connection with empty fields', function () {
    mysqlPage.clickAddNewMysql();
    expect(mysqlPage.getMysqlName()).toEqual('');  
    expect(mysqlPage.getUsername()).toEqual('');  
    expect(mysqlPage.getPassword()).toEqual('');  
    expect(mysqlPage.getHostname()).toEqual('');  
    expect(mysqlPage.getSocket()).toEqual(''); 
    expect(mysqlPage.isDisabledCreateBtn()).toBe('true'); 
  });

  it('should add new MySql connection', function () {
    mysqlPage.clickAddNewMysql();
    mysqlPage.setMysqlName(name);  
    expect(mysqlPage.getMysqlName()).toEqual(name);  
    mysqlPage.setUsername(username);  
    expect(mysqlPage.getUsername()).toEqual(username);  
    mysqlPage.setPassword(password);  
    expect(mysqlPage.getPassword()).toEqual(password);  
    mysqlPage.setHostname(hostname);  
    expect(mysqlPage.getHostname()).toEqual(hostname);  
    mysqlPage.setSocket(socket); 
    expect(mysqlPage.getSocket(socket)).toEqual(socket);
    mysqlPage.clickSaveBtn();
    expect(mysqlPage.getSelectedConnection()).toContain(name);

  });

  it('should select specified connection', function () {
    mysqlPage.selectConnection(defaultMysqlConn);

  });

  it('should remove specified connection', function () {
    mysqlPage.selectConnection(name);
    mysqlPage.removeInstance();

  });
})

