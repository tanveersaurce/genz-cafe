import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center' | 'right';
  theme?: 'light' | 'dark';
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  subtitle,
  align = 'center',
  theme = 'light',
  className,
}) => {
  const alignments = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  };

  const isDark = theme === 'dark';

  return (
    <div className={cn('flex flex-col mb-8 sm:mb-12', alignments[align], className)}>
      {subtitle && (
        <span
          className={cn(
            'font-script text-2xl sm:text-3xl font-medium tracking-wide mb-1',
            isDark ? 'text-brand-gold-500' : 'text-brand-green-700'
          )}
        >
          {subtitle}
        </span>
      )}
      <h2
        className={cn(
          'font-serif text-h2 font-bold tracking-tight',
          isDark ? 'text-brand-cream-100' : 'text-brand-green-950'
        )}
      >
        {title}
      </h2>
      <div
        className={cn(
          'h-1 w-12 rounded-full mt-3',
          isDark ? 'bg-brand-gold-500' : 'bg-brand-green-800'
        )}
        aria-hidden="true"
      />
    </div>
  );
};
