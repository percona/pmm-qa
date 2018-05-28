var landing = require('../../page_objects/graphMainDash.po.js')
var utils = require('../../common/utils.js')
var updateAvailableTxt = 'A new PMM version is available.'
var updateCompletedTxt = 'PMM Server update was completed.'

describe('Update from Home dashboard page', function() {
    beforeEach(function () {
       browser.waitForAngularEnabled(false); 
       browser.get(browser.baseUrl,50000);
       browser.ignoreSynchronization = true;
       browser.sleep(15000);
       expect(browser.getTitle()).toEqual('Grafana - Home Dashboard');
    });

   it('should check current version', function() {
      var version = landing.graphPage.currentVersion.getText();
      version.then(function (realTextValue) {
            console.log(realTextValue);
      });
    });

    it('should check if update is available', function() {
      landing.graphPage.checkUpdateBtn.click().then(function () {
        utils.waitForElementClickable(landing.graphPage.updateBtn);
        expect(landing.graphPage.releaseNotes.isPresent()).toBe(true);

      });
    });


    it('should run update', function() {
      var EC = protractor.ExpectedConditions;
      landing.graphPage.checkUpdateBtn.click().then(function () {
        landing.graphPage.updateBtn.click().then(function () {
        utils.waitForElementPresent(landing.graphPage.updateModal);
          
        utils.waitForElementNotPresented(element(by.xpath('//div[contains(text(), "Update in progress")]')));
        expect(element(by.id('pmm-update-modal')).getText()).not.toContain('Update failed');
        landing.graphPage.updateCloseBtn.click();
           });
    
      });
    });

});
