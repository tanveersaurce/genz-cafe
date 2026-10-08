import {
  WeekdayHours,
  isOpenNow as checkIsOpenNow,
  formatHoursSummary,
  WeekdayKey,
} from '../lib/timeUtils';

export interface GalleryItem {
  id: string;
  title: string;
  category: 'Food' | 'Drinks' | 'Ambience';
  src: string;
  alt: string;
  aspectRatio?: 'square' | 'wide' | 'tall';
}

export interface TestimonialItem {
  id: string;
  author: string;
  comment: string;
  role: string;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  slogan: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
  };
  hours: WeekdayHours;
  social: {
    instagram: string;
    facebook: string;
    twitter: string;
  };
  map: {
    embedUrl: string;
    lat: number;
    lng: number;
    directionsUrl: string;
  };
  heroImage: string;
  ogImage: string;
  offer: {
    title: string;
    tag: string;
    description: string;
    validity: string;
    code: string;
  };
  testimonials: TestimonialItem[];
  gallery: GalleryItem[];
}

export const siteConfig: SiteConfig = {
  name: 'Gen-Z Cafe',
  tagline: 'Your Daily Hangout',
  slogan: 'Good Food. Good Vibes. Great Memories.',

  // DUMMY: replace before launch
  phone: '+91 98765 00000',

  // DUMMY: replace before launch
  whatsapp: '919876500000',

  // DUMMY: replace before launch
  email: 'hello@example.com',

  address: {
    // DUMMY: replace before launch
    line1: 'Shop No. 00, Sample Plaza',
    // DUMMY: replace before launch
    line2: 'Main Road',
    // DUMMY: replace before launch
    city: 'Your City',
    // DUMMY: replace before launch
    state: 'State',
    // DUMMY: replace before launch
    pincode: '000000',
  },

  // Operating Hours: Daily 10:00 to 23:00 IST (UTC+5:30)
  hours: {
    monday: { open: '10:00', close: '23:00' },
    tuesday: { open: '10:00', close: '23:00' },
    wednesday: { open: '10:00', close: '23:00' },
    thursday: { open: '10:00', close: '23:00' },
    friday: { open: '10:00', close: '23:00' },
    saturday: { open: '10:00', close: '23:00' },
    sunday: { open: '10:00', close: '23:00' },
  },

  social: {
    // DUMMY: replace before launch
    instagram: 'https://instagram.com/gencafe.sample',
    // DUMMY: replace before launch
    facebook: '',
    // DUMMY: replace before launch
    twitter: '',
  },

  map: {
    // DUMMY: replace before launch
    embedUrl: '',
    // DUMMY: replace before launch
    lat: 19.076,
    // DUMMY: replace before launch
    lng: 72.8777,
    // DUMMY: replace before launch
    directionsUrl: 'https://maps.google.com/?q=Gen-Z+Cafe',
  },

  heroImage: '/brand-poster.jpg',
  ogImage: '/brand-poster.jpg',

  // Sample marketing offer shown on homepage
  offer: {
    title: 'Happy Hour Special',
    tag: 'Sample Offer',
    description:
      'Get 20% off all Handcrafted Cold Brews & Frappes between 4:00 PM and 7:00 PM on weekdays.',
    validity: 'Valid Mon - Fri, 4:00 PM - 7:00 PM',
    code: 'GENZ20',
  },

  // TODO: Replace sample testimonials with verified customer reviews before launch
  testimonials: [
    {
      id: '1',
      author: 'Aarav Sharma',
      comment:
        'The Vanilla Sweet Cream Cold Brew and Hazelnut Cappuccino are absolute perfection. Definitely our favorite hangout spot after college.',
      role: 'Regular Hangout Visitor',
    },
    {
      id: '2',
      author: 'Riya Patel',
      comment:
        'Unmatched aesthetic and cozy seating. The Lotus Biscoff Frappe and Peri-Peri Fries make remote working here an absolute joy.',
      role: 'Coffee Enthusiast',
    },
    {
      id: '3',
      author: 'Kabir Mehta',
      comment:
        'Crispy Paneer Makhani Burger with molten cheese poppers was incredible. The partners and staff are very warm and attentive.',
      role: 'Local Foodie',
    },
  ],

  gallery: [
    {
      id: 'g1',
      title: 'Artisanal Latte Art & Pour',
      category: 'Drinks',
      src: '/brand-poster.jpg',
      alt: 'Fresh espresso cappuccino with velvety heart foam art',
      aspectRatio: 'wide',
    },
    {
      id: 'g2',
      title: 'Signature Cold Brew & Frappe',
      category: 'Drinks',
      src: '/brand-poster.jpg',
      alt: 'Tall glass of slow steeped iced cold brew coffee with sweet cream',
      aspectRatio: 'tall',
    },
    {
      id: 'g3',
      title: 'Loaded Crispy Gourmet Burger',
      category: 'Food',
      src: '/brand-poster.jpg',
      alt: 'Gourmet spiced burger with melted cheese on toasted brioche bun',
      aspectRatio: 'square',
    },
    {
      id: 'g4',
      title: 'Golden Peri-Peri Crinkle Fries',
      category: 'Food',
      src: '/brand-poster.jpg',
      alt: 'Bowl of crispy golden french fries tossed in spicy peri peri herbs',
      aspectRatio: 'square',
    },
    {
      id: 'g5',
      title: 'Warm Cafe Ambience & Seating',
      category: 'Ambience',
      src: '/brand-poster.jpg',
      alt: 'Warm forest green interior aesthetic with hanging Edison lamps and cozy seating',
      aspectRatio: 'wide',
    },
    {
      id: 'g6',
      title: 'Lotus Biscoff Baked Cheesecake',
      category: 'Food',
      src: '/brand-poster.jpg',
      alt: 'Slice of artisanal New York baked cheesecake topped with cookie butter',
      aspectRatio: 'tall',
    },
  ],
};

// ==========================================
// CENTRALIZED HELPERS
// ==========================================

export const formatFullAddress = (): string => {
  const { line1, line2, city, state, pincode } = siteConfig.address;
  return [line1, line2, city, `${state} - ${pincode}`].filter(Boolean).join(', ');
};

export const telLink = (): string => {
  const cleaned = siteConfig.phone.replace(/[^0-9+]/g, '');
  return `tel:${cleaned}`;
};

export const whatsappLink = (message?: string): string => {
  const defaultMsg = `Hi ${siteConfig.name}, I would like to reserve a table / inquire about the cafe menu.`;
  const text = encodeURIComponent(message || defaultMsg);
  const cleanedNumber = siteConfig.whatsapp.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanedNumber}?text=${text}`;
};

export const isCafeOpenNow = (testDate?: Date): boolean => {
  return checkIsOpenNow(siteConfig.hours, testDate);
};

export const getHoursSummary = (): string => {
  return formatHoursSummary(siteConfig.hours);
};

export const getDaySchedule = (dayKey: WeekdayKey) => {
  return siteConfig.hours[dayKey];
};
