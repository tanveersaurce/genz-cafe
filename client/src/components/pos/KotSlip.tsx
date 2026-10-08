import React from 'react';
import { PosOrder, PosOrderItem } from '../../types/pos';

interface KotSlipProps {
  order: PosOrder;
  kotNo: string;
  items: PosOrderItem[];
  sentAt?: string;
}

export const KotSlip: React.FC<KotSlipProps> = ({ order, kotNo, items, sentAt }) => {
  const displayTime = sentAt
    ? new Date(sentAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="font-mono text-[13px] leading-tight text-black bg-white p-4 max-w-[80mm] mx-auto select-none print:p-0 print:m-0 print:max-w-none print:w-[80mm]">
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-2 mb-2">
        <h2 className="text-[18px] font-black tracking-wider uppercase">*** KITCHEN ORDER TICKET ***</h2>
        <div className="flex justify-between items-center text-[15px] font-bold mt-1">
          <span>{kotNo}</span>
          <span>{order.type === 'dine_in' ? `TABLE #${order.tableNumber}` : 'TAKEAWAY'}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex justify-between text-[11px] mb-1 text-gray-800">
        <span>Order: {order.orderNo}</span>
        <span>Time: {displayTime}</span>
      </div>
      {order.customerName && (
        <div className="text-[12px] font-bold text-black mb-1">
          Customer: {order.customerName}
        </div>
      )}

      <div className="border-b border-black my-2" />

      {/* Items list with prominent quantities */}
      <table className="w-full text-left mb-3">
        <thead>
          <tr className="border-b border-gray-400 text-[11px]">
            <th className="py-1 w-10 text-center font-bold">QTY</th>
            <th className="py-1 font-bold">ITEM DESCRIPTION</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-2 text-center font-black text-[18px]">{item.qty}</td>
              <td className="py-2 pl-2">
                <div className="font-bold text-[15px] leading-snug">{item.nameSnapshot}</div>
                {item.variantName && (
                  <div className="text-[12px] font-semibold text-gray-700">
                    Portion: {item.variantName}
                  </div>
                )}
                {item.note && (
                  <div className="text-[12px] italic text-red-700 font-medium mt-0.5">
                    *** NOTE: {item.note} ***
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="border-t-2 border-black pt-2 text-center text-[10px] text-gray-600">
        <span>Gen-Z Cafe Kitchen Dispatch</span>
      </div>
    </div>
  );
};
