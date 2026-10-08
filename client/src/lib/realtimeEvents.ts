/**
 * Typed Real-Time Events Catalog for Gen-Z Cafe (Client Mirror)
 * Single source of truth for Socket.io event names and payload shapes.
 */

export const REALTIME_EVENTS = {
  ORDER_UPDATED: 'order.updated',
  ORDER_CUSTOMER_SUBMITTED: 'order.customer_submitted',
  KOT_CREATED: 'kot.created',
  KOT_STATUS_CHANGED: 'kot.status_changed',
  KOT_ITEM_CANCELLED: 'kot.item_cancelled',
  TABLE_STATE_CHANGED: 'table.state_changed',
  RESERVATION_CHANGED: 'reservation.changed',
  MENU_AVAILABILITY_CHANGED: 'menu.availability_changed',
  SESSION_REVOKED: 'session.revoked',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface OrderCustomerSubmittedPayload {
  orderId: string;
  kotId: string;
  submissionId: string;
  tableId: string;
}

export interface OrderUpdatedPayload {
  orderId: string;
  tableId?: string | null;
  version: number;
}

export interface KotCreatedPayload {
  orderId: string;
  kotId: string;
  kotNo: string;
  orderNo?: string;
  tableNumber?: number | null;
}

export interface KotStatusChangedPayload {
  orderId: string;
  kotId: string;
  status: 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
  kotNo?: string;
  tableNumber?: number | null;
}

export interface KotItemCancelledPayload {
  orderId: string;
  kotId: string;
  lineId: string;
  kotNo?: string;
  tableNumber?: number | null;
}

export interface TableStateChangedPayload {
  tableId: string;
}

export interface ReservationChangedPayload {
  reservationId: string;
  status: string;
}

export interface MenuAvailabilityChangedPayload {
  menuItemId: string;
  isAvailable: boolean;
}

export interface SessionRevokedPayload {
  reason: string;
}

export interface RealtimeEventPayloadMap {
  [REALTIME_EVENTS.ORDER_UPDATED]: OrderUpdatedPayload;
  [REALTIME_EVENTS.ORDER_CUSTOMER_SUBMITTED]: OrderCustomerSubmittedPayload;
  [REALTIME_EVENTS.KOT_CREATED]: KotCreatedPayload;
  [REALTIME_EVENTS.KOT_STATUS_CHANGED]: KotStatusChangedPayload;
  [REALTIME_EVENTS.KOT_ITEM_CANCELLED]: KotItemCancelledPayload;
  [REALTIME_EVENTS.TABLE_STATE_CHANGED]: TableStateChangedPayload;
  [REALTIME_EVENTS.RESERVATION_CHANGED]: ReservationChangedPayload;
  [REALTIME_EVENTS.MENU_AVAILABILITY_CHANGED]: MenuAvailabilityChangedPayload;
  [REALTIME_EVENTS.SESSION_REVOKED]: SessionRevokedPayload;
}
