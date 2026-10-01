import { FrameLocator, Locator } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

type RowsPerPage = '25' | '50' | '100';

export default class InventoryPagination {
  readonly rowsPerPageDropdown: Locator;

  constructor(readonly frame: FrameLocator) {
    this.rowsPerPageDropdown = frame.getByTestId('pagination-size-select');
  }

  rowsPerPageOption = (rowsPerPage: RowsPerPage) =>
    this.frame.getByRole('option', { exact: true, name: rowsPerPage });

  selectRowsPerPage = async (rowsPerPage: RowsPerPage) => {
    await this.rowsPerPageDropdown.click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.rowsPerPageOption(rowsPerPage).click({ timeout: Timeouts.THIRTY_SECONDS });
  };
}
