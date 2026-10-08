import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id: customId,
      disabled,
      options,
      placeholder,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = customId || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    const hasError = Boolean(error);

    return (
      <div className="w-full text-left space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-small font-medium text-brand-ink-900">
            {label}
            {props.required && <span className="text-semantic-danger ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : 'false'}
            aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full appearance-none rounded-card-sm border bg-brand-cream-50 px-3.5 py-2.5 pr-10 text-body text-brand-ink-900 transition-colors duration-base cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-brand-gold-500 focus:border-brand-gold-500',
              hasError
                ? 'border-semantic-danger focus:ring-semantic-danger focus:border-semantic-danger bg-semantic-danger-bg/40'
                : 'border-brand-cream-300 hover:border-brand-green-700/60',
              disabled && 'cursor-not-allowed opacity-60 bg-brand-cream-200/50',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <ChevronDown
            className="absolute right-3.5 h-4 w-4 pointer-events-none text-brand-ink-500"
            aria-hidden="true"
          />
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

Select.displayName = 'Select';
