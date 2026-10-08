export type KotStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';

export type CustomerFacingStatus =
  | 'Order received'
  | 'Being prepared'
  | 'Ready, on its way to your table'
  | 'Served. Enjoy!'
  | 'Cancelled';

export const KOT_TO_CUSTOMER_STATUS_MAP: Record<KotStatus, CustomerFacingStatus> = {
  new: 'Order received',
  preparing: 'Being prepared',
  ready: 'Ready, on its way to your table',
  served: 'Served. Enjoy!',
  cancelled: 'Cancelled',
};

export function mapKotStatusToCustomerStatus(kotStatus: KotStatus): CustomerFacingStatus {
  return KOT_TO_CUSTOMER_STATUS_MAP[kotStatus] || 'Order received';
}
