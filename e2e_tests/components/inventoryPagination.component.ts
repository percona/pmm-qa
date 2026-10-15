import { expect, Locator, Page } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { tableLoadedRows } from '@helpers/tableLocators';

type RowsPerPage = '25' | '50' | '100';

export default class InventoryPagination {
  readonly itemsInterval: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;
  readonly rowsPerPageDropdown: Locator;
  readonly selectAllCheckbox: Locator;
  readonly selectedRowCheckboxes: Locator;
  readonly selectRowCheckboxes: Locator;

  constructor(readonly page: Page) {
    // Material React Table's pagination, e.g. "1-25 of 30"
    this.itemsInterval = page.getByText(/^\d+-\d+ of \d+$/);
    this.nextPageButton = page.getByRole('button', { name: 'Go to next page' });
    this.previousPageButton = page.getByRole('button', { name: 'Go to previous page' });
    this.rowsPerPageDropdown = page.getByRole('combobox', { name: 'Rows per page' });
    this.selectAllCheckbox = page.getByRole('checkbox', { name: 'Toggle select all' });
    this.selectRowCheckboxes = page.getByRole('checkbox', { name: 'Toggle select row' });
    this.selectedRowCheckboxes = page.getByRole('checkbox', { checked: true, name: 'Toggle select row' });
  }

  rowsPerPageOption = (rowsPerPage: RowsPerPage) =>
    this.page.getByRole('option', { exact: true, name: rowsPerPage });

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

  // Tables of up to 10 rows have no pagination, so they already show every row
  showAllRows = async () => {
    await expect(this.page.locator(tableLoadedRows).first()).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });

    if (!(await this.rowsPerPageDropdown.isVisible())) return;

    await this.selectRowsPerPage('100');
    await expect(this.rowsPerPageDropdown).toHaveText('100', { timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.itemsInterval, 'Every row should fit on one page of 100').toHaveText(/^1-(\d+) of \1$/);
  };

  verifyPaginationFunctionality = async () => {
    await expect(this.rowsPerPageDropdown).toHaveText('25', { timeout: Timeouts.THIRTY_SECONDS });

    const totalItems = Number((await this.itemsInterval.textContent())?.split(' ')[2]);

    await expect(this.previousPageButton).toBeDisabled();
    await this.nextPageButton.click();
    await expect(this.itemsInterval).toContainText(`26-${totalItems <= 50 ? totalItems : 50}`);
    await this.previousPageButton.click();
    await expect(this.itemsInterval).toContainText('1-25');
  };
}
