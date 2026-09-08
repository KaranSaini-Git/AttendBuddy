import React, { forwardRef } from 'react';

const Card = forwardRef(({ children, className = '', title, subtitle, icon: Icon, action, ...rest }, ref) => {
  return (
    <div ref={ref} className={`bg-white rounded-xl border border-gray-200 shadow-xs ${className}`} {...rest}>
      {(title || subtitle || Icon || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {Icon && <div className="text-gray-500"><Icon size={20} /></div>}
            <div>
              {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
              {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
});

Card.displayName = 'Card';

const CardContent = forwardRef(({ className = '', children, ...rest }, ref) => {
  return (
    <div ref={ref} className={`p-6 ${className}`} {...rest}>
      {children}
    </div>
  );
});

CardContent.displayName = 'CardContent';

export { Card, CardContent };
