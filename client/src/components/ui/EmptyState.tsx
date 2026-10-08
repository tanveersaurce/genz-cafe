import React from 'react';
import { cn } from '@/lib/utils';
import { Coffee } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-card bg-brand-cream-50 border border-brand-cream-300 shadow-soft max-w-lg mx-auto',
        className
      )}
    >
      <div className="h-14 w-14 rounded-full bg-brand-cream-200 flex items-center justify-center text-brand-green-800 mb-4 shadow-inner">
        {icon || <Coffee className="h-7 w-7" />}
      </div>
      <h3 className="font-serif text-h3 font-semibold text-brand-green-900 mb-2">{title}</h3>
      {description && (
        <p className="text-small text-brand-ink-500 max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
