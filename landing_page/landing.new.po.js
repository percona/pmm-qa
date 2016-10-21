  var LandingPage = function() {
    this.qanLink = element(by.css('a[href*="/qan"]'));
    this.grafanaLink = element(by.css('a[href*="/graph"]'));
    this.feedbackButton = element(by.className('btn btn-primary'));
    this.docsLink = element(by.linkText('DOCUMENTATION'));
    this.feedbackEmail = 'pmm@percona.com';  
    this.firstName =  element(by.xpath('//input[@name=firstname]'));
    this.lastName = element(by.name('lastname'));
    this.companyName = element(by.name('company'));
    this.email = element(by.name('email'));
    this.submitBtn = element(by.className('hs-button primary large'));
    this.checkUpdates = element(by.name('pmm_product_updates'));
    this.submittedMesage = element(by.xpath('//div[@class=submitted-message]'));

    this.clickQan = function() {
        qanLink.isDisplayed();
        qanLink.click();
    };
    
    this.clickGrafana = function() {
        grafanaLink.isDisplayed();
        grafanaLink.click();
    };
/*
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
*/
};

module.exports = new LandingPage();
