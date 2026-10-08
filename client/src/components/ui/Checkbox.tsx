import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, id: customId, disabled, checked, ...props }, ref) => {
    const generatedId = useId();
    const checkboxId = customId || generatedId;

    return (
      <div className="flex flex-col space-y-1">
        <label
          htmlFor={checkboxId}
          className={cn(
            'inline-flex items-start gap-3 cursor-pointer select-none group',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              ref={ref}
              id={checkboxId}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              className="peer sr-only"
              {...props}
            />
            <div
              className={cn(
                'h-5 w-5 rounded-md border transition-colors duration-base flex items-center justify-center',
                'border-brand-green-800 bg-brand-cream-50',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-gold-500 peer-focus-visible:ring-offset-2',
                'peer-checked:bg-brand-green-800 peer-checked:border-brand-green-800',
                error && 'border-semantic-danger peer-checked:bg-semantic-danger',
                className
              )}
            >
              <Check className="h-3.5 w-3.5 text-brand-cream-100 opacity-0 peer-checked:opacity-100 transition-opacity stroke-[3]" />
            </div>
          </div>

          {(label || description) && (
            <div className="flex flex-col text-left">
              {label && (
                <span className="text-small font-medium text-brand-ink-900 group-hover:text-brand-green-800">
                  {label}
                </span>
              )}
              {description && (
                <span className="text-caption text-brand-ink-500">{description}</span>
              )}
            </div>
          )}
        </label>

        {error && (
          <p className="text-caption text-semantic-danger pl-8" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
