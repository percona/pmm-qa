'use strict';  
  
module.exports = {  
  mainPage: { 
    noQueries: element(by.id('text_no_profile_data')),
    noQueiesText: 'There is no data for the selected MySQL instance, time range or search query.', 
    topTitle: element(by.id('text_count_queries')),  
    calendarBtn: element(by.id('btn_cal')),  
    managementBtn: element(by.xpath('//*[contains(@title,"Configure query analitics")]')),  
    instancesList: element(by.xpath('//*button[contains(@title,"Databases")]')),  
    serverSumBtn: element(by.xpath('//button[contains(@title,"View database and server summary info")]')),
    totalLink: element(by.linkText('TOTAL')),
    searchFld: element(by.name('search')),
    searchBtn: element(by.xpath('//button[@type="submit"]')),
    serverSummary: element(by.xpath('//*[contains(text(), "Server Summary")]')),
    time3h: element(by.id('btn_3h')),  
    queryList: element.all(by.repeater('row in qanData')),
    querySelected:  element(by.css('[ng-click="qanSelectRow(row)"]')),
    fingerprintTitle:  element(by.xpath('//*[contains(text(), "Fingerprint")]')),
    exampleTitle:  element(by.xpath('//*[contains(text(), "Example")]')),
    nextQueries:  element(by.id('show_more')),
    dbTableFld: element(by.model('dbTable')),
    dbTableBtn: element(by.css('[ng-click="addDbTable()"]')),
    dbTableList: element(by.name('selectedDbTable')),
    reloadTop: element(by.css('[ng-click="$root.doRefresh($root.time_range)"]')),
    dbToExplain: element(by.name('db')),
    explainBtn: element(by.css('[ng-click="getQueryExplain()"]')),
    totalRow: element(by.css('[ng-click="qanSelectSummary()"]'))
  },  
      
  get: function(url) {  
    browser.get(url + '/qan/'); 
    //browser.wait(function() {
    //return driver.getTitle().then(function(title) {
    //    return title === 'Percona Query Analytics';
   // });
//}, 10000);
 
    browser.waitForAngular();  
  },  
      
  returnTopTitle: function() {
    return this.mainPage.topTitle.getText();
  },
  
    
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
    this.mainPage.serverSumBtn.click();
  }, 

  clickManagement: function() {  
    this.mainPage.managementBtn.click();  
  }, 

  clickTotal: function() {
    this.mainPage.totalLink.click();
  },

  returnQueryLink: function(num) {
    this.mainPage.queryList.then(function(row) {
    var query = row[0].element(by.css('[ng-click="qanSelectRow(row)"]'));
      return query;
    });
  },

  clickQueryNr: function(num) {
    this.mainPage.queryList.then(function(tables) {
      var titleElement = tables[num].element(by.css('[ng-click="qanSelectRow(row)"]'));
      titleElement.click(); 
    });
  },

  clickLastQuery: function()  {
    var elm = this.mainPage.queryList.last();
    elm.click();
  },

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

  returnQueriesCount: function()  {
    this.mainPage.queryList.count().then(function(count) {
      console.log("Count was " + count);
    });
  },

  returnTotalElm: function()  {
    element.all(by.css('[ng-click="qanSelectSummary()"]')).each(function(element, index) {
      element.getText().then(function (text) {
        console.log("Elm " + index + " is " + text);
      });

    });
  },

  returnFingerprint: function() {
    /*var mappedVals = element.all(by.repeater('row in qanData')).column(0).map(function (elm) {
    return elm.getText();
    });
    console.log("Im here"); 
    mappedVals.then(function (textArr) {
      console.log("Query is " + textArr[1]);  
    });*/
    var row = this.mainPage.queryList.first();
    var cells = row.all(by.tagName('td'));
//expect(cells.get(2).getText()).toEqual("something");
//var cellTexts = cells.map(function (elm) {
//    return elm.getText();
    return  cells.get(2).getText().then(function(elm) {;
    console.log("Td is " + elm);
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
};
