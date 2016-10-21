var landingPage = require('./landing.po.js');

describe('Landing Page', function () {

  beforeEach(function () {
     browser.ignoreSynchronization = true;
     browser.get(browser.baseUrl);
     expect(browser.getCurrentUrl()).toContain(browser.baseUrl)
  });

  afterEach(function() {
     browser.manage().logs().get('browser').then(function(browserLog) {
     console.log('log: ' + require('util').inspect(browserLog));
     });
  });


  it('should click on QAN link', function () {
     landingPage.clickQan();
  });

  it('should click on Grafana link', function () {
     landingPage.clickGrafana();

  });


  it('should click on Documentation link', function () {
     landingPage.clickDocs();

  });


  it('should check Feedback button', function () {
     landingPage.checkFeedbackButton();

  });


  it('should submit the form', function () {
     landingPage.submitForm();

  });

});

