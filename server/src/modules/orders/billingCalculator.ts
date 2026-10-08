import { billingSettings } from '../../config/billingSettings';

export interface CalculatorLineInput {
  lineId?: string;
  qty: number;
  unitPrice: number; // in integer paise
  gstRate: number; // percentage (e.g. 0, 5, 12, 18)
}

export interface CalculatorDiscountInput {
  type: 'flat' | 'percent';
  value: number; // flat: paise; percent: 0-100
  reason?: string;
}

export interface CalculatorOptions {
  gstEnabled?: boolean;
  pricesIncludeTax?: boolean;
  roundOffToRupee?: boolean;
}

export interface ComputedLineItem {
  lineId?: string;
  qty: number;
  unitPrice: number; // in paise
  grossAmount: number; // qty * unitPrice in paise
  discountAmount: number; // allocated discount in paise
  netGrossAmount: number; // grossAmount - discountAmount
  gstRate: number;
  taxableAmount: number; // in paise
  taxAmount: number; // in paise
  cgstAmount: number; // in paise
  sgstAmount: number; // in paise
  totalAmount: number; // in paise
}

export interface TaxBreakupItem {
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  taxAmount: number;
}

export interface CalculationResult {
  title: 'Tax Invoice' | 'Bill';
  subtotal: number; // in paise
  discount: number; // in paise
  taxable: number; // in paise
  cgst: number; // in paise
  sgst: number; // in paise
  totalTax: number; // in paise
  roundOff: number; // in paise (+/-)
  grandTotal: number; // in paise
  lines: ComputedLineItem[];
  taxBreakup: TaxBreakupItem[];
}

/**
 * Distributes a total discount across line items using the Largest-Remainder Method (Hare-Niemeyer).
 * Guarantees that the sum of line discounts exactly equals totalDiscount with 0 paise drift.
 */
export const distributeDiscountLargestRemainder = (
  grossAmounts: number[],
  totalDiscount: number
): number[] => {
  const lineCount = grossAmounts.length;
  if (lineCount === 0 || totalDiscount <= 0) {
    return new Array(lineCount).fill(0);
  }

  const subtotal = grossAmounts.reduce((sum, g) => sum + g, 0);
  if (subtotal <= 0) {
    return new Array(lineCount).fill(0);
  }

  // Ensure total discount never exceeds subtotal
  const effectiveDiscount = Math.min(totalDiscount, subtotal);

  const floorDiscounts = new Array<number>(lineCount).fill(0);
  const remainders: { index: number; fraction: number }[] = [];

  let allocatedFloor = 0;

  for (let i = 0; i < lineCount; i++) {
    const gross = grossAmounts[i] ?? 0;
    if (gross <= 0) {
      remainders.push({ index: i, fraction: 0 });
      continue;
    }
    const numerator = gross * effectiveDiscount;
    const floorVal = Math.floor(numerator / subtotal);
    const fraction = numerator % subtotal;

    floorDiscounts[i] = floorVal;
    allocatedFloor += floorVal;
    remainders.push({ index: i, fraction });
  }

  let unallocatedPaise = effectiveDiscount - allocatedFloor;

  // Sort descending by remainder fraction; tie breaker: original index
  remainders.sort((a, b) => {
    if (b.fraction !== a.fraction) {
      return b.fraction - a.fraction;
    }
    return a.index - b.index;
  });

  const finalDiscounts = [...floorDiscounts];
  for (let k = 0; k < remainders.length && unallocatedPaise > 0; k++) {
    const targetIdx = remainders[k]?.index;
    if (targetIdx !== undefined) {
      finalDiscounts[targetIdx] = (finalDiscounts[targetIdx] ?? 0) + 1;
      unallocatedPaise--;
    }
  }

  return finalDiscounts;
};

/**
 * Pure Billing Calculator for Gen-Z Cafe.
 * Operates strictly with integer paise.
 */
export const calculateBill = (
  lines: CalculatorLineInput[],
  discountInput?: CalculatorDiscountInput | null,
  options?: CalculatorOptions
): CalculationResult => {
  const gstEnabled = options?.gstEnabled ?? billingSettings.gstEnabled;
  const pricesIncludeTax = options?.pricesIncludeTax ?? billingSettings.pricesIncludeTax;
  const roundOffToRupee = options?.roundOffToRupee ?? billingSettings.roundOffToRupee;

  // 1. Calculate line gross
  const grossAmounts = lines.map((l) => Math.max(0, Math.round(l.qty * l.unitPrice)));
  const subtotal = grossAmounts.reduce((acc, val) => acc + val, 0);

  // 2. Compute total discount
  let totalDiscount = 0;
  if (discountInput && subtotal > 0) {
    if (discountInput.type === 'percent') {
      const clampedPct = Math.max(0, Math.min(100, discountInput.value));
      totalDiscount = Math.round((subtotal * clampedPct) / 100);
    } else {
      totalDiscount = Math.max(0, Math.round(discountInput.value));
    }
    totalDiscount = Math.min(totalDiscount, subtotal);
  }

  // 3. Distribute discount across lines
  const lineDiscounts = distributeDiscountLargestRemainder(grossAmounts, totalDiscount);

  // 4. Calculate taxes and line amounts
  const computedLines: ComputedLineItem[] = [];
  const taxGroupMap = new Map<number, { taxable: number; cgst: number; sgst: number }>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const gross = grossAmounts[i] ?? 0;
    const lineDiscount = lineDiscounts[i] ?? 0;
    const netGross = gross - lineDiscount;

    let taxable = 0;
    let tax = 0;
    let cgst = 0;
    let sgst = 0;
    let lineTotal = 0;

    if (!gstEnabled || line.gstRate === 0) {
      taxable = netGross;
      tax = 0;
      cgst = 0;
      sgst = 0;
      lineTotal = netGross;
    } else {
      const rate = line.gstRate;
      if (pricesIncludeTax) {
        // Gross includes tax: taxable = round((netGross * 100) / (100 + rate))
        taxable = Math.round((netGross * 100) / (100 + rate));
        tax = netGross - taxable;
        lineTotal = netGross;
      } else {
        // Gross excludes tax: tax = round((netGross * rate) / 100)
        taxable = netGross;
        tax = Math.round((netGross * rate) / 100);
        lineTotal = taxable + tax;
      }

      // Intra-state split: SGST receives any odd paise remainder deterministically
      cgst = Math.floor(tax / 2);
      sgst = tax - cgst;

      // Group by rate
      const existing = taxGroupMap.get(rate) || { taxable: 0, cgst: 0, sgst: 0 };
      existing.taxable += taxable;
      existing.cgst += cgst;
      existing.sgst += sgst;
      taxGroupMap.set(rate, existing);
    }

    computedLines.push({
      lineId: line.lineId,
      qty: line.qty,
      unitPrice: line.unitPrice,
      grossAmount: gross,
      discountAmount: lineDiscount,
      netGrossAmount: netGross,
      gstRate: line.gstRate,
      taxableAmount: taxable,
      taxAmount: tax,
      cgstAmount: cgst,
      sgstAmount: sgst,
      totalAmount: lineTotal,
    });
  }

  // 5. Aggregate totals
  const totalTaxable = computedLines.reduce((acc, l) => acc + l.taxableAmount, 0);
  const totalCgst = computedLines.reduce((acc, l) => acc + l.cgstAmount, 0);
  const totalSgst = computedLines.reduce((acc, l) => acc + l.sgstAmount, 0);
  const totalTax = totalCgst + totalSgst;

  // Build sorted tax breakup array
  const taxBreakup: TaxBreakupItem[] = Array.from(taxGroupMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, data]) => ({
      gstRate: rate,
      taxableAmount: data.taxable,
      cgstAmount: data.cgst,
      sgstAmount: data.sgst,
      taxAmount: data.cgst + data.sgst,
    }));

  // Net amount before round-off
  let netBeforeRoundOff = 0;
  if (!gstEnabled || pricesIncludeTax) {
    netBeforeRoundOff = subtotal - totalDiscount;
  } else {
    netBeforeRoundOff = subtotal - totalDiscount + totalTax;
  }

  // 6. Round-off to nearest whole rupee (100 paise)
  let grandTotal = netBeforeRoundOff;
  let roundOff = 0;
  if (roundOffToRupee) {
    grandTotal = Math.round(netBeforeRoundOff / 100) * 100;
    roundOff = grandTotal - netBeforeRoundOff;
  }

  return {
    title: gstEnabled ? 'Tax Invoice' : 'Bill',
    subtotal,
    discount: totalDiscount,
    taxable: totalTaxable,
    cgst: totalCgst,
    sgst: totalSgst,
    totalTax,
    roundOff,
    grandTotal,
    lines: computedLines,
    taxBreakup,
  };
};
