import React, { useState, useMemo } from 'react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Card } from '@/components/ui/Card';
import { SeoHead } from '@/components/common/SeoHead';
import { GalleryLightbox } from '@/components/gallery/GalleryLightbox';
import { siteConfig, GalleryItem } from '@/config/siteConfig';
import { ZoomIn } from 'lucide-react';

type CategoryFilter = 'All' | 'Food' | 'Drinks' | 'Ambience';

export const GalleryPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const filteredItems: GalleryItem[] = useMemo(() => {
    if (activeCategory === 'All') {
      return siteConfig.gallery;
    }
    return siteConfig.gallery.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    setLightboxOpen(true);
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
  };

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
  };

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <SeoHead
        title="Gallery"
        description={`Explore photo moments of ${siteConfig.name}: warm cafe ambience, handcrafted cold brews, gourmet burgers, and vibrant vibes.`}
        canonicalPath="/gallery"
      />

      <SectionHeading
        subtitle="Moments & Vibes"
        title="Photo Gallery"
        align="center"
        className="mb-4"
      />

      {/* Category Filter Pills */}
      <div className="flex justify-center flex-wrap gap-2">
        {(['All', 'Food', 'Drinks', 'Ambience'] as CategoryFilter[]).map((category) => {
          const isSelected = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`px-5 py-2 rounded-pill text-small font-semibold transition-all ${
                isSelected
                  ? 'bg-brand-green-800 text-brand-gold-500 shadow-soft scale-105'
                  : 'bg-brand-cream-200 text-brand-ink-700 hover:bg-brand-cream-300 hover:text-brand-ink-900'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {filteredItems.map((item, idx) => (
          <Card
            key={item.id}
            variant="cream"
            className="group overflow-hidden cursor-pointer hover:shadow-card transition-all duration-fast"
            onClick={() => openLightbox(idx)}
          >
            <div className="relative aspect-4/3 overflow-hidden bg-brand-cream-300">
              <img
                src={item.src}
                alt={item.alt}
                width={500}
                height={375}
                className="w-full h-full object-cover transition-transform duration-slow group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-brand-green-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-brand-gold-400">
                <div className="p-3 rounded-full bg-brand-green-950/80 backdrop-blur">
                  <ZoomIn className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-gold-600">
                {item.category}
              </span>
              <h3 className="font-serif text-body font-bold text-brand-green-950 group-hover:text-brand-gold-600 transition-colors">
                {item.title}
              </h3>
            </div>
          </Card>
        ))}
      </div>

      {/* Lightbox Modal */}
      <GalleryLightbox
        items={filteredItems}
        currentIndex={selectedIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNext={handleNext}
        onPrev={handlePrev}
      />
    </div>
  );
};
