Feature('PMM Settings Screenshot Comparing');

Scenario('Open PMM Settings Page and take screenshots @visual-test', async (I,loginPage, pmmSettingsPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
    I.amOnPage(pmmSettingsPage.url);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    await I.screenshotElement(pmmSettingsPage.fields.mainFrame,"settings_section");
    let sectionNameToExpand = "SSH Key Details";
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    pmmSettingsPage.collapseDefaultSection();
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.sectionButtonText.applySSHKey);
    await I.screenshotElement(pmmSettingsPage.fields.mainFrame,"ssh_key_section");
    pmmSettingsPage.collapseSection(sectionNameToExpand);
    sectionNameToExpand = "AlertManager integration";
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.sectionButtonText.addAlert);
    await I.screenshotElement(pmmSettingsPage.fields.mainFrame,"alert_manager_section");
    pmmSettingsPage.collapseSection(sectionNameToExpand);
    sectionNameToExpand = "Diagnostics";
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.sectionButtonText.downloadLogs);
    await I.screenshotElement(pmmSettingsPage.fields.mainFrame,"diagnostics_section");
});

Scenario('Open PMM Settings Page and compare SSH Key section screenshot @visual-test', async (I) => {
    await I.seeVisualDiff("settings_section.png", {tolerance: 5, prepareBaseImage:false});

});

Scenario('Open PMM Settings Page and compare SSH Key section screenshot @visual-test', async (I) => {
    await I.seeVisualDiff("ssh_key_section.png", {tolerance: 5, prepareBaseImage:false});
});

Scenario('Open PMM Settings Page and compare Alert Manager section screenshot @visual-test', async (I) => {
    await I.seeVisualDiff("alert_manager_section.png", {tolerance: 5, prepareBaseImage:false});
});

Scenario('Open PMM Settings Page and compare Diagnostics section screenshot @visual-test', async (I) => {
    await I.seeVisualDiff("diagnostics_section.png", {tolerance: 5, prepareBaseImage:false});
});