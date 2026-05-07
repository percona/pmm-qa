const { locateOption } = require('../../helper/locatorHelper');

const { I } = inject();

/**
 * Pagination section of PMM Inventory page
 */
module.exports = {
  wrapperDiv: '$pagination',
  elements: {
    rowsPerPageDropdown: locate('$pagination').find('div[class*="-singleValue"]'),
    totalsLabel: '$pagination-items-inverval',
    firstPageButton: '$first-page-button',
    previousPageButton: '$previous-page-button',
    pageNumberButton: (number) => locate('$page-button').withText(`${number}`),
    pageNumberButtonLast: '(//button[@data-testid="page-button-active" or @data-testid="page-button"])[last()]',
    nextPageButton: '$next-page-button',
    lastPageButton: '$last-page-button',
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

  async getSelectedCountPerPage() {
    I.waitForVisible(this.elements.rowsPerPageDropdown);

    return parseInt(await I.grabTextFrom(this.elements.rowsPerPageDropdown), 10);
  },

  async selectRowsPerPage(optionToSelect) {
    const option = `${optionToSelect}`;

    I.assertContain(['25', '50', '100'], option, 'Specified option is not the one available options to select in dropdown');

    await I.say(`Changing 'Rows per page' to ${option}`);
    const pagesCount = await this.getLastPageNumber();
    const rowsTotal = await this.getTotalOfItems();
    const rowsShowing = (await I.grabTextFrom(this.elements.totalsLabel)).split(' ')[1].split('-')[1];

    I.click(this.elements.rowsPerPageDropdown);
    I.waitForVisible(locateOption(option), 30);
    I.click(locateOption(option));

    if ((rowsShowing !== rowsTotal) && (rowsTotal > option)) {
      // 20 sec wait for pages count to change
      await I.asyncWaitFor(async () => {
        const newPagesCount = await this.getLastPageNumber();

        return newPagesCount !== pagesCount;
      }, 10);
    } else {
      I.wait(2);
    }

    await this.verifySelectedCountPerPage(option);
  },

  async getTotalOfItems() {
    I.waitForVisible(this.elements.totalsLabel, 30);

    return (await I.grabTextFrom(this.elements.totalsLabel)).split(' ')[3];
  },

  async getLastPageNumber() {
    I.waitForVisible(this.elements.pageNumberButtonLast, 30);

    return await I.grabTextFrom(this.elements.pageNumberButtonLast);
  },

  /* The check is bogus now, see the comment inside */
  verifyActivePageIs(page) {
    const item = this.elements.pageNumberButton(page);

    // FIXME: add proper check when PMM-10803 will be fixed
    I.waitForElement(item, 30);
  },

  async verifyPagesAndCount(itemsPerPage) {
    const count = await this.getTotalOfItems();
    const lastPage = await this.getLastPageNumber();
    const result = count / lastPage;

    I.assertEqual((Math.ceil(result / 25) * 25), itemsPerPage, 'Pages do not match with total count');
  },

  async verifyRange(expectedRange) {
    const count = await I.grabTextFrom(this.elements.totalsLabel);

    I.assertEqual(count.includes(expectedRange), true, `The value ${expectedRange} should include ${count}`);
  },

  async verifyPaginationFunctionality() {
    await this.verifySelectedCountPerPage(25);
    const totalItems = await this.getTotalOfItems();

    I.seeElementsDisabled(this.elements.previousPageButton);
    I.click(this.elements.nextPageButton);
    this.verifyActivePageIs(2);
    await this.verifyRange(`26-${totalItems <= 50 ? totalItems : 50}`);
    I.click(this.elements.firstPageButton);
    await this.verifyRange('1-25');
  },
};
