import React, { useState } from 'react';
import {
  Phone,
  MessageCircle,
  Mail,
  Instagram,
  MapPin,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Navigation,
} from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { SeoHead } from '@/components/common/SeoHead';
import { OpenNowBadge } from '@/components/common/OpenNowBadge';
import {
  siteConfig,
  formatFullAddress,
  telLink,
  whatsappLink,
} from '@/config/siteConfig';
import {
  WEEKDAYS_ORDER,
  getISTDateTime,
  formatTime12h,
  WeekdayKey,
} from '@/lib/timeUtils';

export const ContactPage: React.FC = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const fullAddress = formatFullAddress();
  const currentIst = getISTDateTime();

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      toast({
        type: 'success',
        title: 'Address Copied',
        message: 'Cafe address copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        type: 'error',
        title: 'Copy Failed',
        message: fullAddress,
      });
    }
  };

  const dayLabels: Record<WeekdayKey, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <SeoHead
        title="Contact Us"
        description={`Get in touch with ${siteConfig.name}. Call, WhatsApp, find directions, or view our daily opening hours in India.`}
        canonicalPath="/contact"
      />

      <div className="text-center space-y-3">
        <SectionHeading
          subtitle="We'd Love to Hear From You"
          title="Visit & Connect"
          align="center"
          className="mb-1"
        />
        <div className="flex justify-center">
          <OpenNowBadge size="md" />
        </div>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. Phone Card */}
        <Card variant="cream" className="flex flex-col justify-between hover:shadow-card transition-shadow">
          <CardHeader className="pb-2">
            <div className="h-12 w-12 rounded-full bg-brand-cream-300 text-brand-green-800 flex items-center justify-center mb-2">
              <Phone className="h-6 w-6" />
            </div>
            <CardTitle>Phone Support</CardTitle>
            <p className="text-caption text-brand-ink-500">Call us for immediate queries</p>
          </CardHeader>
          <CardContent className="pt-0">
            <a href={telLink()} className="block mt-2">
              <Button variant="primary" size="sm" fullWidth leftIcon={<Phone className="h-4 w-4" />}>
                {siteConfig.phone}
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* 2. WhatsApp Card */}
        <Card variant="cream" className="flex flex-col justify-between hover:shadow-card transition-shadow">
          <CardHeader className="pb-2">
            <div className="h-12 w-12 rounded-full bg-brand-cream-300 text-brand-green-800 flex items-center justify-center mb-2">
              <MessageCircle className="h-6 w-6" />
            </div>
            <CardTitle>WhatsApp</CardTitle>
            <p className="text-caption text-brand-ink-500">Chat for table inquiries & offers</p>
          </CardHeader>
          <CardContent className="pt-0">
            <a
              href={whatsappLink('Hi! I have a question about Gen-Z Cafe.')}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2"
            >
              <Button
                variant="outline"
                size="sm"
                fullWidth
                className="border-brand-green-800 text-brand-green-900 hover:bg-brand-green-800 hover:text-brand-cream-100"
                leftIcon={<MessageCircle className="h-4 w-4" />}
              >
                Chat on WhatsApp
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* 3. Email Card */}
        <Card variant="cream" className="flex flex-col justify-between hover:shadow-card transition-shadow">
          <CardHeader className="pb-2">
            <div className="h-12 w-12 rounded-full bg-brand-cream-300 text-brand-green-800 flex items-center justify-center mb-2">
              <Mail className="h-6 w-6" />
            </div>
            <CardTitle>Email Us</CardTitle>
            <p className="text-caption text-brand-ink-500">Events, partnerships & feedback</p>
          </CardHeader>
          <CardContent className="pt-0">
            <a href={`mailto:${siteConfig.email}`} className="block mt-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                className="border-brand-cream-400 text-brand-ink-800 hover:bg-brand-cream-300"
                leftIcon={<Mail className="h-4 w-4" />}
              >
                {siteConfig.email}
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* 4. Instagram Card */}
        <Card variant="cream" className="flex flex-col justify-between hover:shadow-card transition-shadow">
          <CardHeader className="pb-2">
            <div className="h-12 w-12 rounded-full bg-brand-cream-300 text-brand-green-800 flex items-center justify-center mb-2">
              <Instagram className="h-6 w-6" />
            </div>
            <CardTitle>Instagram</CardTitle>
            <p className="text-caption text-brand-ink-500">Follow our cafe reels & vibes</p>
          </CardHeader>
          <CardContent className="pt-0">
            <a
              href={siteConfig.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2"
            >
              <Button
                variant="outline"
                size="sm"
                fullWidth
                className="border-brand-cream-400 text-brand-ink-800 hover:bg-brand-cream-300"
                leftIcon={<Instagram className="h-4 w-4" />}
              >
                @genzcafe.sample
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Address & Hours Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Address Card */}
        <div className="lg:col-span-5 space-y-6">
          <Card variant="cream">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-green-800" />
                <CardTitle>Physical Address</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-body text-brand-ink-800 leading-relaxed font-sans">
                {fullAddress}
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAddress}
                  leftIcon={copied ? <Check className="h-4 w-4 text-brand-green-700" /> : <Copy className="h-4 w-4" />}
                >
                  {copied ? 'Copied to Clipboard' : 'Copy Address'}
                </Button>

                {siteConfig.map.directionsUrl && (
                  <a
                    href={siteConfig.map.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Navigation className="h-4 w-4" />}
                    >
                      Get Directions
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operating Hours Table */}
        <div className="lg:col-span-7">
          <Card variant="cream">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-brand-green-800" />
                  <CardTitle>Weekly Operating Hours (IST)</CardTitle>
                </div>
                <span className="text-caption font-semibold text-brand-ink-500">
                  UTC+5:30
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-brand-cream-300">
                {WEEKDAYS_ORDER.map((day) => {
                  const isToday = currentIst.dayKey === day;
                  const sched = siteConfig.hours[day];

                  return (
                    <div
                      key={day}
                      className={`px-6 py-3.5 flex items-center justify-between text-small transition-colors ${
                        isToday
                          ? 'bg-brand-gold-500/15 font-semibold text-brand-green-950'
                          : 'text-brand-ink-700 hover:bg-brand-cream-200/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{dayLabels[day]}</span>
                        {isToday && (
                          <span className="text-[11px] font-bold uppercase tracking-wider bg-brand-gold-500 text-brand-ink-900 px-2 py-0.5 rounded-full">
                            Today
                          </span>
                        )}
                      </div>

                      <div className="font-mono text-small">
                        {sched.isClosed ? (
                          <span className="text-brand-ink-400">Closed</span>
                        ) : (
                          <span>
                            {formatTime12h(sched.open)} – {formatTime12h(sched.close)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Google Maps / Location Section */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-bold text-brand-green-950">
            Find Us on the Map
          </h2>
          {siteConfig.map.directionsUrl && (
            <a
              href={siteConfig.map.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-small font-semibold text-brand-gold-600 hover:text-brand-gold-700 flex items-center gap-1"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {siteConfig.map.embedUrl ? (
          <div className="w-full h-96 rounded-card overflow-hidden border border-brand-cream-300 shadow-soft bg-brand-cream-200">
            <iframe
              src={siteConfig.map.embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Gen-Z Cafe Google Maps Location"
            />
          </div>
        ) : (
          /* Placeholder styled card when embedUrl is not configured yet */
          <div className="w-full rounded-card border border-brand-cream-300 bg-brand-cream-200 p-8 sm:p-12 text-center space-y-4 shadow-soft">
            <div className="h-16 w-16 mx-auto rounded-full bg-brand-green-800 text-brand-gold-500 flex items-center justify-center shadow-soft">
              <MapPin className="h-8 w-8" />
            </div>
            <div className="space-y-2 max-w-lg mx-auto">
              <h3 className="font-serif text-xl font-bold text-brand-green-950">
                Interactive Map Location
              </h3>
              <p className="text-small text-brand-ink-600">
                {fullAddress}
              </p>
              <p className="text-caption text-brand-ink-400">
                Coordinates: {siteConfig.map.lat}° N, {siteConfig.map.lng}° E
              </p>
            </div>
            <div className="pt-2">
              <a
                href={siteConfig.map.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Navigation className="h-4 w-4" />}
                >
                  Get Directions in Google Maps
                </Button>
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
