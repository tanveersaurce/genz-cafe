import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface CancelReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: (reason: string) => Promise<void>;
  confirmLabel?: string;
}

export const CancelReasonModal: React.FC<CancelReasonModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirm Action',
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      setError('Please provide a specific reason (at least 3 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-body-sm text-brand-ink-900/80">{description}</p>

        <div>
          <label className="block text-caption font-semibold text-brand-ink-900 mb-1">
            Reason for Cancellation / Action <span className="text-brand-danger">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Guest changed mind, billing error, duplicate entry..."
            className="w-full px-3 py-2 border border-brand-cream-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-gold-500 bg-white"
            autoFocus
          />
        </div>

        {error && <p className="text-caption text-brand-danger">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Dismiss
          </Button>
          <Button type="submit" variant="danger" isLoading={submitting}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
