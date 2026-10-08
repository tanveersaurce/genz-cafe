import { MonthlyStatement } from './models/monthlyStatement.model';
import { AppError } from '../../utils/AppError';

export const periodLockService = {
  /**
   * Extracts the YYYY-MM month string from a YYYY-MM-DD date or YYYY-MM string.
   */
  extractMonth(dateOrMonth: string): string {
    if (!dateOrMonth) return '';
    return dateOrMonth.slice(0, 7);
  },

  /**
   * Asserts that the financial period (month) for the given date is NOT finalized.
   * Throws 409 PERIOD_FINALIZED if finalized.
   */
  async assertMonthNotFinalized(dateOrMonth: string): Promise<void> {
    const month = this.extractMonth(dateOrMonth);
    if (!month || month.length !== 7) return;

    const finalizedStatement = await MonthlyStatement.findOne({
      month,
      status: 'finalized',
      isSuperseded: false,
    }).lean();

    if (finalizedStatement) {
      throw new AppError(
        `Financial period ${month} has been finalized and locked. Modifications are not allowed.`,
        409,
        'PERIOD_FINALIZED',
        { month }
      );
    }
  },

  /**
   * Checks whether the month is finalized.
   */
  async isMonthFinalized(dateOrMonth: string): Promise<boolean> {
    const month = this.extractMonth(dateOrMonth);
    if (!month || month.length !== 7) return false;

    const count = await MonthlyStatement.countDocuments({
      month,
      status: 'finalized',
      isSuperseded: false,
    });
    return count > 0;
  },
};
