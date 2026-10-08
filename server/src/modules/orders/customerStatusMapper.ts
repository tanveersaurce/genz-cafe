import { KotStatus } from './models/order.model';

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

/**
 * Pure function mapping internal KOT status to user-friendly customer status.
 */
export function mapKotStatusToCustomerStatus(kotStatus: KotStatus): CustomerFacingStatus {
  return KOT_TO_CUSTOMER_STATUS_MAP[kotStatus] || 'Order received';
}
