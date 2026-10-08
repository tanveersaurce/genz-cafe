import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ShieldX, ArrowLeft } from 'lucide-react';

export const ForbiddenPage: React.FC = () => {
  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-semantic-danger-bg text-semantic-danger border border-semantic-danger/30 flex items-center justify-center mx-auto mb-4">
        <ShieldX className="h-8 w-8" />
      </div>
      <h1 className="font-sans text-h3 font-bold text-brand-green-950 mb-2">
        403 - Access Denied
      </h1>
      <p className="text-small text-brand-ink-500 mb-6 leading-relaxed">
        You do not possess the required permissions to view or manage this section.
        If you believe this is an error, please contact a cafe partner.
      </p>
      <Link to="/app/dashboard">
        <Button variant="primary" size="md" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};
