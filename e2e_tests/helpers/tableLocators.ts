// Material React Table renders skeleton rows while loading, then the data rows or one empty state row
export const tableLoadedRows = 'tbody tr:not(:has(.MuiSkeleton-root))';
// Leaves out the detail panel row after every data row and the empty state, which span the table in one cell
export const tableDataRows = `${tableLoadedRows}:not(.Mui-TableBodyCell-DetailPanel):has(td:nth-child(2))`;
