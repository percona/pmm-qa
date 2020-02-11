const {I, pmmSettingsPage} = inject();
let assert = require('assert');
module.exports = {

    // insert your locators and methods here
    // setting locators
    url: "/graph/d/pmm-settings/pmm-settings",
    prometheusAlertUrl: "/prometheus/alerts",
    diagnosticsText: "You can download server logs to make the problem detection simpler. " +
        "Please include this file if you are submitting a bug report.",
    succesAlertMessage: "Settings updated",
    sectionHeaderList: ["Settings", "Advanced settings", "SSH Key Details", "AlertManager integration", "Diagnostics"],
    sectionButtonText:{
        applyChanges: "Apply changes",
        applySSHKey: "Apply SSH key",
        addAlert: "Apply AlertManager settings",
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
        sshKeyInput: "//textarea[@name='ssh_key' and @placeholder='Enter ssh key']",
        alertURLInput: "//input[@name='alert_manager_url' and @placeholder='Enter URL']",
        alertRulesInput: "//textarea[@name='alert_manager_rules' and @placeholder='Alert manager rule']",
        downloadLogsButton: "//a[@class='ant-btn' and @href='/logs.zip']",
        metricsResolution: "//div[@class='ant-slider-mark']/span[text()='",
        alertTitle: "//div[@class='alert-title']",
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
        I.seeElement("//div[@class='ant-slider-rail']");
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

    verifyAlertManagerSectionElements(){
        I.see("AlertManager URL", this.fields.sectionRow);
        I.see("AlertManager rules", this.fields.sectionRow);
        I.seeElement(this.fields.alertURLInput);
        I.seeElement(this.fields.alertRulesInput);

    },

    verifyDiagnosticsElements(){
        I.see(this.diagnosticsText, this.fields.sectionRow);
    },

    async verifySectionHeaders(){
        for (let i = 0; i< this.sectionHeaderList.length; i++){
            let elementText = await I.grabTextFrom(this.fields.sectionHeader);
            assert.equal(elementText[i], this.sectionHeaderList[i], elementText[i] +" section does not exist");
        }
    },

    waitForButton(sectionName, buttonLocator){
        if (sectionName == "Diagnostics"){
            I.waitForVisible(this.fields.downloadLogsButton, 30);
            return this.fields.downloadLogsButton;
        }else {
            I.waitForVisible(buttonLocator, 30);
            return buttonLocator;
        }
    },

    expandSection(sectionName){
        let sectionExpandLocator = this.fields.sectionHeader + "[contains(text(), '"+ sectionName +"')]";
        let buttonLocator = sectionExpandLocator + "/following-sibling::div" + this.fields.applyButton;
        I.click(sectionExpandLocator);
        return this.waitForButton(sectionName, buttonLocator);
    },

    collapseDefaultSection(){
        let sectionName = "Settings";
        let sectionHeaderLocator = this.fields.sectionHeader + "[contains(text(), '"+ sectionName +"')]";
        I.click(sectionHeaderLocator);
        I.waitForInvisible(this.fields.applyButton, 30);
    },

    async verifySectionExpanded(buttonLocator, buttonText){
        let textInside = await I.grabTextFrom(buttonLocator);
        await assert.equal(textInside, buttonText, "there is no" + buttonText + "button")
    },

    async waitForAlert() {
        I.waitForVisible(this.fields.alertTitle, 30);
        let alertText = await I.grabTextFrom(this.fields.alertTitle);
        await assert.equal(alertText, this.succesAlertMessage, "Alert Message is not successful");
    },

    async selectMetricsResolution(resolution){
        I.click(this.fields.metricsResolution + resolution + "']");
        I.click(this.fields.applyButton);
        await this.waitForAlert();
    },

    async verifyResolutionIsAppliedAfterPageReload(resolution){
        I.refreshPage();
        await this.waitForPmmSettingsPageLoaded();
        let selectedResolutionText = await I.grabTextFrom(this.fields.selectedResolution);
        console.log("actual resolution = " + selectedResolutionText);
        await assert.equal(selectedResolutionText, resolution, "Resolution " + resolution + " was not saved")

    }
}