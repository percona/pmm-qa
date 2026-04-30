Feature('Advisors: configuration');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1771 Verify user is able to see advisor check technology family @advisors',
  async ({
    I, advisorsPage,
  }) => {
    I.amOnPage(advisorsPage.urlConfiguration);
    I.waitForVisible(advisorsPage.elements.expandableSectionByName('Version Configuration'));
    I.click(advisorsPage.elements.expandableSectionByName('Version Configuration'));
    I.seeTextEquals('MongoDB', advisorsPage.elements.technologyCellByName('MongoDB version check'));
    I.seeTextEquals('MySQL', advisorsPage.elements.technologyCellByName('MySQL Version'));
    I.seeTextEquals('PostgreSQL', advisorsPage.elements.technologyCellByName('Check for newer version of PostgreSQL'));
  },
);
