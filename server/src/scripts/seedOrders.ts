import crypto from 'crypto';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import { env } from '../config/env';
import { Order } from '../modules/orders/models/order.model';
import { Bill } from '../modules/orders/models/bill.model';
import { Payment } from '../modules/orders/models/payment.model';
import { Table } from '../modules/tables/table.model';
import { MenuItem } from '../modules/menu/models/MenuItem';
import { User } from '../modules/auth/models/User';
import { calculateBill } from '../modules/orders/billingCalculator';
import { billingSettings } from '../config/billingSettings';
import { logger } from '../utils/logger';

export async function seedOrders(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    logger.error('CRITICAL: seedOrders cannot be executed in production environment.');
    process.exit(1);
  }

  logger.info('Starting dev sample orders seeding...');

  // Ensure an admin or waiter user exists
  let staff = await User.findOne({ username: 'partner_admin' });
  if (!staff) {
    staff = await User.findOne({});
  }
  if (!staff) {
    logger.error('No users found in database. Run npm run seed:partner first.');
    return;
  }

  const staffId = staff._id;

  // Retrieve tables and menu items
  const table1 = await Table.findOne({ number: 1 });
  const table2 = await Table.findOne({ number: 2 });
  const table3 = await Table.findOne({ number: 3 });
  const items = await MenuItem.find({ isActive: true, isAvailable: true }).limit(5);

  if (!table1 || !table2 || !table3 || items.length < 2) {
    logger.warn('Please run npm run seed:tables and npm run seed:menu before seeding orders.');
    return;
  }

  const nowIst = DateTime.now().setZone('Asia/Kolkata');
  const todayLocalDate = nowIst.toFormat('yyyy-MM-dd');

  // Idempotency: Clean up previously created sample orders
  const sampleOrderNos = ['T-SAMPLE-01', 'T-SAMPLE-02', 'T-SAMPLE-03', 'T-SAMPLE-04'];
  const existingSampleOrders = await Order.find({ orderNo: { $in: sampleOrderNos } });
  for (const o of existingSampleOrders) {
    if (o.billId) {
      await Payment.deleteMany({ billId: o.billId });
      await Bill.deleteOne({ _id: o.billId });
    }
    await Order.deleteOne({ _id: o._id });
  }

  // --- Sample 1: Open Order on Table 1 (with 2 sent items, 1 new item, 1 cancelled sent item) ---
  const itemA = items[0]!;
  const itemB = items[1]!;
  const itemC = items[2] || items[0]!;

  const kot1Id = crypto.randomUUID();
  const sentAt1 = nowIst.minus({ minutes: 18 }).toJSDate();

  const line1Id = crypto.randomUUID();
  const line2Id = crypto.randomUUID();
  const lineCancelledId = crypto.randomUUID();
  const lineDraftId = crypto.randomUUID();

  await Order.create({
    orderNo: 'T-SAMPLE-01',
    localDate: todayLocalDate,
    type: 'dine_in',
    tableId: table1._id,
    tableNumber: table1.number,
    status: 'open',
    items: [
      {
        lineId: line1Id,
        menuItemId: itemA._id,
        nameSnapshot: itemA.name,
        unitPrice: itemA.basePrice,
        gstRateSnapshot: itemA.gstRate,
        foodTypeSnapshot: itemA.foodType,
        qty: 2,
        note: 'Extra chilled, less sweet',
        kotId: kot1Id,
        sentAt: sentAt1,
        status: 'active',
        addedBy: staffId,
      },
      {
        lineId: line2Id,
        menuItemId: itemB._id,
        nameSnapshot: itemB.name,
        unitPrice: itemB.basePrice,
        gstRateSnapshot: itemB.gstRate,
        foodTypeSnapshot: itemB.foodType,
        qty: 1,
        kotId: kot1Id,
        sentAt: sentAt1,
        status: 'active',
        addedBy: staffId,
      },
      {
        lineId: lineCancelledId,
        menuItemId: itemC._id,
        nameSnapshot: itemC.name,
        unitPrice: itemC.basePrice,
        gstRateSnapshot: itemC.gstRate,
        foodTypeSnapshot: itemC.foodType,
        qty: 1,
        kotId: kot1Id,
        sentAt: sentAt1,
        status: 'cancelled',
        cancelReason: 'Customer changed mind (out of milk variant)',
        cancelledBy: staffId,
        addedBy: staffId,
      },
      {
        lineId: lineDraftId,
        menuItemId: itemA._id,
        nameSnapshot: itemA.name,
        unitPrice: itemA.basePrice,
        gstRateSnapshot: itemA.gstRate,
        foodTypeSnapshot: itemA.foodType,
        qty: 1,
        status: 'active',
        addedBy: staffId,
      },
    ],
    kots: [
      {
        kotId: kot1Id,
        kotNo: 'KOT-SAMPLE-01',
        itemLineIds: [line1Id, line2Id, lineCancelledId],
        sentAt: sentAt1,
        sentBy: staffId,
      },
    ],
    version: 1,
    openedBy: staffId,
    createdAt: sentAt1,
  });

  // --- Sample 2: Billed Order on Table 2 (issued bill) ---
  const kot2Id = crypto.randomUUID();
  const sentAt2 = nowIst.minus({ minutes: 35 }).toJSDate();
  const line3Id = crypto.randomUUID();
  const line4Id = crypto.randomUUID();

  const sample2Order = await Order.create({
    orderNo: 'T-SAMPLE-02',
    localDate: todayLocalDate,
    type: 'dine_in',
    tableId: table2._id,
    tableNumber: table2.number,
    status: 'billed',
    items: [
      {
        lineId: line3Id,
        menuItemId: itemA._id,
        nameSnapshot: itemA.name,
        unitPrice: itemA.basePrice,
        gstRateSnapshot: itemA.gstRate,
        foodTypeSnapshot: itemA.foodType,
        qty: 2,
        kotId: kot2Id,
        sentAt: sentAt2,
        status: 'active',
        addedBy: staffId,
      },
      {
        lineId: line4Id,
        menuItemId: itemB._id,
        nameSnapshot: itemB.name,
        unitPrice: itemB.basePrice,
        gstRateSnapshot: itemB.gstRate,
        foodTypeSnapshot: itemB.foodType,
        qty: 1,
        kotId: kot2Id,
        sentAt: sentAt2,
        status: 'active',
        addedBy: staffId,
      },
    ],
    kots: [
      {
        kotId: kot2Id,
        kotNo: 'KOT-SAMPLE-02',
        itemLineIds: [line3Id, line4Id],
        sentAt: sentAt2,
        sentBy: staffId,
      },
    ],
    version: 1,
    openedBy: staffId,
    createdAt: sentAt2,
  });

  const calc2 = calculateBill([
    { lineId: line3Id, qty: 2, unitPrice: itemA.basePrice, gstRate: itemA.gstRate },
    { lineId: line4Id, qty: 1, unitPrice: itemB.basePrice, gstRate: itemB.gstRate },
  ]);

  const bill2 = await Bill.create({
    invoiceNo: 'GZ2627-990001',
    financialYear: '2026-27',
    orderId: sample2Order._id,
    orderNo: sample2Order.orderNo,
    tableNumber: sample2Order.tableNumber,
    items: calc2.lines.map((l) => ({
      ...l,
      name: l.lineId === line3Id ? itemA.name : itemB.name,
      foodType: l.lineId === line3Id ? itemA.foodType : itemB.foodType,
    })),
    totals: {
      subtotal: calc2.subtotal,
      discount: calc2.discount,
      taxable: calc2.taxable,
      cgst: calc2.cgst,
      sgst: calc2.sgst,
      totalTax: calc2.totalTax,
      roundOff: calc2.roundOff,
      grandTotal: calc2.grandTotal,
    },
    taxBreakup: calc2.taxBreakup,
    settingsSnapshot: {
      legalName: billingSettings.legalName,
      gstin: billingSettings.gstin,
      address: billingSettings.address,
      pricesIncludeTax: billingSettings.pricesIncludeTax,
      gstEnabled: billingSettings.gstEnabled,
    },
    status: 'issued',
    generatedBy: staffId,
    generatedAt: nowIst.minus({ minutes: 5 }).toJSDate(),
  });

  sample2Order.billId = bill2._id;
  await sample2Order.save();

  // --- Sample 3: Paid Takeaway Order ---
  const line5Id = crypto.randomUUID();
  const sample3Order = await Order.create({
    orderNo: 'T-SAMPLE-03',
    localDate: todayLocalDate,
    type: 'takeaway',
    customerName: 'Sneha Patel',
    customerPhone: '+919876543210',
    status: 'paid',
    items: [
      {
        lineId: line5Id,
        menuItemId: itemA._id,
        nameSnapshot: itemA.name,
        unitPrice: itemA.basePrice,
        gstRateSnapshot: itemA.gstRate,
        foodTypeSnapshot: itemA.foodType,
        qty: 1,
        status: 'active',
        sentAt: nowIst.minus({ minutes: 45 }).toJSDate(),
        addedBy: staffId,
      },
    ],
    kots: [],
    version: 1,
    openedBy: staffId,
    closedAt: nowIst.minus({ minutes: 40 }).toJSDate(),
    createdAt: nowIst.minus({ minutes: 45 }).toJSDate(),
  });

  const calc3 = calculateBill([
    { lineId: line5Id, qty: 1, unitPrice: itemA.basePrice, gstRate: itemA.gstRate },
  ]);

  const bill3 = await Bill.create({
    invoiceNo: 'GZ2627-990002',
    financialYear: '2026-27',
    orderId: sample3Order._id,
    orderNo: sample3Order.orderNo,
    items: calc3.lines.map((l) => ({
      ...l,
      name: itemA.name,
      foodType: itemA.foodType,
    })),
    totals: {
      subtotal: calc3.subtotal,
      discount: calc3.discount,
      taxable: calc3.taxable,
      cgst: calc3.cgst,
      sgst: calc3.sgst,
      totalTax: calc3.totalTax,
      roundOff: calc3.roundOff,
      grandTotal: calc3.grandTotal,
    },
    taxBreakup: calc3.taxBreakup,
    settingsSnapshot: {
      legalName: billingSettings.legalName,
      gstin: billingSettings.gstin,
      address: billingSettings.address,
      pricesIncludeTax: billingSettings.pricesIncludeTax,
      gstEnabled: billingSettings.gstEnabled,
    },
    status: 'paid',
    paidAt: nowIst.minus({ minutes: 40 }).toJSDate(),
    generatedBy: staffId,
    generatedAt: nowIst.minus({ minutes: 42 }).toJSDate(),
  });

  sample3Order.billId = bill3._id;
  await sample3Order.save();

  await Payment.create({
    billId: bill3._id,
    orderId: sample3Order._id,
    method: 'upi',
    amount: calc3.grandTotal,
    reference: 'UPI-SAMPLE-4567',
    receivedBy: staffId,
    receivedAt: nowIst.minus({ minutes: 40 }).toJSDate(),
    status: 'recorded',
  });

  // --- Sample 4: Open Order on Table 3 with 10% Discount ---
  const line6Id = crypto.randomUUID();
  await Order.create({
    orderNo: 'T-SAMPLE-04',
    localDate: todayLocalDate,
    type: 'dine_in',
    tableId: table3._id,
    tableNumber: table3.number,
    status: 'open',
    discount: {
      type: 'percent',
      value: 10,
      reason: 'Student Happy Hour Discount (10%)',
      appliedBy: staffId,
    },
    items: [
      {
        lineId: line6Id,
        menuItemId: itemB._id,
        nameSnapshot: itemB.name,
        unitPrice: itemB.basePrice,
        gstRateSnapshot: itemB.gstRate,
        foodTypeSnapshot: itemB.foodType,
        qty: 2,
        status: 'active',
        addedBy: staffId,
      },
    ],
    kots: [],
    version: 0,
    openedBy: staffId,
    createdAt: nowIst.minus({ minutes: 12 }).toJSDate(),
  });

  logger.info('Sample orders successfully seeded (4 orders across open, billed, paid states).');
}

// Standalone execution support
if (process.argv[1]?.endsWith('seedOrders.ts')) {
  mongoose
    .connect(env.MONGO_URI)
    .then(async () => {
      await seedOrders();
      await mongoose.disconnect();
      logger.info('Database connection closed.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Failed to seed sample orders.');
      process.exit(1);
    });
}
