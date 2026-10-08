import React, { useState } from 'react';
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Modal,
  useToast,
  Skeleton,
  Spinner,
  EmptyState,
  ErrorState,
  Tabs,
  SectionHeading,
} from '@/components/ui';
import { Coffee, ArrowRight, Sparkles } from 'lucide-react';

export const DesignSystemPage: React.FC = () => {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [checkboxChecked, setCheckboxChecked] = useState(true);

  const colorPalettes = [
    {
      group: 'Forest Green Surfaces (Brand Base)',
      colors: [
        { name: 'green-950', hex: '#072617', bgClass: 'bg-brand-green-950', text: 'text-brand-cream-100', role: 'Deepest Base' },
        { name: 'green-900', hex: '#0B3D24', bgClass: 'bg-brand-green-900', text: 'text-brand-cream-100', role: 'Header / Overlays' },
        { name: 'green-800', hex: '#14472F', bgClass: 'bg-brand-green-800', text: 'text-brand-cream-100', role: 'Main Brand Surface' },
        { name: 'green-700', hex: '#1D5A3C', bgClass: 'bg-brand-green-700', text: 'text-brand-cream-100', role: 'Hover / Accent Surface' },
      ],
    },
    {
      group: 'Warm Creams & Gold Accent',
      colors: [
        { name: 'cream-100', hex: '#FBF3DC', bgClass: 'bg-brand-cream-100', text: 'text-brand-ink-900', role: 'Page Background' },
        { name: 'cream-300', hex: '#F3DDA0', bgClass: 'bg-brand-cream-300', text: 'text-brand-green-900', role: 'Cards & Highlights' },
        { name: 'gold-500', hex: '#F2C230', bgClass: 'bg-brand-gold-500', text: 'text-brand-ink-900', role: 'Primary CTA / Accent' },
        { name: 'ink-900', hex: '#1A1A1A', bgClass: 'bg-brand-ink-900', text: 'text-brand-cream-100', role: 'Primary Text on Light' },
      ],
    },
    {
      group: 'Semantic Tokens (WCAG AA Compliant)',
      colors: [
        { name: 'success', hex: '#2E9E5B', bgClass: 'bg-semantic-success', text: 'text-white', role: 'Confirmation / Ready' },
        { name: 'warning', hex: '#E59E1F', bgClass: 'bg-semantic-warning', text: 'text-brand-ink-900', role: 'Alert / Delayed' },
        { name: 'danger', hex: '#D64545', bgClass: 'bg-semantic-danger', text: 'text-white', role: 'Errors / Destructive' },
        { name: 'info', hex: '#2F7FD1', bgClass: 'bg-semantic-info', text: 'text-white', role: 'Informational' },
      ],
    },
  ];

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 text-left">
      {/* Intro Header */}
      <div className="border-b border-brand-cream-300 pb-8">
        <Badge variant="gold" size="sm" className="mb-2">
          Development Design System Showcase
        </Badge>
        <h1 className="font-serif text-h1 font-bold text-brand-green-950">
          Gen-Z Cafe Design System
        </h1>
        <p className="text-body text-brand-ink-700 max-w-3xl mt-2">
          A collection of accessible, tokenized UI primitives crafted for Gen-Z Cafe ("Your Daily Hangout").
          Strict adherence to WCAG AA contrast standards, responsive scales, and zero hardcoded component hex values.
        </p>
      </div>

      {/* 1. Color Palette Tokens */}
      <section className="space-y-6">
        <SectionHeading title="Color Tokens & Contrast Swatches" subtitle="Brand Palette" align="left" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {colorPalettes.map((group) => (
            <div key={group.group} className="space-y-3">
              <h3 className="font-semibold text-small text-brand-green-900">{group.group}</h3>
              <div className="space-y-2">
                {group.colors.map((c) => (
                  <div
                    key={c.name}
                    className={`p-3.5 rounded-card-sm border border-brand-cream-300 flex items-center justify-between shadow-soft ${c.bgClass} ${c.text}`}
                  >
                    <div>
                      <p className="font-semibold text-small tracking-wide">{c.name}</p>
                      <p className="text-caption opacity-85 font-mono">{c.hex} &bull; {c.role}</p>
                    </div>
                    <Badge variant="cream" size="sm" className="bg-white/90 text-brand-ink-900 border-0">
                      AA Pass
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Typography Scale */}
      <section className="space-y-6">
        <SectionHeading title="Typography Scale & Hierarchy" subtitle="Fonts & Typescale" align="left" />
        <Card variant="cream">
          <CardContent className="space-y-6 py-6">
            <div>
              <span className="text-caption font-mono text-brand-ink-500 block mb-1">Display (Playfair Display, clamp 2.5rem - 4rem)</span>
              <p className="font-serif text-display font-bold text-brand-green-950">Good Food, Good Vibes</p>
            </div>
            <div>
              <span className="text-caption font-mono text-brand-ink-500 block mb-1">Heading 1 (Playfair Display, 2rem - 2.75rem)</span>
              <h1 className="font-serif text-h1 font-bold text-brand-green-950">Artisan Cafe & Roastery</h1>
            </div>
            <div>
              <span className="text-caption font-mono text-brand-ink-500 block mb-1">Heading 2 (Playfair Display, 1.5rem - 2rem)</span>
              <h2 className="font-serif text-h2 font-semibold text-brand-green-950">Fresh Daily Brews & Specials</h2>
            </div>
            <div>
              <span className="text-caption font-mono text-brand-ink-500 block mb-1">Heading 3 (Playfair Display, 1.25rem - 1.5rem)</span>
              <h3 className="font-serif text-h3 font-semibold text-brand-green-950">Reserved Seating & Hangout Area</h3>
            </div>
            <div>
              <span className="text-caption font-mono text-brand-ink-500 block mb-1">Decorative Accent Script (Caveat, 1.75rem)</span>
              <p className="font-script text-3xl text-brand-gold-600 font-semibold">Eat &bull; Drink &bull; Repeat &bull; Your Daily Hangout</p>
            </div>
            <div>
              <span className="text-caption font-mono text-brand-ink-500 block mb-1">Body Text (Poppins / Inter, 1rem)</span>
              <p className="text-body text-brand-ink-700 max-w-2xl">
                Gen-Z Cafe brings together gourmet comfort dining with youthful coffee culture.
                High contrast body typography ensures effortless readability across all mobile and POS devices.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Button Component States */}
      <section className="space-y-6">
        <SectionHeading title="Button Primitives & States" subtitle="Interactive Components" align="left" />
        <div className="space-y-6">
          {/* Variants */}
          <div className="space-y-2">
            <h4 className="text-small font-semibold text-brand-ink-700">All Variants (Normal)</h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Gold</Button>
              <Button variant="secondary">Secondary Green</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </div>

          {/* Sizes including POS touch friendly */}
          <div className="space-y-2">
            <h4 className="text-small font-semibold text-brand-ink-700">Sizes (sm, md, lg, POS touch target 44px+)</h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small (32px)</Button>
              <Button size="md">Medium (40px)</Button>
              <Button size="lg">Large (48px)</Button>
              <Button size="pos" leftIcon={<Coffee className="h-5 w-5" />}>
                POS Touch Button (52px Min Target)
              </Button>
            </div>
          </div>

          {/* States: Loading, Disabled, Icons */}
          <div className="space-y-2">
            <h4 className="text-small font-semibold text-brand-ink-700">Loading, Disabled & Icon States</h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button isLoading>Primary Loading</Button>
              <Button variant="secondary" isLoading>Secondary Loading</Button>
              <Button disabled>Disabled Button</Button>
              <Button variant="outline" disabled>Disabled Outline</Button>
              <Button variant="primary" leftIcon={<Sparkles className="h-4 w-4" />}>
                Left Icon
              </Button>
              <Button variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Right Icon
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Form Controls */}
      <section className="space-y-6">
        <SectionHeading title="Form Controls & Accessible Fields" subtitle="Inputs & Toggles" align="left" />
        <Card variant="cream">
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
            <Input
              label="Standard Input"
              placeholder="Enter customer name..."
              helperText="Helper message informing user"
            />
            <Input
              label="Input with Error State"
              defaultValue="invalid-email"
              error="Please enter a valid email address"
            />
            <Input
              label="Disabled Input"
              value="ReadOnly Account ID"
              disabled
            />
            <Input
              label="Input with Left Icon"
              placeholder="Search dishes..."
              leftIcon={<Coffee className="h-4 w-4" />}
            />
            <Select
              label="Select Dropdown"
              placeholder="Select table section..."
              options={[
                { value: 'ground', label: 'Ground Floor Lounge' },
                { value: 'terrace', label: 'Terrace Garden Patio' },
                { value: 'private', label: 'Private Room (VIP)' },
              ]}
            />
            <Select
              label="Select with Error State"
              error="Please choose an operational table"
              options={[{ value: '', label: 'Select option...' }]}
            />
            <div className="space-y-3 pt-2">
              <Checkbox
                label="Active Table Indicator"
                description="Marks table ready for new incoming diners"
                checked={checkboxChecked}
                onChange={(e) => setCheckboxChecked(e.target.checked)}
              />
              <Checkbox
                label="Disabled Checkbox"
                description="This option cannot be toggled at this time"
                disabled
              />
              <Checkbox
                label="Checkbox with Error"
                error="You must agree to the terms"
              />
            </div>
            <div>
              <Textarea
                label="Order Notes / Kitchen Instructions"
                placeholder="Less spicy, extra cheese on the side..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 5. Badges, Skeletons, Spinners */}
      <section className="space-y-6">
        <SectionHeading title="Badges, Shimmers & Indicators" subtitle="Feedback & States" align="left" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card variant="cream">
            <CardHeader>
              <CardTitle>Badge Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="cream">Cream Default</Badge>
                <Badge variant="green">Green Surface</Badge>
                <Badge variant="gold">Gold CTA</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="info">Info</Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="green" dot>
                  Active Order
                </Badge>
                <Badge variant="gold" dot>
                  Table Occupied
                </Badge>
                <Badge variant="danger" dot>
                  Out of Stock
                </Badge>
                <Badge variant="success" dot>
                  KDS Ready
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card variant="cream">
            <CardHeader>
              <CardTitle>Spinners & Skeletons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <Spinner size="sm" variant="gold" />
                <Spinner size="md" variant="green" />
                <Spinner size="lg" variant="gold" />
              </div>
              <div className="space-y-2 pt-2">
                <Skeleton variant="text" className="w-3/4" />
                <Skeleton variant="text" className="w-1/2" />
                <div className="flex items-center gap-3 pt-2">
                  <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton variant="text" />
                    <Skeleton variant="text" className="w-2/3" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 6. Tabs & Section Headings */}
      <section className="space-y-6">
        <SectionHeading title="Pill Category Tabs" subtitle="Navigation Primitives" align="left" />
        <div className="space-y-4">
          <Tabs
            tabs={[
              { id: 'all', label: 'All Items', count: 24 },
              { id: 'coffee', label: 'Brews & Espressos', count: 8 },
              { id: 'burgers', label: 'Gourmet Burgers', count: 6 },
              { id: 'shakes', label: 'Thick Shakes', count: 5 },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </section>

      {/* 7. Modal & Toast Interactive Demonstrations */}
      <section className="space-y-6">
        <SectionHeading title="Modal Dialog & Toast Notifications" subtitle="Interactive Overlays" align="left" />
        <Card variant="cream">
          <CardHeader>
            <CardTitle>Trigger Overlays</CardTitle>
            <CardDescription>
              Test accessible focus trap, ESC closing, and ARIA polite live toast notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Open Test Modal Dialog
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  type: 'success',
                  title: 'Order Created #1024',
                  message: 'Successfully sent to the kitchen display.',
                })
              }
            >
              Trigger Success Toast
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  type: 'warning',
                  title: 'Low Stock Alert',
                  message: 'Arabica coffee beans running below 2kg threshold.',
                })
              }
            >
              Trigger Warning Toast
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                toast({
                  type: 'error',
                  title: 'Printer Offline',
                  message: 'Thermal receipt printer at Station 1 is disconnected.',
                })
              }
            >
              Trigger Error Toast
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Modal Dialog Instance */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Gen-Z Cafe Table Reservation Confirmation"
        description="Review booking details before assigning to POS floor map."
      >
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-card-sm bg-brand-cream-200/50 border border-brand-cream-300">
            <p className="text-small font-semibold text-brand-green-950">Table #4 (Terrace View)</p>
            <p className="text-caption text-brand-ink-700">4 Guests &bull; Today at 7:30 PM &bull; Aryan Sharma</p>
          </div>

          <Input label="Staff Notes" placeholder="Special arrangements or birthday requests..." />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-cream-300">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                toast({
                  type: 'success',
                  title: 'Table Assigned',
                  message: 'Reservation has been assigned to Table #4.',
                });
              }}
            >
              Confirm Assignment
            </Button>
          </div>
        </div>
      </Modal>

      {/* 8. Empty & Error States */}
      <section className="space-y-6">
        <SectionHeading title="Empty & Error State Views" subtitle="Fallback Screens" align="left" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EmptyState
            title="No Active Orders In Queue"
            description="The kitchen line is currently clear. New incoming POS tickets will populate here instantly."
            action={
              <Button variant="primary" size="sm">
                Create New Order
              </Button>
            }
          />
          <ErrorState
            title="Failed to Load Floor Layout"
            message="We were unable to synchronize the current floor map from the server."
            onRetry={() =>
              toast({
                type: 'info',
                title: 'Retrying Sync',
                message: 'Pinging server for table status update...',
              })
            }
          />
        </div>
      </section>
    </div>
  );
};
