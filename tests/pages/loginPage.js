const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/login",
    fields: {
        username: "//input[@placeholder='email or username']",
        password: "//input[@placeholder='password']"
    },
    loginButton: "Log In",
    skipLink: "//a[contains(text(), 'Skip')]",

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
