const event = require('codeceptjs').event;
const container = require('codeceptjs').container;

module.exports = function() {

    event.dispatcher.on(event.test.failed, function (test, error) {
        console.log("Inside the failed event-----------");
        var sessionId = container.helpers().WebDriverIO.browser.requestHandler.sessionID;
        let SauceHelper = container.helpers('SauceHelper');
        SauceHelper._updateSauceJob(sessionId, {"passed": false, "name": test.title});
    });
};