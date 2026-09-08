import React from 'react';
import Spinner from './Spinner';

const Table = ({ columns = [], data = [], loading = false, emptyMessage = "No data found", onRowClick }) => {
  return (
    <div className="w-full">
      {/* Desktop View */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-medium border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-6 py-4 ${col.className || ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((col, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded-md w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr 
                  key={row.id || i} 
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-6 py-4 ${col.className || ''}`}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked View */}
      <div className="sm:hidden flex flex-col gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded-md w-1/2 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded-md w-full"></div>
            </div>
          ))
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            {emptyMessage}
          </div>
        ) : (
          data.map((row, i) => (
            <div 
              key={row.id || i} 
              onClick={() => onRowClick && onRowClick(row)}
              className={`bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 ${onRowClick ? 'cursor-pointer active:bg-gray-50' : ''}`}
            >
              {columns.map((col) => (
                <div key={col.key} className="flex justify-between items-start gap-4">
                  <span className="text-xs font-medium text-gray-500 uppercase">{col.label}</span>
                  <span className={`text-sm text-gray-900 text-right ${col.className || ''}`}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Table;
