import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id: customId,
      disabled,
      leftIcon,
      rightIcon,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = customId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const hasError = Boolean(error);

    return (
      <div className="w-full text-left space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-small font-medium text-brand-ink-900"
          >
            {label}
            {props.required && <span className="text-semantic-danger ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-brand-ink-500">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : 'false'}
            aria-describedby={
              hasError ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              'w-full rounded-card-sm border bg-brand-cream-50 px-3.5 py-2.5 text-body text-brand-ink-900 placeholder:text-brand-ink-400 transition-colors duration-base',
              'focus:outline-none focus:ring-2 focus:ring-brand-gold-500 focus:border-brand-gold-500',
              hasError
                ? 'border-semantic-danger focus:ring-semantic-danger focus:border-semantic-danger bg-semantic-danger-bg/40'
                : 'border-brand-cream-300 hover:border-brand-green-700/60',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              disabled && 'cursor-not-allowed opacity-60 bg-brand-cream-200/50',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-brand-ink-500">
              {rightIcon}
            </div>
          )}
        </div>

        {hasError && (
          <p id={errorId} className="text-caption text-semantic-danger" role="alert">
            {error}
          </p>
        )}

        {!hasError && helperText && (
          <p id={helperId} className="text-caption text-brand-ink-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
