const { I, adminPage } = inject();

module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "graph/d/pmm-add-instance/pmm-add-instance?orgId=1",
    fields: {
        pageHeaderText: "PMM Add Instance",
        iframe: "//div[@class='panel-content']//iframe",
        remoteInstanceTitle: "How to Add an Instance",
        addMongoDBRemote: "//a[contains(text(), 'Add a Remote MongoDB Instance')]",
        addMySqlRemote: "//a[contains(text(), 'Add a Remote MySQL Instance')]",
        hostName: "//input[contains(@placeholder,'*Hostname')]",
        serviceName: "//input[@placeholder='Service name (default: Hostname)']",
        portNumber: "//input[contains(@placeholder, 'Port')]",
        userName: "//input[contains(@placeholder, 'Username')]",
        password: "//input[contains(@placeholder, 'Password')]",
        environment: "//input[contains(@placeholder, 'Environment')]",
        addService: "#addInstance",
        skipTLS: "//input[@name='tls_skip_verify']",
        usePerformanceSchema: "//input[@name='qan_mysql_perfschema']",
        skipTLSL: "//input[@name='tls_skip_verify']/following-sibling::span[2]",
        availabilityZone: '//input[@placeholder="*Availability Zone"]'
    },

    async addMySQLRemote (serviceName) {
        remoteInstancesPage = this;
        I.click(remoteInstancesPage.fields.addMySqlRemote);
        I.waitForElement(remoteInstancesPage.fields.serviceName, 60);
        I.fillField(remoteInstancesPage.fields.hostName, process.env.REMOTE_MYSQL_HOST);
        I.fillField(remoteInstancesPage.fields.serviceName, serviceName);
        I.fillField(remoteInstancesPage.fields.userName, process.env.REMOTE_MYSQL_USER);
        I.fillField(remoteInstancesPage.fields.password, process.env.REMOTE_MYSQL_PASSWORD);
        I.fillField(remoteInstancesPage.fields.environment, "Remote Node MySQL");
        I.wait(5);
        adminPage.peformPageDown(5);
        I.click(remoteInstancesPage.fields.skipTLS);
        I.click(remoteInstancesPage.fields.usePerformanceSchema);
        I.click(remoteInstancesPage.fields.addService);
        I.wait(10);
    },

    async addMySQLRemoteLatest (serviceName) {
        remoteInstancesPage = this;
        I.click(remoteInstancesPage.fields.addMySqlRemote);
        I.waitForElement(remoteInstancesPage.fields.serviceName, 60);
        I.fillField(remoteInstancesPage.fields.hostName,  process.env.REMOTE_MYSQL_HOST);
        I.fillField(remoteInstancesPage.fields.serviceName, serviceName);
        I.fillField(remoteInstancesPage.fields.userName, process.env.REMOTE_MYSQL_USER);
        I.fillField(remoteInstancesPage.fields.password, process.env.REMOTE_MYSQL_PASSWORD);
        I.fillField(remoteInstancesPage.fields.environment, "Remote Node MySQL");
        I.wait(5);
        adminPage.peformPageDown(5);
        I.click(remoteInstancesPage.fields.skipTLSL);
        I.click(remoteInstancesPage.fields.addService);
        I.wait(10);
    }
}
