export type ExpenseCategoryType =
  | 'cogs_purchase'
  | 'operating'
  | 'payroll'
  | 'rent_utilities'
  | 'marketing'
  | 'maintenance'
  | 'other_operating'
  | 'non_operating';

export interface PnlBillInput {
  subtotal: number; // in integer paise (gross line sum before discount)
  discount: number; // in paise
  taxable: number; // in paise (taxable value ex-GST; discount is already distributed inside taxable)
  cgst: number; // in paise
  sgst: number; // in paise
  totalTax: number; // in paise
  roundOff: number; // in paise (+/-)
  grandTotal: number; // in paise
}

export interface PnlExpenseInput {
  amount: number; // in integer paise
  categoryType: ExpenseCategoryType;
  categoryName: string;
  isPaid: boolean;
}

export interface PnlResult {
  revenue: {
    grossSales: number; // paise (sum of subtotal before discount)
    discounts: number; // paise (sum of discount)
    netRevenue: number; // paise (sum of taxable = ex-GST revenue)
    gstCollected: number; // paise (sum of totalTax)
    roundOff: number; // paise (sum of roundOff)
    totalBilled: number; // paise (sum of grandTotal)
  };
  directCosts: {
    total: number; // paise (cogs_purchase expenses)
    cogsPurchases: number;
  };
  grossProfit: number; // paise (netRevenue - directCosts.total)
  grossMarginBasisPoints: number; // basis points (10000 = 100%)
  operatingExpenses: {
    total: number;
    byType: Record<string, number>;
    byCategory: Array<{ name: string; type: ExpenseCategoryType; amount: number }>;
  };
  operatingProfit: number; // paise (grossProfit - operatingExpenses.total)
  nonOperatingExpenses: {
    total: number;
    byCategory: Array<{ name: string; amount: number }>;
  };
  netProfit: number; // paise (operatingProfit - nonOperatingExpenses.total)
  unpaidSupplierCredit: number; // paise (unpaid active expenses in range)
}

/**
 * Pure P&L calculation function adhering to Gen-Z Cafe financial rules.
 * All amounts are in integer paise. No floats anywhere in financial calculations.
 */
export function computePnl(
  bills: readonly PnlBillInput[],
  expenses: readonly PnlExpenseInput[]
): PnlResult {
  let grossSales = 0;
  let discounts = 0;
  let netRevenue = 0;
  let totalTax = 0;
  let roundOff = 0;
  let totalBilled = 0;

  for (const b of bills) {
    grossSales += b.subtotal;
    discounts += b.discount;
    netRevenue += b.taxable;
    totalTax += b.totalTax;
    roundOff += b.roundOff;
    totalBilled += b.grandTotal;
  }

  // Direct costs (COGS purchases)
  let directCostsTotal = 0;

  // Operating expenses
  const operatingByType: Record<string, number> = {
    operating: 0,
    payroll: 0,
    rent_utilities: 0,
    marketing: 0,
    maintenance: 0,
    other_operating: 0,
  };
  const categoryMap = new Map<string, { type: ExpenseCategoryType; amount: number }>();

  // Non-operating expenses
  let nonOperatingTotal = 0;
  const nonOperatingCategoryMap = new Map<string, number>();

  let unpaidSupplierCredit = 0;

  for (const exp of expenses) {
    if (!exp.isPaid) {
      unpaidSupplierCredit += exp.amount;
    }

    if (exp.categoryType === 'cogs_purchase') {
      directCostsTotal += exp.amount;
    } else if (exp.categoryType === 'non_operating') {
      nonOperatingTotal += exp.amount;
      const cur = nonOperatingCategoryMap.get(exp.categoryName) || 0;
      nonOperatingCategoryMap.set(exp.categoryName, cur + exp.amount);
    } else {
      const currentVal = operatingByType[exp.categoryType] ?? 0;
      operatingByType[exp.categoryType] = currentVal + exp.amount;

      const existing = categoryMap.get(exp.categoryName);
      if (existing) {
        existing.amount += exp.amount;
      } else {
        categoryMap.set(exp.categoryName, { type: exp.categoryType, amount: exp.amount });
      }
    }
  }

  const operatingTotal = Object.values(operatingByType).reduce((sum, v) => sum + v, 0);

  const operatingByCategory = Array.from(categoryMap.entries()).map(([name, val]) => ({
    name,
    type: val.type,
    amount: val.amount,
  }));

  const nonOperatingByCategory = Array.from(nonOperatingCategoryMap.entries()).map(([name, amount]) => ({
    name,
    amount,
  }));

  const grossProfit = netRevenue - directCostsTotal;
  const grossMarginBasisPoints =
    netRevenue > 0 ? Math.floor((grossProfit * 10000) / netRevenue) : 0;

  const operatingProfit = grossProfit - operatingTotal;
  const netProfit = operatingProfit - nonOperatingTotal;

  return {
    revenue: {
      grossSales,
      discounts,
      netRevenue,
      gstCollected: totalTax,
      roundOff,
      totalBilled,
    },
    directCosts: {
      total: directCostsTotal,
      cogsPurchases: directCostsTotal,
    },
    grossProfit,
    grossMarginBasisPoints,
    operatingExpenses: {
      total: operatingTotal,
      byType: operatingByType,
      byCategory: operatingByCategory,
    },
    operatingProfit,
    nonOperatingExpenses: {
      total: nonOperatingTotal,
      byCategory: nonOperatingByCategory,
    },
    netProfit,
    unpaidSupplierCredit,
  };
}
