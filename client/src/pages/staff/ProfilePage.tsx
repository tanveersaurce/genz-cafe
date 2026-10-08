import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { pinAuthService } from '@/services/pinAuthService';
import { approvalService } from '@/services/approvalService';

export const ProfilePage: React.FC = () => {
  const { user, changePassword } = useAuth();

  // Fast Login PIN State (4 digits)
  const [loginCurrentPass, setLoginCurrentPass] = useState<string>('');
  const [loginPin, setLoginPin] = useState<string>('');
  const [loginPinConfirm, setLoginPinConfirm] = useState<string>('');
  const [loginPinLoading, setLoginPinLoading] = useState<boolean>(false);
  const [loginPinSuccess, setLoginPinSuccess] = useState<string | null>(null);
  const [loginPinError, setLoginPinError] = useState<string | null>(null);

  // Approval PIN State (6 digits - Partner/Manager only)
  const [approvalCurrentPass, setApprovalCurrentPass] = useState<string>('');
  const [approvalPin, setApprovalPin] = useState<string>('');
  const [approvalPinConfirm, setApprovalPinConfirm] = useState<string>('');
  const [approvalPinLoading, setApprovalPinLoading] = useState<boolean>(false);
  const [approvalPinSuccess, setApprovalPinSuccess] = useState<string | null>(null);
  const [approvalPinError, setApprovalPinError] = useState<string | null>(null);

  // Password Change State
  const [passCurrent, setPassCurrent] = useState<string>('');
  const [passNew, setPassNew] = useState<string>('');
  const [passConfirm, setPassConfirm] = useState<string>('');
  const [passLoading, setPassLoading] = useState<boolean>(false);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  if (!user) return null;

  const canGrantApprovals = hasPermission(user.permissions, 'approvals:grant');

  const handleSetLoginPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginPinError(null);
    setLoginPinSuccess(null);

    if (loginPin.length !== 4) {
      setLoginPinError('Fast login PIN must be exactly 4 digits');
      return;
    }
    if (loginPin !== loginPinConfirm) {
      setLoginPinError('PIN confirmation does not match');
      return;
    }

    setLoginPinLoading(true);
    try {
      await pinAuthService.setLoginPin({
        currentPassword: loginCurrentPass,
        pin: loginPin,
      });
      setLoginPinSuccess('Fast login PIN updated successfully!');
      setLoginCurrentPass('');
      setLoginPin('');
      setLoginPinConfirm('');
    } catch (err: unknown) {
      setLoginPinError(err instanceof Error ? err.message : 'Failed to update login PIN');
    } finally {
      setLoginPinLoading(false);
    }
  };

  const handleSetApprovalPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setApprovalPinError(null);
    setApprovalPinSuccess(null);

    if (approvalPin.length !== 6) {
      setApprovalPinError('Manager approval PIN must be exactly 6 digits');
      return;
    }
    if (approvalPin !== approvalPinConfirm) {
      setApprovalPinError('Approval PIN confirmation does not match');
      return;
    }

    setApprovalPinLoading(true);
    try {
      await approvalService.setApprovalPin({
        currentPassword: approvalCurrentPass,
        pin: approvalPin,
      });
      setApprovalPinSuccess('Manager approval PIN updated successfully!');
      setApprovalCurrentPass('');
      setApprovalPin('');
      setApprovalPinConfirm('');
    } catch (err: unknown) {
      setApprovalPinError(err instanceof Error ? err.message : 'Failed to update approval PIN');
    } finally {
      setApprovalPinLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (passNew !== passConfirm) {
      setPassError('New passwords do not match');
      return;
    }
    if (passNew.length < 8) {
      setPassError('Password must be at least 8 characters long');
      return;
    }

    setPassLoading(true);
    try {
      await changePassword(passCurrent, passNew);
      setPassSuccess('Account password changed successfully! All other sessions have been logged out.');
      setPassCurrent('');
      setPassNew('');
      setPassConfirm('');
    } catch (err: unknown) {
      setPassError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header & User Card */}
      <div className="bg-brand-surface p-6 rounded-3xl border border-brand-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary text-brand-ink-900 font-heading font-bold text-xl flex items-center justify-center shadow-sm">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading font-bold text-title text-brand-ink-900">
                {user.name}
              </h1>
              <Badge variant="gold" size="sm" className="capitalize">
                {user.role}
              </Badge>
            </div>
            <p className="text-body-sm text-brand-ink-500 mt-1">
              @{user.username} {user.phone ? `• ${user.phone}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Fast Login PIN (4 digits) */}
        <div className="bg-brand-surface p-6 rounded-3xl border border-brand-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                  Fast Login PIN (4 Digits)
                </h3>
                <p className="text-caption text-brand-ink-500">
                  Used for instant login on trusted counter tablets
                </p>
              </div>
            </div>

            {loginPinSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-caption mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{loginPinSuccess}</span>
              </div>
            )}
            {loginPinError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-caption mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{loginPinError}</span>
              </div>
            )}

            <form onSubmit={handleSetLoginPin} className="space-y-3.5">
              <div>
                <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                  Current Password:
                </label>
                <input
                  type="password"
                  value={loginCurrentPass}
                  onChange={(e) => setLoginCurrentPass(e.target.value)}
                  placeholder="Verify account password"
                  className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  required
                />
              </div>

              <div>
                <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                  New 4-Digit PIN:
                </label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  inputMode="numeric"
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  required
                />
              </div>

              <div>
                <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                  Confirm 4-Digit PIN:
                </label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  inputMode="numeric"
                  value={loginPinConfirm}
                  onChange={(e) => setLoginPinConfirm(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  required
                />
              </div>

              <span className="block text-caption text-brand-ink-400">
                Trivial PINs like 1234 or 0000 are not permitted.
              </span>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full mt-2"
                isLoading={loginPinLoading}
              >
                Save 4-Digit PIN
              </Button>
            </form>
          </div>
        </div>

        {/* Card 2: Manager Approval PIN (6 digits - Manager / Partner Only) */}
        {canGrantApprovals && (
          <div className="bg-brand-surface p-6 rounded-3xl border border-brand-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                    Manager Approval PIN (6 Digits)
                  </h3>
                  <p className="text-caption text-brand-ink-500">
                    Authorizes discounts, voided bills, and cancellations
                  </p>
                </div>
              </div>

              {approvalPinSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-caption mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{approvalPinSuccess}</span>
                </div>
              )}
              {approvalPinError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-caption mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{approvalPinError}</span>
                </div>
              )}

              <form onSubmit={handleSetApprovalPin} className="space-y-3.5">
                <div>
                  <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                    Current Password:
                  </label>
                  <input
                    type="password"
                    value={approvalCurrentPass}
                    onChange={(e) => setApprovalCurrentPass(e.target.value)}
                    placeholder="Verify account password"
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                    New 6-Digit Approval PIN:
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    value={approvalPin}
                    onChange={(e) => setApprovalPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                    Confirm 6-Digit Approval PIN:
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    value={approvalPinConfirm}
                    onChange={(e) => setApprovalPinConfirm(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                    required
                  />
                </div>

                <span className="block text-caption text-brand-ink-400">
                  Must be 6 digits. Never share this PIN with staff.
                </span>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                  isLoading={approvalPinLoading}
                >
                  Save 6-Digit Approval PIN
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Card 3: Change Account Password */}
        <div className="bg-brand-surface p-6 rounded-3xl border border-brand-border shadow-sm md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                Change Password
              </h3>
              <p className="text-caption text-brand-ink-500">
                Update your login password across all devices
              </p>
            </div>
          </div>

          {passSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-caption mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{passSuccess}</span>
            </div>
          )}
          {passError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-caption mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                Current Password:
              </label>
              <input
                type="password"
                value={passCurrent}
                onChange={(e) => setPassCurrent(e.target.value)}
                placeholder="Current password"
                className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                required
              />
            </div>

            <div>
              <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                New Password:
              </label>
              <input
                type="password"
                value={passNew}
                onChange={(e) => setPassNew(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                required
              />
            </div>

            <div>
              <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                Confirm New Password:
              </label>
              <input
                type="password"
                value={passConfirm}
                onChange={(e) => setPassConfirm(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                required
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" variant="primary" size="sm" isLoading={passLoading}>
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
