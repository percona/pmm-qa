'use strict';  
  
module.exports = {  
  mainPage: { 
    noQueries: element(by.id('query_profile_heared')),
    noQueriesText: 'No data for selected time-range', 
    topTitle: element(by.id('query_profile_top')),  
    titleContains: element(by.xpath('*//contains(text(),"Grand Total Time"')),
    calendarBtn: element(by.id('supportedContentDropdown')),  
    //managementBtn: element(by.id('settings_link')),  
    managementBtn: element(by.xpath('//*[contains(@title,"Configure query analytics")]')),  
    instancesBtn: element(by.id('navbarDropdownMenuLink')),  
    instancesAll: element.all(by.repeater('db in instances')),
    totalLink: element(by.linkText('TOTAL')),
    searchFld: element(by.name('searchValue')),
    searchBtn: element(by.id('search_button')),
    serverSummaryBtn: element(by.id('summary_link')),
    time3h: element(by.linkText('Last 3 hours')),  
    queryTable: element.all(by.css('table[id="query_profile_table"]')),
    querySelected:  element(by.css('[ng-click="qanSelectRow(row)"]')),
    fingerprintTitle:  element(by.xpath('//*[contains(text(), "Fingerprint")]')),
    exampleTitle:  element(by.xpath('//*[contains(text(), "Example")]')),
    visualTitle: element(by.xpath('//div[@id="visual-explain-header"]//*[contains(text(),"VISUAL")]')),
    nextQueries:  element(by.id('show_more')),
    dbTableFld: element(by.id('dbTblNamesInput')),
    dbTableBtn: element(by.buttonText('ADD')),
    dbTableList: element(by.name('selectedDbTable')),
    reloadTop: element(by.css('[ng-click="$root.doRefresh($root.time_range)"]')),
    dbToExplain: element(by.name('db')),
    explainBtn: element(by.css('[ng-click="getQueryExplain()"]')),
    totalRow: element(by.css('[ng-click="qanSelectSummary()"]')),
    alertMsg: element.all(by.css('.alert.msg')),
    alertDang: element(by.css('.alert-danger')),
    instanceCur: element(by.xpath('//a[@class="list-group-item ng-scope active"]')),
    goToMain: element(by.css('[ng-click="$root.goToQueries();"]'))
  },  

  settingsTab: {
    settingsHeader: element(by.id('settingsTab-header')),
  }, 
  get: function(url) {  
    browser.get(url + '/qan/',100000);
  },  
  /**
   * returnTopTitle returns a text above Top queries
   */  
  returnTopTitle: function() {
    return this.mainPage.topTitle.getText();
  },
  
   /**
   * returnNoQueriesTxt returns a text message 
   * if there is no any query
   */
  returnNoQueriesTxt: function() {
    return this.mainPage.noQueries.getText();
  },

  
  clickCalendar: function() {  
    this.mainPage.calendarBtn.click();  
  },
 
  searchFor: function(query) {  
    this.mainPage.searchFld.sendKeys(query);
  },

  clearSearch: function() {
    this.mainPage.searchFld.clear();
  },
 
  doSearch: function() {
    this.mainPage.searchBtn.click();
  },
 
  clickSummary: function() {  
    this.mainPage.serverSummaryBtn.click();
  }, 

  clickManagement: function() {  
    this.mainPage.managementBtn.click();  
  }, 

  clickTotal: function() {
    this.mainPage.totalLink.click();
  },

  /*returnQueryLink: function(num) {
    this.mainPage.queryList.then(function(row) {
    var query = row[0].element(by.css('[ng-click="qanSelectRow(row)"]'));
      return query;
    });
  },
  */
   /**
   * clickQueryNumber clicks on specified query's number
   */
  clickQueryNr: function(num) {
    /*this.mainPage.queryList.then(function(tables) {
      var titleElement = tables[num].element(by.css('[ng-click="qanSelectRow(row)"]'));
      titleElement.click(); 
    });*/
    //var data = this.mainPage.queryTable;
    //data.get(num).click();
   element(by.xpath('//*[contains(@id,"query_profile_table")]//tr[2]//a')).click();
  },

  /**
   * clickLastQuery click on last query from Top queries
   */
  clickLastQuery: function()  {
    var elm = this.mainPage.queryList.last();
    elm.click();
  },

  /**
   * returnTopQueriesTxt returns a text above Top queries
   */
  returnTopQueriesTxt: function() {
    this.mainPage.topTitle.getAttribute('title');
  },

  clickNextQueries: function()  {
    this.mainPage.NextQueries.click();
  },

  clickFingerprint: function()  {
    this.mainPage.fingerprintTitle.click();
  },

  clickExample: function()  {
    this.mainPage.exampleTitle.click();
  },

  clickVisual: function()  {
    this.mainPage.visualTitle.click();
  },

  addTable: function(table)  {
    this.mainPage.dbTableFld.sendKeys(table);
    this.mainPage.dbTableBtn.click();
  },

  clickAddedTable: function(table)  {
    element(by.cssContainingText('option', table)).click();
    },
 
  addDbToExplain: function(db)  {
    this.mainPage.dbToExplain.clear();
    this.mainPage.dbToExplain.sendKeys(db);
  },

  returnDbExplain: function(db) {
    return this.mainPage.dbToExplain.getAttribute('value');
  },

  clickExplainBtn: function() {
    this.mainPage.explainBtn.click();
  },

  explainIsActive: function() {
    return this.mainPage.explainBtn.isEnabled();
  },

/**
 * returnQueriesCount returns count of all queries in Top queries
 */
  returnQueriesCount: function()  {
    this.mainPage.queryList.count().then(function(count) {
      console.log("Count was " + count);
      return count;
    });
  },

  returnTotalElm: function()  {
    element.all(by.css('[ng-click="qanSelectSummary()"]')).each(function(element, index) {
      element.getText().then(function (text) {
      });

    });
  },

/**
 * returnFingeprint returns query's ID 
 * base on query's number in Top queries
 */
  returnFingerprint: function(num) {
    var row = this.mainPage.queryList.get(num);
    var cells = row.all(by.tagName('td'));
    return  cells.get(2).getText().then(function(elm) {
    return elm;
    });
  },  

  clickLoadNext: function() {
    this.mainPage.nextQueries.click();
  },

  clickCalendar: function() {
    this.mainPage.calendarBtn.click();
  },

  clickTime3h: function() {
    this.mainPage.time3h.click()
  },

  clickInstancesMenu: function() {
    this.mainPage.instancesBtn.click();
  },


  returnInstancesCount: function() {
    return this.mainPage.instancesAll.count();
  },  

  clickEachInstance: function() {
    this.mainPage.instancesAll.each(function(element, index) {
        element.getText().then(function (text) {
      });
    });
  },

  returnInstanceList: function() {
    return this.mainPage.instancesAll;
  },

  goToMainPage: function() {
    this.mainPage.goToMain.click();
    browser.waitForAngular();
  },

  returnTitleContains: function() {
    return this.mainPage.titleContains;
  },

  //clickQueryProfileBtn: function()  {
  //  this.mainPage.queryProfileBtn.click();
  //},
};
