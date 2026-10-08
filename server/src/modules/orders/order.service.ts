import crypto from 'crypto';
import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Order, IOrder, IOrderItem } from './models/order.model';
import { getNextSequence } from './models/counter.model';
import { Bill } from './models/bill.model';
import { Payment } from './models/payment.model';
import { MenuItem } from '../menu/models/MenuItem';
import { Table } from '../tables/table.model';
import { Reservation } from '../reservations/models/reservation.model';
import { calculateBill } from './billingCalculator';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { maskPhone } from '../reservations/reservationTime';
import { realtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS, REALTIME_ROOMS } from '../../config/realtimeEvents';
import { closingService } from '../closing/closing.service';
import { approvalService } from '../approvals/approval.service';
import { hasPermission, Role } from '../auth/permissions';

export interface CreateOrderParams {
  type: 'dine_in' | 'takeaway';
  tableId?: string;
  reservationId?: string;
  customerName?: string;
  customerPhone?: string;
  openedBy: string;
}

export interface AddItemsParams {
  idempotencyKey: string;
  items: {
    menuItemId: string;
    variantName?: string;
    qty: number;
    note?: string;
  }[];
  userId: string;
}

export const orderService = {
  /**
   * Retrieves all active tables with live occupancy states and open order summaries for the POS table map.
   */
  async getLivePosTables() {
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const todayLocalDate = nowIst.toFormat('yyyy-MM-dd');

    // 1. Fetch all active tables
    const tables = await Table.find({ isActive: true }).sort({ tableNumber: 1 });

    // 2. Fetch all running orders (open or billed)
    const runningOrders = await Order.find({
      status: { $in: ['open', 'billed'] },
      type: 'dine_in',
    });

    const orderMapByTable = new Map<string, IOrder>();
    for (const order of runningOrders) {
      if (order.tableId) {
        orderMapByTable.set(order.tableId.toString(), order);
      }
    }

    // 3. Fetch upcoming confirmed reservations starting within 60 minutes
    const nowUtc = new Date();
    const upcomingReservations = await Reservation.find({
      status: 'confirmed',
      localDate: todayLocalDate,
      startAt: {
        $gte: new Date(nowUtc.getTime() - 15 * 60 * 1000),
        $lte: new Date(nowUtc.getTime() + 60 * 60 * 1000),
      },
    });

    const reservationMapByTable = new Map<string, (typeof upcomingReservations)[0]>();
    for (const r of upcomingReservations) {
      if (r.tableIds && r.tableIds.length > 0) {
        for (const tid of r.tableIds) {
          reservationMapByTable.set(tid.toString(), r);
        }
      }
    }

    // 4. Construct table live states
    const result = tables.map((t) => {
      const order = orderMapByTable.get(t._id.toString());
      const reservation = reservationMapByTable.get(t._id.toString());

      let status: 'free' | 'occupied' | 'billed' | 'reserved_soon' = 'free';
      let openOrderSummary: {
        orderId: string;
        orderNo: string;
        itemsCount: number;
        runningTotalPaise: number;
        ageMinutes: number;
      } | null = null;

      let readyCount = 0;
      let oldestReadyMinutes = 0;

      if (order) {
        status = order.status === 'billed' ? 'billed' : 'occupied';

        const readyKots = order.kots.filter((k) => k.status === 'ready');
        readyCount = readyKots.length;
        if (readyCount > 0) {
          const nowMs = Date.now();
          const oldestReadyTime = Math.min(
            ...readyKots.map((k) => (k.readyAt ? new Date(k.readyAt).getTime() : nowMs))
          );
          oldestReadyMinutes = Math.max(0, Math.floor((nowMs - oldestReadyTime) / 60000));
        }

        const activeItems = order.items.filter((i) => i.status === 'active');
        const calc = calculateBill(
          activeItems.map((i) => ({
            qty: i.qty,
            unitPrice: i.unitPrice,
            gstRate: i.gstRateSnapshot,
          })),
          order.discount
        );

        const orderCreatedIst = DateTime.fromJSDate(order.createdAt).setZone('Asia/Kolkata');
        const ageMinutes = Math.max(0, Math.floor(nowIst.diff(orderCreatedIst, 'minutes').minutes));

        openOrderSummary = {
          orderId: order._id.toString(),
          orderNo: order.orderNo,
          itemsCount: activeItems.reduce((acc, i) => acc + i.qty, 0),
          runningTotalPaise: calc.grandTotal,
          ageMinutes,
        };
      } else if (reservation) {
        status = 'reserved_soon';
      }

      return {
        tableId: t._id.toString(),
        tableNumber: t.number,
        label: t.label,
        capacity: t.capacity,
        zone: t.zone,
        status,
        readyCount,
        oldestReadyMinutes,
        hasUnacknowledgedCustomerSubmission: !!order?.hasUnacknowledgedCustomerSubmission,
        openOrder: openOrderSummary,
        reservedSoon: reservation
          ? {
              reservationId: reservation._id.toString(),
              startTime: reservation.startAt.toISOString(),
              customerName: reservation.customerName,
              partySize: reservation.guests,
            }
          : null,
      };
    });

    return result;
  },

  /**
   * Opens a new dine-in or takeaway order.
   */
  async createOrder(params: CreateOrderParams) {
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const localDate = nowIst.toFormat('yyyy-MM-dd');

    let tableNumber: number | null = null;
    let matchedReservation: {
      reservationId: string;
      customerName: string;
      partySize: number;
      startTime: string;
    } | null = null;

    if (params.type === 'dine_in') {
      if (!params.tableId) {
        throw new AppError('tableId is required for dine-in orders', 400);
      }

      const table = await Table.findById(params.tableId);
      if (!table || !table.isActive) {
        throw new AppError('Selected table is invalid or inactive', 400);
      }
      tableNumber = table.number;

      // Check if table already has an active order
      const existing = await Order.findOne({
        tableId: params.tableId,
        type: 'dine_in',
        status: { $in: ['open', 'billed'] },
      });

      if (existing) {
        throw new AppError('Table already has an open order', 409, 'TABLE_OCCUPIED', {
          existingOrderId: existing._id.toString(),
        });
      }

      // Check if table has a confirmed reservation within +/- 30 minutes
      const nowUtc = new Date();
      const nearbyReservation = await Reservation.findOne({
        tableIds: params.tableId,
        status: 'confirmed',
        localDate,
        startAt: {
          $gte: new Date(nowUtc.getTime() - 30 * 60 * 1000),
          $lte: new Date(nowUtc.getTime() + 30 * 60 * 1000),
        },
      });

      if (nearbyReservation) {
        matchedReservation = {
          reservationId: nearbyReservation._id.toString(),
          customerName: nearbyReservation.customerName,
          partySize: nearbyReservation.guests,
          startTime: nearbyReservation.startAt.toISOString(),
        };
      }
    }

    // Atomic daily order sequence
    const orderKey = `order:${localDate}`;
    const seq = await getNextSequence(orderKey);
    const orderNo = `T-${seq.toString().padStart(3, '0')}`;

    try {
      const order = await Order.create({
        orderNo,
        localDate,
        type: params.type,
        tableId: params.tableId ? new Types.ObjectId(params.tableId) : null,
        tableNumber,
        reservationId: params.reservationId ? new Types.ObjectId(params.reservationId) : null,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        status: 'open',
        items: [],
        kots: [],
        discount: null,
        version: 0,
        openedBy: new Types.ObjectId(params.openedBy),
      });

      await auditService.log({
        actorId: params.openedBy,
        action: 'order.created',
        entityType: 'Order',
        entityId: order._id.toString(),
        metadata: {
          orderNo,
          type: params.type,
          tableNumber,
          customerPhone: params.customerPhone ? maskPhone(params.customerPhone) : undefined,
        },
      });

      realtimeService.emit(
        REALTIME_EVENTS.ORDER_UPDATED,
        [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
        {
          orderId: order._id.toString(),
          tableId: order.tableId ? order.tableId.toString() : null,
          version: order.version,
        }
      );
      if (order.tableId) {
        realtimeService.emit(
          REALTIME_EVENTS.TABLE_STATE_CHANGED,
          REALTIME_ROOMS.POS,
          { tableId: order.tableId.toString() }
        );
      }

      return {
        order,
        matchedReservation,
      };
    } catch (err: unknown) {
      // Catch MongoDB unique constraint violation on tableId partial index
      if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
        const existing = await Order.findOne({
          tableId: params.tableId,
          type: 'dine_in',
          status: { $in: ['open', 'billed'] },
        });
        throw new AppError('Table already has an open order', 409, 'TABLE_OCCUPIED', {
          existingOrderId: existing?._id.toString(),
        });
      }
      throw err;
    }
  },

  /**
   * Appends line items to an open order with idempotency protection and optimistic concurrency retries.
   */
  async addItems(orderId: string, params: AddItemsParams) {
    let order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.status !== 'open') {
      throw new AppError('Cannot add items to a billed, paid, or cancelled order', 409, 'ORDER_LOCKED');
    }

    // Idempotency: Return early if idempotencyKey was already recorded
    if (order.idempotencyKeys.includes(params.idempotencyKey)) {
      return order;
    }

    if (order.items.length + params.items.length > 60) {
      throw new AppError('Cannot exceed 60 items per order', 400);
    }

    // Resolve MenuItem price and availability snapshots from the database
    const resolvedLines: IOrderItem[] = [];
    for (const itemInput of params.items) {
      const menuItem = await MenuItem.findById(itemInput.menuItemId);
      if (!menuItem || !menuItem.isActive || menuItem.archivedAt || !menuItem.isAvailable) {
        throw new AppError(
          `Item "${menuItem?.name || 'Selected item'}" is unavailable or out of stock`,
          400,
          'ITEM_UNAVAILABLE'
        );
      }

      let unitPrice = menuItem.basePrice;
      let variantName: string | undefined;

      if (itemInput.variantName) {
        const variant = menuItem.variants.find(
          (v) => v.name.toLowerCase() === itemInput.variantName?.toLowerCase()
        );
        if (!variant) {
          throw new AppError(
            `Variant "${itemInput.variantName}" not found on item "${menuItem.name}"`,
            400,
            'ITEM_UNAVAILABLE'
          );
        }
        unitPrice = variant.price;
        variantName = variant.name;
      }

      resolvedLines.push({
        lineId: crypto.randomUUID(),
        menuItemId: menuItem._id,
        nameSnapshot: menuItem.name,
        variantName,
        unitPrice,
        gstRateSnapshot: menuItem.gstRate,
        foodTypeSnapshot: menuItem.foodType,
        qty: itemInput.qty,
        note: itemInput.note,
        status: 'active',
        addedBy: new Types.ObjectId(params.userId),
      });
    }

    // Optimistic concurrency retry loop (up to 3 attempts)
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      const currentVersion = order.version;

      const updated = await Order.findOneAndUpdate(
        { _id: order._id, version: currentVersion, status: 'open' },
        {
          $push: {
            items: { $each: resolvedLines },
            idempotencyKeys: params.idempotencyKey,
          },
          $inc: { version: 1 },
        },
        { new: true }
      );

      if (updated) {
        realtimeService.emit(
          REALTIME_EVENTS.ORDER_UPDATED,
          [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
          {
            orderId: updated._id.toString(),
            tableId: updated.tableId ? updated.tableId.toString() : null,
            version: updated.version,
          }
        );
        return updated;
      }

      // Version conflict or status change: reload latest order
      const reloaded = await Order.findById(orderId);
      if (!reloaded) throw new AppError('Order not found', 404);
      if (reloaded.status !== 'open') {
        throw new AppError('Cannot add items to a non-open order', 409, 'ORDER_LOCKED');
      }
      if (reloaded.idempotencyKeys.includes(params.idempotencyKey)) {
        return reloaded;
      }
      order = reloaded;
    }

    throw new AppError('Concurrent update conflict. Please try adding items again.', 409, 'CONFLICT');
  },

  /**
   * Updates an unsent draft line item.
   */
  async updateDraftItem(
    orderId: string,
    lineId: string,
    updates: { qty?: number; note?: string }
  ) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'open') throw new AppError('Order is not open', 409, 'ORDER_LOCKED');

    const itemIndex = order.items.findIndex((i) => i.lineId === lineId);
    if (itemIndex === -1) throw new AppError('Item line not found', 404);

    const item = order.items[itemIndex]!;
    if (item.sentAt || item.kotId) {
      throw new AppError('Sent items cannot be edited. Please cancel the item instead.', 400);
    }
    if (item.status === 'cancelled') {
      throw new AppError('Cancelled items cannot be edited', 400);
    }

    if (updates.qty !== undefined) {
      if (updates.qty <= 0) {
        order.items.splice(itemIndex, 1);
      } else {
        item.qty = updates.qty;
      }
    }
    if (updates.note !== undefined) {
      item.note = updates.note;
    }

    order.version += 1;
    await order.save();
    return order;
  },

  /**
   * Cancels a sent line item (requires orders:cancel permission or valid manager approval token).
   */
  async cancelItem(
    orderId: string,
    lineId: string,
    reason: string,
    userId: string,
    userRole?: string,
    approvalToken?: string
  ) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (order.status === 'paid' || order.status === 'cancelled') {
      throw new AppError('Cannot cancel item on paid or cancelled order', 409);
    }

    await closingService.assertDayNotClosed(order.localDate);

    const item = order.items.find((i) => i.lineId === lineId);
    if (!item) throw new AppError('Item line not found', 404);
    if (item.status === 'cancelled') throw new AppError('Item is already cancelled', 400);

    let approverInfo: { approverId: string; approverName: string } | undefined;
    const canCancelDirectly = userRole ? hasPermission(userRole as Role, 'orders:cancel') : true;

    if (!canCancelDirectly && (item.sentAt || item.kotId)) {
      if (!approvalToken) {
        throw new AppError(
          'Manager approval required to cancel an item sent to kitchen',
          403,
          'APPROVAL_REQUIRED',
          { action: 'order.item_cancel_after_kot' }
        );
      }

      const tokenResult = await approvalService.consumeApprovalToken({
        rawToken: approvalToken,
        action: 'order.item_cancel_after_kot',
        entityId: orderId,
        params: { lineId, reason },
        userId,
      });

      approverInfo = {
        approverId: tokenResult.approverId,
        approverName: tokenResult.approverName,
      };
    }

    const oldStatus = item.status;
    item.status = 'cancelled';
    item.cancelReason = reason;
    item.cancelledBy = new Types.ObjectId(userId);

    let kotCancelled = false;
    let cancelledKotNo: string | undefined;
    if (item.kotId) {
      const kot = order.kots.find((k) => k.kotId === item.kotId);
      if (kot) {
        cancelledKotNo = kot.kotNo;
        const kotLines = order.items.filter((i) => kot.itemLineIds.includes(i.lineId));
        const allCancelled = kotLines.every((i) => i.status === 'cancelled');
        if (allCancelled && kot.status !== 'served' && kot.status !== 'cancelled') {
          kot.status = 'cancelled';
          kotCancelled = true;
        }
      }
    }

    order.version += 1;
    await order.save();

    await auditService.log({
      actorId: userId,
      action: 'order.item_cancelled',
      entityType: 'Order',
      entityId: order._id.toString(),
      metadata: {
        lineId,
        itemName: item.nameSnapshot,
        reason,
        oldStatus,
        newStatus: 'cancelled',
        approvedBy: approverInfo?.approverId,
        approverName: approverInfo?.approverName,
      },
    });

    if (item.kotId) {
      realtimeService.emit(
        REALTIME_EVENTS.KOT_ITEM_CANCELLED,
        [REALTIME_ROOMS.KITCHEN, REALTIME_ROOMS.POS],
        {
          orderId: order._id.toString(),
          kotId: item.kotId,
          lineId,
          kotNo: cancelledKotNo,
          tableNumber: order.tableNumber ?? null,
        }
      );
      if (kotCancelled) {
        realtimeService.emit(
          REALTIME_EVENTS.KOT_STATUS_CHANGED,
          [REALTIME_ROOMS.KITCHEN, REALTIME_ROOMS.POS],
          {
            orderId: order._id.toString(),
            kotId: item.kotId,
            status: 'cancelled',
            kotNo: cancelledKotNo,
            tableNumber: order.tableNumber ?? null,
          }
        );
      }
    }

    realtimeService.emit(
      REALTIME_EVENTS.ORDER_UPDATED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: order._id.toString(),
        tableId: order.tableId ? order.tableId.toString() : null,
        version: order.version,
      }
    );

    return order;
  },

  /**
   * Batches all unsent items into a KOT and increments the daily KOT sequence.
   */
  async sendKot(orderId: string, userId: string) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'open') throw new AppError('Cannot send KOT for non-open order', 409);

    const unsentLines = order.items.filter((i) => i.status === 'active' && !i.sentAt);
    if (unsentLines.length === 0) {
      throw new AppError('No unsent items in order to send to kitchen', 400, 'NO_UNSENT_ITEMS');
    }

    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const todayLocalDate = nowIst.toFormat('yyyy-MM-dd');
    const kotKey = `kot:${todayLocalDate}`;
    const seq = await getNextSequence(kotKey);
    const kotNo = `KOT-${seq.toString().padStart(3, '0')}`;
    const kotId = crypto.randomUUID();
    const sentAt = new Date();

    const lineIds: string[] = [];
    for (const line of unsentLines) {
      line.kotId = kotId;
      line.sentAt = sentAt;
      lineIds.push(line.lineId);
    }

    const kot = {
      kotId,
      kotNo,
      itemLineIds: lineIds,
      sentAt,
      sentBy: new Types.ObjectId(userId),
      status: 'new' as const,
      receivedAt: sentAt,
      startedAt: null,
      readyAt: null,
      servedAt: null,
      startedBy: null,
      readyBy: null,
      servedBy: null,
    };

    order.kots.push(kot);
    order.version += 1;
    await order.save();

    realtimeService.emit(
      REALTIME_EVENTS.KOT_CREATED,
      [REALTIME_ROOMS.KITCHEN, REALTIME_ROOMS.POS],
      {
        orderId: order._id.toString(),
        kotId,
        kotNo,
        orderNo: order.orderNo,
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

    return { order, kot };
  },

  /**
   * Transfers an open dine-in order to another free table.
   */
  async transferTable(orderId: string, toTableId: string, userId: string) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'open') throw new AppError('Only open orders can be transferred', 409);
    if (order.type !== 'dine_in') throw new AppError('Takeaway orders cannot be transferred to a table', 400);

    const targetTable = await Table.findById(toTableId);
    if (!targetTable || !targetTable.isActive) {
      throw new AppError('Target table is invalid or inactive', 400);
    }

    if (order.tableId?.toString() === toTableId) {
      return order; // same table
    }

    // Check if target table is occupied
    const occupied = await Order.findOne({
      tableId: toTableId,
      type: 'dine_in',
      status: { $in: ['open', 'billed'] },
    });
    if (occupied) {
      throw new AppError('Target table is already occupied', 409, 'TABLE_OCCUPIED');
    }

    const oldTableNumber = order.tableNumber;
    order.tableId = targetTable._id;
    order.tableNumber = targetTable.number;
    order.version += 1;
    await order.save();

    await auditService.log({
      actorId: userId,
      action: 'order.table_transferred',
      entityType: 'Order',
      entityId: order._id.toString(),
      metadata: {
        fromTableNumber: oldTableNumber,
        toTableNumber: targetTable.number,
      },
    });

    realtimeService.emit(
      REALTIME_EVENTS.ORDER_UPDATED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: order._id.toString(),
        tableId: order.tableId ? order.tableId.toString() : null,
        version: order.version,
      }
    );
    realtimeService.emit(REALTIME_EVENTS.TABLE_STATE_CHANGED, REALTIME_ROOMS.POS, {
      tableId: targetTable._id.toString(),
    });

    return order;
  },

  /**
   * Applies flat or percent discount to an open order.
   */
  async applyDiscount(
    orderId: string,
    params: { type: 'flat' | 'percent'; value: number; reason: string; approvalToken?: string },
    userId: string,
    userRole?: string
  ) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'open') throw new AppError('Order is not open', 409);

    await closingService.assertDayNotClosed(order.localDate);

    let approverInfo: { approverId: string; approverName: string } | undefined;
    const canDiscountDirectly = userRole ? hasPermission(userRole as Role, 'orders:discount') : true;

    if (!canDiscountDirectly) {
      if (!params.approvalToken) {
        throw new AppError(
          'Manager approval required for discounts',
          403,
          'APPROVAL_REQUIRED',
          { action: 'discount.apply' }
        );
      }

      const tokenResult = await approvalService.consumeApprovalToken({
        rawToken: params.approvalToken,
        action: 'discount.apply',
        entityId: orderId,
        params: { type: params.type, value: params.value, reason: params.reason },
        userId,
      });

      approverInfo = {
        approverId: tokenResult.approverId,
        approverName: tokenResult.approverName,
      };
    }

    if (params.value === 0) {
      order.discount = null;
    } else {
      order.discount = {
        type: params.type,
        value: params.value,
        reason: params.reason,
        appliedBy: new Types.ObjectId(userId),
      };
    }

    order.version += 1;
    await order.save();

    await auditService.log({
      actorId: userId,
      action: 'order.discount_applied',
      entityType: 'Order',
      entityId: order._id.toString(),
      metadata: {
        discountType: params.type,
        discountValue: params.value,
        reason: params.reason,
        approvedBy: approverInfo?.approverId,
        approverName: approverInfo?.approverName,
      },
    });

    return order;
  },

  /**
   * Cancels a whole order if no recorded payments exist.
   */
  async cancelOrder(orderId: string, reason: string, userId: string) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (order.status === 'cancelled') throw new AppError('Order is already cancelled', 400);

    await closingService.assertDayNotClosed(order.localDate);

    // Safeguard: Check for recorded payments
    const payment = await Payment.findOne({ orderId, status: 'recorded' });
    if (payment) {
      throw new AppError('Cannot cancel an order with recorded payments', 409, 'ORDER_HAS_PAYMENTS');
    }

    if (order.billId) {
      const bill = await Bill.findById(order.billId);
      if (bill && bill.status !== 'void') {
        bill.status = 'void';
        bill.voidReason = `Order cancelled: ${reason}`;
        bill.voidedBy = new Types.ObjectId(userId);
        bill.voidedAt = new Date();
        await bill.save();
      }
    }

    order.status = 'cancelled';
    order.closedAt = new Date();
    order.version += 1;
    await order.save();

    await auditService.log({
      actorId: userId,
      action: 'order.cancelled',
      entityType: 'Order',
      entityId: order._id.toString(),
      metadata: {
        orderNo: order.orderNo,
        reason,
      },
    });

    realtimeService.emit(
      REALTIME_EVENTS.ORDER_UPDATED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: order._id.toString(),
        tableId: order.tableId ? order.tableId.toString() : null,
        version: order.version,
      }
    );
    if (order.tableId) {
      realtimeService.emit(REALTIME_EVENTS.TABLE_STATE_CHANGED, REALTIME_ROOMS.POS, {
        tableId: order.tableId.toString(),
      });
    }

    return order;
  },

  /**
   * Reopens an unpaid billed order (voids the issued bill).
   */
  async reopenOrder(orderId: string, reason: string, userId: string) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'billed') {
      throw new AppError('Only billed orders can be reopened', 409);
    }

    await closingService.assertDayNotClosed(order.localDate);

    // Safeguard: Check for recorded payments
    const payment = await Payment.findOne({ orderId, status: 'recorded' });
    if (payment) {
      throw new AppError(
        'Cannot reopen an order with recorded payments. Reverse payments first.',
        409,
        'BILL_HAS_PAYMENTS'
      );
    }

    if (order.billId) {
      const bill = await Bill.findById(order.billId);
      if (bill && bill.status !== 'void') {
        bill.status = 'void';
        bill.voidReason = reason;
        bill.voidedBy = new Types.ObjectId(userId);
        bill.voidedAt = new Date();
        await bill.save();

        await auditService.log({
          actorId: userId,
          action: 'bill.voided',
          entityType: 'Bill',
          entityId: bill._id.toString(),
          metadata: {
            invoiceNo: bill.invoiceNo,
            reason,
          },
        });
      }
    }

    order.status = 'open';
    order.billId = null;
    order.version += 1;
    await order.save();

    await auditService.log({
      actorId: userId,
      action: 'order.reopened',
      entityType: 'Order',
      entityId: order._id.toString(),
      metadata: {
        orderNo: order.orderNo,
        reason,
      },
    });

    realtimeService.emit(
      REALTIME_EVENTS.ORDER_UPDATED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: order._id.toString(),
        tableId: order.tableId ? order.tableId.toString() : null,
        version: order.version,
      }
    );
    if (order.tableId) {
      realtimeService.emit(REALTIME_EVENTS.TABLE_STATE_CHANGED, REALTIME_ROOMS.POS, {
        tableId: order.tableId.toString(),
      });
    }

    return order;
  },

  /**
   * Retrieves order by ID with calculated live summary.
   */
  async getOrderById(orderId: string) {
    const order = await Order.findById(orderId).populate('openedBy', 'name username role');
    if (!order) throw new AppError('Order not found', 404);

    const activeItems = order.items.filter((i) => i.status === 'active');
    const calc = calculateBill(
      activeItems.map((i) => ({
        lineId: i.lineId,
        qty: i.qty,
        unitPrice: i.unitPrice,
        gstRate: i.gstRateSnapshot,
      })),
      order.discount
    );

    return {
      order,
      calculated: calc,
    };
  },

  /**
   * Retrieves paginated order history with search and filtering.
   */
  async getOrders(params: {
    date?: string;
    status?: string;
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const targetDate = params.date || nowIst.toFormat('yyyy-MM-dd');
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const filter: Record<string, unknown> = {
      localDate: targetDate,
    };

    if (params.status) {
      filter.status = params.status;
    }
    if (params.type) {
      filter.type = params.type;
    }

    if (params.search) {
      const s = params.search.trim();
      const num = parseInt(s, 10);
      filter.$or = [
        { orderNo: { $regex: s, $options: 'i' } },
        ...(isNaN(num) ? [] : [{ tableNumber: num }]),
      ];
    }

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('openedBy', 'name username');

    return {
      orders,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  },
};
