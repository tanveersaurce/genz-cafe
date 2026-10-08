import React from 'react';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'gold' | 'green' | 'cream' | 'current';
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  className,
  size = 'md',
  variant = 'gold',
  label = 'Loading...',
  ...props
}) => {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
  };

  const variants = {
    gold: 'border-brand-gold-500 border-t-transparent',
    green: 'border-brand-green-800 border-t-transparent',
    cream: 'border-brand-cream-100 border-t-transparent',
    current: 'border-current border-t-transparent',
  };

  return (
    <div role="status" className="inline-flex items-center justify-center">
      <div
        className={cn(
          'rounded-full animate-spin',
          sizes[size],
          variants[variant],
          className
        )}
        aria-hidden="true"
        {...props}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
};
