import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an error while loading this content. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  className,
}) => {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-card bg-semantic-danger-bg/50 border border-semantic-danger/30 shadow-soft max-w-lg mx-auto',
        className
      )}
    >
      <div className="h-14 w-14 rounded-full bg-semantic-danger-bg flex items-center justify-center text-semantic-danger mb-4 border border-semantic-danger/30">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h3 className="font-serif text-h3 font-semibold text-semantic-danger mb-2">{title}</h3>
      <p className="text-small text-brand-ink-700 max-w-sm mb-6 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="md" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
};
