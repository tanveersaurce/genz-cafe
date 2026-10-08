import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'cream' | 'green' | 'gold' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'cream',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const variants = {
    cream: 'bg-brand-cream-300 text-brand-green-900 border border-brand-cream-400',
    green: 'bg-brand-green-800 text-brand-cream-100 border border-brand-green-700',
    gold: 'bg-brand-gold-500 text-brand-ink-900 font-semibold border border-brand-gold-600',
    success: 'bg-semantic-success-bg text-semantic-success border border-semantic-success/30 font-medium',
    warning: 'bg-semantic-warning-bg text-semantic-warning border border-semantic-warning/30 font-medium',
    danger: 'bg-semantic-danger-bg text-semantic-danger border border-semantic-danger/30 font-medium',
    info: 'bg-semantic-info-bg text-semantic-info border border-semantic-info/30 font-medium',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-caption px-3 py-1 font-medium',
  };

  const dotColors = {
    cream: 'bg-brand-green-900',
    green: 'bg-brand-gold-500',
    gold: 'bg-brand-ink-900',
    success: 'bg-semantic-success',
    warning: 'bg-semantic-warning',
    danger: 'bg-semantic-danger',
    info: 'bg-semantic-info',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full select-none tracking-wide',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColors[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
