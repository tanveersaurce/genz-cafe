import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle' | 'text';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rect',
  ...props
}) => {
  const variantStyles = {
    rect: 'rounded-card-sm',
    circle: 'rounded-full',
    text: 'rounded h-4 w-full',
  };

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'animate-pulse bg-brand-cream-300/60',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
};
