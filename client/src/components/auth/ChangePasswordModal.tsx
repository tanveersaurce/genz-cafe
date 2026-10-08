import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { KeyRound, ShieldAlert } from 'lucide-react';

export const ChangePasswordModal: React.FC = () => {
  const { user, changePassword } = useAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user?.mustChangePassword) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword === user.username) {
      setError('New password cannot be identical to your username.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await changePassword(currentPassword, newPassword);
      toast({
        type: 'success',
        title: 'Password Updated',
        message: 'Your temporary password has been changed. You now have full access.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {}} // Non-dismissible: user must change password
      title="Password Change Required"
      description="You are currently using a temporary password. Please set a secure password to continue."
      showCloseButton={false}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="p-3.5 rounded-card-sm bg-semantic-warning-bg border border-semantic-warning/30 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-semantic-warning shrink-0 mt-0.5" />
          <p className="text-caption text-brand-ink-700">
            Staff security policy requires updating temporary credentials before accessing operational tools.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-card-sm bg-semantic-danger-bg border border-semantic-danger/30 text-caption text-semantic-danger">
            {error}
          </div>
        )}

        <Input
          label="Current Temporary Password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <Input
          label="New Password (min 8 characters)"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={loading}
            leftIcon={<KeyRound className="h-4 w-4" />}
          >
            Save Password & Proceed
          </Button>
        </div>
      </form>
    </Modal>
  );
};
