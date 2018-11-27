'use strict';

// use any assertion library you like
let assert = require('assert');
let request = require('request');
const container = require('codeceptjs').container;

class SauceHelper extends codecept_helper {

    constructor(config) {
        super(config);
    }

    _updateSauceJob(sessionId, data) {
        var sauce_url = "Test finished. Link to job: https://saucelabs.com/jobs/";
        sauce_url = sauce_url.concat(sessionId);
        console.log(sauce_url);


        var status_url = 'https://saucelabs.com/rest/v1/';
        status_url = status_url.concat(this.config.user);
        status_url = status_url.concat('/jobs/');
        status_url = status_url.concat(sessionId);

        console.log(this.config.user);
        request({ url: status_url, method: 'PUT', json: data, auth: {'user': this.config.user, 'pass': this.config.key}}, this._callback);
    }

     _callback(error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    }
}

module.exports = SauceHelper;
