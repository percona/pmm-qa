Feature('PMM Settings Page Elements');

Before((I, loginPage, pmmSettingsPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
    I.amOnPage(pmmSettingsPage.url);
});

Scenario('Open PMM Settings page, verify Section Headers and Settings Section', async (I, pmmSettingsPage) =>{
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    await pmmSettingsPage.verifySectionHeaders();
    await pmmSettingsPage.verifySectionExpanded(pmmSettingsPage.fields.applyButton, pmmSettingsPage.sectionButtonText.applyChanges);
    pmmSettingsPage.verifySettingsSectionElements();
});

Scenario('Open PMM Settings page and verify SSH Key Details Section', async (I, pmmSettingsPage) =>{
    let sectionNameToExpand = "SSH Key Details";
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    pmmSettingsPage.collapseDefaultSection();
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.sectionButtonText.applySSHKey);
    pmmSettingsPage.verifySSHKeyDetailsSectionElements();
});

Scenario('Open PMM Settings page and verify AlertManager integration Section', async (I, pmmSettingsPage) =>{
    let sectionNameToExpand = "AlertManager integration";
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    pmmSettingsPage.collapseDefaultSection();
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.sectionButtonText.addAlert);
    pmmSettingsPage.verifyAlertManagerSectionElements();
});

Scenario('Open PMM Settings page and verify Diagnostics Section', async (I, pmmSettingsPage) =>{
    let sectionNameToExpand = "Diagnostics";
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    pmmSettingsPage.collapseDefaultSection();
    await pmmSettingsPage.expandSection(sectionNameToExpand, pmmSettingsPage.sectionButtonText.downloadLogs);
    pmmSettingsPage.verifyDiagnosticsElements();
});