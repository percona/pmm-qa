var mainQANPage = require('../page_objects/mainQan.po.js')
var settingsQANPage = require('../page_objects/settingsQan.po.js')
var data = require('../test_data/main_page_data.json')
var global = require('../test_data/global_data.json')
var utils = require('../common/utils.js')
   
describe('Main QAN Page', function () {
 
  beforeEach(function () {
    mainQANPage.get(browser.baseUrl);
    expect(browser.getCurrentUrl()).not.toContain('add-instance');
    expect(element(by.css('.alert-warning')).isPresent()).toBe(false);
  });
  
  afterEach(function() {
//    browser.manage().logs().get('browser').then(function(browserLog) {
//    console.log('log: ' + require('util').inspect(browserLog));
  //  });
  });


  it('should click on each instances in menu list', function() {
    browser.executeScript("sauce:context=Select instance");
    
    mainQANPage.clickInstancesMenu();
    //mainQANPage.clickEachInstance();
    //console.log('Count = ' + mainQANPage.returnInstancesCount());

  });

  xit('should search by fingerprint', function()  {
    var fingerprint = mainQANPage.returnFingerprint(0);
    //mainQANPage.clearSearch();
    //mainQANPage.searchFor(fingerprint);
    //mainQANPage.doSearch();
    //browser.sleep(25000);
   // expect(mainQANPage.returnTitleContains()).toBe('true');
   // expect(mainQANPage.returnFingerprint(0)).toEqual(fingerprint);

  });

  it('should search Select query', function () {
    browser.executeScript("sauce:context=Search SELECT query");
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectExists']);
    mainQANPage.doSearch();
    browser.sleep(25000);
    expect(mainQANPage.mainPage.topTitle.isDisplayed()).toBe(true);
  });

  it('shouldnt search any query', function () {
    browser.executeScript("sauce:context=Cannot search SELECT query");
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectNotExist']);
    mainQANPage.doSearch();
    browser.sleep(25000);
    expect(mainQANPage.mainPage.topTitle.isDisplayed()).toBe(true);
   // expect(mainQANPage.mainPage.noQueriesText.isDisplayed()).toBe(true);
  });
  
  it('should click Select query', function () {
    browser.executeScript("sauce:context=Choose query");
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectExists']);
    mainQANPage.doSearch();
    browser.sleep(5000);
    //expect(mainQANPage.returnTitleContains()).toBe(true);
    //mainQANPage.clickQueryNr(0);
    //mainQANPage.clickExample();
    //mainQANPage.clickFingerprint();
  });

  xit('should add db.table', function () {
    browser.executeScript("sauce:context=Select instance");
    mainQANPage.clickQueryNr(1);
    mainQANPage.addTable(data['tableValid']);
    mainQANPage.clickAddedTable(data['tableValid']);
    expect(element(by.css('.alert-danger')).isPresent()).toBe(false);
  });

  xit('should show error for invalid db.table', function () {
    mainQANPage.clickQueryNr(1);
    mainQANPage.addTable(data['tableInvalid']);
    //mainQANPage.clickAddedTable(data['tableInvalid']);
    //expect(element(by.css('.alert-danger')).isPresent()).toBe(true);
  });

  xit('should open Server Summary page', function () {
    mainQANPage.clickSummary();
    element(by.xpath('//*[contains(text(), "Server Summary")]'));
  });

  it('should click on Total', function () {
    browser.executeScript("sauce:context=Click on Total");
    mainQANPage.clickTotal();
    mainQANPage.returnTotalElm();
  });

  it('should click on Settings button', function () {
    mainQANPage.clickManagement().then(function(){
      expect(browser.getCurrentUrl()).toContain('settings');
    });
    //element(by.xpath('//*[contains(text(), "Settings")]'))
    //  browser.waitForAngular();
  //  utils.waitForElementPresent(settingsQANPage.SettingsPage.applyBtn);
    //expect(mainQANPage.returnTitleContains()).toBe('true');
  });

  xit('should explain the query', function () {
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectExists']);
    mainQANPage.doSearch();
    mainQANPage.clickLastQuery();
    mainQANPage.returnDbExplain().then(function(result) {
      if (result!=0) {
        expect(mainQANPage.explainIsActive()).toBe(true);
      } else {
        expect(mainQANPage.explainIsActive()).toBe(false);
      }
    });
  });
  
  xit('should load next queries', function ()  {
    mainQANPage.clickLoadNext();
  });

  xit('should click on calendar', function ()  {
    mainQANPage.clickCalendar();
     var ec = protractor.ExpectedConditions
    var timeout = 60000;
    var elem = element(by.xpath('//div[@title="Time range"]'));
    browser.wait(ec.presenceOf(elem), timeout);
    //mainQANPage.clickTime3h();
    //browser.sleep(25000);
    //expect(mainQANPage.returnTitleContains()).toBe('true');

  });

});
