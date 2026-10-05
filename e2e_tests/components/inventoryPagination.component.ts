import { expect, FrameLocator, Locator } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

type RowsPerPage = '25' | '50' | '100';

export default class InventoryPagination {
  readonly activePageButton: Locator;
  readonly firstPageButton: Locator;
  readonly itemsInterval: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;
  readonly rowsPerPageDropdown: Locator;
  readonly selectAllCheckbox: Locator;
  readonly selectedRowCheckboxes: Locator;
  readonly selectRowCheckboxes: Locator;

  constructor(readonly frame: FrameLocator) {
    this.activePageButton = frame.getByTestId('page-button-active');
    this.firstPageButton = frame.getByTestId('first-page-button');
    this.itemsInterval = frame.getByTestId('pagination-items-inverval');
    this.nextPageButton = frame.getByTestId('next-page-button');
    this.previousPageButton = frame.getByTestId('previous-page-button');
    this.rowsPerPageDropdown = frame.getByTestId('pagination-size-select');
    this.selectAllCheckbox = frame.getByTestId('select-all').locator('span');
    this.selectRowCheckboxes = frame.getByTestId('select-row').locator('span');
    this.selectedRowCheckboxes = frame.getByTestId('select-row').getByRole('checkbox', { checked: true });
  }

  rowsPerPageOption = (rowsPerPage: RowsPerPage) =>
    this.frame.getByRole('option', { exact: true, name: rowsPerPage });

  selectAllRows = async (): Promise<number> => {
    await this.selectAllCheckbox.click({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.selectedRowCheckboxes.first()).toBeVisible();

    return this.selectedRowCheckboxes.count();
  };

  selectFirstRow = async (): Promise<number> => {
    await this.selectRowCheckboxes.first().click();
    await expect(this.selectedRowCheckboxes.first()).toBeVisible();

    return this.selectedRowCheckboxes.count();
  };

  selectRowsPerPage = async (rowsPerPage: RowsPerPage) => {
    await this.rowsPerPageDropdown.click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.rowsPerPageOption(rowsPerPage).click({ timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyPaginationFunctionality = async () => {
    await expect(this.rowsPerPageDropdown).toHaveText('25', { timeout: Timeouts.THIRTY_SECONDS });

    const totalItems = Number((await this.itemsInterval.textContent())?.split(' ')[3]);

    await expect(this.previousPageButton).toBeDisabled();
    await this.nextPageButton.click();
    await expect(this.activePageButton).toHaveText('2', { timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.itemsInterval).toContainText(`26-${totalItems <= 50 ? totalItems : 50}`);
    await this.firstPageButton.click();
    await expect(this.itemsInterval).toContainText('1-25');
  };
}
