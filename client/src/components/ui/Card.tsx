import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'cream' | 'white' | 'dark';
  bordered?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  variant = 'cream',
  bordered = true,
  children,
  ...props
}) => {
  const variants = {
    cream: 'bg-brand-cream-50 text-brand-ink-900 border-brand-cream-300 shadow-soft',
    white: 'bg-white text-brand-ink-900 border-brand-cream-200 shadow-soft',
    dark: 'bg-brand-green-800 text-brand-cream-100 border-brand-green-700 shadow-dark-card',
  };

  return (
    <div
      className={cn(
        'rounded-card transition-colors duration-base overflow-hidden',
        variants[variant],
        bordered ? 'border' : 'border-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('p-6 pb-3 text-left space-y-1.5', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3 className={cn('font-serif text-h3 font-semibold leading-tight', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => (
  <p className={cn('text-small text-brand-ink-500', className)} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('p-6 pt-3 text-left', className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn('p-6 pt-3 border-t border-brand-cream-200/60 flex items-center justify-between', className)}
    {...props}
  >
    {children}
  </div>
);
