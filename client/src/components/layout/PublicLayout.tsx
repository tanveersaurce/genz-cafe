import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { SkipLink } from '@/components/common/SkipLink';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-brand-cream-100 text-brand-ink-900 selection:bg-brand-gold-500 selection:text-brand-ink-900">
      <SkipLink />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 w-full focus:outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
