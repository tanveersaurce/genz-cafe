import React, { useState } from 'react';
import {
  Clock,
  Users,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Share2,
  CalendarPlus,
  ArrowRight,
  ArrowLeft,
  Search,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { SeoHead } from '@/components/common/SeoHead';
import { OpenNowBadge } from '@/components/common/OpenNowBadge';
import {
  siteConfig,
  telLink,
} from '@/config/siteConfig';
import { formatTime12h } from '@/lib/timeUtils';
import { downloadIcsCalendar } from '@/lib/calendarUtils';
import { apiClient, ApiClientError } from '@/lib/apiClient';

interface SlotInfo {
  time: string;
  isAvailable: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

interface ReservationResult {
  code: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  customerName: string;
  phoneMasked: string;
  guests: number;
  date: string;
  time: string;
  assignedTables?: Array<{ tableNumber: number; label: string; zone: string }>;
  occasion?: string;
  specialRequest?: string;
  expiresAt?: string;
}

const OCCASIONS = [
  { value: '', label: 'Select occasion (optional)' },
  { value: 'casual', label: 'Casual Hangout' },
  { value: 'birthday', label: 'Birthday Celebration 🎂' },
  { value: 'anniversary', label: 'Anniversary 💖' },
  { value: 'date', label: 'Date Night 🕯️' },
  { value: 'family', label: 'Family Gathering 👨‍👩‍👧‍👦' },
  { value: 'business', label: 'Business / Work Meeting 💼' },
  { value: 'other', label: 'Other Special Occasion ✨' },
];

function getISTDate(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays > 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

export const ReservationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'book' | 'lookup'>('book');

  // Booking Stepper State (Steps 1 to 4)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [date, setDate] = useState<string>(getISTDate(0));
  const [guests, setGuests] = useState<number>(2);
  const [selectedTime, setSelectedTime] = useState<string>('');

  const [customerName, setCustomerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [occasion, setOccasion] = useState<string>('');
  const [specialRequest, setSpecialRequest] = useState<string>('');
  const [honeypot, setHoneypot] = useState<string>('');

  // Availability State
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdReservation, setCreatedReservation] = useState<ReservationResult | null>(null);

  // Lookup / Cancel State
  const [lookupCode, setLookupCode] = useState<string>('');
  const [lookupPhone, setLookupPhone] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookedUpReservation, setLookedUpReservation] = useState<ReservationResult | null>(null);

  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  const todayStr = getISTDate(0);
  const maxDateStr = getISTDate(30);

  // Fetch slots whenever step 2 is entered or date/guests change
  const fetchAvailability = async (targetDate: string, targetGuests: number) => {
    setIsLoadingSlots(true);
    setSlotsError(null);
    try {
      const response = await apiClient.get<{ success: boolean; data: { slots: SlotInfo[] } }>(
        `/public/reservations/availability?date=${targetDate}&guests=${targetGuests}`
      );
      setSlots(response.data.slots || []);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Could not check slot availability.';
      setSlotsError(msg);
      setSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleStep1Next = () => {
    if (!date) return;
    fetchAvailability(date, guests);
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (!selectedTime) return;
    setCurrentStep(3);
  };

  const handleStep3Next = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!customerName.trim() || customerName.trim().length < 2) {
      setSubmitError('Please enter a valid name (at least 2 characters).');
      return;
    }
    if (cleanPhone.length < 10) {
      setSubmitError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setSubmitError(null);
    setCurrentStep(4);
  };

  const handleConfirmBooking = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const idempotencyKey = crypto.randomUUID();
      const payload = {
        customerName: customerName.trim(),
        phone: phone.trim(),
        guests,
        date,
        time: selectedTime,
        occasion: occasion || undefined,
        specialRequest: specialRequest.trim() || undefined,
        email: email.trim() || undefined,
        idempotencyKey,
        honeypot: honeypot || undefined,
      };

      const response = await apiClient.post<{ success: boolean; data: ReservationResult }>(
        '/public/reservations',
        payload
      );

      setCreatedReservation(response.data);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Reservation could not be submitted. Please try again.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupCode.trim() || !lookupPhone.trim()) {
      setLookupError('Please enter both booking code and mobile number.');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setLookedUpReservation(null);
    setCancelSuccessMsg(null);
    setCancelError(null);

    try {
      const res = await apiClient.post<{ success: boolean; data: { reservation: ReservationResult } }>(
        '/public/reservations/lookup',
        {
          code: lookupCode.trim().toUpperCase(),
          phone: lookupPhone.trim(),
        }
      );
      setLookedUpReservation(res.data.reservation);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'No booking found matching these details.';
      setLookupError(msg);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!lookedUpReservation) return;
    setIsCancelling(true);
    setCancelError(null);

    try {
      await apiClient.post('/public/reservations/cancel', {
        code: lookedUpReservation.code,
        phone: lookupPhone.trim(),
        reason: cancelReason.trim() || 'Cancelled online by customer',
      });
      setCancelSuccessMsg('Your reservation has been successfully cancelled.');
      setLookedUpReservation({
        ...lookedUpReservation,
        status: 'cancelled',
      });
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : 'Cancellation failed. Bookings can only be cancelled up to 2 hours before the start time.';
      setCancelError(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const resetBookingForm = () => {
    setCreatedReservation(null);
    setCurrentStep(1);
    setSelectedTime('');
    setCustomerName('');
    setPhone('');
    setEmail('');
    setOccasion('');
    setSpecialRequest('');
    setSubmitError(null);
  };

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <SeoHead
        title="Table Reservations"
        description={`Reserve your table at ${siteConfig.name}. Instant confirmation for groups up to 6, custom seating, birthday celebrations, and cozy cafe vibes.`}
        canonicalPath="/reservation"
      />

      {/* Header Section */}
      <div className="text-center space-y-3">
        <SectionHeading
          subtitle="Your Daily Hangout"
          title="Reserve a Table"
          align="center"
          className="mb-1"
        />
        <div className="flex justify-center items-center gap-3">
          <OpenNowBadge size="md" />
          <span className="text-caption text-brand-ink-400">|</span>
          <span className="text-caption text-brand-ink-600 font-medium">Daily 10:00 AM – 11:00 PM IST</span>
        </div>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-card p-1 bg-brand-surface-card border border-brand-cream-300 shadow-soft">
          <button
            type="button"
            onClick={() => setActiveTab('book')}
            className={`px-5 py-2 rounded-button text-sm font-semibold transition-all ${
              activeTab === 'book'
                ? 'bg-brand-green-800 text-brand-cream-100 shadow-sm'
                : 'text-brand-ink-600 hover:text-brand-green-900'
            }`}
          >
            Book a Table
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lookup')}
            className={`px-5 py-2 rounded-button text-sm font-semibold transition-all ${
              activeTab === 'lookup'
                ? 'bg-brand-green-800 text-brand-cream-100 shadow-sm'
                : 'text-brand-ink-600 hover:text-brand-green-900'
            }`}
          >
            Find / Cancel Booking
          </button>
        </div>
      </div>

      {/* MODE 1: BOOK A TABLE */}
      {activeTab === 'book' && (
        <div className="max-w-2xl mx-auto space-y-8">
          {/* SUCCESS SCREEN */}
          {createdReservation ? (
            <Card variant="cream" className="border-brand-gold-500/60 shadow-card">
              <CardContent className="p-8 text-center space-y-6">
                <div className="h-16 w-16 mx-auto rounded-full bg-brand-green-800 text-brand-gold-400 flex items-center justify-center shadow-soft">
                  <CheckCircle2 className="h-9 w-9" />
                </div>

                <div className="space-y-2">
                  <Badge
                    variant={createdReservation.status === 'confirmed' ? 'success' : 'warning'}
                    className="text-xs uppercase px-3 py-1 font-bold"
                  >
                    {createdReservation.status === 'confirmed' ? 'Booking Confirmed' : 'Request Received'}
                  </Badge>

                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-brand-green-950">
                    {createdReservation.status === 'confirmed'
                      ? 'Your Table is Reserved!'
                      : 'We Received Your Group Request!'}
                  </h3>

                  <p className="text-body text-brand-ink-600 max-w-md mx-auto">
                    {createdReservation.status === 'confirmed'
                      ? 'We look forward to hosting you at Gen-Z Cafe. Please arrive within 15 minutes of your booking slot.'
                      : 'For groups larger than 6, our manager confirms seating shortly. We will reach out on your mobile number.'}
                  </p>
                </div>

                {/* Booking Code Banner */}
                <div className="bg-brand-surface-card p-5 rounded-card border border-brand-gold-400/50 shadow-soft max-w-sm mx-auto">
                  <span className="text-caption text-brand-ink-400 uppercase tracking-wider block font-medium">
                    Booking Reference Code
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold text-brand-green-900 tracking-widest">
                    {createdReservation.code}
                  </span>
                  <span className="text-caption text-brand-ink-500 block mt-1">
                    Save this code to check in or modify your reservation.
                  </span>
                </div>

                {/* Reservation Summary Details */}
                <div className="bg-white/80 p-5 rounded-card border border-brand-cream-300 text-left space-y-2.5 max-w-md mx-auto">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-ink-500">Name</span>
                    <span className="font-semibold text-brand-green-950">{createdReservation.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-ink-500">Date</span>
                    <span className="font-semibold text-brand-green-950">{createdReservation.date}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-ink-500">Time</span>
                    <span className="font-semibold text-brand-green-950">{formatTime12h(createdReservation.time)} IST</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-ink-500">Guests</span>
                    <span className="font-semibold text-brand-green-950">{createdReservation.guests} People</span>
                  </div>
                  {createdReservation.assignedTables && createdReservation.assignedTables.length > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-brand-ink-500">Table</span>
                      <span className="font-semibold text-brand-green-950">
                        {createdReservation.assignedTables.map((t) => t.label || `Table ${t.tableNumber}`).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action CTAs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto pt-2">
                  <Button
                    variant="outline"
                    className="w-full justify-center gap-2"
                    onClick={() =>
                      downloadIcsCalendar({
                        code: createdReservation.code,
                        customerName: createdReservation.customerName,
                        guests: createdReservation.guests,
                        dateStr: createdReservation.date,
                        timeStr: createdReservation.time,
                      })
                    }
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Add to Calendar
                  </Button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hey! I just booked a table at ${siteConfig.name} for ${createdReservation.guests} people on ${createdReservation.date} at ${formatTime12h(createdReservation.time)}. Booking code: ${createdReservation.code}. See you there!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="w-full justify-center gap-2">
                      <Share2 className="h-4 w-4" />
                      Share Details
                    </Button>
                  </a>
                </div>

                <div className="pt-4 border-t border-brand-cream-300">
                  <Button variant="ghost" size="sm" onClick={resetBookingForm}>
                    Book Another Table
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* STEPPER FORM */
            <Card variant="cream" className="shadow-card border-brand-cream-300">
              {/* Stepper Header Indicator */}
              <div className="border-b border-brand-cream-300 px-6 py-4 bg-brand-cream-100/60">
                <div className="flex items-center justify-between">
                  {[
                    { step: 1, label: 'Date & Guests' },
                    { step: 2, label: 'Select Slot' },
                    { step: 3, label: 'Details' },
                    { step: 4, label: 'Review' },
                  ].map((s) => (
                    <div key={s.step} className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          currentStep === s.step
                            ? 'bg-brand-green-800 text-brand-gold-400 ring-2 ring-brand-gold-500'
                            : currentStep > s.step
                              ? 'bg-brand-green-900 text-white'
                              : 'bg-brand-cream-200 text-brand-ink-400'
                        }`}
                      >
                        {currentStep > s.step ? '✓' : s.step}
                      </div>
                      <span
                        className={`text-xs hidden sm:inline font-medium ${
                          currentStep === s.step ? 'text-brand-green-950 font-bold' : 'text-brand-ink-500'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <CardContent className="p-6 sm:p-8 space-y-6">
                {submitError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-card flex items-start gap-2.5 text-sm text-red-700">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* STEP 1: DATE & GUESTS */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-serif text-lg font-bold text-brand-green-950 mb-1">
                        1. Choose Date & Number of Guests
                      </h4>
                      <p className="text-sm text-brand-ink-500">
                        Bookings are open up to 30 days in advance. Free table hold for 15 minutes.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Date Picker */}
                      <div>
                        <label htmlFor="booking-date" className="block text-sm font-semibold text-brand-green-950 mb-1.5">
                          Date
                        </label>
                        <Input
                          id="booking-date"
                          type="date"
                          value={date}
                          min={todayStr}
                          max={maxDateStr}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full bg-white"
                        />
                      </div>

                      {/* Guest Count Stepper */}
                      <div>
                        <label className="block text-sm font-semibold text-brand-green-950 mb-1.5">
                          Party Size ({guests} {guests === 1 ? 'Guest' : 'Guests'})
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setGuests(num)}
                              className={`px-3.5 py-2 rounded-button text-sm font-medium transition-all ${
                                guests === num
                                  ? 'bg-brand-green-800 text-brand-gold-400 font-bold shadow-soft ring-1 ring-brand-gold-500'
                                  : 'bg-white border border-brand-cream-300 text-brand-ink-700 hover:border-brand-green-700'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                        {guests > 6 && (
                          <p className="text-xs text-amber-700 mt-2 bg-amber-50 p-2.5 rounded-button border border-amber-200">
                            Note: Parties of more than 6 guests are subject to host manager review to ensure optimal group arrangement.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button onClick={handleStep1Next} className="gap-2">
                        Find Slots <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 2: TIME SLOTS */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-serif text-lg font-bold text-brand-green-950 mb-1">
                        2. Select Time Slot
                      </h4>
                      <p className="text-sm text-brand-ink-500">
                        {date} for {guests} {guests === 1 ? 'guest' : 'guests'}. Slots are 30 mins interval with 90 mins stay duration.
                      </p>
                    </div>

                    {isLoadingSlots ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-3">
                        <Spinner size="lg" variant="gold" />
                        <span className="text-sm text-brand-ink-500">Checking table availability...</span>
                      </div>
                    ) : slotsError ? (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-card text-center space-y-3">
                        <p className="text-sm text-red-700">{slotsError}</p>
                        <Button size="sm" variant="outline" onClick={() => fetchAvailability(date, guests)}>
                          Retry
                        </Button>
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="p-6 bg-brand-cream-100 rounded-card text-center space-y-2">
                        <AlertCircle className="h-8 w-8 text-brand-ink-400 mx-auto" />
                        <p className="text-sm font-semibold text-brand-ink-700">
                          No booking slots available for this date and party size.
                        </p>
                        <p className="text-xs text-brand-ink-500">
                          The cafe may be fully booked or closed. Please pick another date or contact our team directly.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-80 overflow-y-auto p-1">
                        {slots.map((s) => {
                          const isSelected = selectedTime === s.time;
                          return (
                            <button
                              key={s.time}
                              type="button"
                              disabled={!s.isAvailable}
                              onClick={() => setSelectedTime(s.time)}
                              className={`p-2.5 rounded-card text-xs font-medium border text-center transition-all ${
                                !s.isAvailable
                                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed line-through'
                                  : isSelected
                                    ? 'bg-brand-green-800 border-brand-gold-500 text-brand-gold-400 font-bold shadow-soft ring-1 ring-brand-gold-500'
                                    : 'bg-white border-brand-cream-300 text-brand-green-950 hover:border-brand-green-700 hover:bg-brand-cream-50'
                              }`}
                            >
                              <div className="font-semibold text-sm">{formatTime12h(s.time)}</div>
                              <div className="text-[10px] mt-0.5">
                                {!s.isAvailable
                                  ? s.reason || 'Full'
                                  : s.requiresConfirmation
                                    ? 'Request'
                                    : 'Available'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-4 flex justify-between items-center">
                      <Button variant="ghost" onClick={() => setCurrentStep(1)} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button disabled={!selectedTime} onClick={handleStep2Next} className="gap-2">
                        Continue <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 3: DETAILS FORM */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-serif text-lg font-bold text-brand-green-950 mb-1">
                        3. Contact Details & Preferences
                      </h4>
                      <p className="text-sm text-brand-ink-500">
                        We send your instant booking confirmation and updates to this number.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Name */}
                      <div>
                        <label htmlFor="customerName" className="block text-sm font-semibold text-brand-green-950 mb-1">
                          Full Name *
                        </label>
                        <Input
                          id="customerName"
                          placeholder="e.g. Rahul Sharma"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="bg-white"
                          required
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label htmlFor="phone" className="block text-sm font-semibold text-brand-green-950 mb-1">
                          Mobile Number * (10 Digits)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-ink-500 font-medium">
                            +91
                          </span>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="9876543210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="bg-white pl-12"
                            required
                          />
                        </div>
                      </div>

                      {/* Email (Optional) */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-brand-green-950 mb-1">
                          Email Address (Optional)
                        </label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-white"
                        />
                      </div>

                      {/* Occasion */}
                      <div>
                        <label htmlFor="occasion" className="block text-sm font-semibold text-brand-green-950 mb-1">
                          Occasion
                        </label>
                        <Select
                          id="occasion"
                          options={OCCASIONS}
                          value={occasion}
                          onChange={(e) => setOccasion(e.target.value)}
                          className="bg-white"
                        />
                      </div>

                      {/* Special Requests */}
                      <div>
                        <label htmlFor="specialRequest" className="block text-sm font-semibold text-brand-green-950 mb-1">
                          Special Requests or Dietary Notes (Optional)
                        </label>
                        <Textarea
                          id="specialRequest"
                          rows={2}
                          maxLength={300}
                          placeholder="Window seat preference, birthday cake arrangement, high chair needed, etc."
                          value={specialRequest}
                          onChange={(e) => setSpecialRequest(e.target.value)}
                          className="bg-white"
                        />
                        <span className="text-[11px] text-brand-ink-400 block text-right">
                          {specialRequest.length}/300
                        </span>
                      </div>

                      {/* Hidden Honeypot Field */}
                      <input
                        type="text"
                        name="honeypot"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        className="hidden"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <Button variant="ghost" onClick={() => setCurrentStep(2)} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button onClick={handleStep3Next} className="gap-2">
                        Review Reservation <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 4: REVIEW & CONFIRM */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-serif text-lg font-bold text-brand-green-950 mb-1">
                        4. Review & Confirm
                      </h4>
                      <p className="text-sm text-brand-ink-500">
                        Please review your reservation details before submitting.
                      </p>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-brand-surface-card p-5 rounded-card border border-brand-cream-300 space-y-3">
                      <div className="flex justify-between items-center border-b border-brand-cream-200 pb-2 text-sm">
                        <span className="text-brand-ink-500">Date & Time</span>
                        <span className="font-bold text-brand-green-950">
                          {date} at {formatTime12h(selectedTime)} IST
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-brand-cream-200 pb-2 text-sm">
                        <span className="text-brand-ink-500">Party Size</span>
                        <span className="font-bold text-brand-green-950">{guests} Guests</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-brand-cream-200 pb-2 text-sm">
                        <span className="text-brand-ink-500">Reserved For</span>
                        <span className="font-semibold text-brand-green-950">{customerName}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-brand-cream-200 pb-2 text-sm">
                        <span className="text-brand-ink-500">Mobile</span>
                        <span className="font-semibold text-brand-green-950">+91 {phone}</span>
                      </div>
                      {occasion && (
                        <div className="flex justify-between items-center border-b border-brand-cream-200 pb-2 text-sm">
                          <span className="text-brand-ink-500">Occasion</span>
                          <span className="font-semibold text-brand-green-950 capitalize">{occasion}</span>
                        </div>
                      )}
                      {specialRequest && (
                        <div className="text-sm pt-1">
                          <span className="text-brand-ink-500 block mb-1">Note:</span>
                          <span className="text-brand-ink-700 italic bg-white p-2 rounded block border border-brand-cream-200">
                            {specialRequest}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Confirmation Notice */}
                    <div className="p-3.5 bg-brand-cream-100 rounded-card border border-brand-gold-500/30 text-xs text-brand-ink-600 space-y-1">
                      <div className="font-semibold text-brand-green-950 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-brand-gold-600" />
                        {guests <= 6 ? 'Instant Confirmation Policy' : 'Group Request Policy'}
                      </div>
                      <p>
                        {guests <= 6
                          ? 'Your table will be automatically locked and confirmed instantly.'
                          : 'Parties larger than 6 guests will be verified by our host manager within 2 hours.'}
                      </p>
                      <p className="text-brand-ink-500 pt-1">
                        Free cancellation is allowed up to 2 hours before your booking time.
                      </p>
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <Button variant="ghost" onClick={() => setCurrentStep(3)} className="gap-1.5" disabled={isSubmitting}>
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button
                        onClick={handleConfirmBooking}
                        disabled={isSubmitting}
                        className="gap-2 bg-brand-green-800 text-brand-gold-400 hover:bg-brand-green-900"
                      >
                        {isSubmitting ? (
                          <>
                            <Spinner size="sm" variant="gold" />
                            <span>Locking Table...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Confirm Reservation</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* MODE 2: FIND / CANCEL BOOKING */}
      {activeTab === 'lookup' && (
        <div className="max-w-xl mx-auto space-y-6">
          <Card variant="cream" className="shadow-card border-brand-cream-300">
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-serif text-xl font-bold text-brand-green-950">
                Find or Manage Your Reservation
              </CardTitle>
              <p className="text-sm text-brand-ink-500">
                Enter your booking reference code (e.g. GZ-7K3M9P) and registered mobile number.
              </p>
            </CardHeader>

            <CardContent className="space-y-6 pt-2">
              <form onSubmit={handleLookup} className="space-y-4">
                <div>
                  <label htmlFor="lookupCode" className="block text-sm font-semibold text-brand-green-950 mb-1">
                    Booking Code *
                  </label>
                  <Input
                    id="lookupCode"
                    placeholder="GZ-XXXXXX"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                    className="font-mono uppercase bg-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="lookupPhone" className="block text-sm font-semibold text-brand-green-950 mb-1">
                    Mobile Number *
                  </label>
                  <Input
                    id="lookupPhone"
                    type="tel"
                    placeholder="9876543210"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    className="bg-white"
                    required
                  />
                </div>

                {lookupError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-card flex items-center gap-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span>{lookupError}</span>
                  </div>
                )}

                <Button type="submit" disabled={isLookingUp} className="w-full justify-center gap-2">
                  {isLookingUp ? <Spinner size="sm" variant="gold" /> : <Search className="h-4 w-4" />}
                  <span>Search Booking</span>
                </Button>
              </form>

              {/* Looked Up Details */}
              {lookedUpReservation && (
                <div className="mt-6 pt-6 border-t border-brand-cream-300 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-brand-ink-400 font-medium block">REFERENCE CODE</span>
                      <span className="font-mono font-bold text-lg text-brand-green-900">
                        {lookedUpReservation.code}
                      </span>
                    </div>
                    <Badge
                      variant={
                        lookedUpReservation.status === 'confirmed'
                          ? 'success'
                          : lookedUpReservation.status === 'pending'
                            ? 'warning'
                            : lookedUpReservation.status === 'cancelled'
                              ? 'danger'
                              : 'cream'
                      }
                      className="uppercase font-bold text-xs"
                    >
                      {lookedUpReservation.status}
                    </Badge>
                  </div>

                  <div className="bg-white p-4 rounded-card border border-brand-cream-300 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-brand-ink-500">Name</span>
                      <span className="font-semibold text-brand-green-950">{lookedUpReservation.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-ink-500">Date & Time</span>
                      <span className="font-semibold text-brand-green-950">
                        {lookedUpReservation.date} at {formatTime12h(lookedUpReservation.time)} IST
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-ink-500">Guests</span>
                      <span className="font-semibold text-brand-green-950">{lookedUpReservation.guests} People</span>
                    </div>
                    {lookedUpReservation.assignedTables && lookedUpReservation.assignedTables.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-brand-ink-500">Table</span>
                        <span className="font-semibold text-brand-green-950">
                          {lookedUpReservation.assignedTables
                            .map((t) => t.label || `Table ${t.tableNumber}`)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {cancelSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-card text-emerald-800 text-sm">
                      {cancelSuccessMsg}
                    </div>
                  )}

                  {cancelError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-card text-red-700 text-sm space-y-2">
                      <p>{cancelError}</p>
                      <a href={telLink()} className="text-xs font-semibold underline block">
                        Call Host Desk: {siteConfig.phone}
                      </a>
                    </div>
                  )}

                  {/* Cancellation Action if Pending or Confirmed */}
                  {(lookedUpReservation.status === 'confirmed' || lookedUpReservation.status === 'pending') && (
                    <div className="space-y-3 pt-2">
                      <label htmlFor="cancelReason" className="block text-xs font-semibold text-brand-ink-600">
                        Reason for Cancellation (Optional)
                      </label>
                      <Input
                        id="cancelReason"
                        placeholder="e.g. Change of plans"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="bg-white text-sm"
                      />
                      <Button
                        variant="outline"
                        className="w-full justify-center text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        disabled={isCancelling}
                        onClick={handleCancelBooking}
                      >
                        {isCancelling ? (
                          <Spinner size="sm" />
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-1.5" />
                            Cancel This Reservation
                          </>
                        )}
                      </Button>
                      <p className="text-[11px] text-brand-ink-400 text-center">
                        Note: Online cancellations are accepted up to 2 hours before your scheduled time.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Helpful FAQ / Policy Section */}
      <div className="max-w-3xl mx-auto pt-6 border-t border-brand-cream-300">
        <h4 className="font-serif text-lg font-bold text-brand-green-950 mb-4 text-center">
          Reservation Guidelines & Policies
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-brand-surface-card rounded-card border border-brand-cream-200 space-y-1.5">
            <div className="font-semibold text-brand-green-900 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-brand-gold-600" /> 15-Minute Grace Period
            </div>
            <p className="text-xs text-brand-ink-500">
              We hold your table for 15 minutes after the reserved time before releasing it for walk-in guests.
            </p>
          </div>

          <div className="p-4 bg-brand-surface-card rounded-card border border-brand-cream-200 space-y-1.5">
            <div className="font-semibold text-brand-green-900 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-brand-gold-600" /> Large Parties
            </div>
            <p className="text-xs text-brand-ink-500">
              Groups over 6 guests are reviewed by our host manager to arrange connected tables in our family zone.
            </p>
          </div>

          <div className="p-4 bg-brand-surface-card rounded-card border border-brand-cream-200 space-y-1.5">
            <div className="font-semibold text-brand-green-900 flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-brand-gold-600" /> Need Help?
            </div>
            <p className="text-xs text-brand-ink-500">
              For urgent modifications or custom catering inquiries, call us at{' '}
              <a href={telLink()} className="font-semibold text-brand-green-800 underline">
                {siteConfig.phone}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
