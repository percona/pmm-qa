const assert = require('assert');

const { I, queryAnalyticsPage } = inject();

class QueryAnalyticsQueryDetails {
  constructor() {
    this.elements = {
      metricsCellDetailValue: (metricName, columnNumber) => locate(`//td//span[contains(text(), "${metricName}")]/ancestor::tr/td[${columnNumber}]//span[1]`),
      codeBlock: locate('//*[@data-testid="highlight-code" or contains(@class, "pretty-json-container")]'),
      noExamples: locate('pre').withText('Sorry, no examples found for this query'),
      noPlan: locate('pre').withText('No plan found'),
      noClassic: locate('pre').withText('No classic explain found'),
      noTable: locate('pre').withText('No table info from example nor explain'),
      noJSON: locate('pre').withText('No JSON explain found'),
      explainError: locate('$json-explain-error'),
      classicExplainError: locate('//*[@data-testid="classic-explain-error"]'),
      histogramContainer: locate('$histogram-collapse-container'),
      topQuery: locate('$top-query').find('div'),
      emptyPlanText: locate('pre').withText('No plan found'),
      planText: locate('pre').find('code'),
      planInfoIcon: locate('$query-analytics-details').find('[tabindex="0"]'),
      tooltipPlanId: locate(I.useDataQA('data-testid tooltip')),
      table: (tableIndex) => locate(`((//div[@role="tablist"])[2]//button)[${tableIndex + 1}]`),
      tables: locate('(//div[@role="tablist"])[2]//button'),
    };
    this.buttons = {
      tab: (tabName) => locate('button').withText(tabName),
      close: locate('button').find('span').withText('Close'),
    };
    this.messages = {
      notSupportedExplain: 'Failed to create action: EXPLAIN functionality is supported only for DML queries - SELECT, INSERT, UPDATE, DELETE and REPLACE.',
    };
  }

  async verifyAverageQueryCount(timeRangeInSec = 300) {
    const qpsvalue = await I.grabTextFrom(this.elements.metricsCellDetailValue('Query Count', 2));
    let queryCountDetail = await I.grabTextFrom(this.elements.metricsCellDetailValue('Query Count', 3));

    queryCountDetail = this.getQueryCountValue(queryCountDetail);

    const result = (queryCountDetail / timeRangeInSec).toFixed(4);

    this.compareCalculation(qpsvalue, result);
  }

  async verifyAverageQueryTime(timeRangeInSec = 300) {
    const timeLocator = this.elements.metricsCellDetailValue('Query Time', 4);
    const countLocator = this.elements.metricsCellDetailValue('Query Count', 3);
    const loadLocator = this.elements.metricsCellDetailValue('Query Time', 2);

    /* eslint-disable prefer-const */
    let [perQueryStats, perQueryUnit] = (await I.grabTextFrom(timeLocator)).split(' ');

    if (perQueryUnit === 'ms') perQueryStats /= 1000;

    if (perQueryUnit === 'µs') perQueryStats /= 1000000;

    let queryCountDetail = await I.grabTextFrom(countLocator);

    queryCountDetail = this.getQueryCountValue(queryCountDetail);

    const [load] = (await I.grabTextFrom(loadLocator)).split(' ');
    const result = ((queryCountDetail * parseFloat(perQueryStats)) / timeRangeInSec).toFixed(4);

    this.compareCalculation(load, result);
  }

  getQueryCountValue(value) {
    let result = parseFloat(value);

    if (value.endsWith('k')) {
      result *= 1000;
    }

    return result;
  }

  compareCalculation(value, result) {
    switch (true) {
      case result < 0.01:
        assert.ok(value.startsWith('<0.01'), `Values don't match. Value: ${value}, calculated Result: ${result}`);
        break;
      case parseFloat(result) <= 0.0149:
        assert.ok(value.startsWith('0.01'), `Values don't match. Value: ${value}, calculated Result: ${result}`);
        break;
      default:
        assert.ok(parseFloat(parseFloat(result).toFixed(2)) === parseFloat(value), `Values don't match. Value: ${value}, calculated Result: ${result}`);
    }
  }

  checkExamplesTab(isNoExamplesVisible = false) {
    this.openExamplesTab();
    queryAnalyticsPage.waitForLoaded();
    I.waitForVisible(this.elements.codeBlock, 30);

    if (isNoExamplesVisible) { I.seeElement(this.elements.noExamples); } else { I.dontSeeElement(this.elements.noExamples); }
  }

  async verifyExamples(parameters = {}) {
    I.waitForVisible(this.buttons.tab('Examples'), 30);
    I.click(this.buttons.tab('Examples'));
    queryAnalyticsPage.waitForLoaded();
    I.waitForVisible(this.elements.codeBlock, 30);

    if (await I.isElementDisplayed(this.elements.noExamples, 1)) {
      throw new Error(`No examples visible for parameters: ${JSON.stringify(parameters)}`);
    }
  }

  async verifyExplain(parameters = {}) {
    I.waitForVisible(this.buttons.tab('Explain'), 30);
    I.click(this.buttons.tab('Explain'));
    queryAnalyticsPage.waitForLoaded();
    I.waitForVisible(this.elements.codeBlock, 30);

    if (await I.isElementDisplayed(this.elements.explainError, 1)) {
      throw new Error(`No explain visible for parameters: ${JSON.stringify(parameters)}`);
    }
  }

  async verifyTables(parameters = {}) {
    I.waitForVisible(this.buttons.tab('Tables'), 30);
    I.click(this.buttons.tab('Tables'));
    queryAnalyticsPage.waitForLoaded();
    I.waitForVisible(this.elements.tables, 2);
    const tablesCount = await I.grabNumberOfVisibleElements(this.elements.tables);

    for (let i = 0; i < tablesCount; i++) {
      I.click(this.elements.table(i));
      queryAnalyticsPage.waitForLoaded();
      I.waitForVisible(this.elements.codeBlock, 30);

      if (await I.isElementDisplayed(this.elements.noTable, 1)) {
        throw new Error(`No explain visible for parameters: ${JSON.stringify(parameters)}`);
      }
    }
  }

  async verifyPlan(parameters = {}) {
    I.waitForVisible(this.buttons.tab('Plan'), 30);
    I.click(this.buttons.tab('Plan'));
    queryAnalyticsPage.waitForLoaded();

    if (await I.isElementDisplayed(this.elements.noPlan, 1)) {
      throw new Error(`No plan visible for parameters: ${JSON.stringify(parameters)}`);
    }
  }

  openExplainTab() {
    I.waitForVisible(this.buttons.tab('Explain'), 30);
    I.click(this.buttons.tab('Explain'));
  }

  openExamplesTab() {
    I.waitForVisible(this.buttons.tab('Examples'), 30);
    I.click(this.buttons.tab('Examples'));
  }

  openTablesTab() {
    I.waitForVisible(this.buttons.tab('Tables'), 30);
    I.click(this.buttons.tab('Tables'));
  }

  async verifyExplainError({ classicError, jsonError }) {
    if (classicError) {
      I.waitForVisible(this.elements.classicExplainError);
      I.assertEqual(
        await I.grabTextFrom(this.elements.classicExplainError),
        classicError,
        `Expected the actual classic error: "${await I.grabTextFrom(this.elements.classicExplainError)}" to match expected one ${classicError}`,
      );
    }

    if (jsonError) {
      I.waitForVisible(this.elements.explainError);
      I.assertEqual(
        await I.grabTextFrom(this.elements.explainError),
        classicError,
        `Expected the actual classic error: "${await I.grabTextFrom(this.elements.explainError)}" to match expected one ${jsonError}`,
      );
    }
  }

  checkTab(tabName) {
    I.waitForVisible(this.buttons.tab(tabName), 30);
    I.click(this.buttons.tab(tabName));
    I.wait(5);
    queryAnalyticsPage.waitForLoaded();
    I.dontSeeElement(this.elements.noClassic);
    I.dontSeeElement(this.elements.noJSON);
    I.waitForDetached(this.elements.explainError);
  }

  waitForDetails() {
    I.waitForVisible(this.buttons.tab('Details'), 30);
    I.click(this.buttons.tab('Details'));
    I.wait(5);
    queryAnalyticsPage.waitForLoaded();
    I.dontSeeElement(this.elements.noClassic);
    I.dontSeeElement(this.elements.noJSON);
    I.waitForDetached(this.elements.explainError);
  }

  async checkPlanTabIsNotEmpty() {
    I.dontSeeElement(this.elements.emptyPlanText);
    I.waitForVisible(this.elements.planText, 20);
    const text = await I.grabTextFrom(this.elements.planText);

    assert.ok(text.length > 0, 'Plan text length must be more than 0');
  }

  async mouseOverPlanInfoIcon() {
    await I.moveCursorTo(this.elements.planInfoIcon);
    await I.waitForVisible(this.elements.tooltipPlanId, 30);
  }

  checkPlanTabIsEmpty() {
    I.waitForVisible(this.elements.emptyPlanText, 20);
    I.dontSeeElement(this.elements.planInfoIcon);
  }
}

module.exports = new QueryAnalyticsQueryDetails();
module.exports.QueryAnalyticsQueryDetails = QueryAnalyticsQueryDetails;
