/**
* Usage: Return Random Email Id.
*/
exports.getRandomEmail = function () {
  var strValues = "abcdefghijk123456789";
  var strEmail = "";
  for (var i = 0; i < strValues.length; i++) 
    strEmail = strEmail + strValues.charAt(Math.round(strValues.length * Math.random()));
  return strEmail + "@mymail.test";
};

/**
* Usage: Generate random string.
* characterLength :  Length of string.
* Returns : Random string.
*/
exports.getRandomString = function (characterLength) {
  var randomText = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < characterLength; i++)
    randomText += possible.charAt(Math.floor(Math.random() * possible.length));
  return randomText;
};

/**
* Usage: Generate random number.
* characterLength :  Length of number.
* Returns : Random number.
*/
exports.getRandomNumber = function (numberLength) {
  var randomNumber = "";
  var possible = "0123456789";
  for (var i = 0; i < numberLength; i++)
    randomNumber += possible.charAt(Math.floor(Math.random() * possible.length));
  return randomNumber;
};

/**
* Usage: waiting for element is presented
*
*/
exports.waitForElementPresent = function (elem) {
    var ec = protractor.ExpectedConditions
    var timeout = 100000;
    browser.wait(ec.presenceOf(elem), timeout);
};

/**
* Usage: waiting for element is invisible
*
*/
exports.waitForElementInvisible = function (elem) {
    var ec = protractor.ExpectedConditions
    var timeout = 60000;
    browser.wait(ec.invisibilityOf(elem), timeout);
};

/**
* Usage: waiting for element is clickable
*
*/
exports.waitForElementClickable = function (elem) {
    var ec = protractor.ExpectedConditions
    var timeout = 60000;
    browser.wait(ec.elementToBeClickable(elem), timeout);
};

/**
* Usage: waiting for text is presented in element
*
*/
exports.waitForTextPresent = function (elem, text) {
    var ec = protractor.ExpectedConditions
    var timeout = 60000;
    browser.wait(ec.textToBePresentInElement(elem,text), timeout);
};

/**
* Usage: waiting for element is visible
*
*/
exports.waitForElementVisible = function (elem) {
    var ec = protractor.ExpectedConditions
    var timeout = 60000;
    browser.wait(ec.visibilityOf(elem, timeout));
};

/**
* Usage: checking if alert presented
*
*/
exports.checkAlert = function () {
    browser.getCurrentUrl().then(function(url) {
       browser.navigate().refresh().catch(function() {
         return browser.switchTo().alert().then(function (alert) {
           console.log("Unexpected alert = " + alert.getText()); 
           alert.accept();
           return browser.get(url);
         });
       });
    });
};


