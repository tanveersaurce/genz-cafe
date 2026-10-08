import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'pos';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-btn transition-colors duration-base select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] disabled:active:scale-100';

    const variants = {
      primary:
        'bg-brand-gold-500 text-brand-ink-900 font-semibold hover:bg-brand-gold-600 focus-visible:outline-brand-gold-500 shadow-soft',
      secondary:
        'bg-brand-green-800 text-brand-cream-100 font-medium hover:bg-brand-green-700 focus-visible:outline-brand-green-800 shadow-soft',
      outline:
        'border-2 border-brand-green-800 text-brand-green-800 hover:bg-brand-green-800/10 focus-visible:outline-brand-green-800',
      ghost:
        'text-brand-green-800 hover:bg-brand-cream-300/40 focus-visible:outline-brand-green-800',
      danger:
        'bg-semantic-danger text-white hover:bg-red-700 focus-visible:outline-semantic-danger shadow-soft',
    };

    const sizes = {
      sm: 'text-caption py-1.5 px-3 min-h-[32px] gap-1.5',
      md: 'text-small py-2.5 px-5 min-h-[40px] gap-2',
      lg: 'text-body py-3 px-6 min-h-[48px] gap-2.5',
      pos: 'text-body py-3.5 px-7 min-h-[52px] text-base font-semibold tracking-wide gap-3 shadow-soft-md',
    };

    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
