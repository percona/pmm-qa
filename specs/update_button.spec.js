var landing = require('../page_objects/landing.po.js')

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

    it('should check update button exists', function() {
       landing.landingPage.updateLink.isDisplayed();
    });

});
