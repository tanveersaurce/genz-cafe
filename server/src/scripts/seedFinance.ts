import { connectDB, disconnectDB } from '../config/db';
import { User } from '../modules/auth/models/User';
import { ExpenseCategory } from '../modules/expenses/models/expenseCategory.model';
import { Vendor } from '../modules/expenses/models/vendor.model';
import { RecurringExpenseTemplate } from '../modules/expenses/models/recurringTemplate.model';
import { Partner } from '../modules/partners/models/partner.model';
import { PartnerShareSchedule } from '../modules/partners/models/partnerShareSchedule.model';
import { CapitalEntry } from '../modules/partners/models/capitalEntry.model';
import { PartnerLedger } from '../modules/partners/models/partnerLedger.model';
import { Expense } from '../modules/expenses/models/expense.model';
import { logger } from '../utils/logger';
import { DateTime } from 'luxon';
import { Types } from 'mongoose';

export const seedFinance = async (): Promise<void> => {
  await connectDB();

  try {
    const partnerUser = await User.findOne({ role: 'partner' });
    if (!partnerUser) {
      logger.error('No partner user found. Please ensure users are seeded first.');
      return;
    }

    logger.info('Seeding Expense Categories...');
    const defaultCategories = [
      { name: 'Raw Material', type: 'cogs_purchase', sortOrder: 1 },
      { name: 'Salaries & Wages', type: 'payroll', sortOrder: 2 },
      { name: 'Rent', type: 'rent_utilities', sortOrder: 3 },
      { name: 'Electricity & Power', type: 'rent_utilities', sortOrder: 4 },
      { name: 'Cooking Gas & Fuel', type: 'rent_utilities', sortOrder: 5 },
      { name: 'Internet & Phone', type: 'rent_utilities', sortOrder: 6 },
      { name: 'Marketing & Promotions', type: 'marketing', sortOrder: 7 },
      { name: 'Repairs & Maintenance', type: 'maintenance', sortOrder: 8 },
      { name: 'Packaging', type: 'operating', sortOrder: 9 },
      { name: 'Cleaning & Sanitation', type: 'operating', sortOrder: 10 },
      { name: 'Licenses & Software', type: 'operating', sortOrder: 11 },
      { name: 'Miscellaneous', type: 'other_operating', sortOrder: 12 },
      { name: 'Bank & Payment Gateway Charges', type: 'operating', sortOrder: 13 },
      { name: 'Depreciation', type: 'non_operating', sortOrder: 14 },
      { name: 'Capital Expenditure', type: 'non_operating', sortOrder: 15 },
    ];

    const categoryMap = new Map<string, string>();
    for (const cat of defaultCategories) {
      let doc = await ExpenseCategory.findOne({ name: cat.name });
      if (!doc) {
        doc = await ExpenseCategory.create(cat);
      }
      categoryMap.set(cat.name, doc._id.toString());
    }

    logger.info('Seeding Sample Vendors...');
    const sampleVendors = [
      {
        name: 'Fresh Dairy Farms',
        category: categoryMap.get('Raw Material'),
        gstin: '29AABCF1234F1Z1',
        phone: '9876543210',
        defaultPaymentMethod: 'cash_drawer',
      },
      {
        name: 'Bengaluru Artisan Roasters',
        category: categoryMap.get('Raw Material'),
        gstin: '29AABCR5678F1Z2',
        phone: '9876543211',
        defaultPaymentMethod: 'bank_transfer',
      },
      {
        name: 'EcoPack India Ltd',
        category: categoryMap.get('Packaging'),
        gstin: '29AABCE9012F1Z3',
        defaultPaymentMethod: 'upi',
      },
      {
        name: 'BESCOM Electricity Board',
        category: categoryMap.get('Electricity & Power'),
        defaultPaymentMethod: 'bank_transfer',
      },
      {
        name: 'Urban Prime Properties (Landlord)',
        category: categoryMap.get('Rent'),
        defaultPaymentMethod: 'bank_transfer',
      },
    ];

    const vendorMap = new Map<string, string>();
    for (const v of sampleVendors) {
      let doc = await Vendor.findOne({ name: v.name });
      if (!doc) {
        doc = await Vendor.create(v);
      }
      vendorMap.set(v.name, doc._id.toString());
    }

    logger.info('Seeding Partners...');
    const partnerConfigs = [
      {
        name: 'Aarav Sharma',
        email: 'aarav.sharma@genzcafe.in',
        phone: '9876541111',
        pan: 'ABCPS1234A',
        userId: partnerUser._id,
        notes: 'Managing Partner - Operations & Brand',
      },
      {
        name: 'Diya Patel',
        email: 'diya.patel@genzcafe.in',
        phone: '9876542222',
        pan: 'ABCDE5678B',
        notes: 'Partner - Finance & Quality',
      },
      {
        name: 'Kabir Khan',
        email: 'kabir.khan@genzcafe.in',
        phone: '9876543333',
        pan: 'KLMNO9012C',
        notes: 'Partner - Marketing & Culinary',
      },
    ];

    const partnerDocs: Array<{ _id: Types.ObjectId; name: string }> = [];
    for (const p of partnerConfigs) {
      let doc = await Partner.findOne({ name: p.name });
      if (!doc) {
        doc = await Partner.create(p);
      }
      partnerDocs.push(doc);
    }

    const p1 = partnerDocs[0];
    const p2 = partnerDocs[1];
    const p3 = partnerDocs[2];
    if (!p1 || !p2 || !p3) {
      throw new Error('Failed to seed or find all 3 partners');
    }

    logger.info('Seeding Initial Share Schedule (60% / 25% / 15%)...');
    const existingSchedule = await PartnerShareSchedule.findOne({ effectiveFrom: '2026-01-01' });
    if (!existingSchedule) {
      await PartnerShareSchedule.create({
        effectiveFrom: '2026-01-01',
        shares: [
          { partnerId: p1._id, basisPoints: 6000 },
          { partnerId: p2._id, basisPoints: 2500 },
          { partnerId: p3._id, basisPoints: 1500 },
        ],
        notes: 'Founding equity distribution (10,000 bps total)',
        createdBy: partnerUser._id,
      });
    }

    logger.info('Seeding Initial Capital Contributions (₹10,00,000 Total)...');
    const capitalSeeds = [
      { partner: p1, amount: 60000000 }, // ₹6,00,000
      { partner: p2, amount: 25000000 }, // ₹2,50,000
      { partner: p3, amount: 15000000 }, // ₹1,50,000
    ];

    for (const cap of capitalSeeds) {
      const existingCap = await CapitalEntry.findOne({ partnerId: cap.partner._id });
      if (!existingCap) {
        const entry = await CapitalEntry.create({
          partnerId: cap.partner._id,
          type: 'contribution',
          amount: cap.amount,
          effectiveDate: '2026-01-01',
          paymentMethod: 'bank_transfer',
          reference: 'INITIAL-CAPITAL-NEFT',
          notes: 'Initial founding equity capital contribution',
          recordedBy: partnerUser._id,
        });

        await PartnerLedger.create({
          partnerId: cap.partner._id,
          entryDate: '2026-01-01',
          type: 'capital_contribution',
          credit: cap.amount,
          debit: 0,
          description: `Initial founding capital contribution via bank transfer (Ref: INITIAL-CAPITAL-NEFT)`,
          referenceId: entry._id,
          referenceType: 'CapitalEntry',
          createdBy: partnerUser._id,
        });
      }
    }

    logger.info('Seeding Recurring Expense Templates...');
    const recurringTemplates = [
      {
        title: 'Monthly Cafe Store Rent',
        categoryId: categoryMap.get('Rent'),
        vendorId: vendorMap.get('Urban Prime Properties (Landlord)'),
        amount: 7500000, // ₹75,000.00
        frequency: 'monthly',
        dayOfMonth: 1,
        paymentMethod: 'bank_transfer',
        createdBy: partnerUser._id,
      },
      {
        title: 'High-Speed Fiber & POS Wi-Fi',
        categoryId: categoryMap.get('Internet & Phone'),
        amount: 350000, // ₹3,500.00
        frequency: 'monthly',
        dayOfMonth: 5,
        paymentMethod: 'upi',
        createdBy: partnerUser._id,
      },
      {
        title: 'Staff Salary Base Payroll',
        categoryId: categoryMap.get('Salaries & Wages'),
        amount: 12000000, // ₹1,20,000.00
        frequency: 'monthly',
        dayOfMonth: 7,
        paymentMethod: 'bank_transfer',
        createdBy: partnerUser._id,
      },
    ];

    for (const rt of recurringTemplates) {
      const existingRt = await RecurringExpenseTemplate.findOne({ title: rt.title });
      if (!existingRt && rt.categoryId) {
        await RecurringExpenseTemplate.create(rt);
      }
    }

    logger.info('Seeding Sample Current Month Operating Expenses...');
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const curMonth = nowIst.toFormat('yyyy-MM');
    const day01 = `${curMonth}-01`;
    const day03 = `${curMonth}-03`;
    const day05 = `${curMonth}-05`;

    const sampleExpenses = [
      {
        expenseNo: `EXP-${curMonth.replace('-', '')}-0001`,
        expenseDate: day01,
        categoryId: categoryMap.get('Rent'),
        vendorId: vendorMap.get('Urban Prime Properties (Landlord)'),
        vendorName: 'Urban Prime Properties (Landlord)',
        amount: 7500000,
        paidAmount: 7500000,
        paymentStatus: 'paid',
        payments: [
          {
            method: 'bank_transfer',
            amount: 7500000,
            paidAt: new Date(),
            paidBy: partnerUser._id,
            reference: 'RENT-OCT-2026',
          },
        ],
        status: 'active',
        createdBy: partnerUser._id,
      },
      {
        expenseNo: `EXP-${curMonth.replace('-', '')}-0002`,
        expenseDate: day03,
        categoryId: categoryMap.get('Raw Material'),
        vendorId: vendorMap.get('Bengaluru Artisan Roasters'),
        vendorName: 'Bengaluru Artisan Roasters',
        amount: 4500000, // ₹45,000
        paidAmount: 4500000,
        paymentStatus: 'paid',
        payments: [
          {
            method: 'bank_transfer',
            amount: 4500000,
            paidAt: new Date(),
            paidBy: partnerUser._id,
            reference: 'COFFEE-BEANS-LOT-88',
          },
        ],
        status: 'active',
        createdBy: partnerUser._id,
      },
      {
        expenseNo: `EXP-${curMonth.replace('-', '')}-0003`,
        expenseDate: day05,
        categoryId: categoryMap.get('Packaging'),
        vendorId: vendorMap.get('EcoPack India Ltd'),
        vendorName: 'EcoPack India Ltd',
        amount: 1200000, // ₹12,000
        paidAmount: 1200000,
        paymentStatus: 'paid',
        payments: [
          {
            method: 'upi',
            amount: 1200000,
            paidAt: new Date(),
            paidBy: partnerUser._id,
            reference: 'UPI-ECOPACK-592',
          },
        ],
        status: 'active',
        createdBy: partnerUser._id,
      },
    ];

    for (const exp of sampleExpenses) {
      const exists = await Expense.findOne({ expenseNo: exp.expenseNo });
      if (!exists && exp.categoryId) {
        await Expense.create(exp);
      }
    }

    logger.info('Finance seed completed successfully.');
  } catch (error) {
    logger.error({ err: error }, 'Error seeding finance');
    throw error;
  } finally {
    await disconnectDB();
  }
};

if (require.main === module) {
  seedFinance()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
