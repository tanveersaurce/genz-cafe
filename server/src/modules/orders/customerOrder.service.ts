import crypto from 'crypto';
import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Table } from '../tables/table.model';
import { Order, IOrder, IOrderItem, IOrderKot } from './models/order.model';
import { CustomerSubmission, ICustomerSubmissionItem } from './models/customerSubmission.model';
import { MenuItem } from '../menu/models/MenuItem';
import { getNextSequence } from './models/counter.model';
import { qrOrderingSettings } from '../../config/qrOrderingSettings';
import { reservationSettings } from '../../config/reservationSettings';
import { settingService } from '../settings/setting.service';
import { normalizeIndianPhone } from '../reservations/reservationTime';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { realtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS, REALTIME_ROOMS } from '../../config/realtimeEvents';
import { mapKotStatusToCustomerStatus } from './customerStatusMapper';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export interface QrContextResult {
  tableNumber: number;
  orderingEnabled: boolean;
  reason?: 'paused' | 'closed' | 'cutoff' | 'billed' | 'invalid_token';
  pauseMessage?: string;
}

export interface CustomerOrderLineInput {
  menuItemId: string;
  variantName?: string;
  qty: number;
  note?: string;
}

export interface CreateCustomerOrderParams {
  tableNumber: number;
  token: string;
  customerName: string;
  customerPhone?: string;
  lines: CustomerOrderLineInput[];
  idempotencyKey: string;
  honeypot?: string;
  clientIp: string;
  userAgent?: string;
}

/**
 * Check if the current time in IST is within cafe operating hours and cutoff window.
 */
function checkOperatingHours(nowServer = new Date()): { allowed: boolean; reason?: 'closed' | 'cutoff' } {
  const istNow = DateTime.fromJSDate(nowServer, { zone: 'Asia/Kolkata' });
  const [openH, openM] = reservationSettings.openTime.split(':').map((v) => parseInt(v, 10));
  const [closeH, closeM] = reservationSettings.closeTime.split(':').map((v) => parseInt(v, 10));

  const openDt = istNow.set({ hour: openH, minute: openM, second: 0, millisecond: 0 });
  const closeDt = istNow.set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });
  const cutoffDt = closeDt.minus({ minutes: qrOrderingSettings.orderCutoffBeforeCloseMinutes });

  if (istNow < openDt || istNow >= closeDt) {
    return { allowed: false, reason: 'closed' };
  }
  if (istNow >= cutoffDt) {
    return { allowed: false, reason: 'cutoff' };
  }
  return { allowed: true };
}

/**
 * Derives a deterministic statusToken from idempotencyKey so retries with identical key receive identical token.
 */
function deriveStatusToken(idempotencyKey: string, tableId: string): string {
  const secret = env.JWT_ACCESS_SECRET || 'genz-cafe-qr-token-secret';
  return crypto.createHmac('sha256', secret).update(`${idempotencyKey}:${tableId}`).digest('base64url');
}

export const customerOrderService = {
  /**
   * Retrieves ordering context for a given table and QR token.
   * Never returns contents of other customers' orders.
   */
  async getQrContext(tableNumber: number, token?: string, now = new Date()): Promise<QrContextResult> {
    if (!token || !token.trim()) {
      return { tableNumber, orderingEnabled: false, reason: 'invalid_token' };
    }

    const table = await Table.findOne({ number: tableNumber, isActive: true });
    if (!table || table.qrToken !== token) {
      return { tableNumber, orderingEnabled: false, reason: 'invalid_token' };
    }

    // 1. Check runtime kill switch
    const qrSetting = await settingService.getQrOrderingSetting();
    if (!qrSetting.enabled) {
      return {
        tableNumber,
        orderingEnabled: false,
        reason: 'paused',
        pauseMessage: qrSetting.pauseMessage || 'Online table ordering is temporarily paused. Please order with our staff.',
      };
    }

    // 2. Check operating hours & cutoff
    const hoursCheck = checkOperatingHours(now);
    if (!hoursCheck.allowed) {
      return {
        tableNumber,
        orderingEnabled: false,
        reason: hoursCheck.reason,
      };
    }

    // 3. Check if table has a billed order
    const billedOrder = await Order.findOne({
      tableId: table._id,
      type: 'dine_in',
      status: 'billed',
    });

    if (billedOrder) {
      return {
        tableNumber,
        orderingEnabled: false,
        reason: 'billed',
      };
    }

    return { tableNumber, orderingEnabled: true };
  },

  /**
   * Processes a customer self-order submission atomically and dispatches directly to the kitchen.
   */
  async submitCustomerOrder(params: CreateCustomerOrderParams, now = new Date()) {
    // 1. Honeypot check: silently return fake success to prevent bot scrapers
    if (params.honeypot && params.honeypot.trim().length > 0) {
      const fakeSubmissionId = crypto.randomUUID();
      const fakeToken = crypto.randomBytes(16).toString('base64url');
      return {
        submissionId: fakeSubmissionId,
        statusToken: fakeToken,
        kotNo: 'KOT-999',
        items: params.lines.map((l) => ({
          nameSnapshot: 'Order item',
          variantName: l.variantName,
          qty: l.qty,
          note: l.note,
        })),
        undoUntil: new Date(now.getTime() + qrOrderingSettings.undoWindowSeconds * 1000).toISOString(),
      };
    }

    // 2. Validate Table and Token
    const table = await Table.findOne({ number: params.tableNumber, isActive: true });
    if (!table || !params.token || table.qrToken !== params.token) {
      throw new AppError('Invalid table or QR code. Please scan the QR code on your table.', 400, 'INVALID_TABLE_OR_TOKEN');
    }

    // 3. Validate Kill Switch
    const qrSetting = await settingService.getQrOrderingSetting();
    if (!qrSetting.enabled) {
      throw new AppError(
        qrSetting.pauseMessage || 'QR ordering is temporarily paused by staff.',
        400,
        'QR_ORDERING_PAUSED'
      );
    }

    // 4. Validate Operating Hours & Cutoff
    const hours = checkOperatingHours(now);
    if (!hours.allowed) {
      if (hours.reason === 'cutoff') {
        throw new AppError(
          'Last orders for today have closed (15 minutes before closing). Please speak to our staff.',
          400,
          'ORDER_CUTOFF_REACHED'
        );
      }
      throw new AppError('Cafe is currently closed for ordering.', 400, 'OUTSIDE_OPERATING_HOURS');
    }

    // 5. Validate Table Not Billed
    const billedOrder = await Order.findOne({
      tableId: table._id,
      type: 'dine_in',
      status: 'billed',
    });
    if (billedOrder) {
      throw new AppError(
        'Your bill has already been generated. Please call our staff to add more items.',
        409,
        'TABLE_BILLED'
      );
    }

    // 6. Limits Validation (Lines & Quantities)
    if (!params.lines || params.lines.length === 0) {
      throw new AppError('Order must contain at least one item.', 400, 'EMPTY_ORDER');
    }
    if (params.lines.length > qrOrderingSettings.maxLinesPerSubmission) {
      throw new AppError(
        `Cannot submit more than ${qrOrderingSettings.maxLinesPerSubmission} lines per order.`,
        400,
        'TOO_MANY_LINES'
      );
    }
    for (const line of params.lines) {
      if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > qrOrderingSettings.maxQtyPerLine) {
        throw new AppError(
          `Quantity must be between 1 and ${qrOrderingSettings.maxQtyPerLine} per line.`,
          400,
          'INVALID_QUANTITY'
        );
      }
    }

    // 7. Abuse Limits: Submissions per table in 10 minutes & pending customer submissions
    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const recentSubmissions = await CustomerSubmission.countDocuments({
      tableId: table._id,
      createdAt: { $gte: tenMinsAgo },
    });
    if (recentSubmissions >= qrOrderingSettings.maxSubmissionsPerTablePer10Min) {
      logger.warn(
        { tableNumber: table.number, ipHash: crypto.createHash('sha256').update(params.clientIp).digest('hex') },
        'Rate limit: Table exceeded max submissions per 10 minutes'
      );
      throw new AppError(
        'Too many submissions from this table recently. Please wait a few moments before ordering again.',
        429,
        'TABLE_RATE_LIMITED'
      );
    }

    const pendingSubmissions = await CustomerSubmission.countDocuments({
      tableId: table._id,
      status: 'new',
    });
    if (pendingSubmissions >= qrOrderingSettings.maxPendingCustomerSubmissionsPerTable) {
      throw new AppError(
        'Please wait for the kitchen to begin preparing your previous order before submitting more.',
        429,
        'TOO_MANY_PENDING_ORDERS'
      );
    }

    // 8. Idempotency Check
    const rawStatusToken = deriveStatusToken(params.idempotencyKey, table._id.toString());
    const publicAccessTokenHash = crypto.createHash('sha256').update(rawStatusToken).digest('hex');

    const existingSubmission = await CustomerSubmission.findOne({
      tableId: table._id,
      idempotencyKey: params.idempotencyKey,
    });
    if (existingSubmission) {
      return {
        submissionId: existingSubmission.submissionId,
        statusToken: rawStatusToken,
        kotNo: existingSubmission.kotNo,
        items: existingSubmission.itemSummaries,
        undoUntil: existingSubmission.undoUntil.toISOString(),
      };
    }

    // 9. Customer Name & Phone Normalization
    const trimmedName = params.customerName.replace(/[\x00-\x1F\x7F]/g, '').trim();
    if (trimmedName.length < qrOrderingSettings.nameMinChars || trimmedName.length > qrOrderingSettings.nameMaxChars) {
      throw new AppError(
        `Name must be between ${qrOrderingSettings.nameMinChars} and ${qrOrderingSettings.nameMaxChars} characters.`,
        400,
        'INVALID_NAME'
      );
    }

    let normalizedPhone: string | null = null;
    if (params.customerPhone && params.customerPhone.trim().length > 0) {
      normalizedPhone = normalizeIndianPhone(params.customerPhone);
    }

    // 10. Authoritative Server Pricing & Availability Verification
    // All-or-nothing: if ANY item is unavailable/inactive/archived, reject whole order
    const resolvedLines: IOrderItem[] = [];
    const itemSummaries: ICustomerSubmissionItem[] = [];
    const submissionId = crypto.randomUUID();

    for (const line of params.lines) {
      const menuItem = await MenuItem.findById(line.menuItemId);
      if (!menuItem || !menuItem.isActive || menuItem.archivedAt || !menuItem.isAvailable) {
        throw new AppError(
          `Item "${menuItem?.name || 'Selected item'}" is currently unavailable or out of stock.`,
          400,
          'ITEM_UNAVAILABLE',
          { unavailableItem: menuItem?.name || 'Item' }
        );
      }

      let unitPrice = menuItem.basePrice;
      let variantName: string | undefined;

      if (line.variantName) {
        const variant = menuItem.variants.find(
          (v) => v.name.toLowerCase() === line.variantName?.toLowerCase()
        );
        if (!variant) {
          throw new AppError(
            `Selected portion "${line.variantName}" not found for "${menuItem.name}".`,
            400,
            'ITEM_UNAVAILABLE'
          );
        }
        unitPrice = variant.price;
        variantName = variant.name;
      }

      const lineId = crypto.randomUUID();
      const sanitizedNote = line.note ? line.note.trim().slice(0, 100) : undefined;

      resolvedLines.push({
        lineId,
        menuItemId: menuItem._id,
        nameSnapshot: menuItem.name,
        variantName,
        unitPrice,
        gstRateSnapshot: menuItem.gstRate,
        foodTypeSnapshot: menuItem.foodType,
        qty: line.qty,
        note: sanitizedNote,
        status: 'active',
        source: 'customer',
        submissionId,
      });

      itemSummaries.push({
        lineId,
        nameSnapshot: menuItem.name,
        variantName,
        qty: line.qty,
        note: sanitizedNote,
      });
    }

    // 11. Find or Atomically Open Dine-In Order for Table
    const istNow = DateTime.fromJSDate(now, { zone: 'Asia/Kolkata' });
    const localDate = istNow.toFormat('yyyy-MM-dd');
    let order: IOrder | null = await Order.findOne({
      tableId: table._id,
      type: 'dine_in',
      status: 'open',
    });

    if (!order) {
      // Free table: open new dine-in order with concurrency protection
      const orderKey = `order:${localDate}`;
      const seq = await getNextSequence(orderKey);
      const orderNo = `T-${seq.toString().padStart(3, '0')}`;

      try {
        order = await Order.create({
          orderNo,
          localDate,
          type: 'dine_in',
          tableId: table._id,
          tableNumber: table.number,
          customerName: trimmedName,
          customerPhone: normalizedPhone || undefined,
          status: 'open',
          items: [],
          kots: [],
          discount: null,
          version: 0,
          openedBy: null,
          hasUnacknowledgedCustomerSubmission: true,
        });
      } catch (err: unknown) {
        // Concurrency: if another customer or staff opened an order right at this instant
        if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
          order = await Order.findOne({
            tableId: table._id,
            type: 'dine_in',
            status: 'open',
          });
          if (!order) {
            throw new AppError('Unable to open order for table. Please retry.', 409, 'ORDER_CONFLICT');
          }
        } else {
          throw err;
        }
      }
    }

    // 12. Create Single KOT Immediately and Append Lines
    const kotKey = `kot:${localDate}`;
    const kotSeq = await getNextSequence(kotKey);
    const kotNo = `KOT-${kotSeq.toString().padStart(3, '0')}`;
    const kotId = crypto.randomUUID();
    const sentAt = now;

    const lineIds: string[] = [];
    for (const line of resolvedLines) {
      line.kotId = kotId;
      line.sentAt = sentAt;
      lineIds.push(line.lineId);
    }

    const kot: IOrderKot = {
      kotId,
      kotNo,
      itemLineIds: lineIds,
      sentAt,
      sentBy: null,
      status: 'new',
      receivedAt: sentAt,
      startedAt: null,
      readyAt: null,
      servedAt: null,
      startedBy: null,
      readyBy: null,
      servedBy: null,
      source: 'customer',
      customerName: trimmedName,
      submissionId,
    };

    // Concurrency retry loop to push lines and KOT
    if (!order) {
      throw new AppError('Unable to open order for table', 500);
    }
    let currentOrder: IOrder = order;
    let attempts = 0;
    let savedOrder: IOrder | null = null;

    while (attempts < 3) {
      attempts++;
      const currentVersion = currentOrder.version;

      const updated: IOrder | null = await Order.findOneAndUpdate(
        { _id: currentOrder._id, version: currentVersion, status: 'open' },
        {
          $push: {
            items: { $each: resolvedLines },
            kots: kot,
            idempotencyKeys: params.idempotencyKey,
          },
          $set: { hasUnacknowledgedCustomerSubmission: true },
          $inc: { version: 1 },
        },
        { new: true }
      );

      if (updated) {
        savedOrder = updated;
        break;
      }

      const reloaded: IOrder | null = await Order.findById(currentOrder._id);
      if (!reloaded || reloaded.status !== 'open') {
        throw new AppError('Order state changed while processing. Please retry.', 409, 'ORDER_LOCKED');
      }
      currentOrder = reloaded;
    }

    if (!savedOrder) {
      throw new AppError('Concurrent order update failed. Please try again.', 409, 'CONFLICT');
    }

    // 13. Save Customer Submission Record
    const undoUntil = new Date(now.getTime() + qrOrderingSettings.undoWindowSeconds * 1000);
    const ipHash = crypto.createHash('sha256').update(params.clientIp).digest('hex');
    const userAgentHash = crypto.createHash('sha256').update(params.userAgent || '').digest('hex');

    await CustomerSubmission.create({
      submissionId,
      orderId: savedOrder._id,
      tableId: table._id,
      tableNumber: table.number,
      customerName: trimmedName,
      customerPhone: normalizedPhone,
      kotId,
      kotNo,
      itemSummaries,
      ipHash,
      userAgentHash,
      idempotencyKey: params.idempotencyKey,
      status: 'new',
      publicAccessTokenHash,
      undoUntil,
    });

    // 14. Emit Real-time Events AFTER Commit (Zero customer names or phones in payload)
    realtimeService.emit(
      REALTIME_EVENTS.ORDER_CUSTOMER_SUBMITTED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: savedOrder._id.toString(),
        kotId,
        submissionId,
        tableId: table._id.toString(),
      }
    );

    realtimeService.emit(
      REALTIME_EVENTS.KOT_CREATED,
      [REALTIME_ROOMS.KITCHEN, REALTIME_ROOMS.POS],
      {
        orderId: savedOrder._id.toString(),
        kotId,
        kotNo,
        orderNo: savedOrder.orderNo,
        tableNumber: savedOrder.tableNumber ?? null,
      }
    );

    realtimeService.emit(
      REALTIME_EVENTS.ORDER_UPDATED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: savedOrder._id.toString(),
        tableId: savedOrder.tableId ? savedOrder.tableId.toString() : null,
        version: savedOrder.version,
      }
    );

    realtimeService.emit(
      REALTIME_EVENTS.TABLE_STATE_CHANGED,
      REALTIME_ROOMS.POS,
      { tableId: table._id.toString() }
    );

    return {
      submissionId,
      statusToken: rawStatusToken,
      kotNo,
      items: itemSummaries,
      undoUntil: undoUntil.toISOString(),
    };
  },

  /**
   * Retrieves status of a single customer submission via hashed token.
   * Enforces data minimization: no phone, no prices of other submissions, no staff names.
   */
  async getSubmissionStatus(rawToken: string, now = new Date()) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const submission = await CustomerSubmission.findOne({ publicAccessTokenHash: hash });
    if (!submission) {
      throw new AppError('Order status not found or link has expired', 404, 'NOT_FOUND');
    }

    const order = await Order.findById(submission.orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    // Check link validity if order is paid or cancelled
    if (order.status === 'paid' || order.status === 'cancelled') {
      const closedAt = order.closedAt || order.updatedAt;
      const expiryTime = new Date(
        new Date(closedAt).getTime() + qrOrderingSettings.statusLinkValidHoursAfterClose * 3600 * 1000
      );
      if (now > expiryTime) {
        throw new AppError('This order status link has expired.', 410, 'LINK_EXPIRED');
      }
    }

    // Sync status with current KOT status if changed by kitchen
    const currentKot = order.kots.find((k) => k.kotId === submission.kotId);
    if (currentKot && currentKot.status !== submission.status) {
      submission.status = currentKot.status;
      await submission.save();
    }

    const customerStatus = mapKotStatusToCustomerStatus(submission.status);
    const undoAllowed = submission.status === 'new' && now < submission.undoUntil;

    return {
      submissionId: submission.submissionId,
      tableNumber: submission.tableNumber,
      status: customerStatus,
      kotStatus: submission.status,
      items: submission.itemSummaries,
      createdAt: submission.createdAt.toISOString(),
      undoUntil: submission.undoUntil.toISOString(),
      undoAllowed,
      serverTime: now.toISOString(),
    };
  },

  /**
   * Customer undo cancellation: allowed only while KOT is "new" AND within undoWindowSeconds.
   */
  async cancelSubmission(rawToken: string, now = new Date()) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const submission = await CustomerSubmission.findOne({ publicAccessTokenHash: hash });
    if (!submission) {
      throw new AppError('Order submission not found', 404, 'NOT_FOUND');
    }

    if (submission.status === 'cancelled') {
      return { success: true, message: 'Order is already cancelled' };
    }

    const order = await Order.findById(submission.orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    const kot = order.kots.find((k) => k.kotId === submission.kotId);
    if (!kot) {
      throw new AppError('Kitchen ticket not found', 404, 'NOT_FOUND');
    }

    if (kot.status !== 'new') {
      throw new AppError(
        'The kitchen has already started your order. Please ask our staff.',
        409,
        'KITCHEN_ALREADY_STARTED'
      );
    }

    if (now > submission.undoUntil) {
      throw new AppError(
        'The 60-second cancellation window has expired. Please ask our staff to adjust your order.',
        400,
        'UNDO_WINDOW_EXPIRED'
      );
    }

    // Cancel line items of this submission
    for (const item of order.items) {
      if (item.submissionId === submission.submissionId) {
        item.status = 'cancelled';
        item.cancelReason = 'customer_undo';
      }
    }

    // Cancel KOT
    kot.status = 'cancelled';
    order.version += 1;
    await order.save();

    // Update submission
    submission.status = 'cancelled';
    submission.cancelledByCustomerAt = now;
    await submission.save();

    // Audit log
    await auditService.log({
      action: 'order.customer_cancelled',
      entityType: 'CustomerSubmission',
      entityId: submission.submissionId,
      metadata: {
        tableNumber: submission.tableNumber,
        kotNo: submission.kotNo,
        itemsCount: submission.itemSummaries.length,
      },
    });

    // Real-time events
    realtimeService.emit(
      REALTIME_EVENTS.KOT_STATUS_CHANGED,
      [REALTIME_ROOMS.KITCHEN, REALTIME_ROOMS.POS],
      {
        orderId: order._id.toString(),
        kotId: kot.kotId,
        status: 'cancelled',
        kotNo: kot.kotNo,
        tableNumber: order.tableNumber ?? null,
      }
    );

    realtimeService.emit(
      REALTIME_EVENTS.ORDER_UPDATED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: order._id.toString(),
        tableId: order.tableId ? order.tableId.toString() : null,
        version: order.version,
      }
    );

    return {
      success: true,
      status: 'Cancelled',
      message: 'Your order was successfully cancelled.',
    };
  },

  /**
   * Retrieves all unacknowledged customer submissions today for staff POS tray.
   */
  async getPendingCustomerOrders(canViewPhone: boolean) {
    const istNow = DateTime.now().setZone('Asia/Kolkata');
    const startOfToday = istNow.startOf('day').toJSDate();

    const pending = await CustomerSubmission.find({
      acknowledgedAt: null,
      createdAt: { $gte: startOfToday },
      status: { $ne: 'cancelled' },
    }).sort({ createdAt: -1 });

    return pending.map((sub) => {
      const totalQty = sub.itemSummaries.reduce((sum, item) => sum + item.qty, 0);
      return {
        submissionId: sub.submissionId,
        orderId: sub.orderId.toString(),
        tableNumber: sub.tableNumber,
        customerName: sub.customerName,
        customerPhone: canViewPhone ? sub.customerPhone : undefined,
        itemCount: totalQty,
        kotStatus: sub.status,
        createdAt: sub.createdAt.toISOString(),
      };
    });
  },

  /**
   * Marks a customer submission alert acknowledged for everyone.
   * Repeat calls are idempotent.
   */
  async acknowledgeSubmission(submissionId: string, userId: string) {
    const submission = await CustomerSubmission.findOne({ submissionId });
    if (!submission) {
      throw new AppError('Customer submission not found', 404, 'NOT_FOUND');
    }

    if (!submission.acknowledgedAt) {
      submission.acknowledgedAt = new Date();
      submission.acknowledgedBy = new Types.ObjectId(userId);
      await submission.save();

      // Check if order has any remaining unacknowledged submissions
      const remainingUnacked = await CustomerSubmission.countDocuments({
        orderId: submission.orderId,
        acknowledgedAt: null,
      });

      if (remainingUnacked === 0) {
        await Order.findByIdAndUpdate(submission.orderId, {
          hasUnacknowledgedCustomerSubmission: false,
        });
      }

      realtimeService.emit(
        REALTIME_EVENTS.ORDER_UPDATED,
        [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
        {
          orderId: submission.orderId.toString(),
          tableId: submission.tableId.toString(),
          version: 0,
        }
      );
    }

    return { success: true, acknowledged: true };
  },
};
