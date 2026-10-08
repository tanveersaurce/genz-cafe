import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: 'pill' | 'underline';
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  variant = 'pill',
}) => {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      onChange(nextTab.id);
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        'flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none',
        className
      )}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab;

        if (variant === 'pill') {
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-small font-medium transition-all duration-base whitespace-nowrap min-h-[40px]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-gold-500',
                isActive
                  ? 'bg-brand-green-800 text-brand-cream-100 shadow-soft font-semibold'
                  : 'bg-brand-cream-50 text-brand-ink-700 hover:bg-brand-cream-200/80 border border-brand-cream-300'
              )}
            >
              {tab.icon && <span className="h-4 w-4" aria-hidden="true">{tab.icon}</span>}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[11px] font-semibold',
                    isActive
                      ? 'bg-brand-gold-500 text-brand-ink-900'
                      : 'bg-brand-cream-300 text-brand-ink-800'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        }

        // Underline variant
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-3 text-small font-medium transition-colors border-b-2 whitespace-nowrap',
              'focus-visible:outline-none focus-visible:border-brand-gold-500',
              isActive
                ? 'border-brand-green-800 text-brand-green-800 font-semibold'
                : 'border-transparent text-brand-ink-500 hover:text-brand-ink-900 hover:border-brand-cream-300'
            )}
          >
            {tab.icon && <span className="h-4 w-4" aria-hidden="true">{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
