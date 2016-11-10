var mainQANPage = require('./mainQan.po.js')
var data = require('../test_data/main_page_data.json')
var global = require('../test_data/global_data.json')
   
describe('Main QAN Page', function () {
 
  beforeEach(function () {
    browser.ignoreSynchronization = false;
    mainQANPage.get(global['url']);
    element.all(by.css('.alert.msg')).then(function(items)  {
      expect(items.length).toBe(0);
    });
    //expect(element(by.css('.alert-danger')).isPresent()).toBe(false);
    expect(mainQANPage.returnTopTitle()).toContain('Top');
  });
  
  afterEach(function() {
    browser.manage().logs().get('browser').then(function(browserLog) {
    console.log('log: ' + require('util').inspect(browserLog));
    });
  });

  it('should search Select query', function () {
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectExists']);
    mainQANPage.doSearch();
    expect(mainQANPage.returnTopTitle()).toContain('Top');
    mainQANPage.clearSearch();
    mainQANPage.doSearch();
    expect(mainQANPage.returnTopTitle()).toContain('Top');
  });

  it('shouldnt search any query', function () {
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectNotExist']);
    mainQANPage.doSearch();
    expect(mainQANPage.returnNoQueriesTxt()).toContain('There is no data');
    mainQANPage.clearSearch();
    mainQANPage.doSearch();
    expect(mainQANPage.returnTopTitle()).toContain('Top');
  });
  
  it('should click Select query', function () {
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectExists']);
    mainQANPage.doSearch();
    mainQANPage.clickQueryNr(0);
    mainQANPage.clickExample();
    mainQANPage.clickFingerprint();
  });

  it('should add db.table', function () {
    mainQANPage.clickQueryNr(1);
    mainQANPage.addTable(data['tableValid']);
    mainQANPage.clickAddedTable(data['tableValid']);
    expect(element(by.css('.alert-danger')).isPresent()).toBe(false);
  });

  it('should show error for invalid db.table', function () {
    mainQANPage.clickQueryNr(1);
    mainQANPage.addTable(data['tableInvalid']);
    mainQANPage.clickAddedTable(data['tableInvalid']);
    expect(element(by.css('.alert-danger')).isPresent()).toBe(true);
  });

  it('should open Server Summary page', function () {
    mainQANPage.clickSummary();
    element(by.xpath('//*[contains(text(), "Server Summary")]'));
  });

  it('should click on Total', function () {
    mainQANPage.clickTotal();
    mainQANPage.returnTotalElm();
  });

  it('should click on management button', function () {
    mainQANPage.clickManagement();
    expect(browser.getCurrentUrl()).toContain('/qan/#/management/mysql');
  });

  it('should explain the query', function () {
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
  
  it('should load all queries', function ()  {
    mainQANPage.clickLoadNext();
  });

});
