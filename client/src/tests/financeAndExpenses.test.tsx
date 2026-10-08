import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExpensesPage } from '../pages/staff/ExpensesPage';
import { PnlPage } from '../pages/staff/PnlPage';
import { PartnersPage } from '../pages/staff/PartnersPage';
import { StatementsPage } from '../pages/staff/StatementsPage';
import { expenseService } from '../services/expenseService';
import { financeService } from '../services/financeService';
import { partnerService } from '../services/partnerService';
import { statementService } from '../services/statementService';

vi.mock('../services/expenseService', () => ({
  expenseService: {
    listExpenses: vi.fn(),
    getCategories: vi.fn(),
    getVendors: vi.fn(),
    listRecurringTemplates: vi.fn(),
    createExpense: vi.fn(),
    voidExpense: vi.fn(),
    addPayment: vi.fn(),
  },
}));

vi.mock('../services/financeService', () => ({
  financeService: {
    getPnl: vi.fn(),
    getTrend: vi.fn(),
    getExportUrl: vi.fn(),
  },
}));

vi.mock('../services/partnerService', () => ({
  partnerService: {
    getSummary: vi.fn(),
    listPartners: vi.fn(),
    getCurrentShares: vi.fn(),
    listCapitalEntries: vi.fn(),
    listWithdrawals: vi.fn(),
    createWithdrawal: vi.fn(),
  },
}));

vi.mock('../services/statementService', () => ({
  statementService: {
    listStatements: vi.fn(),
    getPreChecks: vi.fn(),
    getPreview: vi.fn(),
    finalizeStatement: vi.fn(),
    reopenStatement: vi.fn(),
    getPdfUrl: vi.fn((m: string) => `/api/statements/${m}/pdf`),
  },
}));

vi.mock('../lib/authContext', () => ({
  useAuth: () => ({
    user: {
      id: 'partner-user-1',
      name: 'Diya Partner',
      role: 'partner',
      permissions: [
        'expenses:read',
        'expenses:create',
        'expenses:edit',
        'expenses:void',
        'finance:view',
        'partners:manage',
      ],
    },
    logout: vi.fn(),
  }),
}));

describe('Finance, Expenses, Partners & Statements (Prompt 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ExpensesPage Component', () => {
    it('renders expenses table, summary metrics and items', async () => {
      vi.mocked(expenseService.listExpenses).mockResolvedValue({
        items: [
          {
            _id: 'exp-1',
            expenseNo: 'EXP-202610-0001',
            expenseDate: '2026-10-01',
            categoryId: { _id: 'cat-1', name: 'Coffee Beans', type: 'cogs_purchase' },
            vendorName: 'Blue Tokai Roasters',
            amount: 500000, // ₹5,000
            paidAmount: 500000,
            paymentStatus: 'paid',
            status: 'active',
            payments: [
              {
                _id: 'pay-1',
                amount: 500000,
                method: 'cash_drawer',
                paidAt: '2026-10-01T10:00:00Z',
              },
            ],
            createdAt: '2026-10-01T10:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pages: 1,
        summary: {
          totalAmount: 500000,
          totalPaid: 500000,
        },
      });
      vi.mocked(expenseService.getCategories).mockResolvedValue([
        { _id: 'cat-1', name: 'Coffee Beans', type: 'cogs_purchase', isActive: true, sortOrder: 1 },
      ]);
      vi.mocked(expenseService.getVendors).mockResolvedValue([
        { _id: 'ven-1', name: 'Blue Tokai Roasters' },
      ]);
      vi.mocked(partnerService.listPartners).mockResolvedValue([]);
      vi.mocked(expenseService.listRecurringTemplates).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <ExpensesPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Expense Management')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('EXP-202610-0001')).toBeInTheDocument();
        expect(screen.getByText('Blue Tokai Roasters')).toBeInTheDocument();
        expect(screen.getAllByText('₹5,000').length).toBeGreaterThan(0);
      });
    });
  });

  describe('PnlPage Component', () => {
    it('renders P&L breakdown with revenue, cogs, margins and operating profit', async () => {
      vi.mocked(financeService.getPnl).mockResolvedValue({
        range: { from: '2026-10-01', to: '2026-10-31' },
        revenue: {
          grossSales: 10000000,
          discounts: 500000,
          netRevenue: 9500000,
          gstCollected: 475000,
          roundOff: 0,
          totalBilled: 9975000,
        },
        directCosts: {
          total: 3000000,
          cogsPurchases: 3000000,
        },
        grossProfit: 6500000,
        grossMarginBasisPoints: 6842, // 68.42%
        operatingExpenses: {
          total: 2000000,
          byType: { payroll: 2000000 },
          byCategory: [{ name: 'Salaries', type: 'payroll', amount: 2000000 }],
        },
        operatingProfit: 4500000,
        nonOperatingExpenses: {
          total: 0,
          byCategory: [],
        },
        netProfit: 4500000,
        unpaidSupplierCredit: 0,
      });
      vi.mocked(financeService.getTrend).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <PnlPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Profit & Loss Statement')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Gross Profit & Margin')).toBeInTheDocument();
        expect(screen.getByText('P&L Detailed Breakdown')).toBeInTheDocument();
        expect(screen.getByText('Net Revenue (Ex-GST)')).toBeInTheDocument();
      });
    });
  });

  describe('PartnersPage Component', () => {
    it('renders equity schedule, partners and ledger balance summaries', async () => {
      vi.mocked(partnerService.getSummary).mockResolvedValue([
        {
          partner: {
            _id: 'p-1',
            name: 'Aarav Mehta',
            email: 'aarav@genzcafe.local',
            isActive: true,
          },
          totalCredits: 6000000,
          totalDebits: 2000000,
          netBalance: 4000000,
        },
      ]);
      vi.mocked(partnerService.getCurrentShares).mockResolvedValue({
        _id: 'sched-1',
        effectiveFrom: '2026-01-01',
        shares: [{ partnerId: { _id: 'p-1', name: 'Aarav Mehta' }, basisPoints: 6000 }],
      });
      vi.mocked(partnerService.listCapitalEntries).mockResolvedValue([]);
      vi.mocked(partnerService.listWithdrawals).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <PartnersPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Partners & Equity')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getAllByText('Aarav Mehta').length).toBeGreaterThan(0);
        expect(screen.getByText('Active Equity Ownership Schedule')).toBeInTheDocument();
        expect(screen.getAllByText('60.00%').length).toBeGreaterThan(0);
      });
    });
  });

  describe('StatementsPage Component', () => {
    it('renders finalized monthly statements with allocations and checksum', async () => {
      vi.mocked(statementService.listStatements).mockResolvedValue([
        {
          _id: 'stmt-1',
          statementNo: 'STMT-202609-001',
          month: '2026-09',
          status: 'finalized',
          version: 1,
          totals: {
            grossSales: 10000000,
            discounts: 500000,
            netRevenue: 9500000,
            totalTax: 475000,
            directCosts: 3000000,
            operatingExpenses: 2000000,
            netProfit: 4500000,
          },
          retainedAmount: 500000,
          distributableAmount: 4000000,
          allocations: [
            {
              partnerId: 'p-1',
              partnerNameSnapshot: 'Aarav Mehta',
              basisPoints: 6000,
              amount: 2400000,
            },
          ],
          finalizedBy: { _id: 'u-1', name: 'Diya Partner' },
          finalizedAt: '2026-10-01T00:00:00Z',
          checksum: 'a8b3e25f829c426618492040b2847291a2839281923049281920394819203948',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ]);

      render(
        <MemoryRouter>
          <StatementsPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Partner Monthly Statements')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText(/STMT-202609-001/)).toBeInTheDocument();
        expect(screen.getByText('₹40,000')).toBeInTheDocument();
        expect(screen.getByText(/a8b3e25f829c426618492040b2847291a28392819230492819203948/)).toBeInTheDocument();
      });
    });
  });
});
