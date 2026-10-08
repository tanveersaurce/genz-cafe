import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Utensils,
  Coffee,
  HeartHandshake,
  Users,
  ArrowRight,
  Sparkles,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  ExternalLink,
  Tag,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { OpenNowBadge } from '@/components/common/OpenNowBadge';
import { SeoHead } from '@/components/common/SeoHead';
import { FoodTypeIndicator, FoodType } from '@/components/menu/FoodTypeIndicator';
import { apiClient } from '@/lib/apiClient';
import { formatPaiseToRupees } from '@/lib/formatPrice';
import {
  siteConfig,
  formatFullAddress,
  getHoursSummary,
  telLink,
  whatsappLink,
} from '@/config/siteConfig';

interface PublicMenuItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  foodType: FoodType;
  basePrice: number;
  variants: Array<{ name: string; price: number; isDefault: boolean }>;
  gstRate: number;
  image?: { full: string; thumbnail: string };
  tags: string[];
  isFeatured: boolean;
  isAvailable: boolean;
  preparationMinutes?: number;
  sortOrder: number;
}

interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sortOrder: number;
  items: PublicMenuItem[];
}

interface PublicMenuResponse {
  success: boolean;
  data: {
    categories: PublicCategory[];
    totalItems: number;
  };
}

export const HomePage: React.FC = () => {
  const { data: menuData, isLoading: menuLoading } = useQuery<PublicMenuResponse>({
    queryKey: ['public-menu'],
    queryFn: async () => {
      return apiClient.get<PublicMenuResponse>('/public/menu');
    },
    staleTime: 30 * 1000,
  });

  const categories = menuData?.data?.categories || [];

  // Extract featured items or fallback to top items across categories
  const featuredItems: PublicMenuItem[] = [];
  categories.forEach((cat) => {
    cat.items.forEach((item) => {
      if (item.isFeatured && featuredItems.length < 4) {
        featuredItems.push(item);
      }
    });
  });

  // If no items explicitly flagged as featured, take the first 4 items from categories
  if (featuredItems.length === 0 && categories.length > 0) {
    for (const cat of categories) {
      for (const item of cat.items) {
        if (featuredItems.length < 4) {
          featuredItems.push(item);
        }
      }
    }
  }

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      <SeoHead
        title="Home"
        description={`${siteConfig.name} - ${siteConfig.slogan} Premium artisanal coffees, loaded gourmet burgers, slow-steeped cold brews, and youthful cafe vibes.`}
        canonicalPath="/"
      />

      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-brand-green-950 text-brand-cream-100 py-16 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8 border-b border-brand-green-800">
        <div className="max-w-content mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-script text-2xl sm:text-3xl text-brand-gold-500">
                {siteConfig.tagline}
              </span>
              <OpenNowBadge size="md" />
            </div>

            <h1 className="font-serif text-display font-bold leading-tight tracking-tight text-brand-cream-100">
              Good Food, <span className="text-brand-gold-500">Good Vibes,</span> Great Memories
            </h1>

            <p className="text-body sm:text-lg text-brand-cream-100/80 max-w-xl leading-relaxed">
              Crafted with heart by 5 passionate partners in India. Whether you need an energizing workspace,
              chill college hangout, or artisanal espresso paired with gourmet burgers, {siteConfig.name} is
              your daily hangout spot.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/menu">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Explore Menu
                </Button>
              </Link>
              <Link to="/reservation">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-brand-cream-300 text-brand-cream-100 hover:bg-brand-green-800"
                >
                  Reserve a Table
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="relative p-3 rounded-2xl bg-brand-green-900/90 border border-brand-green-700 shadow-dark-card max-w-sm sm:max-w-md w-full">
              <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-brand-green-950">
                <img
                  src={siteConfig.heroImage}
                  alt={`${siteConfig.name} signature cold brew and burgers`}
                  width={600}
                  height={450}
                  className="w-full h-full object-cover transition-transform duration-slow hover:scale-105"
                />
              </div>
              <div className="absolute -bottom-4 -left-3 bg-brand-gold-500 text-brand-ink-900 px-4 py-2 rounded-full font-semibold text-small shadow-soft flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                <span>Eat • Drink • Repeat</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Value Strip (4 Pillars) */}
      <section className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          subtitle="What We Stand For"
          title="The Gen-Z Experience"
          align="center"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card variant="cream">
            <CardHeader>
              <div className="h-12 w-12 rounded-full bg-brand-cream-300 text-brand-green-800 flex items-center justify-center mb-3">
                <Utensils className="h-6 w-6" />
              </div>
              <CardTitle>Delicious Food</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-small text-brand-ink-500">
                Fresh gourmet burgers, crispy sides, artisanal pizzas, and rich decadent desserts made to order.
              </p>
            </CardContent>
          </Card>

          <Card variant="cream">
            <CardHeader>
              <div className="h-12 w-12 rounded-full bg-brand-cream-300 text-brand-green-800 flex items-center justify-center mb-3">
                <Coffee className="h-6 w-6" />
              </div>
              <CardTitle>Great Ambience</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-small text-brand-ink-500">
                Forest green aesthetics, warm mood pendant lights, comfortable seating, and relaxing lo-fi beats.
              </p>
            </CardContent>
          </Card>

          <Card variant="cream">
            <CardHeader>
              <div className="h-12 w-12 rounded-full bg-brand-cream-300 text-brand-green-800 flex items-center justify-center mb-3">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <CardTitle>Good Vibes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-small text-brand-ink-500">
                Friendly hospitality from founders and baristas who genuinely love welcoming the community.
              </p>
            </CardContent>
          </Card>

          <Card variant="cream">
            <CardHeader>
              <div className="h-12 w-12 rounded-full bg-brand-cream-300 text-brand-green-800 flex items-center justify-center mb-3">
                <Users className="h-6 w-6" />
              </div>
              <CardTitle>Memorable Moments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-small text-brand-ink-500">
                Board games, study sessions, late evening chats, and birthday celebrations that stay with you.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3. Popular Categories */}
      <section className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <SectionHeading
            subtitle="Explore Our Flavours"
            title="Popular Categories"
            align="left"
            className="mb-0"
          />
          <Link to="/menu" className="text-small font-semibold text-brand-gold-600 hover:text-brand-gold-700 flex items-center gap-1">
            <span>View Full Menu</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {menuLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rect" className="h-32 rounded-card" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-brand-ink-500 text-center py-6">Menu categories will be updated shortly.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/menu?category=${cat.slug}`}
                className="group block"
              >
                <div className="p-6 rounded-card bg-brand-cream-200 border border-brand-cream-300 text-center space-y-2 group-hover:border-brand-gold-500 group-hover:bg-brand-cream-100 transition-all duration-fast shadow-soft group-hover:-translate-y-1">
                  <h3 className="font-serif text-lg font-bold text-brand-green-950 group-hover:text-brand-gold-600 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-caption text-brand-ink-500 line-clamp-1">
                    {cat.description || `${cat.items.length} items`}
                  </p>
                  <span className="inline-block text-[11px] font-semibold text-brand-green-800 bg-brand-cream-300 px-2.5 py-0.5 rounded-full">
                    {cat.items.length} delicious options
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. Today's Special / Chef Highlights */}
      <section className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          subtitle="Handpicked For You"
          title="Today's Specials & Bestsellers"
          align="center"
        />

        {menuLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rect" className="h-64 rounded-card" />
            ))}
          </div>
        ) : featuredItems.length === 0 ? (
          <p className="text-brand-ink-500 text-center py-6">Check our menu page for the full listing.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredItems.map((item) => (
              <Card key={item.id} variant="cream" className="flex flex-col justify-between hover:shadow-card transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <FoodTypeIndicator type={item.foodType} size="sm" />
                    <Badge variant="gold" size="sm" className="font-mono">
                      {formatPaiseToRupees(item.basePrice)}
                    </Badge>
                  </div>
                  <CardTitle className="font-serif text-base font-bold text-brand-green-950 line-clamp-1">
                    {item.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-small text-brand-ink-600 line-clamp-2">
                    {item.description || 'Freshly prepared with artisanal ingredients.'}
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-brand-cream-300/60">
                    <Badge variant={item.isAvailable ? 'success' : 'danger'} size="sm">
                      {item.isAvailable ? 'Available' : 'Sold Out'}
                    </Badge>
                    <Link
                      to={`/menu?category=${item.slug}`}
                      className="text-caption font-semibold text-brand-gold-600 hover:text-brand-gold-700 inline-flex items-center gap-1"
                    >
                      <span>Details</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 5. Offer Banner */}
      <section className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-card bg-gradient-to-r from-brand-green-950 to-brand-green-900 border border-brand-gold-500/40 p-6 sm:p-10 text-brand-cream-100 shadow-dark-card flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold-500/20 text-brand-gold-400 text-caption font-semibold">
              <Tag className="h-3.5 w-3.5" />
              <span>{siteConfig.offer.tag}</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-brand-cream-100">
              {siteConfig.offer.title}
            </h2>
            <p className="text-body text-brand-cream-100/80 max-w-xl">
              {siteConfig.offer.description}
            </p>
            <p className="text-caption text-brand-gold-400">
              {siteConfig.offer.validity}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <div className="px-5 py-2.5 rounded-card-sm border-2 border-dashed border-brand-gold-500 text-brand-gold-400 font-mono font-bold tracking-wider text-base bg-brand-green-900/60">
              CODE: {siteConfig.offer.code}
            </div>
            <Link to="/menu">
              <Button variant="primary" size="md">
                Claim Offer
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. About Story Block */}
      <section className="bg-brand-green-900 py-16 px-4 sm:px-6 lg:px-8 border-y border-brand-green-800 text-brand-cream-100">
        <div className="max-w-content mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5 text-left">
            <SectionHeading
              subtitle="Our Story"
              title="Built by 5 Friends with a Dream"
              theme="dark"
              align="left"
              className="mb-0"
            />
            <p className="text-body text-brand-cream-100/90 leading-relaxed">
              We started Gen-Z Cafe with a singular conviction: cafe culture should be vibrant,
              unhurried, and genuinely tasty. No artificial fuss—just great coffee roasts, honest ingredients,
              and a welcoming aesthetic where everyone has a seat.
            </p>
            <p className="text-body text-brand-cream-100/80 leading-relaxed">
              Every detail—from the playlist playing softly in the background to our secret spiced peri-peri
              blend—reflects our personal love for Indian cafe culture and culinary adventures.
            </p>
            <div className="pt-2">
              <Link to="/contact">
                <Button variant="outline" size="md" className="border-brand-gold-500 text-brand-gold-400 hover:bg-brand-green-800">
                  Come Say Hi
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="rounded-xl overflow-hidden border border-brand-green-700 bg-brand-green-950 p-2 shadow-dark-card w-full max-w-md">
              <img
                src={siteConfig.heroImage}
                alt="Gen-Z Cafe Interior Ambience"
                width={500}
                height={350}
                className="rounded-lg object-cover w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 7. Testimonials */}
      <section className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          subtitle="Love from Our Community"
          title="What Our Regulars Say"
          align="center"
        />

        {/* TODO: Replace sample testimonials with verified customer reviews before launch */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {siteConfig.testimonials.map((t) => (
            <Card key={t.id} variant="cream" className="flex flex-col justify-between">
              <CardContent className="pt-6 space-y-4">
                <div className="flex text-brand-gold-500 gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-body italic text-brand-ink-700">
                  "{t.comment}"
                </p>
                <div className="border-t border-brand-cream-300 pt-3">
                  <p className="font-serif font-bold text-brand-green-950">{t.author}</p>
                  <p className="text-caption text-brand-ink-500">{t.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 8. Visit Us Strip */}
      <section className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-card bg-brand-cream-200 border border-brand-cream-300 p-8 sm:p-10 text-brand-ink-900 shadow-soft">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4 text-left">
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-brand-green-950">
                  Visit {siteConfig.name} Today
                </h2>
                <OpenNowBadge size="sm" />
              </div>

              <div className="space-y-2 text-small text-brand-ink-700">
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-brand-green-800 shrink-0 mt-0.5" />
                  <span>{formatFullAddress()}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-brand-green-800 shrink-0 mt-0.5" />
                  <span>{getHoursSummary()}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
              <a
                href={whatsappLink('Hi! I would like to check table availability for today.')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  leftIcon={<MessageCircle className="h-4 w-4" />}
                >
                  WhatsApp Us
                </Button>
              </a>

              <a href={telLink()} className="w-full">
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  leftIcon={<Phone className="h-4 w-4" />}
                >
                  {siteConfig.phone}
                </Button>
              </a>

              {siteConfig.map.directionsUrl && (
                <a
                  href={siteConfig.map.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    leftIcon={<ExternalLink className="h-4 w-4" />}
                  >
                    Get Directions
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
