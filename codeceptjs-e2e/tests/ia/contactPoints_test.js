const { contactPointsPage } = inject();
const editedCPName = 'Edited';
const contactPoints = new DataTable(['name', 'type']);

for (const [, cp] of Object.entries(contactPointsPage.types)) {
  contactPoints.add([cp.name, cp.type]);
}

Feature('Alerting: Contact Points');

Before(async ({ I }) => {
  await I.Authorize();
});

// Data(contactPoints).Scenario(
//   'PMM-T1703 Verify Slack contact point can be created, '
//   + 'PMM-T1709 Verify Webhook contact point can be created @fb-alerting',
//   async ({ I, current }) => {
//     await contactPointsPage.openContactPointsTab();
//     await contactPointsPage.createCP(current.name, current.type);
//     I.click(contactPointsPage.buttons.saveCP);
//     I.verifyPopUpMessage(contactPointsPage.messages.cPCreatedSuccess);
//     await contactPointsPage.verifyCPInTable(current.name);
//   },
// );
//
// Data(contactPoints).Scenario(
//   'PMM-T1707 Verify Slack contact point can be edited @fb-alerting',
//   async ({ I, current }) => {
//     await contactPointsPage.openContactPointsTab();
//     await contactPointsPage.editCP(current.name);
//     I.appendField(contactPointsPage.fields.cPName, editedCPName);
//     I.click(contactPointsPage.buttons.saveCP);
//     I.verifyPopUpMessage(contactPointsPage.messages.cPEditedSuccess);
//     await contactPointsPage.verifyCPInTable(current.name + editedCPName);
//   },
// );
//
// Scenario(
//   'PMM-T1706 Verify default contact point cannot be deleted @fb-alerting',
//   async ({ I }) => {
//     await contactPointsPage.openContactPointsTab();
//     await contactPointsPage.openMoreMenu('default');
//     I.waitForVisible(contactPointsPage.buttons.deleteCP, 10);
//     I.seeAttributesOnElements(contactPointsPage.buttons.deleteCP, { disabled: 'true' });
//   },
// );
//
// Data(contactPoints).Scenario(
//   'PMM-T1704 Verify Slack contact point can be deleted @fb-alerting',
//   async ({ I, current }) => {
//     const name = current.name + editedCPName;
//
//     await contactPointsPage.openContactPointsTab();
//     await contactPointsPage.deleteCP(name);
//     I.waitForVisible(contactPointsPage.elements.deleteCPDialogHeader, 10);
//     I.see(contactPointsPage.messages.deleteCPConfirm(name));
//     I.click(contactPointsPage.buttons.confirmDeleteCP);
//     I.verifyPopUpMessage(contactPointsPage.messages.cPDeletedSuccess);
//     I.dontSee(name, contactPointsPage.elements.cPTable);
//   },
// );

// Scenario(
//   'PMM-T1710 Verify saving a contact point when required info is missing, '
//   + 'PMM-T1711 Verify contact point test @fb-alerting',
//   async ({ I, iaCommon }) => {
//     await contactPointsPage.openContactPointsTab();
//     I.waitForVisible(contactPointsPage.buttons.newContactPoint, 10);
//     I.click(contactPointsPage.buttons.newContactPoint);
//     I.waitForVisible(contactPointsPage.buttons.saveCP, 10);
//     I.click(contactPointsPage.buttons.saveCP);
//     I.verifyPopUpMessage(contactPointsPage.messages.missingRequired);
//     I.click(contactPointsPage.fields.cPType);
//     I.waitForVisible(iaCommon.elements.selectDropdownOption('PagerDuty'), 10);
//     I.click(iaCommon.elements.selectDropdownOption('PagerDuty'));
//     I.fillField(contactPointsPage.fields.cPName, 'test');
//     I.fillField(contactPointsPage.fields.pagerDutyKey, process.env.PAGER_DUTY_SERVICE_KEY);
//     I.click(contactPointsPage.buttons.testCP);
//     I.see(contactPointsPage.messages.testNotification, iaCommon.elements.modalDialog);
//     I.click(contactPointsPage.buttons.sendTest);
//     I.verifyPopUpMessage(contactPointsPage.messages.testSent);
//   },
// );
