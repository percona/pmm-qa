const { tableDataRows } = require('../../helper/locatorHelper');

const { I } = inject();

/**
 * Pagination section of PMM Inventory page, shown for tables of more than 10 rows
 */
module.exports = {
  elements: {
    rowsPerPageDropdown: '.MuiTablePagination-root [role="combobox"]',
    rowsPerPageOption: (selectedOption) => `//li[@role="option"][normalize-space()="${selectedOption}"]`,
    nextPageButton: 'button[aria-label="Go to next page"]',
  },

  /**
   * Check that selected value in "Rows per page" dropdown matches expected
   *
   * @param     expectedNumber    string or number to check, possible values: 25|50|100
   * @returns   {Promise<void>}
   */
  async verifySelectedCountPerPage(expectedNumber) {
    I.assertContain(
      ['25', '50', '100'],
      `${expectedNumber}`,
      'Expected number is not the one available options to select in dropdown',
    );
    I.waitForElement(this.elements.rowsPerPageDropdown, 30);
    const selectedNumber = await I.grabTextFrom(this.elements.rowsPerPageDropdown);

    I.assertEqual(expectedNumber.toString(), selectedNumber, 'Selected options is not the same as the expected one');
  },

  async selectRowsPerPage(optionToSelect) {
    const option = `${optionToSelect}`;

    I.assertContain(['25', '50', '100'], option, 'Specified option is not the one available options to select in dropdown');
    I.waitForVisible(tableDataRows, 30);

    if (!await I.grabNumberOfVisibleElements(this.elements.rowsPerPageDropdown)) {
      await I.say('All rows fit on one page, there is no \'Rows per page\' to change');

      return;
    }

    await I.say(`Changing 'Rows per page' to ${option}`);
    I.click(this.elements.rowsPerPageDropdown);
    I.waitForVisible(this.elements.rowsPerPageOption(option), 30);
    I.click(this.elements.rowsPerPageOption(option));
    await this.verifySelectedCountPerPage(option);
  },
};
