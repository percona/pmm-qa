const locateOptions = locate('[data-testid="data-testid Select option"]');
const locateOption = (option) => locateOptions.withText(option);
// Material React Table renders skeleton rows while loading, then the data rows or one empty state row
const tableLoadedRows = '//tbody/tr[not(.//*[contains(@class, "MuiSkeleton-root")])]';
// Leaves out the detail panel row after every data row and the empty state, which span the table in one cell
const tableDataRows = '//tbody/tr[td[2] and not(contains(@class, "Mui-TableBodyCell-DetailPanel")) and not(.//*[contains(@class, "MuiSkeleton-root")])]';

module.exports = {
  locateOption,
  locateOptions,
  tableDataRows,
  tableLoadedRows,
};
