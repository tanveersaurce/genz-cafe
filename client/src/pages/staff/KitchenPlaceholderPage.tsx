import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ChefHat, Flame } from 'lucide-react';

export const KitchenPlaceholderPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-semibold text-brand-green-950 font-sans">
            Kitchen Display System (KDS)
          </h1>
          <p className="text-small text-brand-ink-500 font-sans mt-0.5">
            Real-time kitchen order preparation display.
          </p>
        </div>
        <Badge variant="green" size="md">
          Phase 2 Target
        </Badge>
      </div>

      <Card variant="white">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-cream-300 flex items-center justify-center text-brand-green-800">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-sans text-h3">Kitchen Master Terminal</CardTitle>
              <p className="text-small text-brand-ink-500">Authorized for Kitchen and Partner roles.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-8 rounded-card-sm bg-brand-cream-50 border border-brand-cream-300 text-center space-y-3">
            <Flame className="h-8 w-8 text-semantic-danger mx-auto" />
            <h3 className="font-semibold text-body text-brand-green-900">
              Live Cooking Station Tickets
            </h3>
            <p className="text-small text-brand-ink-500 max-w-md mx-auto">
              Kitchen staff authentication verified. Live WebSocket ticket dispatching is prepared for Phase 2.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
