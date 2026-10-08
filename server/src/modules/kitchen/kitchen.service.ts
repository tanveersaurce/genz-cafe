import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { Order, IOrder, IOrderKot } from '../orders/models/order.model';
import { AppError } from '../../utils/AppError';
import { realtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS, REALTIME_ROOMS } from '../../config/realtimeEvents';

export interface KitchenItemDto {
  lineId: string;
  name: string;
  variant?: string;
  qty: number;
  note?: string;
  foodType: 'veg' | 'non_veg' | 'egg';
  status: 'active' | 'cancelled';
}

export interface KitchenKotDto {
  kotId: string;
  kotNo: string;
  orderId: string;
  orderNo: string;
  orderType: 'dine_in' | 'takeaway';
  tableNumber: number | null;
  customerName?: string | null;
  source?: 'staff' | 'customer';
  status: 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
  timestamps: {
    sentAt: string;
    receivedAt: string;
    startedAt: string | null;
    readyAt: string | null;
    servedAt: string | null;
  };
  items: KitchenItemDto[];
}

export interface KitchenBoardDto {
  serverTime: string;
  activeKots: KitchenKotDto[];
  recentlyServedKots: KitchenKotDto[];
}

export interface PosReadyKotDto {
  kotId: string;
  kotNo: string;
  orderId: string;
  orderNo: string;
  orderType: 'dine_in' | 'takeaway';
  tableNumber: number | null;
  tableId: string | null;
  readyAt: string;
  waitingMinutes: number;
  itemCount: number;
}

export const kitchenService = {
  /**
   * Retrieves active KOTs today (new, preparing, ready) and recently served KOTs (past 20 mins) for Recall.
   * Strips out ALL prices, customer names, phone numbers, and billing details.
   */
  async getKitchenBoard(): Promise<KitchenBoardDto> {
    const now = new Date();
    const serverTime = now.toISOString();
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const todayLocalDate = nowIst.toFormat('yyyy-MM-dd');
    const twentyMinsAgo = new Date(now.getTime() - 20 * 60 * 1000);

    // 1. Fetch today's orders (both active and settled within recall window)
    const orders = await Order.find({
      localDate: todayLocalDate,
    }).lean();

    const activeKots: KitchenKotDto[] = [];
    const recentlyServedKots: KitchenKotDto[] = [];

    for (const order of orders) {
      const isOrderActive = order.status === 'open' || order.status === 'billed';

      for (const kot of order.kots) {
        // Map KOT items snapshot (stripping sensitive financial & PII data)
        const items: KitchenItemDto[] = [];
        for (const lineId of kot.itemLineIds) {
          const item = order.items.find((i) => i.lineId === lineId);
          if (item) {
            items.push({
              lineId: item.lineId,
              name: item.nameSnapshot,
              variant: item.variantName,
              qty: item.qty,
              note: item.note,
              foodType: item.foodTypeSnapshot,
              status: item.status,
            });
          }
        }

        const kotDto: KitchenKotDto = {
          kotId: kot.kotId,
          kotNo: kot.kotNo,
          orderId: order._id.toString(),
          orderNo: order.orderNo,
          orderType: order.type,
          tableNumber: order.tableNumber ?? null,
          customerName: kot.customerName || (kot.source === 'customer' ? order.customerName : null) || null,
          source: (kot.source as 'staff' | 'customer') || 'staff',
          status: kot.status || 'served', // legacy fallback
          timestamps: {
            sentAt: kot.sentAt ? new Date(kot.sentAt).toISOString() : new Date().toISOString(),
            receivedAt: kot.receivedAt ? new Date(kot.receivedAt).toISOString() : new Date().toISOString(),
            startedAt: kot.startedAt ? new Date(kot.startedAt).toISOString() : null,
            readyAt: kot.readyAt ? new Date(kot.readyAt).toISOString() : null,
            servedAt: kot.servedAt ? new Date(kot.servedAt).toISOString() : null,
          },
          items,
        };

        // Active board: only for active orders and non-final KOT statuses
        if (
          isOrderActive &&
          (kot.status === 'new' || kot.status === 'preparing' || kot.status === 'ready')
        ) {
          activeKots.push(kotDto);
        } else if (
          kot.status === 'served' &&
          kot.servedAt &&
          new Date(kot.servedAt) >= twentyMinsAgo
        ) {
          // Recently served recall window
          recentlyServedKots.push(kotDto);
        }
      }
    }

    // Sort active KOTs oldest first (receivedAt ascending)
    activeKots.sort(
      (a, b) => new Date(a.timestamps.receivedAt).getTime() - new Date(b.timestamps.receivedAt).getTime()
    );

    // Sort recently served newest first (servedAt descending)
    recentlyServedKots.sort(
      (a, b) =>
        new Date(b.timestamps.servedAt || 0).getTime() - new Date(a.timestamps.servedAt || 0).getTime()
    );

    return {
      serverTime,
      activeKots,
      recentlyServedKots,
    };
  },

  /**
   * Updates KOT status within the Kitchen workflow (new -> preparing -> ready, or bump back).
   * Implements Compare-and-Set with idempotent return if target status already matches.
   */
  async updateKotStatus(
    kotId: string,
    to: 'preparing' | 'ready',
    expectedFrom: 'new' | 'preparing' | 'ready',
    userId: string
  ): Promise<{ order: IOrder; kot: IOrderKot; idempotent: boolean }> {
    const order = await Order.findOne({ 'kots.kotId': kotId });
    if (!order) {
      throw new AppError('KOT not found', 404, 'KOT_NOT_FOUND');
    }

    const kot = order.kots.find((k) => k.kotId === kotId);
    if (!kot) {
      throw new AppError('KOT not found', 404, 'KOT_NOT_FOUND');
    }

    // 1. Idempotency Check
    if (kot.status === to) {
      return { order, kot, idempotent: true };
    }

    // 2. Terminal State Validation
    if (kot.status === 'served' || kot.status === 'cancelled') {
      throw new AppError(
        `Cannot update KOT in final status '${kot.status}'`,
        409,
        'KOT_STATUS_FINAL'
      );
    }

    // 3. Expected Current Status Validation
    if (kot.status !== expectedFrom) {
      throw new AppError(
        `KOT is currently '${kot.status}', expected '${expectedFrom}'`,
        409,
        'KOT_STATUS_CONFLICT'
      );
    }

    // 4. Validate allowed transitions
    const isValidTransition =
      (expectedFrom === 'new' && to === 'preparing') ||
      (expectedFrom === 'preparing' && to === 'ready') ||
      (expectedFrom === 'ready' && to === 'preparing'); // bump back

    if (!isValidTransition) {
      throw new AppError(
        `Invalid status transition from '${expectedFrom}' to '${to}'`,
        409,
        'INVALID_KOT_TRANSITION'
      );
    }

    // 5. Build atomic update payload
    const now = new Date();
    const updateFields: Record<string, unknown> = {
      'kots.$.status': to,
    };

    if (to === 'preparing') {
      if (expectedFrom === 'ready') {
        // Bump back: revert ready state
        updateFields['kots.$.readyAt'] = null;
        updateFields['kots.$.readyBy'] = null;
      } else {
        // First start
        updateFields['kots.$.startedAt'] = now;
        updateFields['kots.$.startedBy'] = new Types.ObjectId(userId);
      }
    } else if (to === 'ready') {
      updateFields['kots.$.readyAt'] = now;
      updateFields['kots.$.readyBy'] = new Types.ObjectId(userId);
    }

    // 6. Atomic CAS findOneAndUpdate
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        'kots.kotId': kotId,
        'kots.status': expectedFrom,
      },
      {
        $set: updateFields,
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updatedOrder) {
      // Check if parallel request already transitioned to the desired target status
      const refreshedOrder = await Order.findById(order._id);
      const currentKot = refreshedOrder?.kots.find((k) => k.kotId === kotId);
      if (currentKot && currentKot.status === to) {
        return { order: refreshedOrder!, kot: currentKot, idempotent: true };
      }

      throw new AppError(
        `KOT status was modified concurrently (current: ${currentKot?.status || 'unknown'})`,
        409,
        'CONCURRENT_MODIFICATION'
      );
    }

    const updatedKot = updatedOrder.kots.find((k) => k.kotId === kotId)!;

    // 7. Emit real-time events (non-blocking)
    realtimeService.emit(
      REALTIME_EVENTS.KOT_STATUS_CHANGED,
      [REALTIME_ROOMS.KITCHEN, REALTIME_ROOMS.POS],
      {
        orderId: updatedOrder._id.toString(),
        kotId,
        status: to,
        kotNo: updatedKot.kotNo,
        tableNumber: updatedOrder.tableNumber ?? null,
      }
    );

    realtimeService.emit(
      REALTIME_EVENTS.ORDER_UPDATED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: updatedOrder._id.toString(),
        tableId: updatedOrder.tableId ? updatedOrder.tableId.toString() : null,
        version: updatedOrder.version,
      }
    );

    return { order: updatedOrder, kot: updatedKot, idempotent: false };
  },

  /**
   * Marks a ready KOT as served (Waitstaff action via POS).
   */
  async markKotServed(
    kotId: string,
    userId: string
  ): Promise<{ order: IOrder; kot: IOrderKot; idempotent: boolean }> {
    const order = await Order.findOne({ 'kots.kotId': kotId });
    if (!order) {
      throw new AppError('KOT not found', 404, 'KOT_NOT_FOUND');
    }

    const kot = order.kots.find((k) => k.kotId === kotId);
    if (!kot) {
      throw new AppError('KOT not found', 404, 'KOT_NOT_FOUND');
    }

    // Idempotent return if already served
    if (kot.status === 'served') {
      return { order, kot, idempotent: true };
    }

    if (kot.status !== 'ready') {
      throw new AppError(
        `KOT must be in 'ready' status to be marked served (currently '${kot.status}')`,
        409,
        'KOT_NOT_READY'
      );
    }

    const now = new Date();
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        'kots.kotId': kotId,
        'kots.status': 'ready',
      },
      {
        $set: {
          'kots.$.status': 'served',
          'kots.$.servedAt': now,
          'kots.$.servedBy': new Types.ObjectId(userId),
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updatedOrder) {
      const refreshedOrder = await Order.findById(order._id);
      const currentKot = refreshedOrder?.kots.find((k) => k.kotId === kotId);
      if (currentKot && currentKot.status === 'served') {
        return { order: refreshedOrder!, kot: currentKot, idempotent: true };
      }

      throw new AppError(
        `KOT status was modified concurrently (current: ${currentKot?.status || 'unknown'})`,
        409,
        'CONCURRENT_MODIFICATION'
      );
    }

    const updatedKot = updatedOrder.kots.find((k) => k.kotId === kotId)!;

    // Emit real-time events
    realtimeService.emit(
      REALTIME_EVENTS.KOT_STATUS_CHANGED,
      [REALTIME_ROOMS.KITCHEN, REALTIME_ROOMS.POS],
      {
        orderId: updatedOrder._id.toString(),
        kotId,
        status: 'served',
        kotNo: updatedKot.kotNo,
        tableNumber: updatedOrder.tableNumber ?? null,
      }
    );

    realtimeService.emit(
      REALTIME_EVENTS.ORDER_UPDATED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: updatedOrder._id.toString(),
        tableId: updatedOrder.tableId ? updatedOrder.tableId.toString() : null,
        version: updatedOrder.version,
      }
    );

    if (updatedOrder.tableId) {
      realtimeService.emit(
        REALTIME_EVENTS.TABLE_STATE_CHANGED,
        REALTIME_ROOMS.POS,
        { tableId: updatedOrder.tableId.toString() }
      );
    }

    return { order: updatedOrder, kot: updatedKot, idempotent: false };
  },

  /**
   * Lists all KOTs in 'ready' status for today's active orders (for waiter 'ready to serve' tray).
   */
  async getPosReadyKots(): Promise<PosReadyKotDto[]> {
    const now = new Date();
    const nowMs = now.getTime();
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const todayLocalDate = nowIst.toFormat('yyyy-MM-dd');

    const orders = await Order.find({
      localDate: todayLocalDate,
      status: { $in: ['open', 'billed'] },
      'kots.status': 'ready',
    }).lean();

    const result: PosReadyKotDto[] = [];

    for (const order of orders) {
      for (const kot of order.kots) {
        if (kot.status === 'ready' && kot.readyAt) {
          const readyAtDate = new Date(kot.readyAt);
          const waitingMinutes = Math.max(0, Math.floor((nowMs - readyAtDate.getTime()) / 60000));
          const activeItems = order.items.filter(
            (i) => kot.itemLineIds.includes(i.lineId) && i.status === 'active'
          );

          result.push({
            kotId: kot.kotId,
            kotNo: kot.kotNo,
            orderId: order._id.toString(),
            orderNo: order.orderNo,
            orderType: order.type,
            tableNumber: order.tableNumber ?? null,
            tableId: order.tableId ? order.tableId.toString() : null,
            readyAt: readyAtDate.toISOString(),
            waitingMinutes,
            itemCount: activeItems.reduce((acc, i) => acc + i.qty, 0),
          });
        }
      }
    }

    // Sort oldest waiting first
    result.sort((a, b) => new Date(a.readyAt).getTime() - new Date(b.readyAt).getTime());
    return result;
  },
};
