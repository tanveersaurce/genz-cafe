import React from 'react';
import { cn } from '@/lib/utils';

export type FoodType = 'veg' | 'non_veg' | 'egg';

interface FoodTypeIndicatorProps {
  type: FoodType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const FoodTypeIndicator: React.FC<FoodTypeIndicatorProps> = ({
  type,
  size = 'md',
  showLabel = false,
  className,
}) => {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5 p-0.5',
    md: 'h-4 w-4 p-0.5',
    lg: 'h-5 w-5 p-1',
  };

  const labelMap: Record<FoodType, string> = {
    veg: 'Vegetarian',
    non_veg: 'Non-Vegetarian',
    egg: 'Contains Egg',
  };

  const renderSymbol = () => {
    switch (type) {
      case 'veg':
        return (
          <div
            className={cn(
              'border border-semantic-success flex items-center justify-center rounded-[2px]',
              sizeClasses[size]
            )}
            title="Vegetarian"
            aria-label="Vegetarian"
          >
            <span className="h-full w-full rounded-full bg-semantic-success" />
          </div>
        );
      case 'non_veg':
        return (
          <div
            className={cn(
              'border border-brand-accent-terracotta flex items-center justify-center rounded-[2px]',
              sizeClasses[size]
            )}
            title="Non-Vegetarian"
            aria-label="Non-Vegetarian"
          >
            {/* Triangular indicator for non-veg */}
            <div
              className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-brand-accent-terracotta"
            />
          </div>
        );
      case 'egg':
        return (
          <div
            className={cn(
              'border border-semantic-warning flex items-center justify-center rounded-[2px]',
              sizeClasses[size]
            )}
            title="Contains Egg"
            aria-label="Contains Egg"
          >
            <span className="h-[70%] w-[70%] rounded-full bg-semantic-warning" />
          </div>
        );
    }
  };

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      {renderSymbol()}
      {showLabel && (
        <span className="text-caption font-medium text-brand-ink-700">
          {labelMap[type]}
        </span>
      )}
    </div>
  );
};
