const pmmServerPort = '8081';
const basePmmUrl = `http://127.0.0.1:${pmmServerPort}/`;
const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';

Feature('SQL editor probe');

BeforeSuite(async ({ I }) => {
  await I.verifyCommand(`PMM_SERVER_IMAGE=${dockerVersion} docker compose -f docker-compose-clickhouse.yml up -d`);
  await I.wait(30);
});

Before(async ({ I }) => {
  await I.Authorize('admin', 'admin', basePmmUrl);
});

AfterSuite(async ({ I }) => {
  await I.verifyCommand('docker compose -f docker-compose-clickhouse.yml down -v');
});

Scenario('PROBE editor content @probe', async ({ I, explorePage }) => {
  const dump = async (label) => {
    const lines = await I.grabTextFromAll('//div[contains(@class,"view-lines")]');
    const areas = await I.grabNumberOfVisibleElements(explorePage.elements.sqlBuilder);

    I.say(`PROBE|${label}|textareas=${areas}|${JSON.stringify(lines)}`);
  };

  I.amOnPage(basePmmUrl + explorePage.url);
  explorePage.selectDataSource('ClickHouse');
  I.waitForVisible(explorePage.elements.sqlEditorButton, 30);
  I.click(explorePage.elements.sqlEditorButton);
  await dump('after-sql-editor-click');
  I.clearField(explorePage.elements.sqlBuilder);
  await dump('after-clearField');
  I.fillField(explorePage.elements.sqlBuilder, 'SELECT * FROM pmm.metrics LIMIT 10;');
  await dump('after-fillField');
});

Scenario('PROBE editor content after settle @probe', async ({ I, explorePage }) => {
  const dump = async (label) => {
    const lines = await I.grabTextFromAll('//div[contains(@class,"view-lines")]');

    I.say(`PROBE|${label}|${JSON.stringify(lines)}`);
  };

  I.amOnPage(basePmmUrl + explorePage.url);
  explorePage.selectDataSource('ClickHouse');
  I.waitForVisible(explorePage.elements.sqlEditorButton, 30);
  I.click(explorePage.elements.sqlEditorButton);
  I.wait(5);
  await dump('settled-after-sql-editor-click');
  I.click(explorePage.elements.sqlBuilder);
  I.pressKey(['Control', 'a']);
  I.fillField(explorePage.elements.sqlBuilder, 'SELECT * FROM pmm.metrics LIMIT 10;');
  await dump('settled-selectall-then-fill');
});
