const { I } = inject();

class ExplorePage {
  constructor() {
    this.url = 'graph/explore';
    this.elements = {
      rawQueryToggleLabel: '$QueryEditorModeToggle',
      dataSourcePicker: locate('//input[@id="data-source-picker"]'),
      sqlEditorButton: locate('//label[text()="SQL Editor"]//parent::*[@data-testid="data-testid radio-button"]'),
      sqlBuilder: locate('//textarea'),
      sqlEditorContent: locate('//div[contains(@class, "view-lines")]'),
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

  // The SQL editor is Monaco, and the textarea this locator matches only mirrors
  // the editor's current selection. Clearing it with nothing selected therefore
  // deletes a single character rather than the query the plugin pre-fills, and
  // the new text is appended to that leftover: ClickHouse then rejects the whole
  // thing with "Multi-statements are not allowed" and no rows come back.
  setSqlQuery(query) {
    I.waitForVisible(this.elements.sqlBuilder, 30);
    I.click(this.elements.sqlBuilder);
    I.pressKey(['Control', 'a']);
    I.fillField(this.elements.sqlBuilder, query);
    I.waitForText(query, 10, this.elements.sqlEditorContent);
  }
}

module.exports = new ExplorePage();
module.exports.ExplorePage = ExplorePage;
