import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { GalleryItem } from '@/config/siteConfig';

interface GalleryLightboxProps {
  items: GalleryItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export const GalleryLightbox: React.FC<GalleryLightboxProps> = ({
  items,
  currentIndex,
  isOpen,
  onClose,
  onNext,
  onPrev,
}) => {
  const currentItem = items[currentIndex];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        onNext();
      } else if (e.key === 'ArrowLeft') {
        onPrev();
      }
    },
    [isOpen, onClose, onNext, onPrev]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !currentItem) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-green-950/90 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close lightbox"
        className="absolute top-5 right-5 z-50 p-2.5 rounded-full bg-brand-green-900/80 text-brand-cream-100 hover:text-brand-gold-500 hover:bg-brand-green-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-gold-500"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Prev button */}
      {items.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous image"
          className="absolute left-4 sm:left-6 z-50 p-3 rounded-full bg-brand-green-900/80 text-brand-cream-100 hover:text-brand-gold-500 hover:bg-brand-green-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-gold-500"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next button */}
      {items.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next image"
          className="absolute right-4 sm:right-6 z-50 p-3 rounded-full bg-brand-green-900/80 text-brand-cream-100 hover:text-brand-gold-500 hover:bg-brand-green-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-gold-500"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image & Caption Container */}
      <div
        className="max-w-4xl max-h-[85vh] flex flex-col items-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative rounded-card overflow-hidden shadow-card border border-brand-green-800 bg-brand-green-900 flex items-center justify-center">
          <img
            src={currentItem.src}
            alt={currentItem.alt}
            className="max-h-[70vh] w-auto object-contain rounded-card"
          />
        </div>

        {/* Caption */}
        <div className="mt-4 text-center text-brand-cream-100 space-y-1">
          <p className="font-serif text-lg font-semibold tracking-wide text-brand-gold-500">
            {currentItem.title}
          </p>
          <div className="flex items-center justify-center gap-2 text-caption text-brand-cream-100/70">
            <span className="uppercase tracking-widest">{currentItem.category}</span>
            <span>•</span>
            <span>
              {currentIndex + 1} of {items.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
