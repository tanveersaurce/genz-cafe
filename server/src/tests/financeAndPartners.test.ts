import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { authService } from '../modules/auth/auth.service';
import { ExpenseCategory } from '../modules/expenses/models/expenseCategory.model';
import { Expense } from '../modules/expenses/models/expense.model';
import { Partner } from '../modules/partners/models/partner.model';
import { PartnerShareSchedule } from '../modules/partners/models/partnerShareSchedule.model';
import { PartnerLedger } from '../modules/partners/models/partnerLedger.model';
import { CashMovement } from '../modules/cash/models/cashMovement.model';
import { Bill } from '../modules/orders/models/bill.model';
import { Types } from 'mongoose';

describe('Finance, Expenses, Partners & Statements Integration Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function setupUsers() {
    const passwordHash = await authService.hashPassword('Pass@1234');

    const partner = await User.create({
      name: 'Rohan Sharma',
      username: 'partner1',
      passwordHash,
      role: 'partner',
      isActive: true,
    });

    const manager = await User.create({
      name: 'Simran Kaur',
      username: 'manager1',
      passwordHash,
      role: 'manager',
      isActive: true,
    });

    const cashier = await User.create({
      name: 'Amit Patel',
      username: 'cashier1',
      passwordHash,
      role: 'cashier',
      isActive: true,
    });

    const partnerToken = authService.generateAccessToken({
      userId: partner._id.toString(),
      role: 'partner',
      username: 'partner1',
    });

    const managerToken = authService.generateAccessToken({
      userId: manager._id.toString(),
      role: 'manager',
      username: 'manager1',
    });

    const cashierToken = authService.generateAccessToken({
      userId: cashier._id.toString(),
      role: 'cashier',
      username: 'cashier1',
    });

    return { partner, manager, cashier, partnerToken, managerToken, cashierToken };
  }

  describe('Expenses Module', () => {
    it('creates active expense paid from cash drawer, recording cash movement', async () => {
      const { partnerToken } = await setupUsers();

      const cat = await ExpenseCategory.create({
        name: 'Vegetables & Milk',
        type: 'cogs_purchase',
      });

      const today = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');

      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          expenseDate: today,
          categoryId: cat._id.toString(),
          amount: 250000, // ₹2,500.00
          isPaid: true,
          paymentMethod: 'cash_drawer',
          notes: 'Daily dairy purchase',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.expenseNo).toMatch(/^EXP-\d{6}-\d{4}$/);
      expect(res.body.data.paymentStatus).toBe('paid');
      expect(res.body.data.payments[0].cashMovementId).toBeDefined();

      // Verify linked cash movement
      const movement = await CashMovement.findById(res.body.data.payments[0].cashMovementId);
      expect(movement).toBeDefined();
      expect(movement?.type).toBe('out');
      expect(movement?.amount).toBe(250000);
      expect(movement?.category).toBe('purchase');
    });

    it('creates owner_paid expense and credits the partner ledger', async () => {
      const { partnerToken } = await setupUsers();

      const partnerDoc = await Partner.create({
        name: 'Aarav Partner',
        pan: 'ABCDE1234F',
      });

      const cat = await ExpenseCategory.create({
        name: 'Marketing Flyers',
        type: 'marketing',
      });

      const today = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');

      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          expenseDate: today,
          categoryId: cat._id.toString(),
          amount: 500000, // ₹5,000.00
          isPaid: true,
          paymentMethod: 'owner_paid',
          paidByPartnerId: partnerDoc._id.toString(),
          notes: 'Flyers printed out of pocket',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.payments[0].ledgerEntryId).toBeDefined();

      const ledger = await PartnerLedger.findById(res.body.data.payments[0].ledgerEntryId);
      expect(ledger).toBeDefined();
      expect(ledger?.type).toBe('expense_reimbursement');
      expect(ledger?.credit).toBe(500000);
      expect(ledger?.debit).toBe(0);
    });

    it('enforces 24h edit window and ownership for managers', async () => {
      const { partner, manager, managerToken } = await setupUsers();

      const cat = await ExpenseCategory.create({
        name: 'Store Supplies',
        type: 'operating',
      });

      const today = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');

      // Created by partner
      const partnerExpense = await Expense.create({
        expenseNo: 'EXP-202610-0099',
        expenseDate: today,
        categoryId: cat._id,
        amount: 100000,
        paymentStatus: 'unpaid',
        status: 'active',
        createdBy: partner._id,
      });

      // Manager trying to edit partner's expense -> 403 Forbidden
      const res1 = await request(app)
        .patch(`/api/expenses/${partnerExpense._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ notes: 'Manager edit' });

      expect(res1.status).toBe(403);

      // Manager expense created 25h ago
      const oldExpense = await Expense.create({
        expenseNo: 'EXP-202610-0098',
        expenseDate: today,
        categoryId: cat._id,
        amount: 100000,
        paymentStatus: 'unpaid',
        status: 'active',
        createdBy: manager._id,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });

      const res2 = await request(app)
        .patch(`/api/expenses/${oldExpense._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ notes: 'Too late edit' });

      expect(res2.status).toBe(403);
    });

    it('voids an expense and compensates linked cash movements (partner only)', async () => {
      const { partnerToken, managerToken } = await setupUsers();

      const cat = await ExpenseCategory.create({ name: 'Coffee Beans', type: 'cogs_purchase' });
      const today = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');

      const createRes = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          expenseDate: today,
          categoryId: cat._id.toString(),
          amount: 300000,
          isPaid: true,
          paymentMethod: 'cash_drawer',
        });

      const expenseId = createRes.body.data._id;
      const cashMovementId = createRes.body.data.payments[0].cashMovementId;

      // Manager cannot void
      const mgrVoidRes = await request(app)
        .post(`/api/expenses/${expenseId}/void`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Accidental entry' });
      expect(mgrVoidRes.status).toBe(403);

      // Partner voids
      const voidRes = await request(app)
        .post(`/api/expenses/${expenseId}/void`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ reason: 'Duplicate invoice recorded' });

      expect(voidRes.status).toBe(200);
      expect(voidRes.body.data.status).toBe('voided');

      const movement = await CashMovement.findById(cashMovementId);
      expect(movement?.status).toBe('reversed');
    });
  });

  describe('Partners, Capital & Withdrawals Module', () => {
    it('validates that partner share schedules sum to exactly 10,000 basis points', async () => {
      const { partnerToken } = await setupUsers();

      const p1 = await Partner.create({ name: 'Partner One' });
      const p2 = await Partner.create({ name: 'Partner Two' });

      // Sum = 9000 (invalid)
      const res1 = await request(app)
        .post('/api/partners/shares')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          effectiveFrom: '2026-10-01',
          shares: [
            { partnerId: p1._id.toString(), basisPoints: 6000 },
            { partnerId: p2._id.toString(), basisPoints: 3000 },
          ],
        });
      expect(res1.status).toBe(400);

      // Sum = 10000 (valid)
      const res2 = await request(app)
        .post('/api/partners/shares')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          effectiveFrom: '2026-10-01',
          shares: [
            { partnerId: p1._id.toString(), basisPoints: 7000 },
            { partnerId: p2._id.toString(), basisPoints: 3000 },
          ],
        });
      expect(res2.status).toBe(201);
      expect(res2.body.data.shares).toHaveLength(2);
    });

    it('records capital entry and withdrawal with running ledger balance', async () => {
      const { partnerToken } = await setupUsers();

      const partner = await Partner.create({ name: 'Rohit Verma' });
      const today = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');

      // 1. Capital contribution of ₹1,00,000 (10,000,000 paise)
      await request(app)
        .post('/api/partners/capital')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          partnerId: partner._id.toString(),
          type: 'contribution',
          amount: 10000000,
          effectiveDate: today,
          paymentMethod: 'bank_transfer',
          reference: 'NEFT-1234',
        });

      // 2. Partner withdrawal of ₹20,000 (2,000,000 paise) via cash drawer
      const wRes = await request(app)
        .post('/api/partners/withdrawals')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          partnerId: partner._id.toString(),
          amount: 2000000,
          paymentMethod: 'cash_drawer',
          effectiveDate: today,
        });

      expect(wRes.status).toBe(201);
      expect(wRes.body.data.status).toBe('recorded');

      // 3. Check ledger running balance
      const ledgerRes = await request(app)
        .get(`/api/partners/${partner._id}/ledger`)
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(ledgerRes.status).toBe(200);
      expect(ledgerRes.body.data.entries).toHaveLength(2);
      expect(ledgerRes.body.data.summary.netBalance).toBe(8000000); // 1,00,000 - 20,000 = ₹80,000
    });
  });

  describe('Profit & Loss and Statement Finalization', () => {
    it('blocks manager from accessing P&L, partners, and statements (403)', async () => {
      const { managerToken } = await setupUsers();

      const resPnl = await request(app)
        .get('/api/finance/pnl')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(resPnl.status).toBe(403);

      const resPartners = await request(app)
        .get('/api/partners')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(resPartners.status).toBe(403);

      const resStatements = await request(app)
        .get('/api/statements')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(resStatements.status).toBe(403);
    });

    it('finalizes a monthly statement, locks period, and generates PDF', async () => {
      const { partner, partnerToken } = await setupUsers();

      const p1 = await Partner.create({ name: 'Aarav S' });
      const p2 = await Partner.create({ name: 'Diya P' });

      await PartnerShareSchedule.create({
        effectiveFrom: '2026-10-01',
        shares: [
          { partnerId: p1._id, basisPoints: 6000 },
          { partnerId: p2._id, basisPoints: 4000 },
        ],
        createdBy: partner._id,
      });

      // Create a paid bill for 2026-10
      const generatedAt = DateTime.fromISO('2026-10-15T12:00:00', { zone: 'Asia/Kolkata' }).toJSDate();
      await Bill.create({
        invoiceNo: 'GZ2627-000001',
        financialYear: '2026-27',
        orderId: new Types.ObjectId(),
        orderNo: 'ORD-1',
        items: [],
        totals: {
          subtotal: 100000,
          discount: 10000,
          taxable: 90000,
          cgst: 2250,
          sgst: 2250,
          totalTax: 4500,
          roundOff: 0,
          grandTotal: 94500,
        },
        settingsSnapshot: {
          legalName: 'Gen-Z Cafe',
          gstin: '29ABCDE1234F1Z5',
          address: { line1: 'Koramangala', city: 'Bengaluru', state: 'KA', pincode: '560034' },
          pricesIncludeTax: false,
          gstEnabled: true,
        },
        status: 'paid',
        generatedBy: partner._id,
        generatedAt,
        paidAt: generatedAt,
      });

      // Finalize 2026-10 with override
      const finRes = await request(app)
        .post('/api/statements/2026-10/finalize')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          retainedAmount: 10000, // ₹100
          overridePrechecks: true,
          overrideReason: 'End of month audit completed',
        });

      expect(finRes.status).toBe(201);
      expect(finRes.body.data.status).toBe('finalized');
      expect(finRes.body.data.statementNo).toBe('PS-2026-10');
      expect(finRes.body.data.checksum).toBeDefined();

      // Verify period lock: creating an expense in 2026-10 now throws 409 PERIOD_FINALIZED
      const cat = await ExpenseCategory.create({ name: 'Late Bill', type: 'operating' });
      const lateExpRes = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          expenseDate: '2026-10-20',
          categoryId: cat._id.toString(),
          amount: 50000,
        });

      expect(lateExpRes.status).toBe(409);
      expect(lateExpRes.body.error.code).toBe('PERIOD_FINALIZED');

      // Verify PDF generation returns valid application/pdf
      const pdfRes = await request(app)
        .get('/api/statements/2026-10/pdf')
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toBe('application/pdf');
      expect(pdfRes.body.toString().startsWith('%PDF-')).toBe(true);
    });
  });
});
