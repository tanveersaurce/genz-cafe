import React, { useState, useEffect } from 'react';
import { isCafeOpenNow } from '@/config/siteConfig';
import { cn } from '@/lib/utils';

interface OpenNowBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
  showHoursDetail?: boolean;
}

export const OpenNowBadge: React.FC<OpenNowBadgeProps> = ({
  className,
  size = 'md',
  showHoursDetail = true,
}) => {
  // Recalculate periodically (every minute)
  const [open, setOpen] = useState(() => isCafeOpenNow());

  useEffect(() => {
    const timer = setInterval(() => {
      setOpen(isCafeOpenNow());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const isSmall = size === 'sm';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-pill font-medium transition-colors',
        open
          ? 'bg-semantic-success-bg border border-semantic-success/30 text-semantic-success'
          : 'bg-brand-cream-300/40 border border-brand-ink-400/30 text-brand-ink-600',
        isSmall ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-caption',
        className
      )}
      title={open ? 'Cafe is currently open in IST' : 'Cafe is currently closed in IST'}
      aria-label={open ? 'Open Now' : 'Currently Closed'}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {open && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-semantic-success opacity-75" />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full h-2 w-2',
            open ? 'bg-semantic-success' : 'bg-brand-ink-400'
          )}
        />
      </span>

      <span className="font-semibold">
        {open ? 'Open Now' : 'Closed'}
      </span>

      {showHoursDetail && (
        <span className="opacity-80 hidden sm:inline">
          {open ? '• until 11:00 PM' : '• Opens 10:00 AM IST'}
        </span>
      )}
    </div>
  );
};
