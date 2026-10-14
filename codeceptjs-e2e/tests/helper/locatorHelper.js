const locateOptions = locate('[data-testid="data-testid Select option"]');
const locateOption = (option) => locateOptions.withText(option);
// Material React Table renders a detail panel row after every row, and skeleton rows while loading
const tableDataRows = '//tbody/tr[not(contains(@class, "Mui-TableBodyCell-DetailPanel")) and not(.//*[contains(@class, "MuiSkeleton-root")])]';

module.exports = {
  locateOption,
  locateOptions,
  tableDataRows,
};
