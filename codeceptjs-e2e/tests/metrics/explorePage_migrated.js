Feature('Explore Page');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  '@PMM-T1419 Verify there is no Give feedback button on Explore page @grafana-pr',
  async ({ I, explorePage }) => {
    explorePage.open();
    I.dontSee('Give feedback');
  },
);
