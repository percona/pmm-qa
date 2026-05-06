const assert = require('assert');

const { I, queryAnalyticsPage, adminPage } = inject();

class QueryAnalyticsFilters {
  constructor() {
    this.fields = {
      filterBy: locate(I.useDataQA('filters-search-field')),
      filterCheckboxes: locate('//div[contains(@data-testid, "filter-checkbox")]'),
      filterCheckBoxesInGroup: (groupName) => this.fields.filterGroup(groupName).find('//div[contains(@data-testid, "filter-checkbox")]'),
      groupHeaders: locate(I.useDataQA('checkbox-group-header')),
      filterGroup: (groupName) => locate(`//span[@data-testid="checkbox-group-header" and text()="${groupName}"]/parent::p/parent::div`),
      filterByExactName: (filterName) => locate(`//div[@data-testid="filter-checkbox-${filterName}"]`),
      filterByName: (filterName) => locate(`//div[contains(@data-testid, "filter-checkbox-${filterName}")]`),
      filterByNameAndGroup: (filterName, groupName) => this.fields.filterGroup(groupName).find(`//div[@data-testid="filter-checkbox-${filterName}"]`),
      filterByNameAndGroupContains: (filterName, groupName) => this.fields.filterGroup(groupName).find(`//div[contains(@data-testid, "filter-checkbox-${filterName}")]`),
      filterLinkByNameAndGroup: (filterName, groupName) => this.fields.filterByNameAndGroup(filterName, groupName).find('a'),
      filterPercentageByNameAndGroup: (filterName, groupName) => this.fields.filterByNameAndGroup(filterName, groupName).find('//span').at(3),
      filterName: locate('//span[@class="checkbox-container__label-text"]'),
      checkedFilters: () => this.fields.filterCheckboxes.find('//input[@type="checkbox" and @checked]//following-sibling::span[@class="checkbox-container__label-text"]'),
      groupElementsCount: (groupName) => `//span[contains(text(), '${groupName}')]/following-sibling::span[contains(text(), 'Show all')]`,
    };
    this.buttons = {
      showSelected: locate('$qan-filters-show-selected'),
      resetAll: locate('$qan-filters-reset-all'),
    };
    this.labels = {
      filterGroups: [
        'Environment',
        'Cluster',
        'Replication Set',
        'Database',
        'Node Name',
        'Service Name',
        'User Name',
        'Node Type',
        'Service Type',
        'Command Type',
      ],
    };
  }

  async getFilterPercentage(filterName, groupName) {
    return this.fields.filterPercentageByNameAndGroup(filterName, groupName);
  }

  filterBy(filterName) {
    I.usePlaywrightTo('Filter QAN by name', async ({ page }) => {
      const locator = await page.locator(this.fields.filterBy.value);

      await locator.waitFor({ state: 'attached' });
      await locator.type(filterName);
      await page.waitForTimeout(200);
    });
  }

  selectFilter(filterName, timeout = 30000) {
    I.waitForVisible(this.fields.filterBy, 30);
    I.usePlaywrightTo('Search and select QAN Filter', async ({ page }) => {
      const locator = page.locator(this.fields.filterByExactName(filterName).value).first();

      await page.locator(this.fields.filterBy.value).fill(filterName);

      await locator.waitFor({ state: 'attached', timeout });
      await locator.click();
    });
    queryAnalyticsPage.waitForLoaded();
    I.click(this.fields.filterBy);
    adminPage.customClearField(this.fields.filterBy);
    I.wait(1);
  }

  resetAllFilters() {
    I.usePlaywrightTo('Select QAN Filter', async ({ page }) => {
      const locator = await page.locator(this.buttons.resetAll.value);

      await locator.waitFor({ state: 'attached' });
      await locator.click();
    });
  }

  selectFilterInGroup(filterName, groupName) {
    let selectedFilter = filterName;

    if (selectedFilter === 'n/a') {
      selectedFilter = '';
    }

    I.waitForVisible(this.fields.filterBy, 10);
    I.fillField(this.fields.filterBy, filterName);
    I.usePlaywrightTo('Select QAN Filter', async ({ page }) => {
      const locator = await page.locator(this.fields.filterByNameAndGroup(selectedFilter, groupName).value);

      await locator.waitFor({ state: 'attached' });
      await locator.click();
    });
    queryAnalyticsPage.waitForLoaded();
    I.click(this.fields.filterBy);
    adminPage.customClearField(this.fields.filterBy);
    I.wait(1);
  }

  selectFilterInGroupAtPosition(groupName, position) {
    I.usePlaywrightTo('Select QAN Filter', async ({ page }) => {
      const locator = await page.locator(this.fields.filterCheckBoxesInGroup(groupName).value);

      await locator.nth(position - 1).waitFor({ state: 'attached' });
      await locator.nth(position - 1).click();
    });
  }

  selectContainFilter(filterName) {
    I.waitForVisible(this.fields.groupHeaders, 30);
    I.click(this.fields.groupHeaders);
    I.fillField(this.fields.filterBy, filterName);
    I.waitForVisible(this.fields.filterByName(filterName));
    I.usePlaywrightTo('Select QAN Filter', async ({ page }) => {
      const locator = await page.locator(this.fields.filterByName(filterName).value);

      await locator.first().waitFor({ state: 'attached' });
      await locator.first().click();
    });
    queryAnalyticsPage.waitForLoaded();
    I.click(this.fields.filterBy);
    adminPage.customClearField(this.fields.filterBy);
    I.wait(1);
  }

  selectContainFilterInGroup(filterName, groupName) {
    let selectedFilter = filterName;

    if (selectedFilter === 'n/a') {
      selectedFilter = '';
    }

    I.waitForVisible(this.fields.filterBy, 30);
    I.usePlaywrightTo('Filter Field.', async ({ page }) => {
      const locator = await page.locator(this.fields.filterBy.value);

      await locator.waitFor({ state: 'attached' });
      await locator.fill(filterName);
    });
    I.usePlaywrightTo('Select QAN Filter', async ({ page }) => {
      const locator = await page.locator(this.fields.filterByNameAndGroupContains(selectedFilter, groupName).value);

      await locator.first().waitFor({ state: 'attached' });
      await locator.first().click();
    });
    queryAnalyticsPage.waitForLoaded();
    I.click(this.fields.filterBy);
    adminPage.customClearField(this.fields.filterBy);
    I.wait(1);
  }

  selectContainsFilterInGroupAtPosition(groupName, position) {
    I.usePlaywrightTo('Select QAN Filter', async ({ page }) => {
      const locator = await page.locator(this.fields.filterCheckBoxesInGroup(groupName).value);

      await locator.nth(position - 1).waitFor({ state: 'attached' });
      await locator.nth(position - 1).click();
    });
  }

  async verifySelectedFilters(filters) {
    this.showSelectedFilters();
    I.waitForVisible(this.fields.filterName, 20);
    const currentFilters = await I.grabTextFrom(this.fields.filterName);

    for (let i = 0; i <= filters.length - 1; i++) {
      assert.ok(currentFilters[i].includes(filters[i]), `The filter '${filters[i]}' has not been found!`);
    }
  }

  async verifyCountOfFiltersDisplayed(expectedCount, expectedResult, timeoutInSeconds = 10) {
    let count = 0;

    for (let i = 0; i < timeoutInSeconds; i++) {
      count = await I.grabNumberOfVisibleElements(this.fields.filterCheckboxes);

      switch (expectedResult) {
        case 'smaller':
          if (count < expectedCount) return;

          break;
        case 'equals':
          if (count === expectedCount) return;

          break;
        case 'bigger':
          if (count > expectedCount) return;

          break;
        default:
          throw new Error(`Expected Result: "${expectedResult}" is not supported.`);
      }
      I.wait(1);
    }

    throw new Error(`Real value: ${count} is not ${expectedResult} then/to: ${expectedCount}`);
  }

  showSelectedFilters() {
    I.usePlaywrightTo('click', async ({ page }) => {
      const locator = await page.locator(this.buttons.showSelected.value);

      await locator.waitFor({ state: 'attached' });
      await locator.click();
    });
  }

  async verifyCheckedFilters(expectedFilters) {
    I.waitForVisible(this.fields.checkedFilters());
    const checkedFilters = await I.grabTextFromAll(this.fields.checkedFilters());
    const notCheckedFilters = [];

    for (const expectedFilter of expectedFilters) {
      if (!checkedFilters.includes(expectedFilter)) {
        notCheckedFilters.push(expectedFilter);
      }
    }

    assert.ok(notCheckedFilters.length === 0, `Expected filters "${expectedFilters}" are not euqal to checked filters: "${checkedFilters}. `);
  }

  async applyShowAllLinkIfItIsVisible(groupName) {
    const numOfShowAllLinkSectionCount = await I.grabNumberOfVisibleElements(this.fields.groupElementsCount(groupName));

    if (numOfShowAllLinkSectionCount) {
      this.applyShowAllLink(groupName);
    }
  }

  applyShowAllLink(groupName) {
    I.waitForVisible(this.fields.groupElementsCount(groupName), 30);
    I.forceClick(this.fields.groupElementsCount(groupName));
  }

  checkLink(filterName, groupName, visibility) {
    if (visibility) {
      I.waitForVisible(this.fields.filterLinkByNameAndGroup(filterName, groupName));
    } else {
      I.waitForDetached(this.fields.filterLinkByNameAndGroup(filterName, groupName));
    }
  }

  checkFilterExistInSection(section, filter) {
    I.waitForVisible(this.fields.filterBy, 30);
    I.fillField(this.fields.filterBy, filter);
    I.waitForVisible(this.fields.filterByNameAndGroup(filter, section), 20);
    I.seeElement(this.fields.filterByNameAndGroup(filter, section));
  }
}

module.exports = new QueryAnalyticsFilters();
module.exports.QueryAnalyticsFilters = QueryAnalyticsFilters;
