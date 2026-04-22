const { I } = inject();

Feature('Add Instance Tests');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1106 - Verify the name RDS button on Add instance page @fb-instances',
  async ({ I, addInstancePage }) => {
    addInstancePage.open();
    I.waitForVisible(addInstancePage.fields.addAmazonRDSbtn, 30);
  },
);
