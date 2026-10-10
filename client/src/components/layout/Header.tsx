import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Camera, MessageSquare, Globe, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { siteConfig } from '@/config/siteConfig';

const navItems = [
  { label: 'HOME', path: '/' },
  { label: 'MENU', path: '/menu' },
  { label: 'GALLERY', path: '/gallery' },
  { label: 'RESERVATION', path: '/reservation' },
  { label: 'CONTACT', path: '/contact' },
];

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0F3826] border-b border-[#1A4D35] text-brand-cream-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center gap-3 group" onClick={closeMenu}>
          <img
            src="/logo.png"
            alt={`${siteConfig.name} Logo`}
            width={46}
            height={46}
            className="h-11 w-11 rounded-full border-2 border-brand-gold-500 object-cover shadow-sm group-hover:scale-105 transition-transform"
          />
          <div className="flex flex-col text-left">
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white group-hover:text-brand-gold-400 transition-colors leading-none">
              Gen-Z Cafe
            </span>
            <span className="text-brand-gold-400 text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase mt-1">
              RESTAURANT & SOCIAL
            </span>
          </div>
        </Link>

        {/* Center Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8" aria-label="Main Navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'text-xs sm:text-sm font-semibold tracking-widest uppercase transition-colors py-1 relative',
                  isActive
                    ? 'text-brand-gold-400 after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2px] after:bg-brand-gold-400'
                    : 'text-[#d6e4dc] hover:text-brand-gold-400'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          {/* Quick Icons */}
          <Link
            to="/gallery"
            title="Photo Gallery"
            className="text-[#d6e4dc] hover:text-brand-gold-400 transition-colors p-1.5 rounded-full hover:bg-[#164630]"
          >
            <Camera className="h-5 w-5" />
          </Link>
          <Link
            to="/contact"
            title="Messages & Reviews"
            className="text-[#d6e4dc] hover:text-brand-gold-400 transition-colors p-1.5 rounded-full hover:bg-[#164630]"
          >
            <MessageSquare className="h-5 w-5" />
          </Link>
          <a
            href={siteConfig.map.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Find Our Location"
            className="text-[#d6e4dc] hover:text-brand-gold-400 transition-colors p-1.5 rounded-full hover:bg-[#164630]"
          >
            <Globe className="h-5 w-5" />
          </a>

          {/* Reserve A Table CTA Button */}
          <Link to="/reservation">
            <button className="bg-[#F5BD1F] hover:bg-[#e6b01a] text-[#123122] font-bold text-xs sm:text-sm uppercase tracking-wider px-5 py-2.5 rounded shadow-sm hover:shadow transition-all duration-200">
              RESERVE A TABLE
            </button>
          </Link>

          {/* User Account / Staff Login */}
          <Link
            to="/staff/login"
            title="Staff & Member Access"
            className="h-9 w-9 rounded-full bg-[#164630] border border-[#235b40] flex items-center justify-center text-[#d6e4dc] hover:text-brand-gold-400 hover:border-brand-gold-500 transition-colors"
          >
            <User className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <Link to="/reservation">
            <button className="bg-[#F5BD1F] text-[#123122] font-bold text-xs uppercase px-3 py-1.5 rounded">
              RESERVE
            </button>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="p-2 rounded-lg text-white hover:text-brand-gold-400 hover:bg-[#164630]"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0A281B] border-b border-[#1A4D35] px-4 pt-3 pb-6 space-y-4 shadow-xl">
          <nav className="flex flex-col space-y-2" aria-label="Mobile Navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMenu}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2.5 rounded text-sm font-semibold tracking-wider transition-colors uppercase',
                    isActive
                      ? 'bg-[#164630] text-brand-gold-400'
                      : 'text-[#d6e4dc] hover:bg-[#164630]/60 hover:text-brand-gold-400'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="pt-2 border-t border-[#1A4D35] flex flex-col gap-2.5">
            <Link to="/reservation" onClick={closeMenu}>
              <button className="w-full bg-[#F5BD1F] text-[#123122] font-bold text-sm uppercase py-2.5 rounded shadow">
                RESERVE A TABLE
              </button>
            </Link>
            <div className="flex justify-around pt-2 text-[#d6e4dc]">
              <Link to="/gallery" onClick={closeMenu} className="flex items-center gap-1.5 text-xs">
                <Camera className="h-4 w-4 text-brand-gold-400" /> Gallery
              </Link>
              <Link to="/contact" onClick={closeMenu} className="flex items-center gap-1.5 text-xs">
                <MessageSquare className="h-4 w-4 text-brand-gold-400" /> Contact
              </Link>
              <Link to="/staff/login" onClick={closeMenu} className="flex items-center gap-1.5 text-xs">
                <User className="h-4 w-4 text-brand-gold-400" /> Staff Portal
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

