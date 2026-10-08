import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, CalendarCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { siteConfig } from '@/config/siteConfig';
import { OpenNowBadge } from '@/components/common/OpenNowBadge';

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'Menu', path: '/menu' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'Reservation', path: '/reservation' },
  { label: 'Contact', path: '/contact' },
];

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-brand-green-900/95 backdrop-blur border-b border-brand-green-800 text-brand-cream-100 shadow-soft">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 group" onClick={closeMenu}>
            <img
              src="/logo.png"
              alt={`${siteConfig.name} Logo`}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full border border-brand-gold-500 shadow-soft object-cover"
            />
            <div className="flex flex-col text-left">
              <span className="font-serif text-lg sm:text-xl font-bold tracking-wider text-brand-cream-100 group-hover:text-brand-gold-500 transition-colors">
                {siteConfig.name.toUpperCase()}
              </span>
              <span className="font-script text-brand-gold-500 text-sm tracking-wide -mt-1">
                {siteConfig.tagline}
              </span>
            </div>
          </Link>
          <div className="hidden lg:block">
            <OpenNowBadge size="sm" />
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Main Navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'text-small font-medium transition-colors hover:text-brand-gold-500 py-1 relative',
                  isActive
                    ? 'text-brand-gold-500 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-gold-500 after:rounded-full'
                    : 'text-brand-cream-100/90'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/design-system" title="Dev Design System Showcase">
            <Button variant="ghost" size="sm" className="text-brand-gold-500 hover:bg-brand-green-800">
              <Sparkles className="h-4 w-4 mr-1 text-brand-gold-500" />
              <span className="text-caption">Design System</span>
            </Button>
          </Link>
          <Link to="/reservation">
            <Button
              variant="primary"
              size="md"
              leftIcon={<CalendarCheck className="h-4 w-4" />}
            >
              Reserve a Table
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="p-2 rounded-lg text-brand-cream-100 hover:text-brand-gold-500 hover:bg-brand-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-gold-500"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-brand-green-950 border-b border-brand-green-800 px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top duration-base">
          <div className="pb-2 border-b border-brand-green-800 flex justify-between items-center">
            <span className="text-caption text-brand-cream-100/70 font-sans uppercase tracking-wider">Cafe Status</span>
            <OpenNowBadge size="sm" />
          </div>
          <nav className="flex flex-col space-y-2" aria-label="Mobile Navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMenu}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2.5 rounded-card-sm text-body font-medium transition-colors',
                    isActive
                      ? 'bg-brand-green-800 text-brand-gold-500 font-semibold'
                      : 'text-brand-cream-100/90 hover:bg-brand-green-800/60 hover:text-brand-gold-500'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="pt-2 border-t border-brand-green-800 flex flex-col gap-2">
            <Link to="/reservation" onClick={closeMenu}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                leftIcon={<CalendarCheck className="h-4 w-4" />}
              >
                Reserve a Table
              </Button>
            </Link>
            <Link to="/design-system" onClick={closeMenu}>
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                className="text-brand-gold-500 hover:bg-brand-green-800"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Preview Design System
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
