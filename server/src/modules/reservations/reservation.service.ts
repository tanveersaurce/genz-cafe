import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import {
  Reservation,
  IReservation,
  ReservationStatus,
  ReservationSource,
  ReservationOccasion,
} from './models/reservation.model';
import { TableSlotLock } from './models/tableSlotLock.model';
import { ReservationBlock, IReservationBlock } from './models/reservationBlock.model';
import { Table, ITable } from '../tables/table.model';
import { reservationSettings } from '../../config/reservationSettings';
import {
  IST_ZONE,
  calculateBookingInterval,
  validateBookingTimeRules,
  normalizeIndianPhone,
  generateReservationCode,
  generateDailySlotTimes,
  maskPhone,
} from './reservationTime';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { realtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS, REALTIME_ROOMS } from '../../config/realtimeEvents';

export interface PublicCreateReservationDto {
  customerName: string;
  phone: string;
  guests: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  occasion?: ReservationOccasion;
  specialRequest?: string;
  email?: string;
  idempotencyKey?: string;
  honeypot?: string;
}

export interface StaffCreateReservationDto {
  customerName: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  source?: ReservationSource;
  tableIds?: string[];
  occasion?: ReservationOccasion;
  specialRequest?: string;
  internalNotes?: string;
  isStaffOverride?: boolean;
}

export interface StaffUpdateReservationDto {
  customerName?: string;
  phone?: string;
  guests?: number;
  date?: string;
  time?: string;
  occasion?: ReservationOccasion | null;
  specialRequest?: string | null;
  internalNotes?: string | null;
}

export const reservationService = {
  /**
   * Acquires 30-min discrete slot locks for the given tables and stay intervals.
   * If any slot conflicts, rolls back inserted locks and throws 409 CONFLICT.
   */
  async acquireTableLocks(
    tableIds: (Types.ObjectId | string)[],
    slotStarts: Date[],
    reservationId: Types.ObjectId | string
  ): Promise<void> {
    if (tableIds.length === 0 || slotStarts.length === 0) return;

    const resId = new Types.ObjectId(reservationId.toString());
    const locksToInsert: Array<{
      tableId: Types.ObjectId;
      slotStart: Date;
      reservationId: Types.ObjectId;
    }> = [];

    for (const tId of tableIds) {
      const tableObjectId = new Types.ObjectId(tId.toString());
      for (const slot of slotStarts) {
        locksToInsert.push({
          tableId: tableObjectId,
          slotStart: slot,
          reservationId: resId,
        });
      }
    }

    try {
      await TableSlotLock.insertMany(locksToInsert, { ordered: true });
    } catch (err: unknown) {
      // Roll back any locks that were inserted for this reservation
      await TableSlotLock.deleteMany({ reservationId: resId });

      // Check for duplicate key error (code 11000)
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
        throw new AppError(
          'The selected table slot is no longer available. Please select another time or table.',
          409,
          'SLOT_CONFLICT'
        );
      }
      throw err;
    }
  },

  /**
   * Releases all slot locks held by a reservation.
   */
  async releaseTableLocks(reservationId: Types.ObjectId | string): Promise<void> {
    const resId = new Types.ObjectId(reservationId.toString());
    await TableSlotLock.deleteMany({ reservationId: resId });
  },

  /**
   * Checks if an interval [startAt, endAt] intersects any staff-created closure block.
   */
  async isIntervalBlocked(startAt: Date, endAt: Date): Promise<boolean> {
    const overlappingBlock = await ReservationBlock.findOne({
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    });
    return !!overlappingBlock;
  },

  /**
   * Finds the best-fit single table for a party size and stay interval.
   * Smallest capacity >= guests, tie-broken by sortOrder ascending.
   */
  async findBestFitTable(
    guests: number,
    slotStarts: Date[],
    allowNonReservable = false
  ): Promise<ITable | null> {
    const tableQuery: Record<string, unknown> = {
      isActive: true,
      capacity: { $gte: guests },
    };

    if (!allowNonReservable) {
      tableQuery.isReservable = true;
    }

    // Sort by smallest capacity >= guests (best fit), then sortOrder
    const candidateTables = await Table.find(tableQuery).sort({ capacity: 1, sortOrder: 1 });

    for (const table of candidateTables) {
      // Check if this table has any locks for the required slots
      const conflictCount = await TableSlotLock.countDocuments({
        tableId: table._id,
        slotStart: { $in: slotStarts },
      });

      if (conflictCount === 0) {
        return table;
      }
    }

    return null;
  },

  /**
   * Computes public availability slots for a given date ("YYYY-MM-DD") and party size.
   */
  async getAvailability(dateStr: string, guests: number, now = new Date()) {
    if (guests < 1 || guests > reservationSettings.maxGuestsPerBooking) {
      throw new AppError(
        `Guests must be between 1 and ${reservationSettings.maxGuestsPerBooking}.`,
        400,
        'INVALID_GUESTS'
      );
    }

    const slotTimes = generateDailySlotTimes();
    const activeReservableTables = await Table.find({ isActive: true, isReservable: true }).sort({
      capacity: 1,
      sortOrder: 1,
    });

    const results: Array<{
      time: string;
      state: 'available' | 'request_only' | 'full' | 'closed';
    }> = [];

    for (const time of slotTimes) {
      const { startAt, endAt, slotStarts } = calculateBookingInterval(dateStr, time);

      // 1. Check if slot violates basic time boundaries (past time, lead time, advance days)
      let isTimeValid = true;
      try {
        validateBookingTimeRules(startAt, now);
      } catch {
        isTimeValid = false;
      }

      if (!isTimeValid) {
        results.push({ time, state: 'closed' });
        continue;
      }

      // 2. Check if overlapping any closure block
      const blocked = await this.isIntervalBlocked(startAt, endAt);
      if (blocked) {
        results.push({ time, state: 'closed' });
        continue;
      }

      // 3. Find which tables are free during these slot starts
      const conflictingLocks = await TableSlotLock.find({
        slotStart: { $in: slotStarts },
      }).select('tableId');

      const lockedTableIdSet = new Set(conflictingLocks.map((l) => l.tableId.toString()));
      const freeTables = activeReservableTables.filter((t) => !lockedTableIdSet.has(t._id.toString()));

      // 4. Determine state
      // Single table best-fit
      const singleFitTable = freeTables.find((t) => t.capacity >= guests);

      if (singleFitTable && guests <= reservationSettings.autoConfirmMaxGuests) {
        results.push({ time, state: 'available' });
      } else {
        // Check combined free table capacity
        const totalFreeCapacity = freeTables.reduce((acc, t) => acc + t.capacity, 0);
        if (totalFreeCapacity >= guests) {
          results.push({ time, state: 'request_only' });
        } else {
          results.push({ time, state: 'full' });
        }
      }
    }

    return results;
  },

  /**
   * Public booking submission with strict honeypot, anti-spam, idempotency,
   * auto-assignment, and double-booking protection.
   */
  async createPublicReservation(dto: PublicCreateReservationDto, now = new Date()) {
    // 1. Honeypot check: silently return fake success if bot filled honeypot
    if (dto.honeypot && dto.honeypot.trim().length > 0) {
      return {
        code: generateReservationCode(),
        status: 'pending' as ReservationStatus,
        customerName: dto.customerName,
        guests: dto.guests,
        date: dto.date,
        time: dto.time,
        occasion: dto.occasion,
      };
    }

    const phone = normalizeIndianPhone(dto.phone);

    // 2. Idempotency Key check: return existing reservation if duplicate UUID submitted
    if (dto.idempotencyKey) {
      const existing = await Reservation.findOne({ idempotencyKey: dto.idempotencyKey });
      if (existing) {
        return {
          code: existing.code,
          status: existing.status,
          customerName: existing.customerName,
          guests: existing.guests,
          date: existing.localDate,
          time: DateTime.fromJSDate(existing.startAt, { zone: IST_ZONE }).toFormat('HH:mm'),
          occasion: existing.occasion,
        };
      }
    }

    // 3. Anti-spam per-phone limits
    const activeBookingsCount = await Reservation.countDocuments({
      phone,
      status: { $in: ['pending', 'confirmed'] },
      startAt: { $gte: now },
    });

    if (activeBookingsCount >= reservationSettings.maxActiveBookingsPerPhone) {
      throw new AppError(
        `Maximum active bookings limit (${reservationSettings.maxActiveBookingsPerPhone}) reached for this phone number.`,
        429,
        'ACTIVE_BOOKINGS_LIMIT'
      );
    }

    // 4. Time validation & interval calculation
    const { startAt, endAt, localDate, slotStarts } = calculateBookingInterval(dto.date, dto.time);
    validateBookingTimeRules(startAt, now);

    // Check no overlapping booking for same phone
    const overlappingCustomerBooking = await Reservation.findOne({
      phone,
      status: { $in: ['pending', 'confirmed', 'seated'] },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    });

    if (overlappingCustomerBooking) {
      throw new AppError(
        'You already have an active booking during this time.',
        409,
        'OVERLAPPING_CUSTOMER_BOOKING'
      );
    }

    // Check closure blocks
    const blocked = await this.isIntervalBlocked(startAt, endAt);
    if (blocked) {
      throw new AppError(
        'The cafe is unavailable for bookings during this time due to a scheduled event or closure.',
        409,
        'TIME_BLOCKED'
      );
    }

    // 5. Code generation
    let code = generateReservationCode();
    // Safety check against extremely rare code collision
    while (await Reservation.exists({ code })) {
      code = generateReservationCode();
    }

    // 6. Best-fit auto-assignment
    let status: ReservationStatus = 'pending';
    let assignedTableId: Types.ObjectId | null = null;

    if (dto.guests <= reservationSettings.autoConfirmMaxGuests) {
      const bestFitTable = await this.findBestFitTable(dto.guests, slotStarts);
      if (bestFitTable) {
        assignedTableId = bestFitTable._id as Types.ObjectId;
        status = 'confirmed';
      }
    }

    // 7. Create Reservation Record
    const reservation = new Reservation({
      code,
      customerName: dto.customerName.trim(),
      phone,
      email: dto.email ? dto.email.trim().toLowerCase() : undefined,
      guests: dto.guests,
      startAt,
      endAt,
      localDate,
      status,
      source: 'online',
      tableIds: assignedTableId ? [assignedTableId] : [],
      occasion: dto.occasion,
      specialRequest: dto.specialRequest,
      idempotencyKey: dto.idempotencyKey,
      statusHistory: [{ status, at: now, byUserId: null }],
    });

    await reservation.save();

    // 8. If confirmed with table, acquire slot locks with rollback safety
    if (assignedTableId) {
      try {
        await this.acquireTableLocks([assignedTableId], slotStarts, reservation._id as Types.ObjectId);
      } catch {
        // If slot just got taken by someone else right at this microsecond,
        // revert status to pending instead of completely failing the customer booking!
        reservation.status = 'pending';
        reservation.tableIds = [];
        reservation.statusHistory.push({ status: 'pending', at: new Date(), byUserId: null });
        await reservation.save();
        status = 'pending';
      }
    }

    // 9. Audit Log (Never log raw phone)
    await auditService.log({
      action: 'PUBLIC_RESERVATION_CREATED',
      entityType: 'Reservation',
      entityId: reservation._id ? reservation._id.toString() : '',
      metadata: {
        code: reservation.code,
        status: reservation.status,
        guests: reservation.guests,
        phoneMasked: maskPhone(phone),
      },
    });

    realtimeService.emit(
      REALTIME_EVENTS.RESERVATION_CHANGED,
      REALTIME_ROOMS.RESERVATIONS,
      {
        reservationId: reservation._id.toString(),
        status: reservation.status,
      }
    );

    return {
      code: reservation.code,
      status: reservation.status,
      customerName: reservation.customerName,
      guests: reservation.guests,
      date: reservation.localDate,
      time: DateTime.fromJSDate(reservation.startAt, { zone: IST_ZONE }).toFormat('HH:mm'),
      occasion: reservation.occasion,
    };
  },

  /**
   * Customer lookup by code + phone. Returns generic 404 for mismatches to prevent enumeration.
   */
  async lookupReservation(code: string, rawPhone: string) {
    const phone = normalizeIndianPhone(rawPhone);
    const reservation = await Reservation.findOne({ code: code.toUpperCase().trim() });

    if (!reservation || reservation.phone !== phone) {
      throw new AppError('No booking found for this code and phone number.', 404, 'BOOKING_NOT_FOUND');
    }

    return {
      code: reservation.code,
      customerName: reservation.customerName,
      guests: reservation.guests,
      date: reservation.localDate,
      time: DateTime.fromJSDate(reservation.startAt, { zone: IST_ZONE }).toFormat('HH:mm'),
      status: reservation.status,
      occasion: reservation.occasion,
      specialRequest: reservation.specialRequest,
      createdAt: reservation.createdAt,
    };
  },

  /**
   * Customer cancellation by code + phone.
   */
  async cancelReservationByCustomer(code: string, rawPhone: string, reason?: string, now = new Date()) {
    const phone = normalizeIndianPhone(rawPhone);
    const reservation = await Reservation.findOne({ code: code.toUpperCase().trim() });

    if (!reservation || reservation.phone !== phone) {
      throw new AppError('No booking found for this code and phone number.', 404, 'BOOKING_NOT_FOUND');
    }

    if (reservation.status !== 'pending' && reservation.status !== 'confirmed') {
      throw new AppError(
        `Cannot cancel booking with current status "${reservation.status}".`,
        409,
        'INVALID_STATUS_FOR_CANCEL'
      );
    }

    // Enforce 120-minute cutoff
    const cutoffInstant = DateTime.fromJSDate(reservation.startAt)
      .minus({ minutes: reservationSettings.customerCancelCutoffMinutes })
      .toJSDate();

    if (now >= cutoffInstant) {
      throw new AppError(
        `Self-service cancellation cutoff (${reservationSettings.customerCancelCutoffMinutes} min) has passed. Please contact the cafe directly.`,
        400,
        'CANCEL_CUTOFF_EXPIRED'
      );
    }

    reservation.status = 'cancelled';
    reservation.cancelledAt = now;
    reservation.cancelledBy = 'customer';
    reservation.cancelReason = reason || 'Customer requested cancellation';
    reservation.statusHistory.push({ status: 'cancelled', at: now, byUserId: null });

    await reservation.save();

    // Release table locks
    await this.releaseTableLocks(reservation._id as Types.ObjectId);

    await auditService.log({
      action: 'RESERVATION_CANCELLED_BY_CUSTOMER',
      entityType: 'Reservation',
      entityId: reservation._id ? reservation._id.toString() : '',
      metadata: { code: reservation.code, reason: reservation.cancelReason },
    });

    realtimeService.emit(
      REALTIME_EVENTS.RESERVATION_CHANGED,
      REALTIME_ROOMS.RESERVATIONS,
      {
        reservationId: reservation._id.toString(),
        status: 'cancelled',
      }
    );

    return {
      code: reservation.code,
      status: 'cancelled',
      message: 'Your reservation has been cancelled successfully.',
    };
  },

  /**
   * Staff: Retrieve reservations with date, status, search, and pagination.
   */
  async getStaffReservations(params: {
    date?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    // Date filter (defaults to today IST if not specified)
    if (params.date) {
      query.localDate = params.date;
    }

    if (params.status && params.status !== 'all') {
      query.status = params.status;
    }

    if (params.search && params.search.trim().length > 0) {
      const s = params.search.trim();
      query.$or = [
        { code: { $regex: s, $options: 'i' } },
        { customerName: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
      ];
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .populate('tableIds', 'number label capacity zone')
        .sort({ startAt: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit),
      Reservation.countDocuments(query),
    ]);

    return {
      reservations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Staff: Get summary metrics for a given date (default today IST).
   */
  async getStaffReservationsSummary(dateStr?: string) {
    const targetDate = dateStr || DateTime.now().setZone(IST_ZONE).toFormat('yyyy-MM-dd');

    const reservations = await Reservation.find({ localDate: targetDate });

    let pendingCount = 0;
    let confirmedCount = 0;
    let seatedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let noShowCount = 0;
    let totalGuests = 0;

    for (const res of reservations) {
      if (res.status === 'pending') pendingCount++;
      else if (res.status === 'confirmed') confirmedCount++;
      else if (res.status === 'seated') seatedCount++;
      else if (res.status === 'completed') completedCount++;
      else if (res.status === 'cancelled') cancelledCount++;
      else if (res.status === 'no_show') noShowCount++;

      if (res.status !== 'cancelled' && res.status !== 'no_show') {
        totalGuests += res.guests;
      }
    }

    return {
      date: targetDate,
      totalReservations: reservations.length,
      totalGuests,
      pendingCount,
      confirmedCount,
      seatedCount,
      completedCount,
      cancelledCount,
      noShowCount,
    };
  },

  /**
   * Staff: Create reservation (phone/walk-in) with optional staff override on lead time.
   */
  async createStaffReservation(
    dto: StaffCreateReservationDto,
    staffUserId?: string,
    staffUserName?: string
  ): Promise<IReservation> {
    const phone = normalizeIndianPhone(dto.phone);
    const { startAt, endAt, localDate, slotStarts } = calculateBookingInterval(dto.date, dto.time);

    validateBookingTimeRules(startAt, new Date(), { isStaffOverride: dto.isStaffOverride });

    let code = generateReservationCode();
    while (await Reservation.exists({ code })) {
      code = generateReservationCode();
    }

    let status: ReservationStatus = 'pending';
    let finalTableIds: Types.ObjectId[] = [];

    if (dto.tableIds && dto.tableIds.length > 0) {
      finalTableIds = dto.tableIds.map((id) => new Types.ObjectId(id));
      status = 'confirmed';
    }

    const reservation = new Reservation({
      code,
      customerName: dto.customerName.trim(),
      phone,
      guests: dto.guests,
      startAt,
      endAt,
      localDate,
      status,
      source: dto.source || 'phone',
      tableIds: finalTableIds,
      occasion: dto.occasion,
      specialRequest: dto.specialRequest,
      internalNotes: dto.internalNotes,
      statusHistory: [
        {
          status,
          at: new Date(),
          byUserId: staffUserId ? new Types.ObjectId(staffUserId) : null,
        },
      ],
      createdBy: staffUserId ? new Types.ObjectId(staffUserId) : undefined,
    });

    await reservation.save();

    if (finalTableIds.length > 0) {
      await this.acquireTableLocks(finalTableIds, slotStarts, reservation._id as Types.ObjectId);
    }

    await auditService.log({
      actorId: staffUserId,
      actorName: staffUserName,
      action: 'STAFF_RESERVATION_CREATED',
      entityType: 'Reservation',
      entityId: reservation._id ? reservation._id.toString() : '',
      metadata: { code: reservation.code, status: reservation.status, phoneMasked: maskPhone(phone) },
    });

    realtimeService.emit(
      REALTIME_EVENTS.RESERVATION_CHANGED,
      REALTIME_ROOMS.RESERVATIONS,
      {
        reservationId: reservation._id.toString(),
        status: reservation.status,
      }
    );

    return reservation;
  },

  /**
   * Staff: Assign or reassign tables on an existing booking.
   * Releases old locks and acquires new ones atomically.
   */
  async assignTables(
    id: string,
    tableIds: string[],
    staffUserId?: string,
    staffUserName?: string
  ): Promise<IReservation> {
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      throw new AppError(`Reservation ${id} not found`, 404, 'RESERVATION_NOT_FOUND');
    }

    if (reservation.status === 'cancelled' || reservation.status === 'completed' || reservation.status === 'no_show') {
      throw new AppError(`Cannot assign tables to ${reservation.status} booking.`, 409, 'INVALID_STATUS');
    }

    const { slotStarts } = calculateBookingInterval(
      reservation.localDate,
      DateTime.fromJSDate(reservation.startAt, { zone: IST_ZONE }).toFormat('HH:mm')
    );

    const newTableObjectIds = tableIds.map((tId) => new Types.ObjectId(tId));

    // Release old locks first
    await this.releaseTableLocks(reservation._id as Types.ObjectId);

    // Acquire new locks
    try {
      await this.acquireTableLocks(newTableObjectIds, slotStarts, reservation._id as Types.ObjectId);
    } catch (err) {
      // If new locks fail, re-acquire old locks if existed
      if (reservation.tableIds.length > 0) {
        await this.acquireTableLocks(reservation.tableIds, slotStarts, reservation._id as Types.ObjectId);
      }
      throw err;
    }

    reservation.tableIds = newTableObjectIds;
    if (reservation.status === 'pending') {
      reservation.status = 'confirmed';
      reservation.statusHistory.push({
        status: 'confirmed',
        at: new Date(),
        byUserId: staffUserId ? new Types.ObjectId(staffUserId) : null,
      });
    }

    await reservation.save();

    await auditService.log({
      actorId: staffUserId,
      actorName: staffUserName,
      action: 'TABLES_ASSIGNED',
      entityType: 'Reservation',
      entityId: reservation._id ? reservation._id.toString() : '',
      metadata: { code: reservation.code, tableIds },
    });

    return reservation;
  },

  /**
   * Staff: Confirm a pending reservation.
   */
  async confirmReservation(
    id: string,
    tableIds?: string[],
    staffUserId?: string,
    staffUserName?: string
  ): Promise<IReservation> {
    if (tableIds && tableIds.length > 0) {
      return this.assignTables(id, tableIds, staffUserId, staffUserName);
    }

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      throw new AppError(`Reservation ${id} not found`, 404, 'RESERVATION_NOT_FOUND');
    }

    if (reservation.status !== 'pending') {
      throw new AppError(`Reservation is already ${reservation.status}.`, 409, 'INVALID_STATUS');
    }

    reservation.status = 'confirmed';
    reservation.statusHistory.push({
      status: 'confirmed',
      at: new Date(),
      byUserId: staffUserId ? new Types.ObjectId(staffUserId) : null,
    });

    await reservation.save();

    await auditService.log({
      actorId: staffUserId,
      actorName: staffUserName,
      action: 'RESERVATION_CONFIRMED',
      entityType: 'Reservation',
      entityId: reservation._id ? reservation._id.toString() : '',
      metadata: { code: reservation.code },
    });

    realtimeService.emit(
      REALTIME_EVENTS.RESERVATION_CHANGED,
      REALTIME_ROOMS.RESERVATIONS,
      {
        reservationId: reservation._id.toString(),
        status: reservation.status,
      }
    );

    return reservation;
  },

  /**
   * State Machine: Transitions reservation status.
   * Enforces rules and 409 on invalid transitions.
   */
  async transitionStatus(
    id: string,
    newStatus: ReservationStatus,
    reason?: string,
    staffUserId?: string,
    staffUserName?: string,
    now = new Date()
  ): Promise<IReservation> {
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      throw new AppError(`Reservation ${id} not found`, 404, 'RESERVATION_NOT_FOUND');
    }

    const currentStatus = reservation.status;

    // State machine transitions:
    // pending -> confirmed | cancelled
    // confirmed -> seated | cancelled | no_show
    // seated -> completed
    const allowedTransitions: Record<ReservationStatus, ReservationStatus[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['seated', 'cancelled', 'no_show'],
      seated: ['completed'],
      completed: [],
      cancelled: [],
      no_show: [],
    };

    if (!allowedTransitions[currentStatus].includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from "${currentStatus}" to "${newStatus}".`,
        409,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // no_show rule: only allowed after startAt + 15 minutes
    if (newStatus === 'no_show') {
      const allowedNoShowInstant = DateTime.fromJSDate(reservation.startAt)
        .plus({ minutes: 15 })
        .toJSDate();

      if (now < allowedNoShowInstant) {
        throw new AppError(
          'Marking as No-Show is only allowed after 15 minutes past the scheduled booking time.',
          400,
          'NO_SHOW_TOO_EARLY'
        );
      }
    }

    reservation.status = newStatus;
    if (newStatus === 'cancelled') {
      reservation.cancelledAt = now;
      reservation.cancelledBy = 'staff';
      reservation.cancelReason = reason || 'Staff cancelled';
    }

    reservation.statusHistory.push({
      status: newStatus,
      at: now,
      byUserId: staffUserId ? new Types.ObjectId(staffUserId) : null,
    });

    await reservation.save();

    // If cancelled, completed, or no_show => release slot locks
    if (['cancelled', 'completed', 'no_show'].includes(newStatus)) {
      await this.releaseTableLocks(reservation._id as Types.ObjectId);
    }

    await auditService.log({
      actorId: staffUserId,
      actorName: staffUserName,
      action: `RESERVATION_${newStatus.toUpperCase()}`,
      entityType: 'Reservation',
      entityId: reservation._id ? reservation._id.toString() : '',
      metadata: { code: reservation.code, previousStatus: currentStatus, newStatus, reason },
    });

    realtimeService.emit(
      REALTIME_EVENTS.RESERVATION_CHANGED,
      REALTIME_ROOMS.RESERVATIONS,
      {
        reservationId: reservation._id.toString(),
        status: reservation.status,
      }
    );

    return reservation;
  },

  /**
   * Staff: Update reservation details (customerName, phone, time, etc.)
   */
  async updateStaffReservation(
    id: string,
    dto: StaffUpdateReservationDto,
    staffUserId?: string,
    staffUserName?: string
  ): Promise<IReservation> {
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      throw new AppError(`Reservation ${id} not found`, 404, 'RESERVATION_NOT_FOUND');
    }

    if (reservation.status === 'cancelled' || reservation.status === 'completed' || reservation.status === 'no_show') {
      throw new AppError(`Cannot edit a ${reservation.status} booking.`, 409, 'INVALID_STATUS');
    }

    if (dto.customerName) reservation.customerName = dto.customerName.trim();
    if (dto.phone) reservation.phone = normalizeIndianPhone(dto.phone);
    if (dto.guests !== undefined) reservation.guests = dto.guests;
    if (dto.occasion !== undefined) reservation.occasion = dto.occasion || undefined;
    if (dto.specialRequest !== undefined) reservation.specialRequest = dto.specialRequest || undefined;
    if (dto.internalNotes !== undefined) reservation.internalNotes = dto.internalNotes || undefined;

    // If date or time changed, recalculate interval and re-acquire locks if tables assigned
    if (dto.date || dto.time) {
      const newDate = dto.date || reservation.localDate;
      const newTime =
        dto.time || DateTime.fromJSDate(reservation.startAt, { zone: IST_ZONE }).toFormat('HH:mm');

      const { startAt, endAt, localDate, slotStarts } = calculateBookingInterval(newDate, newTime);

      // Re-evaluate locks if tables assigned
      if (reservation.tableIds.length > 0) {
        await this.releaseTableLocks(reservation._id as Types.ObjectId);
        try {
          await this.acquireTableLocks(reservation.tableIds, slotStarts, reservation._id as Types.ObjectId);
        } catch (err) {
          // Rollback to original interval
          const originalSlotStarts = calculateBookingInterval(
            reservation.localDate,
            DateTime.fromJSDate(reservation.startAt, { zone: IST_ZONE }).toFormat('HH:mm')
          ).slotStarts;
          await this.acquireTableLocks(reservation.tableIds, originalSlotStarts, reservation._id as Types.ObjectId);
          throw err;
        }
      }

      reservation.startAt = startAt;
      reservation.endAt = endAt;
      reservation.localDate = localDate;
    }

    await reservation.save();

    await auditService.log({
      actorId: staffUserId,
      actorName: staffUserName,
      action: 'RESERVATION_DETAILS_UPDATED',
      entityType: 'Reservation',
      entityId: reservation._id ? reservation._id.toString() : '',
      metadata: { code: reservation.code, updates: dto },
    });

    return reservation;
  },

  /**
   * Staff: Create a closure block.
   * Warns and lists any overlapping bookings (does NOT cancel them silently).
   */
  async createBlock(
    startAt: string,
    endAt: string,
    reason: string,
    staffUserId?: string,
    staffUserName?: string
  ) {
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (startDate >= endDate) {
      throw new AppError('Block start time must be before end time.', 400, 'INVALID_BLOCK_RANGE');
    }

    // Check for overlapping existing active bookings to return clear warnings
    const overlappingBookings = await Reservation.find({
      status: { $in: ['pending', 'confirmed', 'seated'] },
      startAt: { $lt: endDate },
      endAt: { $gt: startDate },
    }).select('code customerName phone guests startAt endAt');

    const block = await ReservationBlock.create({
      startAt: startDate,
      endAt: endDate,
      reason: reason.trim(),
      createdBy: staffUserId ? new Types.ObjectId(staffUserId) : undefined,
    });

    await auditService.log({
      actorId: staffUserId,
      actorName: staffUserName,
      action: 'RESERVATION_BLOCK_CREATED',
      entityType: 'ReservationBlock',
      entityId: block._id ? block._id.toString() : '',
      metadata: { startAt, endAt, reason, overlappingBookingsCount: overlappingBookings.length },
    });

    return {
      block,
      overlappingBookingsWarning: overlappingBookings,
    };
  },

  /**
   * Staff: Get all closure blocks.
   */
  async getBlocks(): Promise<IReservationBlock[]> {
    return ReservationBlock.find().sort({ startAt: 1 });
  },

  /**
   * Staff: Delete a closure block (frees time).
   */
  async deleteBlock(id: string, staffUserId?: string, staffUserName?: string): Promise<void> {
    const block = await ReservationBlock.findByIdAndDelete(id);
    if (!block) {
      throw new AppError('Block not found.', 404, 'BLOCK_NOT_FOUND');
    }

    await auditService.log({
      actorId: staffUserId,
      actorName: staffUserName,
      action: 'RESERVATION_BLOCK_DELETED',
      entityType: 'ReservationBlock',
      entityId: id,
      metadata: { reason: block.reason },
    });
  },
};
