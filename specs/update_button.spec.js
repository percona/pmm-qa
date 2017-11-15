var landing = require('../page_objects/landing.po.js')
var utils = require('../common/utils.js')

describe('Update from landing page', function() {
    beforeEach(function () {
       browser.waitForAngularEnabled(false); 
       browser.get(browser.baseUrl,50000);
       browser.ignoreSynchronization = true;
       browser.sleep(15000);
       //expect(browser.getTitle()).toEqual('Percona Monitoring and Management');
    });

    afterEach(function () {

    });


    it('should click on update button and then close the modal window', function() {
      var EC = protractor.ExpectedConditions;
      landing.landingPage.updateLink.click().then(function () {

        utils.waitForElementClickable(landing.landingPage.updateCloseBtn)
           landing.landingPage.updateCloseBtn.click().then(function () {
              utils.waitForElementInvisible(landing.landingPage.updateLoader);
              });
           });
    });

});
