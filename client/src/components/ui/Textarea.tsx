import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, helperText, error, id: customId, disabled, rows = 4, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = customId || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    const hasError = Boolean(error);

    return (
      <div className="w-full text-left space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-small font-medium text-brand-ink-900">
            {label}
            {props.required && <span className="text-semantic-danger ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          className={cn(
            'w-full rounded-card-sm border bg-brand-cream-50 px-3.5 py-2.5 text-body text-brand-ink-900 placeholder:text-brand-ink-400 transition-colors duration-base',
            'focus:outline-none focus:ring-2 focus:ring-brand-gold-500 focus:border-brand-gold-500',
            hasError
              ? 'border-semantic-danger focus:ring-semantic-danger focus:border-semantic-danger bg-semantic-danger-bg/40'
              : 'border-brand-cream-300 hover:border-brand-green-700/60',
            disabled && 'cursor-not-allowed opacity-60 bg-brand-cream-200/50',
            className
          )}
          {...props}
        />

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

Textarea.displayName = 'Textarea';
