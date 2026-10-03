import { FrameLocator, Locator } from '@playwright/test';
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

  selectRowsPerPage = async (rowsPerPage: RowsPerPage) => {
    await this.rowsPerPageDropdown.click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.rowsPerPageOption(rowsPerPage).click({ timeout: Timeouts.THIRTY_SECONDS });
  };
}
