import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(({
  label,
  error,
  options = [],
  placeholder = 'Select an option',
  className = '',
  icon: Icon,
  disabled,
  id,
  ...rest
}, ref) => {
  const selectId = id || Math.random().toString(36).substring(7);

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Icon size={18} />
          </div>
        )}
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={`
            w-full border rounded-lg px-3 py-2.5 text-sm transition-shadow outline-none appearance-none bg-white
            ${Icon ? 'pl-10' : ''} pr-10
            ${error 
              ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' 
              : 'border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/50'
            }
            ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'text-gray-900'}
          `}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500">
          <ChevronDown size={18} />
        </div>
      </div>
      {error && <p className="text-sm text-red-500 mt-0.5">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
