import type { ReactNode } from 'react';

/**
 * Renders a table from a data array so page content stays data, not markup.
 *
 * Declare the rows as a typed module-level constant and pass them here. Editing
 * a fact then means editing one object, and a reviewer can read the content
 * without stepping through JSX.
 */
export interface DataTableColumn<Row> {
  header: string;
  cell: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  className?: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
}

function DataTable<Row>({
  className,
  columns,
  rows,
  rowKey,
}: DataTableProps<Row>) {
  return (
    <table className={className}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.header}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) => (
              <td key={column.header}>{column.cell(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default DataTable;
