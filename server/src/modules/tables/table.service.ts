import { Table, ITable, TableZone } from './table.model';
import { Reservation } from '../reservations/models/reservation.model';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

export interface CreateTableDto {
  number: number;
  label?: string;
  capacity: number;
  zone?: TableZone;
  isReservable?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
}

export interface UpdateTableDto {
  label?: string;
  capacity?: number;
  zone?: TableZone;
  isReservable?: boolean;
  sortOrder?: number;
  notes?: string;
}

export const tableService = {
  /**
   * Retrieves all tables, sorted by sortOrder and number.
   */
  async getAllTables(filters?: { isActive?: boolean; isReservable?: boolean }): Promise<ITable[]> {
    const query: Record<string, unknown> = {};
    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    if (filters?.isReservable !== undefined) {
      query.isReservable = filters.isReservable;
    }
    return Table.find(query).sort({ sortOrder: 1, number: 1 });
  },

  /**
   * Retrieves a table by ID.
   */
  async getTableById(id: string): Promise<ITable> {
    const table = await Table.findById(id);
    if (!table) {
      throw new AppError(`Table with ID ${id} not found`, 404, 'TABLE_NOT_FOUND');
    }
    return table;
  },

  /**
   * Creates a new cafe table.
   */
  async createTable(data: CreateTableDto, actorId?: string, actorName?: string): Promise<ITable> {
    const existing = await Table.findOne({ number: data.number });
    if (existing) {
      throw new AppError(`Table number ${data.number} already exists`, 409, 'DUPLICATE_TABLE_NUMBER');
    }

    const table = await Table.create(data);

    await auditService.log({
      actorId,
      actorName,
      action: 'TABLE_CREATED',
      entityType: 'Table',
      entityId: table._id ? table._id.toString() : '',
      metadata: { number: table.number, capacity: table.capacity, zone: table.zone },
    });

    return table;
  },

  /**
   * Updates an existing table.
   */
  async updateTable(id: string, data: UpdateTableDto, actorId?: string, actorName?: string): Promise<ITable> {
    const table = await this.getTableById(id);

    if (data.label !== undefined) table.label = data.label;
    if (data.capacity !== undefined) table.capacity = data.capacity;
    if (data.zone !== undefined) table.zone = data.zone;
    if (data.isReservable !== undefined) table.isReservable = data.isReservable;
    if (data.sortOrder !== undefined) table.sortOrder = data.sortOrder;
    if (data.notes !== undefined) table.notes = data.notes;

    await table.save();

    await auditService.log({
      actorId,
      actorName,
      action: 'TABLE_UPDATED',
      entityType: 'Table',
      entityId: table._id ? table._id.toString() : '',
      metadata: { number: table.number, updates: data },
    });

    return table;
  },

  /**
   * Toggles table active status with active reservation safeguard.
   */
  async toggleTableStatus(id: string, isActive: boolean, actorId?: string, actorName?: string): Promise<ITable> {
    const table = await this.getTableById(id);

    // Safeguard: If attempting to deactivate, check for future active bookings
    if (!isActive && table.isActive) {
      const activeFutureBookingsCount = await Reservation.countDocuments({
        tableIds: table._id,
        status: { $in: ['confirmed', 'seated'] },
        startAt: { $gte: new Date() },
      });

      if (activeFutureBookingsCount > 0) {
        throw new AppError(
          `Cannot deactivate Table ${table.number}: table is currently assigned to ${activeFutureBookingsCount} upcoming active reservation(s). Reassign or cancel them first.`,
          400,
          'TABLE_HAS_ACTIVE_BOOKINGS'
        );
      }
    }

    table.isActive = isActive;
    await table.save();

    await auditService.log({
      actorId,
      actorName,
      action: isActive ? 'TABLE_ACTIVATED' : 'TABLE_DEACTIVATED',
      entityType: 'Table',
      entityId: table._id ? table._id.toString() : '',
      metadata: { number: table.number, isActive },
    });

    return table;
  },

  /**
   * Idempotent migration to ensure every existing table has a valid 128-bit qrToken.
   */
  async ensureTableQrTokens(): Promise<number> {
    const { generateTableQrToken } = await import('./table.model');
    const tablesWithoutTokens = await Table.find({
      $or: [{ qrToken: { $exists: false } }, { qrToken: null }, { qrToken: '' }],
    });

    let migrated = 0;
    for (const tbl of tablesWithoutTokens) {
      tbl.qrToken = generateTableQrToken();
      tbl.qrTokenRotatedAt = new Date();
      await tbl.save();
      migrated++;
    }
    return migrated;
  },

  /**
   * Rotates the QR ordering token for an individual table.
   * Invalidates previous physical QR code immediately.
   */
  async rotateQrToken(id: string, actorId?: string, actorName?: string): Promise<ITable> {
    const { generateTableQrToken } = await import('./table.model');
    const table = await this.getTableById(id);

    table.qrToken = generateTableQrToken();
    table.qrTokenRotatedAt = new Date();
    await table.save();

    await auditService.log({
      actorId,
      actorName,
      action: 'table.qr_rotated',
      entityType: 'Table',
      entityId: table._id ? table._id.toString() : '',
      metadata: {
        tableNumber: table.number,
        rotatedAt: table.qrTokenRotatedAt.toISOString(),
      },
    });

    return table;
  },

  /**
   * Rotates QR ordering tokens across ALL active cafe tables simultaneously.
   */
  async rotateAllQrTokens(actorId?: string, actorName?: string): Promise<{ count: number }> {
    const { generateTableQrToken } = await import('./table.model');
    const tables = await Table.find({ isActive: true });

    const now = new Date();
    for (const tbl of tables) {
      tbl.qrToken = generateTableQrToken();
      tbl.qrTokenRotatedAt = now;
      await tbl.save();
    }

    await auditService.log({
      actorId,
      actorName,
      action: 'table.qr_rotated_all',
      entityType: 'Table',
      entityId: 'ALL',
      metadata: {
        count: tables.length,
        rotatedAt: now.toISOString(),
      },
    });

    return { count: tables.length };
  },
};

