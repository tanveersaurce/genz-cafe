import React from 'react';

export const SkipLink: React.FC = () => {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-brand-gold-500 focus:text-brand-ink-900 focus:font-semibold focus:rounded-card-sm focus:shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-green-950 transition-transform"
    >
      Skip to main content
    </a>
  );
};
