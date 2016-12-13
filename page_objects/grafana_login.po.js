'use strict';

module.exports = {
  LoginPage: {
    username: element(by.name('username')),
    password: element(by.password('password')),
    logInBtn: element(by.buttonText('Log In')),
    email: element(by.model('formModel.email')),
    signUpBtn: element(by.xpath('//button[@class,"btn-login-tab active"] and .//text()="Sign Up"')),
    signUpTab: element(by.xpath('//button[@class,"btn btn-large p-x-3 btn-inverse"] and .//text()="Sign Up"'))
  },

  get: function(url) {
    browser.get(url + '/graph/');
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

  clickSignUp: function() { 
    this.LoginPage.signUpBtn.click();
  },


};
