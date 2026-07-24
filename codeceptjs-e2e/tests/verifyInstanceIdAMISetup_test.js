const assert = require('assert');

Feature('to run AMI Setup Page and verify Instance ID');

Scenario('Open the setup Page for AMI Instance @pmm-ami @not-ui-pipeline @not-pr-pipeline', async ({ I, amiInstanceSetupPage }) => {
  I.amOnPage(amiInstanceSetupPage.url);
  await amiInstanceSetupPage.verifyInstanceID(process.env.AMI_INSTANCE_ID);
  I.Authorize();
});

Scenario('PMM-T10 - Check correct link to AWS wizard page @pmm-ami @not-ui-pipeline @not-pr-pipeline', async ({ I, amiInstanceSetupPage }) => {
  I.amOnPage(amiInstanceSetupPage.url);
  I.seeAttributesOnElements(amiInstanceSetupPage.fields.docLink, { href: amiInstanceSetupPage.docLinkUrl });
  const readMoreLink = (await I.grabAttributeFrom(amiInstanceSetupPage.fields.docLink, 'href'));
  const response = await I.sendGetRequest(readMoreLink);

  assert.equal(response.status, 200, '"Where can I get my instance ID?" link should lead to working documentation page. But the GET request response status is not 200');
});
