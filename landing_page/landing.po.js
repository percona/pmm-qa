'use strict';

module.exports = {
    landingPage: {
        qanLink:  element(by.css('a[href*="/qan"]')),
        grafanaLink: element(by.css('a[href*="/graph"]')),
        feedbackButton: element(by.className('btn btn-primary')),
        docsLink: element(by.linkText('DOCUMENTATION')),
        feedbackEmail: 'pmm@percona.com',  
        firstName: element(by.xpath('//input[@name=firstname]')),
        lastName: element(by.name('lastname')),
        companyName: element(by.name('company')),
        email: element(by.name('email')),
        submitBtn: element(by.xpath('//input[@value="Submit"]')),
        checkUpdates: element(by.name('pmm_product_updates')),
        submittedMesage: element(by.xpath('//div[@class=submitted-message]')),
        firstNameRqd: element(by.xpath('//label[@data-reactid=".0.1:$0.$firstname.3.$0.0"]')),  
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

    checkFeedbackButton: function() {
        var landingPage = this.landingPage;

        landingPage.feedbackButton.isDisplayed();
    },

    clickDocs: function() {
        var landingPage = this.landingPage;

        landingPage.docsLink.isDisplayed();
        landingPage.docsLink.click();
    },

    clickCheckUpdates: function() {
        var landingPage = this.landingPage;

        landingPage.checkUpdates.isDisplayed();
        landingPage.checkUpdates.click();
    },

    getFirstname: function() {
        return this.landingPage.firstName.getAttribute('value');
    },

    setFirstname: function(name)  {
        var landingPage = this.landingPage;
        landingPage.firstName.clear();
        landingPage.firstName.sendKeys(name);
        browser.sleep('5000');
        landingPage.firstName.getText().then(function(text) {
    console.log('text inside element: ' + text);
  }) // Nothing gets logged

        expect(landingPage.firstName.getText()).toEqual(name); 

    },

    setLastname: function(name)  {
        var landingPage = this.landingPage;
        landingPage.lastName.sendKeys(name);
    },

    setEmail: function(mail)  {
        var landingPage = this.landingPage;
        landingPage.email.sendKeys(mail);
    },

    setCompanyName: function(company)  {
        var landingPage = this.landingPage;
        landingPage.companyName.sendKeys(company);
    },

    submitForm: function() {
        var landingPage = this.landingPage;

        landingPage.submitBtn.isDisplayed();
        landingPage.submitBtn.click();
    },

    returnSubmittedMsg: function() {
        return this.landingPage.submittedMessage.getValue();
    }

};
