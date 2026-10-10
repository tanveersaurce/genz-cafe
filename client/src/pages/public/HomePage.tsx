import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Utensils,
  Coffee,
  Sparkles,
  Phone,
  Star,
  Check,
  QrCode,
  Flame,
  Leaf,
  Wifi,
  ArrowRight,
} from 'lucide-react';
import { SeoHead } from '@/components/common/SeoHead';
import { telLink } from '@/config/siteConfig';

// Popular dishes data matching Image 1 Customer Favorites
const popularDishes = [
  {
    id: 'pop-1',
    name: 'Classic Gourmet Burger',
    category: 'Burgers',
    price: '₹249',
    rating: '4.9',
    reviews: '230+',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Juicy handcrafted patty with molten cheddar, fresh lettuce, tomatoes & special house relish.',
  },
  {
    id: 'pop-2',
    name: 'Belgian Chocolate Shake',
    category: 'Shakes',
    price: '₹189',
    rating: '4.8',
    reviews: '190+',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Rich Belgian chocolate blend whipped with creamy whole milk and topped with dark chocolate curls.',
  },
  {
    id: 'pop-3',
    name: 'Artisanal Cold Brew',
    category: 'Coffee',
    price: '₹169',
    rating: '4.9',
    reviews: '310+',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&h=450&q=80',
    description: '16-hour slow steeped single-origin Arabica coffee served chilled over artisanal crystal ice cubes.',
  },
  {
    id: 'pop-4',
    name: 'Peri Peri Loaded Fries',
    category: 'Sides',
    price: '₹149',
    rating: '4.7',
    reviews: '175+',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Golden crispy skin-on potatoes dusted with fiery peri-peri spices, served with herb garlic mayo.',
  },
];

// Curated menu items for the Our Menu section matching Image 1
const menuItems = [
  {
    id: 'menu-1',
    name: 'Classic Cheese Burger',
    category: 'BURGERS & SLIDERS',
    price: '₹229',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Toasted brioche bun, grilled veg patty, double cheddar slice and signature cafe spread.',
  },
  {
    id: 'menu-2',
    name: 'Crispy Paneer Burger',
    category: 'BURGERS & SLIDERS',
    price: '₹259',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Crunchy battered cottage cheese patty laced with tandoori mayo and pickled onions.',
  },
  {
    id: 'menu-3',
    name: 'Loaded BBQ Smoke Burger',
    category: 'BURGERS & SLIDERS',
    price: '₹289',
    isVeg: false,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Smoky spiced grilled patty topped with caramelised onions, crispy onion rings and hickory BBQ glaze.',
  },
  {
    id: 'menu-4',
    name: 'Belgian Overload Shake',
    category: 'SHAKES & COFFEE',
    price: '₹199',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Thick shake made with pure couverture chocolate, whipped cream crown and brownie chunks.',
  },
  {
    id: 'menu-5',
    name: 'Hazelnut Frappe Coffee',
    category: 'SHAKES & COFFEE',
    price: '₹179',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1579888944880-d98341245702?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Double espresso blended with roasted hazelnut syrup, ice cream and chilled milk.',
  },
  {
    id: 'menu-6',
    name: 'Cheesy Peri Peri Fries',
    category: 'PIZZAS & SIDES',
    price: '₹159',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Crisp hand-cut fries smothered in warm molten cheddar sauce and spicy peri-peri seasoning.',
  },
  {
    id: 'menu-7',
    name: 'Farmhouse Special Pizza',
    category: 'PIZZAS & SIDES',
    price: '₹329',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Stone-baked thin crust pizza layered with mozzarella, bell peppers, sweet corn, olives and basil.',
  },
  {
    id: 'menu-8',
    name: 'Red Velvet Cheesecake',
    category: 'DESSERTS',
    price: '₹189',
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&h=450&q=80',
    description: 'Velvety cream cheese slice over crunchy graham cracker crust with raspberry coulis drizzle.',
  },
];

const menuTabs = [
  'ALL ITEMS',
  'BURGERS & SLIDERS',
  'SHAKES & COFFEE',
  'PIZZAS & SIDES',
  'DESSERTS',
];

export const HomePage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('ALL ITEMS');
  const [addedItem, setAddedItem] = useState<string | null>(null);

  const filteredItems =
    selectedTab === 'ALL ITEMS'
      ? menuItems
      : menuItems.filter((item) => item.category === selectedTab);

  const handleAddToOrder = (id: string) => {
    setAddedItem(id);
    setTimeout(() => {
      setAddedItem(null);
    }, 1800);
  };

  return (
    <div className="w-full bg-[#FAF6EE] text-[#1A1A1A]">
      <SeoHead
        title="Gen-Z Cafe | Your Daily Hangout"
        description="Experience Good Food, Good Vibes, and Great Memories at Gen-Z Cafe. Premium burgers, cold brew coffee, shakes, and cozy ambiance."
        canonicalPath="/"
      />

      {/* ========================================================
          1. HERO SECTION (Deep Forest Green Theme)
          ======================================================== */}
      <section className="relative bg-[#0F3826] text-[#FAF6EE] pt-12 pb-16 lg:py-20 px-4 sm:px-6 lg:px-8 border-b border-[#1A4D35] overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#164630]/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#164630]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-brand-gold-500/40 bg-[#164630]/70 text-brand-gold-400 text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="h-3.5 w-3.5 text-brand-gold-400" />
              <span>BEST RESTAURANT & CAFE IN TOWN</span>
            </div>

            <p className="font-script text-3xl sm:text-4xl text-brand-gold-400 tracking-wide">
              Your Daily Hangout.
            </p>

            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08]">
              Good Food,
              <br />
              <span className="text-brand-gold-400">Good Vibes.</span>
            </h1>

            <p className="text-sm sm:text-base text-[#D4E2D8] max-w-xl leading-relaxed">
              Experience gourmet comfort food, handcrafted coffee, and unforgettable moments
              in our cozy urban oasis. Fresh ingredients, made with passion.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/menu">
                <button className="bg-[#F5BD1F] hover:bg-[#e6b01a] text-[#123122] font-bold text-sm uppercase tracking-wider px-7 py-3.5 rounded shadow-md hover:shadow-lg transition-all duration-200">
                  EXPLORE OUR MENU
                </button>
              </Link>
              <Link to="/reservation">
                <button className="border-2 border-white/80 hover:border-brand-gold-400 text-white hover:text-brand-gold-400 font-bold text-sm uppercase tracking-wider px-7 py-3 rounded hover:bg-white/5 transition-all duration-200">
                  BOOK A TABLE
                </button>
              </Link>
            </div>
          </div>

          {/* Right Hero Image (Circular Platter) */}
          <div className="lg:col-span-5 flex justify-center relative">
            <div className="relative w-72 h-72 sm:w-96 sm:h-96 md:w-[420px] md:h-[420px]">
              {/* Outer decorative ring */}
              <div className="absolute inset-0 rounded-full border-4 border-[#F5BD1F]/40 scale-105 animate-pulse" />
              {/* Main circular image container */}
              <div className="w-full h-full rounded-full overflow-hidden border-8 border-[#FAF6EE] shadow-2xl relative bg-[#164630]">
                <img
                  src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80"
                  alt="Delicious cafe platter with burgers, fries and cold drinks"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Floating Pill Badges matching Image 1 */}
              <div className="absolute -top-2 right-0 sm:right-4 bg-[#FAF6EE] text-[#123122] px-4 py-1.5 rounded-full shadow-lg border border-brand-gold-500/30 flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                <Star className="h-4 w-4 fill-brand-gold-500 text-brand-gold-500" />
                <span>4.9 (1.2k+ REVIEWS)</span>
              </div>

              <div className="absolute -bottom-3 left-0 sm:left-4 bg-[#FAF6EE] text-[#123122] px-4 py-1.5 rounded-full shadow-lg border border-brand-gold-500/30 flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                <Leaf className="h-4 w-4 text-emerald-600" />
                <span>100% ORGANIC & FRESH</span>
              </div>

              <div className="absolute bottom-6 -right-2 sm:right-2 bg-[#F5BD1F] text-[#123122] px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                <Flame className="h-4 w-4 text-[#123122]" />
                <span>CHEF'S SPECIAL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Features Strip (The Gen-Z Experience: Delicious Food, Daily Specials, Great Ambience, Free Wi-Fi) */}
        <div className="sr-only">The Gen-Z Experience</div>
        <div className="max-w-7xl mx-auto mt-14 pt-8 border-t border-[#1A4D35] grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="flex items-center justify-center gap-3 text-xs sm:text-sm font-bold tracking-wider uppercase text-[#D4E2D8]">
            <Utensils className="h-5 w-5 text-brand-gold-400 shrink-0" />
            <span>Delicious Food</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs sm:text-sm font-bold tracking-wider uppercase text-[#D4E2D8] border-l-0 md:border-l border-[#1A4D35]">
            <Sparkles className="h-5 w-5 text-brand-gold-400 shrink-0" />
            <span>Daily Specials</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs sm:text-sm font-bold tracking-wider uppercase text-[#D4E2D8] border-l-0 md:border-l border-[#1A4D35]">
            <Coffee className="h-5 w-5 text-brand-gold-400 shrink-0" />
            <span>Great Ambience</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs sm:text-sm font-bold tracking-wider uppercase text-[#D4E2D8] border-l-0 md:border-l border-[#1A4D35]">
            <Wifi className="h-5 w-5 text-brand-gold-400 shrink-0" />
            <span>Free High-Speed Wi-Fi</span>
          </div>
        </div>
      </section>

      {/* ========================================================
          2. POPULAR DISHES SECTION (Warm Cream Background)
          ======================================================== */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <p className="font-script text-2xl sm:text-3xl text-brand-gold-600">Customer Favorites</p>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F3826]">
            Popular Dishes
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {popularDishes.map((dish) => (
            <div
              key={dish.id}
              className="bg-white rounded-xl overflow-hidden border border-[#E8DEC7] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full justify-between group"
            >
              {/* Dish Image - Fixed Uniform Height */}
              <div className="relative h-52 w-full overflow-hidden bg-[#EFE8D6] shrink-0">
                {/* Veg/Non-veg indicator badge */}
                <div className="absolute top-3 left-3 z-10 bg-white/90 p-1 rounded-sm shadow">
                  <div
                    className={`h-3 w-3 border ${
                      dish.isVeg ? 'border-emerald-600' : 'border-red-600'
                    } flex items-center justify-center p-[2px]`}
                  >
                    <div
                      className={`h-full w-full rounded-full ${
                        dish.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                      }`}
                    />
                  </div>
                </div>

                <img
                  src={dish.image}
                  alt={dish.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Dish Content - Equal Height Containers */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2 h-7">
                    <h3 className="font-serif text-base sm:text-lg font-bold text-[#0F3826] line-clamp-1 truncate group-hover:text-brand-gold-600 transition-colors">
                      {dish.name}
                    </h3>
                    <span className="font-serif font-bold text-base text-[#0F3826] shrink-0 whitespace-nowrap">
                      {dish.price}
                    </span>
                  </div>
                  <p className="h-10 text-xs text-[#6B6B6B] line-clamp-2 leading-relaxed overflow-hidden">
                    {dish.description}
                  </p>
                </div>

                <button
                  onClick={() => handleAddToOrder(dish.id)}
                  className={`w-full h-10 py-2.5 px-4 rounded font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 shrink-0 ${
                    addedItem === dish.id
                      ? 'bg-emerald-700 text-white'
                      : 'bg-[#F5BD1F] hover:bg-[#e6b01a] text-[#123122] shadow-sm'
                  }`}
                >
                  {addedItem === dish.id ? (
                    <>
                      <Check className="h-4 w-4" /> ADDED TO ORDER
                    </>
                  ) : (
                    'ADD TO ORDER'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          3. ABOUT US SECTION (Warm Sandy Beige / Caramel)
          ======================================================== */}
      <section className="bg-[#E8DAB2] py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-y border-[#DCBA8B]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Circular Visual */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96">
              <div className="w-full h-full rounded-full overflow-hidden border-8 border-[#0F3826] shadow-2xl bg-[#0F3826]">
                <img
                  src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"
                  alt="Delicious table spread at Gen-Z Cafe"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>

          {/* Right Story Text */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div>
              <p className="font-script text-2xl sm:text-3xl text-[#7E5C1B]">Our Story</p>
              <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#0F3826]">
                About Us
              </h2>
            </div>

            <p className="text-sm sm:text-base text-[#3A3326] leading-relaxed">
              Gen-Z Cafe was founded with a singular conviction: cafe culture should be vibrant,
              unhurried, and genuinely flavorful. We built a welcoming sanctuary where handcrafted
              specialty coffees meet gourmet comfort burgers, crispy golden fries, and sweet artisanal treats.
            </p>

            <p className="text-sm sm:text-base text-[#3A3326] leading-relaxed">
              Whether you are meeting your squad for a weekend hangout, settling in with your laptop
              for a productive afternoon session, or sharing stories over hot espresso, every single recipe
              is prepared fresh with passion and top-quality ingredients.
            </p>

            <p className="font-serif text-xl sm:text-2xl font-bold text-[#0F3826] italic">
              Eat. Drink. Repeat.
            </p>

            <div>
              <Link to="/contact">
                <button className="bg-[#0F3826] hover:bg-[#164630] text-white font-bold text-xs sm:text-sm uppercase tracking-wider px-7 py-3 rounded shadow-md transition-all duration-200">
                  READ OUR STORY
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          4. OUR MENU SECTION (Ivory Background, Tabs, 8 Cards)
          ======================================================== */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-2 mb-10">
          <p className="font-script text-2xl sm:text-3xl text-brand-gold-600">Curated Selection</p>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#0F3826]">Our Menu</h2>
          <p className="text-xs sm:text-sm font-semibold tracking-widest text-[#7A6F5A] uppercase">
            HANDCRAFTED WITH PASSION & FRESH INGREDIENTS
          </p>
        </div>

        {/* Menu Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-12">
          {menuTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded text-xs sm:text-sm font-bold tracking-wider transition-all duration-200 uppercase ${
                selectedTab === tab
                  ? 'bg-[#F5BD1F] text-[#123122] shadow-sm'
                  : 'bg-white hover:bg-[#F2EADB] text-[#4A4A4A] border border-[#E3D9C3]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 8 Menu Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl overflow-hidden border border-[#E8DEC7] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full justify-between group"
            >
              {/* Item Image - Fixed Uniform Height */}
              <div className="relative h-52 w-full overflow-hidden bg-[#EFE8D6] shrink-0">
                {/* Veg/Non-veg indicator */}
                <div className="absolute top-3 left-3 z-10 bg-white/90 p-1 rounded-sm shadow">
                  <div
                    className={`h-3 w-3 border ${
                      item.isVeg ? 'border-emerald-600' : 'border-red-600'
                    } flex items-center justify-center p-[2px]`}
                  >
                    <div
                      className={`h-full w-full rounded-full ${
                        item.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                      }`}
                    />
                  </div>
                </div>

                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Item Content - Equal Height Containers */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2 h-7">
                    <h3 className="font-serif text-base font-bold text-[#0F3826] line-clamp-1 truncate group-hover:text-brand-gold-600 transition-colors">
                      {item.name}
                    </h3>
                    <span className="font-serif font-bold text-sm text-[#0F3826] shrink-0 whitespace-nowrap">
                      {item.price}
                    </span>
                  </div>
                  <p className="h-10 text-xs text-[#6B6B6B] line-clamp-2 leading-relaxed overflow-hidden">
                    {item.description}
                  </p>
                </div>

                <button
                  onClick={() => handleAddToOrder(item.id)}
                  className={`w-full h-10 py-2.5 px-4 rounded font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 shrink-0 ${
                    addedItem === item.id
                      ? 'bg-emerald-700 text-white'
                      : 'bg-[#F5BD1F] hover:bg-[#e6b01a] text-[#123122] shadow-sm'
                  }`}
                >
                  {addedItem === item.id ? (
                    <>
                      <Check className="h-4 w-4" /> ADDED TO ORDER
                    </>
                  ) : (
                    'ADD TO ORDER'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* View Full Menu CTA Button */}
        <div className="text-center mt-12">
          <Link to="/menu">
            <button className="border-2 border-[#0F3826] hover:bg-[#0F3826] text-[#0F3826] hover:text-white font-bold text-xs sm:text-sm uppercase tracking-wider px-8 py-3.5 rounded transition-all duration-200 inline-flex items-center gap-2">
              <span>VIEW FULL MENU</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </section>

      {/* ========================================================
          5. THE EXPERIENCE SECTION (Forest Green Theme)
          ======================================================== */}
      <section className="bg-[#0F3826] text-[#FAF6EE] py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-y border-[#1A4D35]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div>
              <p className="font-script text-2xl sm:text-3xl text-brand-gold-400">The Experience</p>
              <h2 className="font-serif text-4xl sm:text-5xl font-bold text-white leading-tight">
                Great Food.
                <br />
                <span className="text-brand-gold-400">Great Memories.</span>
              </h2>
            </div>

            <p className="text-sm sm:text-base text-[#D4E2D8] leading-relaxed">
              Step into a space designed for connection. Surrounded by forest green aesthetics, warm mood
              lighting, relaxing lo-fi beats, and friendly hospitality, every table holds a new story.
              Whether celebrating milestones or having quiet conversations, Gen-Z Cafe makes moments unforgettable.
            </p>

            <div>
              <Link to="/gallery">
                <button className="bg-[#F5BD1F] hover:bg-[#e6b01a] text-[#123122] font-bold text-xs sm:text-sm uppercase tracking-wider px-7 py-3 rounded shadow-md transition-all duration-200">
                  SEE GALLERY
                </button>
              </Link>
            </div>
          </div>

          {/* Right Atmosphere Photo */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="rounded-2xl overflow-hidden border-4 border-[#1A4D35] shadow-2xl bg-[#0A281B] max-w-lg w-full">
              <img
                src="https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=1000&q=80"
                alt="Friends having a great time at Gen-Z Cafe"
                className="w-full h-80 sm:h-96 object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          6. HOW TO ORDER (Simple 3-Step Process)
          ======================================================== */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-2 mb-14">
          <p className="font-script text-2xl sm:text-3xl text-brand-gold-600">Simple 3-Step Process</p>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#0F3826]">How to Order</h2>
          <p className="text-xs sm:text-sm font-semibold tracking-widest text-[#7A6F5A] uppercase">
            QUICK, EASY & HASSLE-FREE
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="bg-white rounded-xl p-8 border border-[#E8DEC7] shadow-sm hover:shadow-lg transition-all duration-300 relative text-left">
            <div className="flex items-center justify-between mb-6">
              <span className="font-serif text-3xl font-bold text-brand-gold-500">01</span>
              <div className="h-10 w-10 rounded-full bg-[#FAF6EE] text-[#0F3826] border border-[#E8DEC7] flex items-center justify-center">
                <Utensils className="h-5 w-5" />
              </div>
            </div>
            <h3 className="font-serif text-xl font-bold text-[#0F3826] mb-2">
              Pick Your Favorites
            </h3>
            <p className="text-sm text-[#6B6B6B] leading-relaxed">
              Explore our handcrafted menu with artisanal burgers, iced cold brews, peri peri fries, and decadent desserts.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-xl p-8 border border-[#E8DEC7] shadow-sm hover:shadow-lg transition-all duration-300 relative text-left">
            <div className="flex items-center justify-between mb-6">
              <span className="font-serif text-3xl font-bold text-brand-gold-500">02</span>
              <div className="h-10 w-10 rounded-full bg-[#FAF6EE] text-[#0F3826] border border-[#E8DEC7] flex items-center justify-center">
                <QrCode className="h-5 w-5" />
              </div>
            </div>
            <h3 className="font-serif text-xl font-bold text-[#0F3826] mb-2">
              Choose Dine-In or Takeaway
            </h3>
            <p className="text-sm text-[#6B6B6B] leading-relaxed">
              Order directly from your seat by scanning the table QR code, or order ahead for takeaway on the go.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl p-8 border border-[#E8DEC7] shadow-sm hover:shadow-lg transition-all duration-300 relative text-left">
            <div className="flex items-center justify-between mb-6">
              <span className="font-serif text-3xl font-bold text-brand-gold-500">03</span>
              <div className="h-10 w-10 rounded-full bg-[#FAF6EE] text-[#0F3826] border border-[#E8DEC7] flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <h3 className="font-serif text-xl font-bold text-[#0F3826] mb-2">
              Enjoy Your Good Vibes
            </h3>
            <p className="text-sm text-[#6B6B6B] leading-relaxed">
              Relax in our cozy ambient seating while our passionate kitchen prepares your food fresh to perfection.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          7. WHAT CUSTOMERS SAY (Warm Caramel Beige Theme)
          ======================================================== */}
      <section className="bg-[#E8DAB2] py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-y border-[#DCBA8B]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-14">
            <p className="font-script text-2xl sm:text-3xl text-[#7E5C1B]">Community Vibes</p>
            <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#0F3826]">
              What Customers Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Testimonial Card 1 */}
            <div className="bg-white rounded-2xl overflow-hidden border border-[#D9C496] shadow-md hover:shadow-xl transition-all duration-300">
              <div className="h-48 sm:h-56 w-full overflow-hidden bg-[#E2D4B3]">
                <img
                  src="https://images.unsplash.com/photo-1525610553991-2bede1a236e2?auto=format&fit=crop&w=800&q=80"
                  alt="Happy customers at Gen-Z Cafe"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 sm:p-8 space-y-4 text-left">
                <div className="flex text-brand-gold-500 gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-4 w-4 fill-[#F5BD1F] text-[#F5BD1F]" />
                  ))}
                </div>
                <p className="font-serif italic text-sm sm:text-base text-[#3A3326] leading-relaxed">
                  "The best hangout spot in the city! The burgers are juicy, the cold coffee is to die for,
                  and the aesthetic vibe is unmatched. We come here every weekend for our study and chill sessions."
                </p>
                <div className="pt-2 border-t border-[#F0E4CE] flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#0F3826] text-brand-gold-400 font-bold flex items-center justify-center text-sm">
                    AS
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-[#0F3826] text-sm">Aarav Sharma</h4>
                    <p className="text-xs text-[#7A6F5A]">Regular Customer</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonial Card 2 */}
            <div className="bg-white rounded-2xl overflow-hidden border border-[#D9C496] shadow-md hover:shadow-xl transition-all duration-300">
              <div className="h-48 sm:h-56 w-full overflow-hidden bg-[#E2D4B3]">
                <img
                  src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
                  alt="Cozy cafe vibes and food at Gen-Z Cafe"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 sm:p-8 space-y-4 text-left">
                <div className="flex text-brand-gold-500 gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-4 w-4 fill-[#F5BD1F] text-[#F5BD1F]" />
                  ))}
                </div>
                <p className="font-serif italic text-sm sm:text-base text-[#3A3326] leading-relaxed">
                  "Outstanding ambiance and delicious peri peri fries! Love working here during afternoons
                  with high-speed Wi-Fi and artisanal iced lattes. 10/10 recommendation for everyone!"
                </p>
                <div className="pt-2 border-t border-[#F0E4CE] flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#0F3826] text-brand-gold-400 font-bold flex items-center justify-center text-sm">
                    PN
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-[#0F3826] text-sm">Priya Nair</h4>
                    <p className="text-xs text-[#7A6F5A]">Food & Lifestyle Blogger</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          8. RESERVE BANNER SECTION (Dark Green Bottom CTA)
          ======================================================== */}
      <section className="relative bg-[#0A281B] text-[#FAF6EE] py-20 px-4 sm:px-6 lg:px-8 overflow-hidden text-center">
        {/* Subtle decorative glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(22,70,48,0.5)_0%,transparent_70%)] pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-6 relative z-10">
          <p className="font-script text-2xl sm:text-3xl text-brand-gold-400">Reserve Your Spot</p>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
            Planning a hangout? Reserve your table
          </h2>
          <p className="text-sm sm:text-base text-[#D4E2D8] max-w-2xl mx-auto leading-relaxed">
            Whether it's a date night, birthday celebration, study session, or a weekend reunion,
            we've got the best seats reserved for you.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link to="/reservation">
              <button className="bg-[#F5BD1F] hover:bg-[#e6b01a] text-[#123122] font-bold text-xs sm:text-sm uppercase tracking-wider px-8 py-3.5 rounded shadow-lg transition-all duration-200">
                BOOK YOUR TABLE
              </button>
            </Link>
            <a href={telLink()}>
              <button className="border-2 border-white/80 hover:border-brand-gold-400 text-white hover:text-brand-gold-400 font-bold text-xs sm:text-sm uppercase tracking-wider px-8 py-3 rounded hover:bg-white/5 transition-all duration-200 inline-flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>CALL US DIRECTLY</span>
              </button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
