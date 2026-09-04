const { I } = inject();

class ExplorePage {
  constructor() {
    this.url = 'graph/explore';
    this.elements = {
      rawQueryToggleLabel: '$QueryEditorModeToggle',
      dataSourcePicker: locate('//input[@id="data-source-picker"]'),
      sqlEditorButton: locate('//label[text()="SQL Editor"]//parent::*[@data-testid="data-testid radio-button"]'),
      sqlBuilder: locate('//textarea'),
      sqlBuilderText: locate('//div[contains(@class, "view-line")]//span[normalize-space(text()) != ""]'),
      runQueryButton: locate('//span[text()="Run Query"]//parent::button'),
      resultRow: locate('//div[@role="row"]'),

    };
    this.messages = {
      authError: 'Authentication failed: password is incorrect, or there is no user with such name',
    };
  }

  open() {
    I.amOnPage(this.url);
    I.waitForVisible(this.elements.rawQueryToggleLabel, 30);
  }

  selectDataSource(dataSourceName) {
    I.waitForVisible(this.elements.dataSourcePicker);
    I.fillField(this.elements.dataSourcePicker, dataSourceName);
    I.pressKey('Enter');
  }

  // The query editor is mounted only after the picked datasource resolves, so
  // neither the mode toggle nor the editor exists yet when selectDataSource returns.
  // It is a Monaco editor seeded with the datasource's skeleton query, and
  // clearField/fillField race that seeding: clearing an editor Monaco has not
  // populated yet leaves the skeleton and the typed query interleaved, which
  // ClickHouse then rejects as a multi-statement. Wait for the skeleton, then
  // replace it from inside the focused editor.
  runSqlQuery(query) {
    I.waitForVisible(this.elements.sqlEditorButton, 30);
    I.click(this.elements.sqlEditorButton);
    I.waitForVisible(this.elements.sqlBuilderText, 30);
    I.click(this.elements.sqlBuilder);
    I.pressKey(['Control', 'a']);
    I.pressKey('Delete');
    I.type(query);
    I.click(this.elements.runQueryButton);
  }
}

module.exports = new ExplorePage();
module.exports.ExplorePage = ExplorePage;
