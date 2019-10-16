const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/login",
    fields: {
        username: "//input[@name='user']",
        password: "//input[@name='password']"
    },
    loginButton: "//button[@type='submit']",
    skipLink: "//a[@ng-click='skip();']",

    // introducing methods
    login (username, password) {
        I.fillField(this.fields.username, username);
        I.fillField(this.fields.password, password);
        I.click(this.loginButton);
        I.waitForElement(this.skipLink, 30);
        I.wait(10);
        I.click(this.skipLink);
        I.wait(10);
    }
}
