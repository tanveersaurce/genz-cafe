import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CashMovementsPage } from '../pages/staff/CashMovementsPage';
import { ClosingPage } from '../pages/staff/ClosingPage';
import { AuditPage } from '../pages/staff/AuditPage';
import { cashService } from '../services/cashService';
import { closingService } from '../services/closingService';
import { auditViewerService } from '../services/auditViewerService';

vi.mock('../services/cashService', () => ({
  cashService: {
    getMovements: vi.fn(),
    createMovement: vi.fn(),
    reverseMovement: vi.fn(),
  },
}));

vi.mock('../services/closingService', () => ({
  closingService: {
    getPreview: vi.fn(),
    submitClosing: vi.fn(),
    listClosings: vi.fn(),
    getClosingByDate: vi.fn(),
    reopenClosing: vi.fn(),
  },
}));

vi.mock('../services/auditViewerService', () => ({
  auditViewerService: {
    getAuditLogs: vi.fn(),
    getDistinctActions: vi.fn(),
    getExportCsvUrl: vi.fn(),
  },
}));

vi.mock('../lib/authContext', () => ({
  useAuth: () => ({
    user: {
      id: 'partner-1',
      name: 'Kabir Partner',
      role: 'partner',
      permissions: ['cash:record', 'closing:perform', 'closing:view', 'audit:view'],
    },
    logout: vi.fn(),
  }),
}));

describe('Cash Drawer, Daily Closing & Audit Trail (Prompt 8 Part C & D)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CashMovementsPage Component', () => {
    it('renders cash movements list and summary cards', async () => {
      vi.mocked(cashService.getMovements).mockResolvedValue([
        {
          _id: 'mov-1',
          type: 'in',
          amount: 50000, // ₹500
          category: 'float_in',
          reason: 'Morning opening float',
          status: 'recorded',
          recordedBy: { _id: 'u-1', name: 'Kabir Partner', username: 'kabir' },
          recordedAt: new Date().toISOString(),
          localDate: '2026-10-07',
        },
        {
          _id: 'mov-2',
          type: 'out',
          amount: 20000, // ₹200
          category: 'purchase',
          reason: 'Emergency dairy milk purchase',
          status: 'recorded',
          recordedBy: { _id: 'u-1', name: 'Kabir Partner', username: 'kabir' },
          recordedAt: new Date().toISOString(),
          localDate: '2026-10-07',
        },
      ]);

      render(
        <MemoryRouter>
          <CashMovementsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Today's Cash In")).toBeInTheDocument();
        expect(screen.getByText('Morning opening float')).toBeInTheDocument();
        expect(screen.getByText('Emergency dairy milk purchase')).toBeInTheDocument();
      });
    });

    it('records a new Cash In movement successfully', async () => {
      vi.mocked(cashService.getMovements).mockResolvedValue([]);
      vi.mocked(cashService.createMovement).mockResolvedValue({
        _id: 'mov-new',
        type: 'in',
        amount: 100000,
        category: 'float_in',
        reason: 'Added coins roll',
        status: 'recorded',
        recordedBy: { _id: 'u-1', name: 'Kabir Partner', username: 'kabir' },
        recordedAt: new Date().toISOString(),
        localDate: '2026-10-07',
      });

      render(
        <MemoryRouter>
          <CashMovementsPage />
        </MemoryRouter>
      );

      await waitFor(() => expect(screen.getByText(/No cash movements recorded today/i)).toBeInTheDocument());

      // Open Cash In modal
      const cashInBtn = screen.getByRole('button', { name: /Cash In/i });
      fireEvent.click(cashInBtn);

      // Select preset ₹1000
      const preset1000 = screen.getByRole('button', { name: '₹1000' });
      fireEvent.click(preset1000);

      // Enter reason
      const reasonInput = screen.getByPlaceholderText(/Bought emergency milk packets/i);
      fireEvent.change(reasonInput, { target: { value: 'Added coins roll' } });

      // Submit
      const saveBtn = screen.getByRole('button', { name: /Save Cash In/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(cashService.createMovement).toHaveBeenCalledWith({
          type: 'in',
          amount: 100000,
          category: 'float_in',
          reason: 'Added coins roll',
          note: undefined,
        });
      });
    });
  });

  describe('ClosingPage Component', () => {
    it('walks through the 4-step closing wizard and calculates denominations', async () => {
      vi.mocked(closingService.getPreview).mockResolvedValue({
        localDate: '2026-10-07',
        isBlindCount: false,
        isAlreadyClosed: false,
        openingCash: 500000, // ₹5,000
        cashIn: 100000,
        cashOut: 50000,
        movements: [],
        openOrders: [],
        unpaidBills: [],
        supportedDenominations: [500, 200, 100, 50, 20, 10],
        differenceTolerancePaise: 5000,
        expected: {
          openingCash: 500000,
          cashSales: 1500000,
          cashIn: 100000,
          cashOut: 50000,
          expectedCash: 2050000, // ₹20,500
        },
        salesSummary: {
          grossSales: 2500000,
          discounts: 200000,
          netSales: 2300000,
          totalTax: 115000,
          roundOff: 0,
          billsCount: 15,
          dineInOrdersCount: 10,
          takeawayOrdersCount: 5,
          voidBillsCount: 0,
          cancelledItemsCount: 0,
        },
      });

      render(
        <MemoryRouter>
          <ClosingPage />
        </MemoryRouter>
      );

      // Step 1: Pre-checks
      await waitFor(() => {
        expect(screen.getByText(/Step 1: Check Open Floor Orders/i)).toBeInTheDocument();
        expect(screen.getByText(/All Cleared/i)).toBeInTheDocument();
      });

      // Advance to Step 2
      fireEvent.click(screen.getByRole('button', { name: /Continue to Cash Count/i }));

      // Step 2: Denominations
      await waitFor(() => {
        expect(screen.getByText(/Step 2: Physical Denomination Count/i)).toBeInTheDocument();
      });

      // Enter 41 notes of ₹500 = ₹20,500 (2,050,000 paise)
      const inputs = screen.getAllByRole('spinbutton');
      // First spinbutton corresponds to ₹500
      fireEvent.change(inputs[0]!, { target: { value: '41' } });

      // Total count should show ₹20,500
      expect(screen.getByText('Total Physical Count')).toBeInTheDocument();

      // Advance to Step 3: Settlement
      fireEvent.click(screen.getByRole('button', { name: /Continue to Settlement/i }));

      await waitFor(() => {
        expect(screen.getByText(/Step 3: Drawer Allocation & Float Retained/i)).toBeInTheDocument();
      });

      // Set Retained to ₹5,000, click auto-fill handover
      const autoFillBtn = screen.getByRole('button', { name: /Auto-Fill Remainder/i });
      fireEvent.click(autoFillBtn);

      // Advance to Step 4: Review
      fireEvent.click(screen.getByRole('button', { name: /Review & Submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/Step 4: Final Summary & Discrepancy Note/i)).toBeInTheDocument();
      });

      // Submit closing
      vi.mocked(closingService.submitClosing).mockResolvedValue({
        _id: 'closing-1',
        localDate: '2026-10-07',
        status: 'closed',
        openingCash: 500000,
        countedCash: 2050000,
        cashRetained: 500000,
        cashHandedOver: 1550000,
        expected: {
          openingCash: 500000,
          cashSales: 1500000,
          cashIn: 100000,
          cashOut: 50000,
          expectedCash: 2050000,
        },
        difference: 0,
        salesSummary: {
          grossSales: 2500000,
          discounts: 200000,
          netSales: 2300000,
          totalTax: 115000,
          roundOff: 0,
          billsCount: 15,
          dineInOrdersCount: 10,
          takeawayOrdersCount: 5,
          voidBillsCount: 0,
          cancelledItemsCount: 0,
        },
        closedBy: { _id: 'u-1', name: 'Kabir Partner', username: 'kabir' },
        closedAt: new Date().toISOString(),
        reopenHistory: [],
      });

      fireEvent.click(screen.getByRole('button', { name: /Confirm & Lock Daily Closing/i }));

      await waitFor(() => {
        expect(closingService.submitClosing).toHaveBeenCalled();
        expect(screen.getByText(/Daily Register Closed Successfully!/i)).toBeInTheDocument();
      });
    });
  });

  describe('AuditPage Component', () => {
    it('renders audit entries, filters and allows opening metadata panel', async () => {
      vi.mocked(auditViewerService.getAuditLogs).mockResolvedValue({
        entries: [
          {
            _id: 'aud-1',
            action: 'bill.void',
            entityType: 'bill',
            entityId: 'bill-100',
            actorName: 'Kabir Partner',
            actorId: { _id: 'u-1', name: 'Kabir Partner', username: 'kabir', role: 'partner' },
            metadata: { reason: 'Accidental double entry', amount: 85000 },
            ip: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
            createdAt: new Date().toISOString(),
          },
        ],
        nextCursor: null,
        hasMore: false,
      });

      render(
        <MemoryRouter>
          <AuditPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Audit Trail & Governance Log')).toBeInTheDocument();
        expect(screen.getByText('Bill Voided')).toBeInTheDocument();
        expect(screen.getByText(/Accidental double entry/i)).toBeInTheDocument();
      });

      // Open detail drawer
      fireEvent.click(screen.getByText('Bill Voided'));

      await waitFor(() => {
        expect(screen.getByText('Audit Entry Details')).toBeInTheDocument();
        expect(screen.getByText(/Captured Metadata Payload/i)).toBeInTheDocument();
      });
    });
  });
});
