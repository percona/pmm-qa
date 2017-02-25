var mainQANPage = require('../page_objects/mainQan.po.js')
var url = 'http://pmmdemo.percona.com'

describe('Check main QAN Page', function () {

  beforeEach(function () {
    mainQANPage.get(url);
    mainQANPage.mainPage.alertMsg.then(function(items)  {
      expect(items.length).toBe(0);
    });
    expect(mainQANPage.mainPage.alertDang.isPresent()).toBe(false);
    expect(mainQANPage.returnTopTitle()).toContain('Top');
  });

  it('should check if all instances works', function() {
    mainQANPage.clickInstancesMenu();
    instanceList = mainQANPage.returnInstanceList();
    instanceList.each(function(rows) {
      rows.click().then(function() {
        expect(mainQANPage.mainPage.alertDang.isPresent()).toBe(false);
        expect(mainQANPage.returnTopTitle()).toContain('Top');
      }); 
      mainQANPage.clickInstancesMenu();
        mainQANPage.mainPage.instanceCur.getText().then(function(textAct) {
        console.log(textAct);
      });
    });
  });
});
