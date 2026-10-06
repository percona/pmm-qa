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

  // Monaco's textarea holds only the slice of the document around the cursor, so
  // clearField empties the slice and fillField splices into the datasource default.
  async setSqlQuery(query) {
    I.waitForVisible(this.elements.sqlBuilder, 30);
    I.wait(2);
    I.appendField(this.elements.sqlBuilder, '');
    I.pressKey(['Control', 'a']);
    I.pressKey('Backspace');
    I.type(query);
    I.pressKey('Escape');

    const [editorContent = ''] = await I.grabTextFromAll(this.elements.sqlEditorContent);

    assert.strictEqual(
      editorContent.replace(/\s+/g, ' ').trim(),
      query,
      'The SQL editor does not hold the query under test',
    );
  }
}

module.exports = new ExplorePage();
module.exports.ExplorePage = ExplorePage;
