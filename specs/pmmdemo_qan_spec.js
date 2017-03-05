var mainQANPage = require('../page_objects/mainQan.po.js')
var mgtQanPage = require('../page_objects/qanManagement.po.js')
var url = 'http://pmmdemo.percona.com'
var instances = ['mdb101','mysql57r','ps55', 'ps56', 'ps57', 'ps57r', 'pxc56-1','pxc56-2','pxc56-3','pxc57-1','pxc57-2','pxc57-3'];

describe('Check main QAN Page', function () {

  beforeEach(function () {
    mainQANPage.get(url);
    mainQANPage.mainPage.alertMsg.then(function(items)  {
      expect(items.length).toBe(0);
    });
    expect(mainQANPage.mainPage.alertDang.isPresent()).toBe(false);
    expect(mainQANPage.returnTopTitle()).toContain('Top');
  });

  it('should check main page forall instances', function() {
    mainQANPage.clickInstancesMenu();
    instanceList = mainQANPage.returnInstanceList();
    instanceList.each(function(rows) {
      rows.click().then(function() {
        expect(mainQANPage.mainPage.alertDang.isPresent()).toBe(false);
        expect(mainQANPage.returnTopTitle()).toContain('Top');
      }); 
      mainQANPage.clickInstancesMenu();
    });
  });

  for(var i = 0; i < instances.length; i++) {
        // look through the list of instances
        (function(i) { 

            it('should check QAN logs for all instances', function() {
                mainQANPage.clickManagement();
                browser.waitForAngular();
                expect(mainQANPage.mainPage.alertDang.isPresent()).toBe(false);
                mainQANPage.clickInstancesMenu();                
                element(by.partialLinkText(instances[i])).click(); 
                browser.waitForAngular();
                mgtQanPage.clickLog();
                browser.waitForAngular();
                //expect(element(by.xpath('//html')).getText()).not.toContain('warning');
                mgtQanPage.managementPage.logList.each(function(rows) {
                  rows.getText().then(function(text) {
                    expect(text).not.toContain('warning');
                  });
                });
            });

        })(i); 
    };

});
