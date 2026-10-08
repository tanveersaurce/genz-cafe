import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Coffee, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-content mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
      <div className="h-20 w-20 rounded-full bg-brand-cream-300 text-brand-green-800 flex items-center justify-center mb-6 shadow-soft">
        <Coffee className="h-10 w-10" />
      </div>
      <span className="font-script text-3xl text-brand-gold-500 font-semibold mb-2">
        Oops! Page not found
      </span>
      <h1 className="font-serif text-h1 font-bold text-brand-green-950 mb-4">
        404 - Spilled Coffee
      </h1>
      <p className="text-body text-brand-ink-500 max-w-md mb-8 leading-relaxed">
        We couldn't find the page you were looking for. It might have been moved or doesn't exist
        anymore.
      </p>
      <Link to="/">
        <Button variant="primary" size="lg" leftIcon={<Home className="h-5 w-5" />}>
          Back to Homepage
        </Button>
      </Link>
    </div>
  );
};
