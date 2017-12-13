var landing = require('../page_objects/landing.po.js')
var utils = require('../common/utils.js')
var updateAvailableTxt = 'A new PMM version is available.'
var updateCompletedTxt = 'PMM Server update was completed.'

describe('Update from landing page', function() {
    beforeEach(function () {
       browser.waitForAngularEnabled(false); 
       browser.get(browser.baseUrl,50000);
       browser.ignoreSynchronization = true;
       browser.sleep(15000);
       //expect(browser.getTitle()).toEqual('Percona Monitoring and Management');
    });

    afterEach(function () {
      element(by.id('updateText')).getText().then(function (text) {
        if (text) {
           console.log("Unexpected alert is opened " + text); 

           } else {
                                      }
        });
    });


    it('should click on update button and then close the modal window', function() {
      var EC = protractor.ExpectedConditions;
      landing.landingPage.updateLink.click().then(function () {

        utils.waitForElementClickable(landing.landingPage.updateCloseBtn);
        landing.landingPage.updateCloseBtn.click().then(function () {
           utils.waitForElementInvisible(landing.landingPage.updateLoader);
           });
         });
    });

    it('should run update', function() {
      var EC = protractor.ExpectedConditions;
      landing.landingPage.updateLink.click().then(function () {
        utils.waitForElementClickable(landing.landingPage.updateRunBtn);
        expect(landing.landingPage.updateText.getText()).toBe(updateAvailableTxt);
           landing.landingPage.updateRunBtn.click().then(function () {
             utils.waitForTextPresent(landing.landingPage.updateText,updateCompletedTxt);
             landing.landingPage.updateCloseBtn.click();
              });
           });
    });

});
