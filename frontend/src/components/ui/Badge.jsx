import React from 'react';

const Badge = ({ children, variant = 'default', size = 'md', className = '' }) => {
  const variants = {
    success: 'bg-success-light text-green-800',
    danger: 'bg-danger-light text-red-800',
    warning: 'bg-warning-light text-amber-800',
    info: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800'
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs'
  };

  const classes = `inline-flex items-center rounded-full font-medium ${variants[variant] || variants.default} ${sizes[size] || sizes.md} ${className}`;

  return (
    <span className={classes}>
      {children}
    </span>
  );
};

export default Badge;
