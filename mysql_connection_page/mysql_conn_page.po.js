'use strict';  
  
module.exports = {  
  mysqlConnectionPage: { 
    addNewMysql: element(by.xpath('//button[@title="Add MySQL Connection"]')), 
    selectedConnection: element(by.className('btn btn-warning navbar-btn dropdown-toggle ng-binding')),  
    allConnections: element.all(by.repeater('row in tree_rows | filter:{visible:true} track by row.branch.uid')),  
    mysqlName: element(by.name('name')),
    username: element(by.name('user')),
    password: element(by.name('password')),
    hostname: element(by.name('hostname')),
    socket: element(by.name('socket')),
    createBtn: element(by.className('btn btn-primary btn-sm ng-binding')),
    removeLink: element(by.linkText('Remove')),
  },  
      
  get: function() {  
    browser.get('/qan/#/management/new-mysql/');   
    browser.waitForAngular();  
  },  

  selectConnection: function(connection)  {
    this.mysqlConnectionPage.selectedConnection.click();
    //element(by.xpath('//*span[contains(@text,"' + connection  + '")]')).click();
    element(by.xpath('//span[text()="MySQL: ' + connection + '"]')).click();
  },
      
  getAllConnections: function() {  
    var page = this.mysqlConnectionPage;  
    page.selected.isDisplayed();  
    page.selectedConnection.click();  
  }, 
  
  getSelectedConnection: function() {  
    var page = this.mysqlConnectionPage;  
    //page.selectedConnection.click();
    return page.selectedConnection.getText();  
  }, 
  
  clickAddNewMysql: function() {
    var page = this.mysqlConnectionPage;
    page.addNewMysql.isDisplayed();
    page.addNewMysql.click();
  },

  getMysqlName: function()  {
    var page = this.mysqlConnectionPage;
    return page.mysqlName.getAttribute('value');
  },

  getUsername: function()  {
    var page = this.mysqlConnectionPage;
    return page.username.getAttribute('value');
  },

  getPassword: function()  {
    var page = this.mysqlConnectionPage;
    return page.password.getAttribute('value');
  },

  getHostname: function()  {
    var page = this.mysqlConnectionPage;
    return page.hostname.getAttribute('value');
  },

  getSocket: function()  {
    var page = this.mysqlConnectionPage;
    return page.socket.getAttribute('value');
  },
  
  isDisabledCreateBtn: function() {
    var page = this.mysqlConnectionPage;
    return page.createBtn.getAttribute('disabled');
  },
 
  clickSaveBtn: function()  {
    var page = this.mysqlConnectionPage;
    page.createBtn.isDisplayed();
    page.createBtn.click();
  },

  setMysqlName: function(name)  {
    var page = this.mysqlConnectionPage;
    page.mysqlName.clear();
    page.mysqlName.sendKeys(name);
  },
  
  setUsername: function(name)  {
    var page = this.mysqlConnectionPage;
    page.username.clear();
    page.username.sendKeys(name);
  },
  
  setPassword: function(password)  {
    var page = this.mysqlConnectionPage;
    page.password.clear();
    page.password.sendKeys(password);
  },

  setHostname: function(hostname)  {
    var page = this.mysqlConnectionPage;
    page.hostname.clear();
    page.hostname.sendKeys(hostname);
  },

  setSocket: function(socket)  {
    var page = this.mysqlConnectionPage;
    page.socket.clear();
    page.socket.sendKeys(socket);
  },

  removeInstance: function()  {
    var page = this.mysqlConnectionPage;
    page.removeLink.click();
    var EC = protractor.ExpectedConditions;
browser.wait(EC.alertIsPresent(), 5000, "Alert is not getting present ");
    browser.switchTo().alert().accept();

  },

};
