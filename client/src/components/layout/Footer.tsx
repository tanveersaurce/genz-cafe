import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Phone, Mail, Instagram, Facebook, Twitter, Shield } from 'lucide-react';
import { siteConfig, formatFullAddress, telLink } from '@/config/siteConfig';
import { formatTime12 } from '@/lib/timeUtils';

export const Footer: React.FC = () => {
  const fullAddress = formatFullAddress();
  const phoneHref = telLink();
  const mailHref = `mailto:${siteConfig.email}`;

  return (
    <footer className="w-full bg-brand-green-950 text-brand-cream-100 border-t border-brand-green-800">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Brand Info */}
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt={`${siteConfig.name} Logo`}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full border border-brand-gold-500 shadow-soft object-cover"
              />
              <div>
                <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white block">
                  Gen-Z Cafe
                </span>
                <span className="text-brand-gold-400 text-[10px] font-semibold tracking-[0.2em] uppercase">
                  RESTAURANT & SOCIAL
                </span>
              </div>
            </div>
            <p className="text-small text-brand-cream-100/70 leading-relaxed">
              {siteConfig.slogan} Warm, fresh, and youthful cafe run with passion by 5 partners in India.
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              {siteConfig.social.instagram && (
                <a
                  href={siteConfig.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${siteConfig.name} on Instagram`}
                  className="h-9 w-9 rounded-full bg-brand-green-800 flex items-center justify-center text-brand-gold-500 hover:bg-brand-green-700 transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {siteConfig.social.facebook && (
                <a
                  href={siteConfig.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${siteConfig.name} on Facebook`}
                  className="h-9 w-9 rounded-full bg-brand-green-800 flex items-center justify-center text-brand-gold-500 hover:bg-brand-green-700 transition-colors"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {siteConfig.social.twitter && (
                <a
                  href={siteConfig.social.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${siteConfig.name} on Twitter / X`}
                  className="h-9 w-9 rounded-full bg-brand-green-800 flex items-center justify-center text-brand-gold-500 hover:bg-brand-green-700 transition-colors"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3 text-left">
            <h4 className="font-serif text-lg font-semibold text-brand-gold-500">Quick Links</h4>
            <ul className="space-y-2 text-small text-brand-cream-100/80">
              <li>
                <Link to="/" className="hover:text-brand-gold-500 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/menu" className="hover:text-brand-gold-500 transition-colors">
                  Explore Menu
                </Link>
              </li>
              <li>
                <Link to="/gallery" className="hover:text-brand-gold-500 transition-colors">
                  Photo Gallery
                </Link>
              </li>
              <li>
                <Link to="/reservation" className="hover:text-brand-gold-500 transition-colors">
                  Table Reservations
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-brand-gold-500 transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Hours from siteConfig */}
          <div className="space-y-3 text-left">
            <h4 className="font-serif text-lg font-semibold text-brand-gold-500">Opening Hours</h4>
            <div className="space-y-2.5 text-small text-brand-cream-100/80">
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-brand-gold-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-brand-cream-100">Monday – Friday</p>
                  <p className="text-caption text-brand-cream-100/70">
                    {formatTime12(siteConfig.hours.monday.open)} – {formatTime12(siteConfig.hours.monday.close)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-brand-gold-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-brand-cream-100">Saturday – Sunday</p>
                  <p className="text-caption text-brand-cream-100/70">
                    {formatTime12(siteConfig.hours.saturday.open)} – {formatTime12(siteConfig.hours.saturday.close)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Column 4: Contact & Location from siteConfig */}
          <div className="space-y-3 text-left">
            <h4 className="font-serif text-lg font-semibold text-brand-gold-500">Visit Us</h4>
            <div className="space-y-2.5 text-small text-brand-cream-100/80">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-brand-gold-500 shrink-0 mt-0.5" />
                <span>{fullAddress}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-brand-gold-500 shrink-0" />
                <a href={phoneHref} className="hover:text-brand-gold-500 transition-colors">
                  {siteConfig.phone}
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-brand-gold-500 shrink-0" />
                <a href={mailHref} className="hover:text-brand-gold-500 transition-colors">
                  {siteConfig.email}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-brand-green-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-caption text-brand-cream-100/60">
          <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link
              to="/app/login"
              className="inline-flex items-center gap-1.5 hover:text-brand-gold-500 transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Staff Portal</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
