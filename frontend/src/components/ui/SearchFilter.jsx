import React from 'react';
import { Search, X } from 'lucide-react';
import Button from './Button';

const SearchFilter = ({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onReset
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-center w-full">
      <div className="relative flex-1 w-full sm:w-auto">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none transition-shadow"
        />
      </div>
      
      {filters.length > 0 && (
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto items-center">
          {filters.map((filter) => (
            <select
              key={filter.key}
              value={filter.value}
              onChange={(e) => filter.onChange && filter.onChange(e.target.value)}
              className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none transition-shadow appearance-none bg-white min-w-[120px]"
            >
              <option value="" disabled>{filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
          
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0" icon={X}>
              Reset
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFilter;
