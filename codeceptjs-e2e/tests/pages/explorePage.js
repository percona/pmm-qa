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

  // The SQL editor arrives pre-filled with the query the plugin generates from
  // the builder ('SELECT FROM  LIMIT 1000'). clearField/fillField drive it through
  // Playwright's fill(), which here deletes a single character per call instead of
  // emptying the editor, leaving the default behind for the typed query to be
  // prepended to - a multi-statement the database rejects. Clearing from the
  // keyboard empties it; the assertion stops a future regression from reaching the
  // query as silent corruption.
  async setSqlQuery(query) {
    I.waitForVisible(this.elements.sqlBuilder, 30);

    let content;

    for (let attempt = 1; attempt <= 3; attempt++) {
      I.click(this.elements.sqlBuilder);
      I.pressKey(['Control', 'a']);
      I.pressKey('Backspace');
      I.type(query);

      content = await I.grabValueFrom(this.elements.sqlBuilder);

      if (content === query) {
        return;
      }
    }

    assert.equal(content, query, `SQL editor should contain only the query under test, found '${content}'`);
  }
}

module.exports = new ExplorePage();
module.exports.ExplorePage = ExplorePage;
