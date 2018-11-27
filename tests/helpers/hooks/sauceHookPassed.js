const event = require('codeceptjs').event;
const container = require('codeceptjs').container;

module.exports = function() {

    event.dispatcher.on(event.test.passed, function (test) {
        console.log("Inside the passed event-----------");
        var sessionId = container.helpers().WebDriverIO.browser.requestHandler.sessionID;
        let SauceHelper = container.helpers('SauceHelper');
        SauceHelper._updateSauceJob(sessionId, {"passed": true, "name": test.title});
    });
};