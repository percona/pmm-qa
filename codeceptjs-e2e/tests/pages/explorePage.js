const assert = require('assert');

const { I } = inject();

class ExplorePage {
  constructor() {
    this.url = 'graph/explore';
    this.elements = {
      rawQueryToggleLabel: '$QueryEditorModeToggle',
      dataSourcePicker: locate('//input[@id="data-source-picker"]'),
      sqlEditorButton: locate('//label[text()="SQL Editor"]//parent::*[@data-testid="data-testid radio-button"]'),
      sqlBuilder: locate('//textarea'),
      runQueryButton: locate('//span[text()="Run Query"]//parent::button'),
      resultRow: locate('//div[@role="row"]'),
      sqlEditorContent: locate('//div[contains(@class, "view-lines")]'),

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

  // The query editor is Monaco, and the textarea the locator reaches holds only the
  // slice of the document around the cursor. clearField therefore empties that slice
  // and not the editor, and fillField splices the new query into whatever default the
  // datasource left behind -- ClickHouse then rejects the result as two statements in
  // one query. Select and delete through real key events instead, and check what the
  // editor actually ended up holding.
  async setSqlQuery(query) {
    I.waitForVisible(this.elements.sqlBuilder, 30);
    // The datasource writes its own default query into the editor when the SQL Editor
    // tab opens, and does it a beat after the tab renders -- clearing before that lands
    // is what makes this intermittent rather than always broken.
    I.wait(2);
    I.appendField(this.elements.sqlBuilder, '');
    I.pressKey(['Control', 'a']);
    I.pressKey('Backspace');
    I.type(query);
    I.pressKey('Escape');

    const [editorContent = ''] = await I.grabTextFromAll(this.elements.sqlEditorContent);

    assert.strictEqual(
      editorContent.replace(/\u00a0/g, ' ').trim(),
      query,
      'The SQL editor does not hold the query under test',
    );
  }
}

module.exports = new ExplorePage();
module.exports.ExplorePage = ExplorePage;
