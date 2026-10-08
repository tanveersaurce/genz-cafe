import { connectDB, disconnectDB } from '../config/db';
import { User } from '../modules/auth/models/User';
import { DailyClosing } from '../modules/closing/models/dailyClosing.model';
import { logger } from '../utils/logger';
import { DateTime } from 'luxon';

export const seedClosing = async (): Promise<void> => {
  await connectDB();

  try {
    const partner = await User.findOne({ role: 'partner' });
    if (!partner) {
      logger.error('No partner user found. Please run seed:partner first.');
      return;
    }

    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const day1Date = nowIst.minus({ days: 3 }).toFormat('yyyy-MM-dd');
    const day2Date = nowIst.minus({ days: 2 }).toFormat('yyyy-MM-dd');
    const day3Date = nowIst.minus({ days: 1 }).toFormat('yyyy-MM-dd');

    // 1. Day 1: Balanced closing
    const existing1 = await DailyClosing.findOne({ localDate: day1Date });
    if (!existing1) {
      logger.info(`Seeding balanced closing for ${day1Date}...`);
      await DailyClosing.create({
        localDate: day1Date,
        status: 'closed',
        openingCash: 200000, // ₹2,000.00
        countedCash: 850000, // ₹8,500.00
        denominations: {
          '500': 15,
          '200': 3,
          '100': 4,
        },
        cashRetained: 200000,
        cashHandedOver: 650000,
        expected: {
          openingCash: 200000,
          cashSales: 650000,
          upiSales: 1200000,
          cardSales: 450000,
          otherSales: 0,
          cashReversals: 0,
          cashIn: 50000,
          cashOut: 50000,
          expectedCash: 850000,
        },
        difference: 0,
        reportedUpi: 1200000,
        reportedCard: 450000,
        salesSummary: {
          billsIssuedCount: 38,
          billsVoidCount: 0,
          billsVoidAmount: 0,
          grossSales: 2300000,
          discountsTotal: 50000,
          taxableAmount: 2142857,
          cgst: 53571,
          sgst: 53572,
          roundOff: 0,
          netSales: 2250000,
          cancelledItemsCount: 1,
          cancelledItemsValue: 12000,
          ordersCountByType: {
            dine_in: 26,
            takeaway: 12,
          },
        },
        note: 'Balanced end-of-day register closing. Perfect count.',
        closedBy: partner._id,
        closedAt: nowIst.minus({ days: 3 }).set({ hour: 23, minute: 30 }).toJSDate(),
        reopenHistory: [],
        version: 1,
      });
    }

    // 2. Day 2: Short closing (counted < expected by ₹150)
    const existing2 = await DailyClosing.findOne({ localDate: day2Date });
    if (!existing2) {
      logger.info(`Seeding short closing for ${day2Date}...`);
      await DailyClosing.create({
        localDate: day2Date,
        status: 'closed',
        openingCash: 200000,
        countedCash: 935000, // ₹9,350.00 (expected ₹9,500.00)
        denominations: {
          '500': 17,
          '200': 3,
          '100': 2,
          '50': 1,
        },
        cashRetained: 200000,
        cashHandedOver: 735000,
        expected: {
          openingCash: 200000,
          cashSales: 750000,
          upiSales: 1450000,
          cardSales: 600000,
          otherSales: 0,
          cashReversals: 0,
          cashIn: 0,
          cashOut: 0,
          expectedCash: 950000,
        },
        difference: -15000, // -₹150.00 short
        reportedUpi: 1450000,
        reportedCard: 600000,
        salesSummary: {
          billsIssuedCount: 45,
          billsVoidCount: 1,
          billsVoidAmount: 25000,
          grossSales: 2800000,
          discountsTotal: 0,
          taxableAmount: 2666667,
          cgst: 66666,
          sgst: 66667,
          roundOff: 0,
          netSales: 2800000,
          cancelledItemsCount: 2,
          cancelledItemsValue: 24000,
          ordersCountByType: {
            dine_in: 30,
            takeaway: 15,
          },
        },
        note: 'Cash short by ₹150. Change calculation variance at counter.',
        closedBy: partner._id,
        closedAt: nowIst.minus({ days: 2 }).set({ hour: 23, minute: 45 }).toJSDate(),
        reopenHistory: [],
        version: 1,
      });
    }

    // 3. Day 3: Excess closing (counted > expected by ₹80)
    const existing3 = await DailyClosing.findOne({ localDate: day3Date });
    if (!existing3) {
      logger.info(`Seeding excess closing for ${day3Date}...`);
      await DailyClosing.create({
        localDate: day3Date,
        status: 'closed',
        openingCash: 200000,
        countedCash: 1108000, // ₹11,080.00 (expected ₹11,000.00)
        denominations: {
          '500': 20,
          '200': 4,
          '100': 2,
          '20': 4,
        },
        cashRetained: 200000,
        cashHandedOver: 908000,
        expected: {
          openingCash: 200000,
          cashSales: 920000,
          upiSales: 1850000,
          cardSales: 720000,
          otherSales: 0,
          cashReversals: 0,
          cashIn: 10000,
          cashOut: 30000,
          expectedCash: 1100000,
        },
        difference: 8000, // +₹80.00 excess
        reportedUpi: 1850000,
        reportedCard: 720000,
        salesSummary: {
          billsIssuedCount: 52,
          billsVoidCount: 0,
          billsVoidAmount: 0,
          grossSales: 3490000,
          discountsTotal: 100000,
          taxableAmount: 3228571,
          cgst: 80714,
          sgst: 80715,
          roundOff: 0,
          netSales: 3390000,
          cancelledItemsCount: 0,
          cancelledItemsValue: 0,
          ordersCountByType: {
            dine_in: 38,
            takeaway: 14,
          },
        },
        note: 'Cash excess by ₹80. Customer left tip in drawer.',
        closedBy: partner._id,
        closedAt: nowIst.minus({ days: 1 }).set({ hour: 23, minute: 15 }).toJSDate(),
        reopenHistory: [],
        version: 1,
      });
    }

    logger.info('✅ Successfully seeded sample daily closing records.');
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed closing records');
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

if (require.main === module) {
  seedClosing()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
