import { useState } from "react";

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

interface PaginatedTableProps<T> {
  rows: T[];
  total: number;
  pageSize: number;
  columns: Column<T>[];
  onPageChange: (offset: number) => void;
  rowKey: (row: T) => string;
}

export function PaginatedTable<T>({
  rows,
  total,
  pageSize,
  columns,
  onPageChange,
  rowKey,
}: PaginatedTableProps<T>) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const goTo = (nextPage: number) => {
    const clamped = Math.min(Math.max(0, nextPage), pageCount - 1);
    setPage(clamped);
    onPageChange(clamped * pageSize);
  };

  return (
    <div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.header}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <button onClick={() => goTo(page - 1)} disabled={page === 0}>
          Previous
        </button>
        <span>
          {" "}Page {page + 1} of {pageCount}{" "}
        </span>
        <button onClick={() => goTo(page + 1)} disabled={page >= pageCount - 1}>
          Next
        </button>
      </div>
    </div>
  );
}
