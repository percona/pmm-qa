
const {I} = inject();
let assert = require('assert');
module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "/graph/d/pmm-settings/pmm-settings",
    prometheusAlertUrl: "/prometheus/alerts",
    diagnosticsText: "You can download server logs to make the problem detection simpler. " +
        "Please include this file if you are submitting a bug report.",
    alertManager:{
        ip: process.env.VM_IP,
        service:"/#/alerts",
        rule: "groups:\n" +
            "  - name: AutoTestAlerts\n" +
            "    rules:\n" +
            "    - alert: InstanceDown\n" +
            "      expr: up == 0\n" +
            "      for: 20s\n" +
            "      labels:\n" +
            "        severity: critical\n" +
            "      annotations:\n" +
            "        summary: \"Instance {{ $labels.instance }} down\"\n" +
            "        description: \"{{ $labels.instance }} of job {{ $labels.job }} has been down for more than 20 seconds.\"",
        ruleName: "AutoTestAlerts"
    },
    popUpMessages:{
        successPopUpMessage: "Settings updated",
        invalidDataDurationMessage: "bad Duration: time: invalid duration text s",
        invalidSSHKeyMessage: "Invalid SSH key.",
        successAlertmanagerMessage:"Alert manager settings updated",
        invalidAlertmanagerMissingSchemeMessage: "Invalid alert_manager_url: invalid_url - missing protocol scheme.",
        invalidAlertmanagerMissingHostMessage: "Invalid alert_manager_url: http:// - missing host.",
        invalidAlertmanagerRulesMessage: "Invalid Alert Manager rules."
    },
    sectionHeaderList: ["Settings", "Advanced settings", "SSH Key Details", "Alertmanager integration", "Diagnostics"],
    sectionButtonText:{
        applyChanges: "Apply changes",
        applySSHKey: "Apply SSH key",
        addAlert: "Apply Alertmanager settings",
        downloadLogs:"Download PMM Server Logs"
    },
    fields: {
        iframe: "//div[@class='panel-content']//iframe",
        sectionHeader: "//div[@class='ant-collapse-header']",
        sectionRow: "//div[@class='ant-row']",
        dataRetentionCount: "//input[@name='data_retention_count']",
        dataRetentionDropdown:"//span//div[@class='select-item']",
        callHomeSwitch:"//button[@class='toggle-field ant-switch ant-switch-checked']",
        subSectionHeader: "/following-sibling::div//div[@class='ant-collapse-header']",
        applyButton: "//button[@type='submit']",
        addSSHKeyButton:"//span[text()='Apply SSH key']/parent::button",
        sshKeyInput: "//textarea[@name='ssh_key' and @placeholder='Enter ssh key']",
        alertURLInput: "//input[@name='alert_manager_url' and @placeholder='Enter URL']",
        alertRulesInput: "//textarea[@name='alert_manager_rules' and @placeholder='Alertmanager rules']",
        addAlertRuleButton: "//span[text()='Apply Alertmanager settings']/parent::button",
        downloadLogsButton: "//a[@class='ant-btn' and @href='/logs.zip']",
        metricsResolution: "//div[@class='ant-slider-mark']/span[text()='",
        metricsResolutionSlider:"//div[@class='ant-slider-rail']",
        popUpTitle: "//div[@class='alert-title']",
        selectedResolution: "//span[@class='ant-slider-mark-text ant-slider-mark-text-active']"
    },

    async waitForPmmSettingsPageLoaded(){
        I.waitForVisible(this.fields.applyButton, 30);
        I.waitForClickable(this.fields.applyButton, 30);
        I.waitForVisible(this.fields.sectionHeader, 30);
        I.waitForVisible(this.fields.callHomeSwitch, 30);
        I.waitForClickable(this.fields.callHomeSwitch, 30);
        return this;
    },

    verifySettingsSectionElements(){
        I.see("Metrics resolution", this.fields.sectionRow);
        I.seeElement(this.fields.metricsResolutionSlider);
        I.see("Data retention", this.fields.sectionRow);
        I.seeElement(this.fields.dataRetentionCount);
        I.seeElement(this.fields.dataRetentionDropdown);
        I.see("Call home", this.fields.sectionRow);
        I.seeElement(this.fields.callHomeSwitch);
        I.see("Check for updates", this.fields.sectionRow);
    },

    verifySSHKeyDetailsSectionElements(){
        I.see("SSH key", this.fields.sectionRow);
        I.seeElement(this.fields.sshKeyInput);
    },

    verifyAlertmanagerSectionElements(){
        I.see("Alertmanager URL", this.fields.sectionRow);
        I.see("Alertmanager rules", this.fields.sectionRow);
        I.seeElement(this.fields.alertURLInput);
        I.seeElement(this.fields.alertRulesInput);

    },

    verifyDiagnosticsElements(){
        I.see(this.diagnosticsText, this.fields.sectionRow);
    },

    async verifySectionHeaders(){
        for (let i = 0; i< this.sectionHeaderList.length; i++){
            let elementText = await I.grabTextFrom(this.fields.sectionHeader);
            assert.equal(elementText[i], this.sectionHeaderList[i], `${elementText[i]}section does not exist"`);
        }
    },

    waitForButton(contentLocator, contentLocatorText){
        I.waitForVisible(contentLocator, 30);
        return this.verifySectionExpanded(contentLocator, contentLocatorText);
    },

    expandSection(sectionName, expectedContentLocatorText){
        let sectionExpandLocator = this.fields.sectionHeader + `[contains(text(), '${sectionName}')]`;
        let contentLocator = sectionExpandLocator + `/following-sibling::div//span[text()='${expectedContentLocatorText}']`;
        I.click(sectionExpandLocator);
        return this.waitForButton(contentLocator, expectedContentLocatorText);
    },

    collapseSection(sectionName){
        let sectionHeaderLocator = this.fields.sectionHeader + `[contains(text(), '${sectionName}')]`;
        I.click(sectionHeaderLocator);
        I.waitForInvisible(this.fields.applyButton, 30);
    },


    collapseDefaultSection(){
        this.collapseSection("Settings");
    },

    async verifySectionExpanded(contentLocator, contentLocatorText){
        let textInside = await I.grabTextFrom(contentLocator);
        assert.equal(textInside, contentLocatorText, `there is no ${contentLocatorText} button`)
    },

    waitForPopUp() {
        I.waitForVisible(this.fields.popUpTitle, 30);
    },

    async verifyPopUpMessage(validationMessage) {
        let alertText = await I.grabTextFrom(this.fields.popUpTitle);
        assert.equal(alertText.toString().split(',')[0], validationMessage, `Unexpected popup message! Expected to see ${validationMessage} instead of ${alertText}`);
    },

    async verifySuccessfulPopUp(successMessage){
        await this.waitForPopUp();
        await this.verifyPopUpMessage(successMessage)
    },

    async verifyValidationPopUp(validationMessage){
        await this.waitForPopUp();
        await this.verifyPopUpMessage(validationMessage)
    },

    async selectMetricsResolution(resolution){
        I.click(this.fields.metricsResolution + resolution + "']");
        I.click(this.fields.applyButton);
    },

    async verifyResolutionIsApplied(resolution){
        I.refreshPage();
        await this.waitForPmmSettingsPageLoaded();
        let selectedResolutionText = await I.grabTextFrom(this.fields.selectedResolution);

        assert.equal(selectedResolutionText, resolution, `Resolution ${resolution} was not saved`)
    },

    customClearField(field) {
        I.appendField(field, '');
        I.pressKey(['Shift', 'Home']);
        I.pressKey('Backspace');
    },

    async changeDataRetentionValueTo(seconds){
        this.customClearField(this.fields.dataRetentionCount);
        I.fillField(this.fields.dataRetentionCount, seconds);
        I.click(this.fields.applyButton);
        await this.waitForPopUp();
    },

    async verifyDataRetentionValueApplied(seconds){
        I.refreshPage();
        await this.waitForPmmSettingsPageLoaded();
        let selectedTimeValue = await I.grabAttributeFrom(this.fields.dataRetentionCount, 'value');
        assert.equal(selectedTimeValue, seconds, `Data Retention value ${seconds} was not saved`);
    },

    addSSHKey(keyValue){
        I.fillField(this.fields.sshKeyInput, keyValue);
        I.click(this.fields.addSSHKeyButton);
    },

    addAlertmanagerRule(url, rule){
        this.customClearField(this.fields.alertURLInput);
        I.fillField(this.fields.alertURLInput, url);
        this.customClearField(this.fields.alertRulesInput);
        I.fillField(this.fields.alertRulesInput, rule);
        I.click(this.fields.addAlertRuleButton);
    },

    openAlertsManagerUi(){
        I.amOnPage(this.prometheusAlertUrl);
    },

    async verifyAlertmanagerRuleAdded(){
        for (let i = 0; i<10; i++) {
            let notLoaded = await I.grabNumberOfVisibleElements(`//td[contains(text(), '${this.alertManager.ruleName}')]`);
            if (notLoaded) break;
            I.refreshPage();
            I.wait(1);
        }
        I.see(this.alertManager.ruleName);
    }
}
