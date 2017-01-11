var mainQANPage = require('../page_objects/mainQan.po.js')
var data = require('../test_data/main_page_data.json')
var global = require('../test_data/global_data.json')
   
describe('Main QAN Page', function () {
 
  beforeEach(function () {
    browser.ignoreSynchronization = false;
    mainQANPage.get(global['url']);
    element.all(by.css('.alert.msg')).then(function(items)  {
      expect(items.length).toBe(0);
    });
    expect(element(by.css('.alert-danger')).isPresent()).toBe(false);
    expect(mainQANPage.returnTopTitle()).toContain('Top');
  });
  
/*  afterEach(function() {
    browser.manage().logs().get('browser').then(function(browserLog) {
    console.log('log: ' + require('util').inspect(browserLog));
    });
  });
*/

  it('should click on each instances in menu list', function() {
    mainQANPage.clickInstancesMenu();
    mainQANPage.clickEachInstance();
    //console.log('Count = ' + mainQANPage.returnInstancesCount());

  });

  it('should search by fingerprint', function()  {
    var fingerprint = mainQANPage.returnFingerprint(0);
    mainQANPage.clearSearch();
    mainQANPage.searchFor(fingerprint);
    mainQANPage.doSearch();
    browser.sleep(25000);
    expect(mainQANPage.returnTopTitle()).toContain('Top');
    expect(mainQANPage.returnFingerprint(0)).toEqual(fingerprint);

  });

  it('should search Select query', function () {
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectExists']);
    mainQANPage.doSearch();
    browser.sleep(25000);
    expect(mainQANPage.returnTopTitle()).toContain('Top');
    mainQANPage.clearSearch();
    mainQANPage.doSearch();
    browser.sleep(25000);
    browser.waitForAngular();
    expect(mainQANPage.returnTopTitle()).toContain('Top');
  });

  it('shouldnt search any query', function () {
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectNotExist']);
    mainQANPage.doSearch();
    browser.sleep(25000);
    expect(mainQANPage.returnNoQueriesTxt()).toContain('There is no data');
    mainQANPage.clearSearch();
    mainQANPage.doSearch();
    browser.sleep(25000);
    expect(mainQANPage.returnTopTitle()).toContain('Top');
  });
  
  it('should click Select query', function () {
    mainQANPage.clearSearch();
    mainQANPage.searchFor(data['selectExists']);
    mainQANPage.doSearch();
    browser.sleep(5000);
    expect(mainQANPage.returnTopTitle()).toContain('Top');
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
    mainQANPage.clickQueryNr(0);
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
    browser.waitForAngular();
    element(by.xpath('//button[@ng-click="$root.goToQueries();"]')).click();
    expect(mainQANPage.returnTopTitle()).toContain('Top');
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

  it('should click on calendar', function ()  {
    mainQANPage.clickCalendar();
    mainQANPage.clickTime3h();
    browser.sleep(25000);
    expect(mainQANPage.returnTopTitle()).toContain('Top');

  });

});
