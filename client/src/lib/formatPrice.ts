/**
 * Utility functions for currency and pricing in Gen-Z Cafe.
 * Golden Rule: DB and API strictly store integer paise (1 INR = 100 paise).
 * Conversion to Rupees is only performed in UI presentation components.
 */

/**
 * Formats an amount in paise to Indian Rupee display (e.g., 15000 -> "₹150", 15050 -> "₹150.50").
 */
export function formatPaiseToRupees(
  paise: number,
  options?: { showZeroDecimals?: boolean }
): string {
  if (isNaN(paise) || paise === null || paise === undefined) {
    return '₹0';
  }

  const rupees = paise / 100;

  if (options?.showZeroDecimals || rupees % 1 !== 0) {
    return `₹${rupees.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `₹${rupees.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

export const formatPrice = formatPaiseToRupees;

/**
 * Converts user input in Rupees (string or number) into integer paise for API payloads.
 */
export function rupeesToPaise(rupeesInput: number | string): number {
  if (typeof rupeesInput === 'string') {
    const cleaned = rupeesInput.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }

  if (isNaN(rupeesInput)) return 0;
  return Math.round(rupeesInput * 100);
}

/**
 * Formats GST rate as percentage label (e.g., 5 -> "5% GST").
 */
export function formatGst(rate: number): string {
  return `${rate}% GST`;
}
