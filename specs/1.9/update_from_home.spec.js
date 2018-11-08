var landing = require('../../page_objects/graphMainDash.po.js')
var utils = require('../../common/utils.js')
var updateAvailableTxt = 'A new PMM version is available.'
var updateCompletedTxt = 'PMM Server update was completed.'

describe('Update from Home dashboard page', function() {
    beforeEach(function () {
       browser.waitForAngularEnabled(false); 
       browser.get(browser.baseUrl,50000);
       browser.sleep(15000);
       expect(browser.getTitle()).toEqual('Grafana - Home Dashboard');
    });

   xit('should check current version', function() {
      var version = landing.updateWidget.currentVersion.getText();
      version.then(function (realTextValue) {
            console.log(realTextValue);
      });
    });

    it('should check if update is available', function() {
      landing.updateWidget.checkUpdateBtn.click().then(function () {
        utils.waitForElementClickable(landing.updateWidget.updateBtn);
        expect(landing.updateWidget.releaseNotes.isPresent()).toBe(true);

      });
    });


    it('should run update', function() {
      var EC = protractor.ExpectedConditions;
      landing.updateWidget.checkUpdateBtn.click().then(function() {
        landing.updateWidget.updateBtn.click().then(function() {
        utils.waitForElementPresent(landing.updateWidget.updateModal);
          utils.waitForElementInvisible(landing.updateWidget.updateSpinner);
            expect(landing.updateWidget.updateStatus).not.toContain('Update failed');
            landing.updateWidget.updateCloseBtn.click().then(function() {
              expect(landing.updateWidget.updateWnd.isPresent()).toBeFalsy();
            });
        });
      });
    });

});
