'use strict';

module.exports = {
  landingPage: {
    qanLink:  element(by.css('a[href*="/qan"]')),
    grafanaLink: element(by.css('a[href*="/graph"]')),
    orchLink: element(by.css('a[href*="/orchestrator/"]')),
    docsLink: element(by.linkText('Review the documentation')),
    downloadLink: element(by.linkText('Download User Manual')),
    forumLink: element(by.linkText('questions and discussions')),
    updateLink: element(by.css('[onClick="checkUpdate()"]')),  
    updateModal: element(by.id('updateDialog')),  
    updateLoader: element(by.id('checkLoader')),  
    updateLoadCheck: element(by.id('checkText')),  
    updateLoadTxt: element(by.id('updateText')),  
    updateRunBtn: element(by.id('updateRunBtn')),  
    updateCloseBtn: element(by.id('updateCloseBtn')),  
    updateText: element(by.id('updateText')),  
  },

  clickQan: function() {
    var landingPage = this.landingPage;
    landingPage.qanLink.isDisplayed();
    landingPage.qanLink.click();
  },
    
  clickGrafana: function() {
    var landingPage = this.landingPage;
    landingPage.grafanaLink.isDisplayed();
    landingPage.grafanaLink.click();
  },

  clickOrchestrator: function() {
    var landingPage = this.landingPage;
    landingPage.orchLink.isDisplayed();
    landingPage.orchLink.click();
  },

  clickDocs: function() {
    var landingPage = this.landingPage;
    landingPage.docsLink.isDisplayed();
    landingPage.docsLink.click();
  },

  clickDownload: function() {
    var landingPage = this.landingPage;
    landingPage.downloadLink.isDisplayed();
    landingPage.downloadLink.click();
  },
  
  clickUpdate: function() {
    var landingPage = this.landingPage;
    landingPage.updateLink.isDisplayed();
    landingPage.updateLink.click();
  },
/*
  getDownloadlTitle: finction() {
    
  },*/
};
