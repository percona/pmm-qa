var q = require('q');
var jasmineReporters = require('jasmine-reporters');
 
exports.config = {
    sauceUser: process.env.SAUCE_USERNAME,
    sauceKey: process.env.SAUCE_ACCESS_KEY,
 
    //seleniumAddress: 'http://ondemand.saucelabs.com:80/wd/hub',
    //specs: ['specs/*spec.js'],
  suites: {
    mainQanPage: 'specs/main_qan.spec.js',
    grafana: 'specs/grafana_*spec.js',
//    managementPage: 'management_page/*spec.js',
  },
 
    restartBrowserBetweenTests: true,
 
    framework: 'jasmine2',
 
    getMultiCapabilities: function () {
        var deferred = q.defer();
        var multiCaps = [{
            browserName: 'firefox',
            version: '32',
            platform: 'OS X 10.10',
            name: "firefox-tests",
            shardTestFiles: true,
            maxInstances: 25
        }, {
            browserName: 'chrome',
            version: '41',
            platform: 'Windows 7',
            name: "chrome-tests",
            shardTestFiles: true,
            maxInstances: 25
        }];
        for (var i = 0; i < multiCaps.length; i++) {
            multiCaps[i].build = process.env.BUILD_TAG;
        }
        deferred.resolve(multiCaps);
        return deferred.promise;
    },
 
    onPrepare: function() {
        jasmine.getEnv().addReporter(new jasmineReporters.JUnitXmlReporter({
            consolidateAll: true,
            savePath: 'testresults',
            filePrefix: 'xmloutput'
        }));
    },
 
    onComplete: function () {
        browser.getSession().then(function (session) {
            return browser.getProcessedConfig().then(function (config) {
                // config.capabilities is the CURRENT capability being run, if
                // you are using multiCapabilities.
                console.log('SauceOnDemandSessionID=' + session.getId() + ' job-name=' + config.capabilities.name);
                return browser.get
            });
        });
    }
}
