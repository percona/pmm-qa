const I = actor();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/login",
    fields: {
        username: "//input[@name='username']",
        password: "//input[@name='password']"
    },
    loginButton: "//button[@type='submit']",

    // introducing methods
    login (username, password) {
        I.fillField(this.fields.username, username);
        I.fillField(this.fields.password, password);
        I.click(this.loginButton);
        I.waitForText("Percona Monitoring and Management", 5);
    }
}