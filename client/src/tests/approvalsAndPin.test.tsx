import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApprovalDialog } from '../components/auth/ApprovalDialog';
import { PinLoginPage } from '../pages/staff/PinLoginPage';
import { IdleLockOverlay } from '../components/auth/IdleLockOverlay';
import { approvalService } from '../services/approvalService';
import { pinAuthService } from '../services/pinAuthService';

vi.mock('../services/approvalService', () => ({
  approvalService: {
    getApprovers: vi.fn(),
    requestApproval: vi.fn(),
    setApprovalPin: vi.fn(),
  },
}));

vi.mock('../services/pinAuthService', () => ({
  pinAuthService: {
    getPinUsers: vi.fn(),
    loginWithPin: vi.fn(),
    setLoginPin: vi.fn(),
  },
}));

const mockLoginWithPin = vi.fn();
const mockLogout = vi.fn();

vi.mock('../lib/authContext', () => ({
  useAuth: () => ({
    user: {
      id: 'cashier-1',
      name: 'Rohan Cashier',
      role: 'cashier',
      permissions: ['cash:record', 'closing:perform'],
    },
    loginWithPin: mockLoginWithPin,
    logout: mockLogout,
  }),
}));

describe('Manager Approval PIN & Fast PIN Login (Prompt 8 Part A & B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApprovalDialog Component', () => {
    const mockApprovers = [
      { id: 'mgr-1', name: 'Alok Manager' },
      { id: 'partner-1', name: 'Kabir Partner' },
    ];

    it('renders approvers list and allows selecting an approver to enter PIN', async () => {
      vi.mocked(approvalService.getApprovers).mockResolvedValue(mockApprovers);

      const onApproved = vi.fn();
      const onClose = vi.fn();

      render(
        <ApprovalDialog
          isOpen={true}
          onClose={onClose}
          title="Approve Large Discount"
          description="Requires manager override"
          action="discount.apply"
          entityId="bill-1"
          params={{ discountPercent: 25 }}
          onApproved={onApproved}
        />
      );

      // Verify title and approvers
      expect(screen.getByText('Approve Large Discount')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('Alok Manager')).toBeInTheDocument();
        expect(screen.getByText('Kabir Partner')).toBeInTheDocument();
      });

      // Click Alok Manager
      fireEvent.click(screen.getByText('Alok Manager'));

      // Check keypad digits are rendered
      const digit1 = screen.getByRole('button', { name: '1' });
      const digit2 = screen.getByRole('button', { name: '2' });

      // Click digits to form PIN
      fireEvent.click(digit1);
      fireEvent.click(digit2);

      // Select Kabir Partner
      fireEvent.click(screen.getByText('Kabir Partner'));
      expect(screen.getByText('Kabir Partner')).toBeInTheDocument();
    });

    it('submits 6-digit PIN and returns approval token on success', async () => {
      vi.mocked(approvalService.getApprovers).mockResolvedValue(mockApprovers);
      vi.mocked(approvalService.requestApproval).mockResolvedValue({
        approvalToken: 'valid-test-token-xyz',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      });

      const onApproved = vi.fn();
      const onClose = vi.fn();

      render(
        <ApprovalDialog
          isOpen={true}
          onClose={onClose}
          title="Approve Void Bill"
          action="bill.void"
          entityId="bill-99"
          onApproved={onApproved}
        />
      );

      await waitFor(() => expect(screen.getByText('Alok Manager')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Alok Manager'));

      // Enter 6 digits: 8, 4, 2, 9, 1, 3
      [8, 4, 2, 9, 1, 3].forEach((digit) => {
        fireEvent.click(screen.getByRole('button', { name: String(digit) }));
      });

      // Click Authorize button
      const authBtn = screen.getByRole('button', { name: /Authorize Action/i });
      fireEvent.click(authBtn);

      await waitFor(() => {
        expect(approvalService.requestApproval).toHaveBeenCalledWith({
          approverId: 'mgr-1',
          pin: '842913',
          action: 'bill.void',
          entityId: 'bill-99',
          params: undefined,
        });
        expect(onApproved).toHaveBeenCalledWith('valid-test-token-xyz');
      });
    });
  });

  describe('PinLoginPage Component', () => {
    it('shows unregistered device warning when device is not trusted', async () => {
      const err = new Error('Device not registered');
      Object.assign(err, { code: 'DEVICE_UNREGISTERED' });
      vi.mocked(pinAuthService.getPinUsers).mockRejectedValue(err);

      render(
        <MemoryRouter>
          <PinLoginPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Device Not Authorized/i)).toBeInTheDocument();
      });
    });

    it('lists registered staff users and accepts 4-digit fast PIN login', async () => {
      vi.mocked(pinAuthService.getPinUsers).mockResolvedValue([
        { id: 'u-1', name: 'Rohan Waiter', username: 'rohan_w', role: 'waiter' },
      ]);
      mockLoginWithPin.mockResolvedValue({ role: 'waiter' });

      render(
        <MemoryRouter>
          <PinLoginPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Rohan Waiter')).toBeInTheDocument();
      });

      // Select Rohan
      fireEvent.click(screen.getByText('Rohan Waiter'));
      expect(screen.getByText(/Enter 4-Digit PIN/i)).toBeInTheDocument();

      // Enter 4 digits
      [4, 7, 2, 1].forEach((d) => {
        fireEvent.click(screen.getByRole('button', { name: String(d) }));
      });

      await waitFor(() => {
        expect(mockLoginWithPin).toHaveBeenCalledWith('u-1', '4721');
      });
    });
  });

  describe('IdleLockOverlay Component', () => {
    it('remains hidden when user is active', () => {
      const { container } = render(
        <MemoryRouter>
          <IdleLockOverlay />
        </MemoryRouter>
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
