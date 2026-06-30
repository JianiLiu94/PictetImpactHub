import { useState } from "react";

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  /** Server-side sort key for this column. Omit to make the column unsortable. */
  sortKey?: string;
}

interface PaginatedTableProps<T> {
  rows: T[];
  total: number;
  pageSize: number;
  columns: Column<T>[];
  onPageChange: (offset: number) => void;
  rowKey: (row: T) => string;
  /** Current sort state and handler -- omit to disable sorting entirely. */
  sortBy?: string | null;
  sortDir?: "asc" | "desc";
  onSort?: (sortKey: string) => void;
}

export function PaginatedTable<T>({
  rows,
  total,
  pageSize,
  columns,
  onPageChange,
  rowKey,
  sortBy,
  sortDir = "asc",
  onSort,
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
              <th key={col.header}>
                {col.sortKey && onSort ? (
                  <button className="sort-btn" onClick={() => onSort(col.sortKey!)}>
                    {col.header}
                    {sortBy === col.sortKey && <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                  </button>
                ) : (
                  col.header
                )}
              </th>
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
