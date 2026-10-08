import React, { useState, useEffect } from 'react';
import { ShieldCheck, Delete, X, AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { approvalService, Approver } from '@/services/approvalService';

export interface ApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  action: 'discount.apply' | 'order.item_cancel_after_kot' | 'bill.void' | 'cash.out_large';
  entityId: string;
  params?: unknown;
  onApproved: (token: string) => void;
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  isOpen,
  onClose,
  title = 'Manager Approval Required',
  description = 'A manager or partner must enter their 6-digit PIN to authorize this action.',
  action,
  entityId,
  params,
  onApproved,
}) => {
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [loadingApprovers, setLoadingApprovers] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shake, setShake] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMessage(null);
      setLoadingApprovers(true);
      approvalService
        .getApprovers()
        .then((list) => {
          setApprovers(list);
          setSelectedApproverId((prev) => prev || (list.length > 0 ? list[0]!.id : ''));
        })
        .catch((err) => {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load approvers');
        })
        .finally(() => setLoadingApprovers(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setErrorMessage(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (!selectedApproverId) {
      setErrorMessage('Please select a manager or partner');
      return;
    }
    if (pin.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit approval PIN');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await approvalService.requestApproval({
        approverId: selectedApproverId,
        pin,
        action,
        entityId,
        params,
      });

      onApproved(res.approvalToken);
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      setErrorMessage(e?.message || 'Invalid approval PIN or approval request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-brand-border flex items-center justify-between bg-brand-surface-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-body text-brand-ink-900">{title}</h3>
              <p className="text-caption text-brand-ink-500 mt-0.5 line-clamp-1">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-brand-ink-400 hover:text-brand-ink-600 transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Approver Selection */}
          <div>
            <label className="block text-caption font-medium text-brand-ink-700 mb-2">
              Select Authorizing Manager:
            </label>
            {loadingApprovers ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : approvers.length === 0 ? (
              <div className="text-center py-3 bg-red-50 text-red-600 rounded-xl text-caption flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                No active managers or partners available to grant approval
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {approvers.map((approver) => {
                  const isSelected = selectedApproverId === approver.id;
                  return (
                    <button
                      key={approver.id}
                      type="button"
                      onClick={() => {
                        setSelectedApproverId(approver.id);
                        setErrorMessage(null);
                      }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary/5 text-brand-ink-900 font-medium ring-2 ring-brand-primary/20'
                          : 'border-brand-border hover:border-brand-primary/40 text-brand-ink-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-ink-100 flex items-center justify-center font-bold text-xs text-brand-ink-600">
                        {approver.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-body-sm truncate">{approver.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* PIN Dots Display */}
          <div className="text-center">
            <span className="text-caption text-brand-ink-500 flex items-center justify-center gap-1.5 mb-3">
              <Lock className="w-3.5 h-3.5" />
              Enter 6-Digit Approval PIN
            </span>
            <div
              className={`flex items-center justify-center gap-3 py-2 ${
                shake ? 'animate-shake' : ''
              }`}
            >
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const isFilled = idx < pin.length;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-150 ${
                      isFilled
                        ? 'bg-brand-primary scale-110 shadow-sm'
                        : 'bg-brand-ink-100 border border-brand-ink-300'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-caption text-center font-medium">
              {errorMessage}
            </div>
          )}

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                disabled={submitting || pin.length >= 6}
                className="h-12 rounded-xl bg-brand-surface-card border border-brand-border hover:bg-brand-primary/10 hover:border-brand-primary/30 active:scale-95 transition-all text-body font-semibold text-brand-ink-800 disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={submitting || pin.length === 0}
              className="h-12 rounded-xl bg-brand-surface-card border border-brand-border hover:bg-red-50 text-caption font-medium text-brand-ink-500 active:scale-95 transition-all disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              disabled={submitting || pin.length >= 6}
              className="h-12 rounded-xl bg-brand-surface-card border border-brand-border hover:bg-brand-primary/10 hover:border-brand-primary/30 active:scale-95 transition-all text-body font-semibold text-brand-ink-800 disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={submitting || pin.length === 0}
              className="h-12 rounded-xl bg-brand-surface-card border border-brand-border hover:bg-brand-primary/10 text-brand-ink-600 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-brand-surface-card border-t border-brand-border flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || pin.length !== 6 || !selectedApproverId}
            isLoading={submitting}
          >
            Authorize Action
          </Button>
        </div>
      </div>
    </div>
  );
};
