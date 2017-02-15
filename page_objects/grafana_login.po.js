'use strict';

module.exports = {
  LoginPage: {
    username: element(by.name('username')),
    password: element(by.name('password')),
    logInBtn: element(by.css('.gf-form-button-row button[type="submit"]')),
    email: element(by.model('formModel.email')),
    signUpBtn: element(by.xpath('//button[@class="btn btn-large p-x-3 btn-primary" and text()="Sign up"]')),
    signUpTab: element(by.buttonText('Sign up'))
  },

  get: function(url) {
    browser.get(url + '/graph/login');
    //browser.wait(function() {
    //return driver.getTitle().then(function(title) {
    //    return title === 'Percona Query Analytics';
   // });
//}, 10000);

    browser.waitForAngular();
  },

  clickLogIn: function() {
    this.LoginPage.loginBtn.click();
  },

  setUsername: function(user) {
    this.LoginPage.username.sendKeys(user);
  },

  setPassword: function(pass) {
    this.LoginPage.password.sendKeys(pass);
  },

  clickSignUpTab: function() {
    this.LoginPage.signUpTab.click();
  },

  setEmail: function(mail) {
    this.LoginPage.email.sendKeys(mail);
  },

  clickSignUpBtn: function() { 
    this.LoginPage.signUpBtn.click();
  },


};
