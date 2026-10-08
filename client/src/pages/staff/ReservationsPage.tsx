import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  CheckCircle,
  UserCheck,
  Clock,
  Users,
  AlertTriangle,
  Ban,
  Edit2,
  Layers,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { useRealtime } from '@/lib/realtimeContext';
import { apiClient, ApiClientError } from '@/lib/apiClient';
import { formatTime12h } from '@/lib/timeUtils';
import { TableItem } from './TablesPage';

interface AssignedTable {
  _id: string;
  tableNumber: number;
  label: string;
  zone: string;
}

interface StaffReservation {
  _id: string;
  code: string;
  customerName: string;
  phone?: string;
  guests: number;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  source: 'web' | 'phone' | 'walk_in';
  assignedTables?: AssignedTable[];
  occasion?: string;
  specialRequest?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface SummaryCounts {
  total: number;
  pending: number;
  confirmed: number;
  seated: number;
  completed: number;
  cancelled: number;
  no_show: number;
}

interface ReservationBlock {
  _id: string;
  startAt: string;
  endAt: string;
  reason: string;
  createdAt: string;
}

function getISTDate(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
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

function formatDisplayDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-').map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const ReservationsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { refetchIntervalFallback } = useRealtime();
  const canManage = hasPermission(user?.permissions, 'reservations:manage');

  // Selected Day Navigator State
  const [selectedDate, setSelectedDate] = useState<string>(getISTDate(0));
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals State
  const [isNewBookingOpen, setIsNewBookingOpen] = useState<boolean>(false);
  const [isBlocksManagerOpen, setIsBlocksManagerOpen] = useState<boolean>(false);
  const [assignModalReservation, setAssignModalReservation] = useState<StaffReservation | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);

  // Cancel Modal State
  const [cancelModalReservation, setCancelModalReservation] = useState<StaffReservation | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Edit Modal State
  const [editModalReservation, setEditModalReservation] = useState<StaffReservation | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editGuests, setEditGuests] = useState<number>(2);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editSpecialRequest, setEditSpecialRequest] = useState<string>('');

  // New Booking Form State
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newGuests, setNewGuests] = useState<number>(2);
  const [newDate, setNewDate] = useState<string>(selectedDate);
  const [newTime, setNewTime] = useState<string>('12:00');
  const [newSource, setNewSource] = useState<'phone' | 'walk_in'>('phone');
  const [newTableIds, setNewTableIds] = useState<string[]>([]);
  const [newOccasion, setNewOccasion] = useState<string>('');
  const [newSpecialRequest, setNewSpecialRequest] = useState<string>('');
  const [newInternalNotes, setNewInternalNotes] = useState<string>('');
  const [isStaffOverride, setIsStaffOverride] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Block Form State
  const [blockStart, setBlockStart] = useState<string>('');
  const [blockEnd, setBlockEnd] = useState<string>('');
  const [blockReason, setBlockReason] = useState<string>('');
  const [blockError, setBlockError] = useState<string | null>(null);

  // General Action Error
  const [actionError, setActionError] = useState<string | null>(null);

  // Queries
  const { data: summaryData } = useQuery({
    queryKey: ['reservations-summary', selectedDate],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { summary: SummaryCounts } }>(
        `/reservations/summary?date=${selectedDate}`
      );
      return res.data.summary;
    },
    refetchInterval: refetchIntervalFallback,
  });

  const {
    data: reservationsData,
    isLoading: isLoadingReservations,
  } = useQuery({
    queryKey: ['staff-reservations', selectedDate, selectedStatus, searchQuery],
    queryFn: async () => {
      let url = `/reservations?date=${selectedDate}`;
      if (selectedStatus !== 'all') {
        url += `&status=${selectedStatus}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await apiClient.get<{
        success: boolean;
        data: { reservations: StaffReservation[]; total: number };
      }>(url);
      return res.data;
    },
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['staff-tables'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { tables: TableItem[] } }>('/tables');
      return res.data.tables;
    },
  });

  const { data: blocks = [], refetch: refetchBlocks } = useQuery({
    queryKey: ['reservation-blocks'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { blocks: ReservationBlock[] } }>(
        '/reservations/blocks'
      );
      return res.data.blocks;
    },
    enabled: isBlocksManagerOpen,
  });

  // Mutations
  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: 'seated' | 'completed' | 'cancelled' | 'no_show';
      reason?: string;
    }) => {
      return apiClient.post(`/reservations/${id}/status`, { status, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-summary'] });
      setActionError(null);
      setCancelModalReservation(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to update reservation status.';
      setActionError(msg);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ id, tableIds }: { id: string; tableIds?: string[] }) => {
      return apiClient.post(`/reservations/${id}/confirm`, { tableIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-summary'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to confirm reservation.';
      setActionError(msg);
    },
  });

  const assignTablesMutation = useMutation({
    mutationFn: async ({ id, tableIds }: { id: string; tableIds: string[] }) => {
      return apiClient.post(`/reservations/${id}/assign-tables`, { tableIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-reservations'] });
      setAssignModalReservation(null);
      setActionError(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to assign tables.';
      setActionError(msg);
    },
  });

  const createStaffReservationMutation = useMutation({
    mutationFn: async (payload: unknown) => {
      return apiClient.post('/reservations', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-summary'] });
      setIsNewBookingOpen(false);
      setFormError(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to create reservation.';
      setFormError(msg);
    },
  });

  const updateReservationMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: unknown }) => {
      return apiClient.patch(`/reservations/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-reservations'] });
      setEditModalReservation(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to update reservation.';
      setActionError(msg);
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: async (payload: { startAt: string; endAt: string; reason: string }) => {
      return apiClient.post('/reservations/blocks', payload);
    },
    onSuccess: () => {
      refetchBlocks();
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      setBlockError(null);
    },
    onError: (err: unknown) => {
      setBlockError(err instanceof ApiClientError ? err.message : 'Failed to create block');
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/reservations/blocks/${id}`);
    },
    onSuccess: () => {
      refetchBlocks();
    },
  });

  // Date Shift Helpers
  const shiftDate = (days: number) => {
    const parts = selectedDate.split('-').map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    const date = new Date(y, m - 1, d + days);
    setSelectedDate(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date)
    );
  };

  const handleOpenEdit = (res: StaffReservation) => {
    setEditModalReservation(res);
    setEditName(res.customerName);
    setEditPhone(res.phone || '');
    setEditGuests(res.guests);
    setEditNotes(res.internalNotes || '');
    setEditSpecialRequest(res.specialRequest || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalReservation) return;
    updateReservationMutation.mutate({
      id: editModalReservation._id,
      payload: {
        customerName: editName.trim(),
        phone: editPhone.trim() || undefined,
        guests: editGuests,
        internalNotes: editNotes.trim() || undefined,
        specialRequest: editSpecialRequest.trim() || undefined,
      },
    });
  };

  const handleOpenAssignModal = (res: StaffReservation) => {
    setAssignModalReservation(res);
    setSelectedTableIds(res.assignedTables?.map((t) => t._id) || []);
  };

  const handleCreateReservationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    createStaffReservationMutation.mutate({
      customerName: newCustomerName.trim(),
      phone: newPhone.trim(),
      guests: newGuests,
      date: newDate,
      time: newTime,
      source: newSource,
      tableIds: newTableIds.length > 0 ? newTableIds : undefined,
      occasion: newOccasion || undefined,
      specialRequest: newSpecialRequest.trim() || undefined,
      internalNotes: newInternalNotes.trim() || undefined,
      isStaffOverride,
    });
  };

  const handleCreateBlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBlockError(null);
    if (!blockStart || !blockEnd || !blockReason.trim()) {
      setBlockError('Start time, end time, and reason are required.');
      return;
    }
    createBlockMutation.mutate({
      startAt: new Date(blockStart).toISOString(),
      endAt: new Date(blockEnd).toISOString(),
      reason: blockReason.trim(),
    });
  };

  const summary = summaryData || {
    total: 0,
    pending: 0,
    confirmed: 0,
    seated: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
  };

  const reservations = reservationsData?.reservations || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-brand-green-950">Reservation Desk</h1>
          <p className="text-sm text-brand-ink-500">
            Monitor daily bookings, seat walk-ins, resolve pending requests, and manage closure blocks.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManage && (
            <>
              <Button
                variant="outline"
                className="gap-2 text-xs"
                onClick={() => setIsBlocksManagerOpen(true)}
              >
                <Ban className="h-3.5 w-3.5 text-red-500" />
                Closure Blocks
              </Button>

              <Button
                onClick={() => {
                  setNewDate(selectedDate);
                  setIsNewBookingOpen(true);
                }}
                className="gap-2 bg-brand-green-800 text-brand-gold-400"
              >
                <Plus className="h-4 w-4" />
                New Booking
              </Button>
            </>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-card flex items-start gap-3 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Action Error</span>
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs text-red-500 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Date Navigator Bar */}
      <div className="bg-brand-surface-card p-4 rounded-card border border-brand-cream-300 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => shiftDate(-1)}
            className="p-2 text-brand-ink-700 hover:bg-brand-cream-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedDate(getISTDate(0))}
            className="text-xs font-semibold"
          >
            Today
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => shiftDate(1)}
            className="p-2 text-brand-ink-700 hover:bg-brand-cream-100"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div className="ml-2 flex items-center gap-2">
            <span className="font-serif font-bold text-lg text-brand-green-950">
              {formatDisplayDate(selectedDate)}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs border border-brand-cream-300 rounded px-2 py-1 bg-white ml-2 text-brand-ink-700"
            />
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-400" />
          <Input
            placeholder="Search code, name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs bg-white h-9"
          />
        </div>
      </div>

      {/* Status Filter Tabs with Counts */}
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-cream-300 pb-3">
        {[
          { key: 'all', label: 'All Bookings', count: summary.total },
          { key: 'pending', label: 'Pending Review', count: summary.pending, highlight: summary.pending > 0 },
          { key: 'confirmed', label: 'Confirmed', count: summary.confirmed },
          { key: 'seated', label: 'Seated', count: summary.seated },
          { key: 'completed', label: 'Completed', count: summary.completed },
          { key: 'cancelled', label: 'Cancelled', count: summary.cancelled },
          { key: 'no_show', label: 'No-Show', count: summary.no_show },
        ].map((tab) => {
          const isActive = selectedStatus === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedStatus(tab.key)}
              className={`px-3.5 py-1.5 rounded-button text-xs font-semibold flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-brand-green-800 text-brand-cream-100 shadow-sm'
                  : 'bg-brand-surface-card border border-brand-cream-300 text-brand-ink-600 hover:border-brand-green-700'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  tab.highlight
                    ? 'bg-amber-400 text-amber-950 animate-pulse'
                    : isActive
                      ? 'bg-brand-gold-500 text-brand-green-950'
                      : 'bg-brand-cream-200 text-brand-ink-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Reservation List */}
      {isLoadingReservations ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" variant="gold" />
          <span className="text-sm text-brand-ink-500">Loading reservations for {selectedDate}...</span>
        </div>
      ) : reservations.length === 0 ? (
        <Card variant="cream">
          <CardContent className="p-12 text-center space-y-2">
            <CalendarIcon className="h-10 w-10 text-brand-ink-300 mx-auto" />
            <p className="font-semibold text-brand-ink-700">No reservations found.</p>
            <p className="text-xs text-brand-ink-500">
              There are no reservations matching this filter for {formatDisplayDate(selectedDate)}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => {
            const isPending = res.status === 'pending';
            const isConfirmed = res.status === 'confirmed';
            const isSeated = res.status === 'seated';

            return (
              <Card
                key={res._id}
                variant="cream"
                className={`border transition-all ${
                  isPending
                    ? 'border-amber-400 bg-amber-50/30'
                    : 'border-brand-cream-300 hover:border-brand-gold-400'
                }`}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left Column: Code, Time, Customer */}
                  <div className="space-y-1.5 flex-1 min-w-[280px]">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-sm text-brand-green-900 bg-brand-cream-100 px-2 py-0.5 rounded border border-brand-cream-300">
                        {res.code}
                      </span>

                      <Badge
                        variant={
                          res.status === 'confirmed'
                            ? 'success'
                            : res.status === 'pending'
                              ? 'warning'
                              : res.status === 'seated'
                                ? 'gold'
                                : res.status === 'cancelled' || res.status === 'no_show'
                                  ? 'danger'
                                  : 'cream'
                        }
                        className="text-[11px] uppercase font-bold"
                      >
                        {res.status.replace('_', '-')}
                      </Badge>

                      <span className="text-xs text-brand-ink-400 uppercase font-medium">
                        [{res.source}]
                      </span>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <span className="font-serif font-bold text-base text-brand-green-950">
                        {res.customerName}
                      </span>
                      {res.phone && (
                        <span className="text-xs text-brand-ink-500 font-mono">
                          {res.phone}
                        </span>
                      )}
                    </div>

                    {/* Occasion / Special Request Notes */}
                    {(res.occasion || res.specialRequest || res.internalNotes) && (
                      <div className="text-xs space-y-0.5 pt-0.5">
                        {res.occasion && (
                          <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-brand-cream-200 text-brand-green-900 font-medium">
                            Occasion: {res.occasion}
                          </span>
                        )}
                        {res.specialRequest && (
                          <span className="text-brand-ink-600 italic block">
                            Request: &ldquo;{res.specialRequest}&rdquo;
                          </span>
                        )}
                        {res.internalNotes && (
                          <span className="text-amber-800 font-medium block">
                            Staff Note: {res.internalNotes}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Middle Column: Time, Party size, Assigned Tables */}
                  <div className="flex flex-wrap items-center gap-6 text-sm text-brand-ink-700">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-brand-gold-600" />
                      <div>
                        <span className="font-bold text-brand-green-950 block">
                          {formatTime12h(res.time)}
                        </span>
                        <span className="text-[11px] text-brand-ink-400">90 min slot</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-brand-gold-600" />
                      <div>
                        <span className="font-bold text-brand-green-950 block">
                          {res.guests} Guests
                        </span>
                        <span className="text-[11px] text-brand-ink-400">Party size</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-brand-gold-600" />
                      <div>
                        {res.assignedTables && res.assignedTables.length > 0 ? (
                          <span className="font-semibold text-brand-green-900 block">
                            {res.assignedTables.map((t) => `Table ${t.tableNumber}`).join(', ')}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold block text-xs">
                            Unassigned
                          </span>
                        )}
                        <span className="text-[11px] text-brand-ink-400">Seating</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions (Only for reservations:manage, read-only for waiters) */}
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-brand-cream-200">
                      {/* PENDING ACTIONS */}
                      {isPending && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                            onClick={() => confirmMutation.mutate({ id: res._id })}
                            disabled={confirmMutation.isPending}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Confirm
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-red-600 hover:bg-red-50 border-red-200"
                            onClick={() => setCancelModalReservation(res)}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {/* CONFIRMED ACTIONS */}
                      {isConfirmed && (
                        <>
                          <Button
                            size="sm"
                            className="bg-brand-green-800 text-brand-gold-400 text-xs gap-1"
                            onClick={() => statusMutation.mutate({ id: res._id, status: 'seated' })}
                            disabled={statusMutation.isPending}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Seat
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => handleOpenAssignModal(res)}
                          >
                            Assign Table
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-brand-ink-600 hover:text-amber-700"
                            onClick={() =>
                              statusMutation.mutate({
                                id: res._id,
                                status: 'no_show',
                                reason: 'No-show after grace period',
                              })
                            }
                          >
                            No-Show
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-red-500 hover:text-red-700"
                            onClick={() => setCancelModalReservation(res)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {/* SEATED ACTIONS */}
                      {isSeated && (
                        <Button
                          size="sm"
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1"
                          onClick={() => statusMutation.mutate({ id: res._id, status: 'completed' })}
                          disabled={statusMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Complete
                        </Button>
                      )}

                      {/* Edit Details */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="p-1.5 text-brand-ink-400 hover:text-brand-green-950"
                        onClick={() => handleOpenEdit(res)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ASSIGN / CHANGE TABLE MODAL */}
      <Modal
        isOpen={!!assignModalReservation}
        onClose={() => setAssignModalReservation(null)}
        title={`Assign Seating: ${assignModalReservation?.code}`}
      >
        {assignModalReservation && (
          <div className="space-y-4">
            <p className="text-xs text-brand-ink-500">
              Select one or more active tables for {assignModalReservation.customerName} ({assignModalReservation.guests} guests).
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
              {tables
                .filter((t) => t.isActive)
                .map((t) => {
                  const isSelected = selectedTableIds.includes(t._id);
                  return (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTableIds(selectedTableIds.filter((id) => id !== t._id));
                        } else {
                          setSelectedTableIds([...selectedTableIds, t._id]);
                        }
                      }}
                      className={`p-3 rounded-card text-left border transition-all text-xs ${
                        isSelected
                          ? 'border-brand-green-800 bg-brand-green-50 ring-1 ring-brand-green-800 font-bold'
                          : 'border-brand-cream-300 bg-white hover:border-brand-green-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-brand-green-950">Table #{t.tableNumber}</span>
                        <Badge variant="cream" className="text-[10px] capitalize">
                          {t.zone}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-brand-ink-500 mt-1">
                        Cap: {t.capacity} | {t.label}
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-brand-cream-200 flex justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setAssignModalReservation(null)}>
                Cancel
              </Button>
              <Button
                disabled={selectedTableIds.length === 0 || assignTablesMutation.isPending}
                className="bg-brand-green-800 text-brand-gold-400"
                onClick={() =>
                  assignTablesMutation.mutate({
                    id: assignModalReservation._id,
                    tableIds: selectedTableIds,
                  })
                }
              >
                Save Assignment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* CANCEL MODAL */}
      <Modal
        isOpen={!!cancelModalReservation}
        onClose={() => setCancelModalReservation(null)}
        title={`Cancel Reservation ${cancelModalReservation?.code}`}
      >
        {cancelModalReservation && (
          <div className="space-y-4">
            <p className="text-xs text-brand-ink-600">
              Are you sure you want to cancel the booking for {cancelModalReservation.customerName} (
              {cancelModalReservation.date} at {formatTime12h(cancelModalReservation.time)})?
            </p>

            <div>
              <label htmlFor="cancelReasonInput" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Reason for Cancellation
              </label>
              <Input
                id="cancelReasonInput"
                placeholder="e.g. Customer called to cancel, emergency..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="bg-white text-xs"
              />
            </div>

            <div className="pt-3 border-t border-brand-cream-200 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCancelModalReservation(null)}>
                Go Back
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    id: cancelModalReservation._id,
                    status: 'cancelled',
                    reason: cancelReason.trim() || 'Cancelled by staff',
                  })
                }
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        isOpen={!!editModalReservation}
        onClose={() => setEditModalReservation(null)}
        title={`Edit Details: ${editModalReservation?.code}`}
      >
        {editModalReservation && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label htmlFor="editName" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Customer Name
              </label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="editPhone" className="block text-xs font-semibold text-brand-green-950 mb-1">
                  Phone Number
                </label>
                <Input
                  id="editPhone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div>
                <label htmlFor="editGuests" className="block text-xs font-semibold text-brand-green-950 mb-1">
                  Guests Count
                </label>
                <Input
                  id="editGuests"
                  type="number"
                  min={1}
                  max={20}
                  value={editGuests}
                  onChange={(e) => setEditGuests(parseInt(e.target.value, 10) || 1)}
                  className="bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="editSpecialReq" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Special Requests
              </label>
              <Input
                id="editSpecialReq"
                value={editSpecialRequest}
                onChange={(e) => setEditSpecialRequest(e.target.value)}
                className="bg-white"
              />
            </div>

            <div>
              <label htmlFor="editNotes" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Internal Staff Notes
              </label>
              <Textarea
                id="editNotes"
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="bg-white"
              />
            </div>

            <div className="pt-3 border-t border-brand-cream-200 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditModalReservation(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateReservationMutation.isPending}
                className="bg-brand-green-800 text-brand-gold-400"
              >
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* NEW BOOKING MODAL (Staff Phone / Walk-in) */}
      <Modal
        isOpen={isNewBookingOpen}
        onClose={() => setIsNewBookingOpen(false)}
        title="Create New Staff Reservation"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateReservationSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-card text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="newSource" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Booking Source *
              </label>
              <Select
                id="newSource"
                options={[
                  { value: 'phone', label: 'Phone Call 📞' },
                  { value: 'walk_in', label: 'Walk-in Guest 🚶' },
                ]}
                value={newSource}
                onChange={(e) => setNewSource(e.target.value as 'phone' | 'walk_in')}
              />
            </div>

            <div>
              <label htmlFor="newGuests" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Guests *
              </label>
              <Input
                id="newGuests"
                type="number"
                min={1}
                max={20}
                value={newGuests}
                onChange={(e) => setNewGuests(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="newCustomerName" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Customer Name *
              </label>
              <Input
                id="newCustomerName"
                placeholder="Rahul"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="newPhone" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Phone Number *
              </label>
              <Input
                id="newPhone"
                type="tel"
                placeholder="9876543210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="newDate" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Date *
              </label>
              <Input
                id="newDate"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="newTime" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Time (24h) *
              </label>
              <Input
                id="newTime"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="newOccasion" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Occasion (Optional)
              </label>
              <Select
                id="newOccasion"
                options={[
                  { value: '', label: 'None' },
                  { value: 'birthday', label: 'Birthday' },
                  { value: 'anniversary', label: 'Anniversary' },
                  { value: 'casual', label: 'Casual' },
                  { value: 'date', label: 'Date' },
                  { value: 'business', label: 'Business' },
                  { value: 'family', label: 'Family' },
                  { value: 'other', label: 'Other' },
                ]}
                value={newOccasion}
                onChange={(e) => setNewOccasion(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="newSpecialRequest" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Special Request (Optional)
              </label>
              <Input
                id="newSpecialRequest"
                placeholder="e.g. Window booth preference"
                value={newSpecialRequest}
                onChange={(e) => setNewSpecialRequest(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="newInternalNotes" className="block text-xs font-semibold text-brand-green-950 mb-1">
              Internal Staff Note (Optional)
            </label>
            <Input
              id="newInternalNotes"
              placeholder="e.g. Regular VIP guest"
              value={newInternalNotes}
              onChange={(e) => setNewInternalNotes(e.target.value)}
            />
          </div>

          {/* Table Assignment (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-brand-green-950 mb-1">
              Assign Table (Optional - leave blank for auto best-fit)
            </label>
            <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto p-1 bg-brand-cream-50 rounded border border-brand-cream-200">
              {tables
                .filter((t) => t.isActive)
                .map((t) => {
                  const isChecked = newTableIds.includes(t._id);
                  return (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setNewTableIds(newTableIds.filter((id) => id !== t._id));
                        } else {
                          setNewTableIds([...newTableIds, t._id]);
                        }
                      }}
                      className={`text-left p-1.5 rounded text-[11px] border ${
                        isChecked
                          ? 'bg-brand-green-800 text-brand-gold-400 font-bold border-brand-green-800'
                          : 'bg-white border-brand-cream-300 text-brand-ink-700'
                      }`}
                    >
                      T{t.tableNumber} ({t.capacity}p)
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Staff Override Toggle */}
          <div className="p-3 bg-amber-50 rounded-card border border-amber-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isStaffOverride}
                onChange={(e) => setIsStaffOverride(e.target.checked)}
                className="h-4 w-4 rounded text-brand-green-800 focus:ring-brand-gold-500"
              />
              <span className="text-xs font-semibold text-amber-900">
                Staff Override (Bypass 60-min lead time & slot restrictions for walk-ins/VIPs)
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-brand-cream-200 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsNewBookingOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createStaffReservationMutation.isPending}
              className="bg-brand-green-800 text-brand-gold-400"
            >
              Book & Confirm
            </Button>
          </div>
        </form>
      </Modal>

      {/* CLOSURE BLOCKS MANAGER MODAL */}
      <Modal
        isOpen={isBlocksManagerOpen}
        onClose={() => setIsBlocksManagerOpen(false)}
        title="Reservation Closure Blocks"
        maxWidth="xl"
      >
        <div className="space-y-6">
          <p className="text-xs text-brand-ink-500">
            Closure blocks prevent customers from booking tables during special private events, maintenance, or holiday hours.
          </p>

          {/* Create Form */}
          <form onSubmit={handleCreateBlockSubmit} className="bg-brand-cream-50 p-4 rounded-card border border-brand-cream-300 space-y-3">
            <span className="text-xs font-bold text-brand-green-950 uppercase tracking-wide block">
              Add New Block Period
            </span>

            {blockError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {blockError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="blockStart" className="block text-[11px] font-semibold text-brand-ink-600 mb-1">
                  Start Date & Time (UTC/Local)
                </label>
                <Input
                  id="blockStart"
                  type="datetime-local"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="bg-white text-xs"
                  required
                />
              </div>

              <div>
                <label htmlFor="blockEnd" className="block text-[11px] font-semibold text-brand-ink-600 mb-1">
                  End Date & Time (UTC/Local)
                </label>
                <Input
                  id="blockEnd"
                  type="datetime-local"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="bg-white text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="blockReason" className="block text-[11px] font-semibold text-brand-ink-600 mb-1">
                Reason / Event Name
              </label>
              <Input
                id="blockReason"
                placeholder="e.g. Private corporate event, kitchen deep clean..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="bg-white text-xs"
                required
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={createBlockMutation.isPending}
                className="bg-brand-green-800 text-brand-gold-400 text-xs"
              >
                Add Closure Block
              </Button>
            </div>
          </form>

          {/* Active Blocks List */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-brand-green-950 uppercase tracking-wide block">
              Active Blocks ({blocks.length})
            </span>

            {blocks.length === 0 ? (
              <p className="text-xs text-brand-ink-400 italic">No closure blocks configured.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {blocks.map((b) => (
                  <div
                    key={b._id}
                    className="p-3 bg-white rounded-card border border-brand-cream-300 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-brand-green-950">{b.reason}</div>
                      <div className="text-brand-ink-500 text-[11px]">
                        From: {new Date(b.startAt).toLocaleString()} | To: {new Date(b.endAt).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 text-xs"
                      onClick={() => deleteBlockMutation.mutate(b._id)}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
