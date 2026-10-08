import React from 'react';
import { PosBill, PosPayment } from '../../types/pos';
import { formatPrice } from '../../lib/formatPrice';

interface ThermalReceiptProps {
  bill: PosBill;
  payments?: PosPayment[];
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ bill, payments = [] }) => {
  const settings = bill.settingsSnapshot;
  const activePayments = payments.filter((p) => p.status === 'recorded');

  return (
    <div className="font-mono text-[12px] leading-tight text-black bg-white p-4 max-w-[80mm] mx-auto select-none print:p-0 print:m-0 print:max-w-none print:w-[80mm]">
      {/* Cafe Header */}
      <div className="text-center mb-3">
        <h2 className="text-[16px] font-bold tracking-tight uppercase">{settings.legalName}</h2>
        {settings.address && (
          <p className="text-[11px] text-gray-700">
            {settings.address.line1}
            {settings.address.line2 ? `, ${settings.address.line2}` : ''}
            <br />
            {settings.address.city}, {settings.address.state} - {settings.address.pincode}
          </p>
        )}
        {settings.gstEnabled && settings.gstin && (
          <p className="text-[11px] font-semibold mt-1">GSTIN: {settings.gstin}</p>
        )}
        <div className="my-2 border-b border-dashed border-gray-400" />
        <h3 className="text-[14px] font-bold tracking-wider uppercase">
          {settings.gstEnabled ? 'TAX INVOICE' : 'BILL'}
        </h3>
        {bill.status === 'void' && (
          <div className="text-red-600 font-bold border border-red-600 my-1 py-0.5">
            *** VOID INVOICE ***
          </div>
        )}
      </div>

      {/* Invoice Details */}
      <div className="text-[11px] mb-2 space-y-0.5">
        <div className="flex justify-between">
          <span>Invoice No:</span>
          <span className="font-bold">{bill.invoiceNo}</span>
        </div>
        <div className="flex justify-between">
          <span>Order No:</span>
          <span>{bill.orderNo}</span>
        </div>
        {bill.tableNumber && (
          <div className="flex justify-between">
            <span>Table:</span>
            <span className="font-bold">Table #{bill.tableNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Date / Time:</span>
          <span>{new Date(bill.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-gray-400 my-2" />

      {/* Line Items Table */}
      <table className="w-full text-left text-[11px] mb-2">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="py-1">Item</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Amt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {bill.items.map((item, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-1 pr-1">
                <span className="font-medium">{item.name}</span>
                {item.variantName && (
                  <span className="text-[10px] text-gray-600 block">({item.variantName})</span>
                )}
              </td>
              <td className="py-1 text-center">{item.qty}</td>
              <td className="py-1 text-right">{formatPrice(item.unitPrice)}</td>
              <td className="py-1 text-right font-medium">{formatPrice(item.grossAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-b border-dashed border-gray-400 my-2" />

      {/* Totals Summary */}
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatPrice(bill.totals.subtotal)}</span>
        </div>

        {bill.totals.discount > 0 && (
          <div className="flex justify-between text-green-800">
            <span>Discount:</span>
            <span>-{formatPrice(bill.totals.discount)}</span>
          </div>
        )}

        {settings.gstEnabled && (
          <>
            <div className="flex justify-between text-gray-700">
              <span>Taxable Value:</span>
              <span>{formatPrice(bill.totals.taxable)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>CGST:</span>
              <span>{formatPrice(bill.totals.cgst)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>SGST:</span>
              <span>{formatPrice(bill.totals.sgst)}</span>
            </div>
          </>
        )}

        {bill.totals.roundOff !== 0 && (
          <div className="flex justify-between text-gray-700">
            <span>Round-off:</span>
            <span>{bill.totals.roundOff > 0 ? `+${formatPrice(bill.totals.roundOff)}` : formatPrice(bill.totals.roundOff)}</span>
          </div>
        )}

        <div className="border-t border-b border-gray-900 py-1.5 my-1 flex justify-between font-bold text-[14px]">
          <span>GRAND TOTAL:</span>
          <span>{formatPrice(bill.totals.grandTotal)}</span>
        </div>
      </div>

      {/* Tax Breakup Table */}
      {settings.gstEnabled && bill.taxBreakup && bill.taxBreakup.length > 0 && (
        <div className="mt-3 pt-2 border-t border-dashed border-gray-400">
          <p className="text-[10px] font-bold uppercase mb-1">GST Tax Breakup:</p>
          <table className="w-full text-[10px] text-gray-700">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-0.5">Rate</th>
                <th className="py-0.5 text-right">Taxable</th>
                <th className="py-0.5 text-right">CGST</th>
                <th className="py-0.5 text-right">SGST</th>
              </tr>
            </thead>
            <tbody>
              {bill.taxBreakup.map((tb, i) => (
                <tr key={i}>
                  <td className="py-0.5">{tb.gstRate}%</td>
                  <td className="py-0.5 text-right">{formatPrice(tb.taxableAmount)}</td>
                  <td className="py-0.5 text-right">{formatPrice(tb.cgstAmount)}</td>
                  <td className="py-0.5 text-right">{formatPrice(tb.sgstAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Tender Details */}
      {activePayments.length > 0 && (
        <div className="mt-3 pt-2 border-t border-dashed border-gray-400 text-[11px]">
          <p className="font-bold mb-1">Payment Modes:</p>
          {activePayments.map((p, idx) => (
            <div key={idx} className="flex justify-between text-gray-800">
              <span className="uppercase">{p.method} {p.reference ? `(${p.reference})` : ''}</span>
              <span className="font-semibold">{formatPrice(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-4 pt-3 border-t border-dashed border-gray-400">
        <p className="font-bold text-[12px]">Thank you, visit again!</p>
        <p className="text-[10px] text-gray-500 mt-1">Good Food • Good Vibes • Gen-Z Cafe</p>
      </div>
    </div>
  );
};
