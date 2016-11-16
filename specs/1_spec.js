// spec.js
describe('Protractor Demo App1', function() {
  it('should greet the named user', function() {
    browser.get('https://qwe123:qwe1@10.10.11.50/qan/');

    element(by.model('yourName')).sendKeys('Example');

    var greeting = element(by.binding('yourName'));

    expect(greeting.getText()).toEqual('Hello Example!');
  });
});
