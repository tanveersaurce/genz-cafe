import { AppError } from './AppError';

/**
 * Validates a 6-digit manager approval PIN.
 * Rejects:
 * - Non 6-digit inputs
 * - All identical repeated digits (e.g., 000000, 111111)
 * - Sequential ascending or descending digits (e.g., 123456, 654321)
 * - Last 6 digits of the user's phone number
 */
export function validateApprovalPin(pin: string, userPhone?: string): void {
  if (!/^\d{6}$/.test(pin)) {
    throw new AppError('Approval PIN must be exactly 6 numeric digits', 400, 'INVALID_PIN_FORMAT');
  }

  // Reject all identical digits (e.g. 000000, 111111)
  if (/^(\d)\1{5}$/.test(pin)) {
    throw new AppError('PIN cannot be all identical digits', 400, 'TRIVIAL_PIN');
  }

  // Reject sequential ascending and descending sequences
  const ascending = '0123456789';
  const descending = '9876543210';
  if (ascending.includes(pin) || descending.includes(pin)) {
    throw new AppError('PIN cannot be a sequential sequence of digits', 400, 'TRIVIAL_PIN');
  }

  // Common trivial patterns like 121212
  if (pin === '121212' || pin === '654321' || pin === '123456') {
    throw new AppError('PIN is too simple or common', 400, 'TRIVIAL_PIN');
  }

  // Reject last 6 digits of user's phone if present
  if (userPhone) {
    const cleanPhone = userPhone.replace(/\D/g, '');
    if (cleanPhone.length >= 6) {
      const lastSix = cleanPhone.slice(-6);
      if (pin === lastSix) {
        throw new AppError('PIN cannot match the last 6 digits of your phone number', 400, 'TRIVIAL_PIN');
      }
    }
  }
}

/**
 * Validates a 4-digit fast staff login PIN.
 * Rejects:
 * - Non 4-digit inputs
 * - All identical repeated digits (e.g., 0000, 1111)
 * - Sequential ascending or descending digits (e.g., 1234, 4321)
 */
export function validateLoginPin(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new AppError('Login PIN must be exactly 4 numeric digits', 400, 'INVALID_PIN_FORMAT');
  }

  // Reject all identical digits (e.g. 0000, 1111)
  if (/^(\d)\1{3}$/.test(pin)) {
    throw new AppError('PIN cannot be all identical digits', 400, 'TRIVIAL_PIN');
  }

  // Reject sequential
  const ascending = '0123456789';
  const descending = '9876543210';
  if (ascending.includes(pin) || descending.includes(pin)) {
    throw new AppError('PIN cannot be a sequential sequence of digits', 400, 'TRIVIAL_PIN');
  }

  if (pin === '1212' || pin === '1234' || pin === '4321') {
    throw new AppError('PIN is too simple or common', 400, 'TRIVIAL_PIN');
  }
}
