import React from 'react';
import { Helmet } from 'react-helmet-async';
import { siteConfig } from '@/config/siteConfig';

interface SeoHeadProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogImage?: string;
  noindex?: boolean;
  schemaJsonLd?: Record<string, unknown>;
}

export const SeoHead: React.FC<SeoHeadProps> = ({
  title,
  description = `${siteConfig.name} - ${siteConfig.slogan} Premium artisanal coffees, loaded gourmet burgers, slow-steeped cold brews, and youthful cafe vibes.`,
  canonicalPath = '',
  ogImage = siteConfig.ogImage,
  noindex = false,
  schemaJsonLd,
}) => {
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://genzcafe.in';
  const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  const canonicalUrl = `${siteUrl}${cleanPath === '/' ? '' : cleanPath}`;
  const fullTitle = title ? `${title} | ${siteConfig.name}` : `${siteConfig.name} - ${siteConfig.tagline}`;
  const absoluteOgImage = ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`;

  // Default CafeOrCoffeeShop Schema for Google Rich Results
  const defaultSchema = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: siteConfig.name,
    description: siteConfig.slogan,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    image: absoluteOgImage,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    priceRange: '₹₹',
    servesCuisine: ['Coffee', 'Cafe', 'Beverages', 'Burgers', 'Desserts'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${siteConfig.address.line1}, ${siteConfig.address.line2}`,
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.state,
      postalCode: siteConfig.address.pincode,
      addressCountry: 'IN',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: siteConfig.hours.monday.open,
        closes: siteConfig.hours.monday.close,
      },
    ],
    sameAs: [siteConfig.social.instagram, siteConfig.social.facebook].filter(Boolean),
  };

  const activeSchema = schemaJsonLd || defaultSchema;

  return (
    <Helmet>
      {/* Title & Standard Meta */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Robots indexing */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph Meta */}
      <meta property="og:type" content="restaurant" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={absoluteOgImage} />
      <meta property="og:site_name" content={siteConfig.name} />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteOgImage} />

      {/* Structured JSON-LD Schema */}
      <script type="application/ld+json">
        {JSON.stringify(activeSchema)}
      </script>
    </Helmet>
  );
};
