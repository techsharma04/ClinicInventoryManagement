// src/components/DataTable.jsx
import React from "react";
import "./styles/table-wrapper.css";

export default function DataTable({
  columns = [],
  data = [],
  page = 1,
  pageCount = 1,
  onPageChange = () => {},
  emptyMessage = "No records found",
}) {
  return (
    <div className="table-container">
      <div className="table-scroll">
        <table className="custom-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.align}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-4">
                  {emptyMessage}
                </td>
              </tr>
            )}

            {data.map((row, idx) => (
              <tr key={row.id || idx}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={col.align}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="pagination-wrapper">
          <button
            className="page-btn"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            «
          </button>

          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              className={page === i + 1 ? "page-btn active" : "page-btn"}
              onClick={() => onPageChange(i + 1)}
            >
              {i + 1}
            </button>
          ))}

          <button
            className="page-btn"
            disabled={page === pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
