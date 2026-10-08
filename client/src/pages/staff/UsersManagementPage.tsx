import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useAuth, AuthUser } from '@/lib/authContext';
import { ROLES, Role } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import {
  UserPlus,
  Search,
  KeyRound,
  ShieldCheck,
  UserX,
  UserCheck,
  Copy,
  Check,
  Edit2,
  AlertTriangle,
} from 'lucide-react';

interface UsersListResponse {
  success: boolean;
  data: {
    users: AuthUser[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export const UsersManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusConfirmModalOpen, setStatusConfirmModalOpen] = useState(false);
  const [tempPasswordModalOpen, setTempPasswordModalOpen] = useState(false);

  // Active user selections
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [displayedTempPassword, setDisplayedTempPassword] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({ name: '', username: '', role: 'cashier' as Role, phone: '' });
  const [editForm, setEditForm] = useState({ name: '', role: 'cashier' as Role, phone: '' });

  // Query users
  const { data, isLoading, isError, error, refetch } = useQuery<UsersListResponse>({
    queryKey: ['users', search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);
      return apiClient.get<UsersListResponse>(`/users?${params.toString()}`);
    },
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (payload: typeof createForm) => {
      return apiClient.post<{ success: boolean; data: { user: AuthUser; temporaryPassword: string } }>(
        '/users',
        payload
      );
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateModalOpen(false);
      setCreateForm({ name: '', username: '', role: 'cashier', phone: '' });
      setDisplayedTempPassword(res.data.temporaryPassword);
      setTempPasswordModalOpen(true);
      toast({
        type: 'success',
        title: 'Staff Member Created',
        message: `Account for ${res.data.user.name} was successfully created.`,
      });
    },
    onError: (err: Error) => {
      toast({ type: 'error', title: 'Failed to Create Staff', message: err.message });
    },
  });

  // Edit user mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof editForm }) => {
      return apiClient.patch(`/users/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditModalOpen(false);
      toast({ type: 'success', title: 'Staff Updated', message: 'User profile updated successfully.' });
    },
    onError: (err: Error) => {
      toast({ type: 'error', title: 'Update Failed', message: err.message });
    },
  });

  // Status toggle mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClient.patch(`/users/${id}/status`, { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setStatusConfirmModalOpen(false);
      toast({
        type: 'info',
        title: 'Account Status Changed',
        message: `User has been ${variables.isActive ? 'activated' : 'deactivated (all sessions revoked)'}.`,
      });
    },
    onError: (err: Error) => {
      toast({ type: 'error', title: 'Status Change Failed', message: err.message });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.post<{ success: boolean; data: { temporaryPassword: string } }>(
        `/users/${id}/reset-password`
      );
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDisplayedTempPassword(res.data.temporaryPassword);
      setTempPasswordModalOpen(true);
      toast({
        type: 'success',
        title: 'Password Reset',
        message: 'A new temporary password was generated. All prior sessions revoked.',
      });
    },
    onError: (err: Error) => {
      toast({ type: 'error', title: 'Reset Failed', message: err.message });
    },
  });

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(displayedTempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ type: 'info', title: 'Copied', message: 'Temporary password copied to clipboard.' });
  };

  const users = data?.data?.users || [];

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto font-sans">
      {/* Header & Create CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-brand-green-950 font-sans">
            Staff & User Management
          </h1>
          <p className="text-small text-brand-ink-500 font-sans mt-0.5">
            Role assignments, credentials, and access control for Gen-Z Cafe team members.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          leftIcon={<UserPlus className="h-4 w-4" />}
          onClick={() => setCreateModalOpen(true)}
        >
          Add Staff Member
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card variant="white">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:flex-1">
            <Input
              placeholder="Search by name or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: '', label: 'All Roles' },
                ...ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) })),
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      {isLoading && (
        <Card variant="white">
          <CardContent className="p-6 space-y-4">
            <Skeleton variant="text" className="h-6 w-1/3" />
            <Skeleton variant="rect" className="h-12 w-full" />
            <Skeleton variant="rect" className="h-12 w-full" />
            <Skeleton variant="rect" className="h-12 w-full" />
          </CardContent>
        </Card>
      )}

      {isError && (
        <ErrorState
          title="Failed to Load Staff Directory"
          message={error instanceof Error ? error.message : 'Network error'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && users.length === 0 && (
        <EmptyState
          title="No Staff Accounts Found"
          description={search || roleFilter ? 'No staff members match the selected filters.' : 'Add your first cafe staff member to assign roles.'}
          action={
            <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
              Add Staff Member
            </Button>
          }
        />
      )}

      {!isLoading && !isError && users.length > 0 && (
        <Card variant="white" className="overflow-x-auto">
          <table className="w-full text-left text-small border-collapse">
            <thead>
              <tr className="border-b border-brand-cream-300 bg-brand-cream-50/70 text-brand-ink-700 font-semibold">
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Security Flag</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-200">
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;

                const roleBadgeVariant: Record<Role, 'gold' | 'green' | 'cream' | 'info' | 'warning'> = {
                  partner: 'gold',
                  manager: 'green',
                  cashier: 'cream',
                  waiter: 'info',
                  kitchen: 'warning',
                  marketing: 'gold',
                };

                return (
                  <tr key={u.id} className="hover:bg-brand-cream-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-brand-green-950 flex items-center gap-2">
                        {u.name}
                        {isSelf && (
                          <span className="text-[10px] font-mono bg-brand-gold-500/30 text-brand-ink-900 px-1.5 py-0.5 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      {u.phone && <p className="text-caption text-brand-ink-500">{u.phone}</p>}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-caption text-brand-ink-700">
                      @{u.username}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={roleBadgeVariant[u.role] || 'cream'} size="sm">
                        {u.role.toUpperCase()}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      {u.isActive ? (
                        <Badge variant="success" size="sm" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="danger" size="sm" dot>
                          Deactivated
                        </Badge>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {u.mustChangePassword ? (
                        <span className="text-[11px] font-medium text-semantic-warning flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Temp Password
                        </span>
                      ) : (
                        <span className="text-[11px] text-brand-ink-500">Normal</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          type="button"
                          title="Edit staff details"
                          onClick={() => {
                            setSelectedUser(u);
                            setEditForm({ name: u.name, role: u.role, phone: u.phone || '' });
                            setEditModalOpen(true);
                          }}
                          className="p-1.5 rounded hover:bg-brand-cream-200 text-brand-ink-700 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        {/* Reset Password */}
                        <button
                          type="button"
                          title="Generate temporary password"
                          onClick={() => {
                            setSelectedUser(u);
                            resetPasswordMutation.mutate(u.id);
                          }}
                          disabled={resetPasswordMutation.isPending}
                          className="p-1.5 rounded hover:bg-brand-cream-200 text-brand-ink-700 transition-colors"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>

                        {/* Activate / Deactivate Toggle */}
                        {!isSelf && (
                          <button
                            type="button"
                            title={u.isActive ? 'Deactivate account' : 'Activate account'}
                            onClick={() => {
                              setSelectedUser(u);
                              setStatusConfirmModalOpen(true);
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              u.isActive
                                ? 'hover:bg-semantic-danger-bg text-semantic-danger'
                                : 'hover:bg-semantic-success-bg text-semantic-success'
                            }`}
                          >
                            {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Staff Member"
        description="Create an account and generate a one-time temporary password."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(createForm);
          }}
          className="space-y-4 pt-2"
        >
          <Input
            label="Full Name"
            placeholder="e.g. Ramesh Kumar"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            required
          />

          <Input
            label="Username (lowercase alphanumeric)"
            placeholder="e.g. ramesh_cashier"
            value={createForm.username}
            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase() })}
            required
          />

          <Select
            label="Staff Role"
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
            options={ROLES.map((r) => ({
              value: r,
              label: `${r.charAt(0).toUpperCase() + r.slice(1)} ${r === 'partner' ? '(Full Access)' : ''}`,
            }))}
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="+91 98765 43210"
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-brand-cream-300">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Create & Issue Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Staff Member"
        description={selectedUser ? `Modifying @${selectedUser.username}` : ''}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedUser) {
              editMutation.mutate({ id: selectedUser.id, payload: editForm });
            }
          }}
          className="space-y-4 pt-2"
        >
          <Input
            label="Full Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />

          <Select
            label="Staff Role"
            value={editForm.role}
            disabled={currentUser?.id === selectedUser?.id} // Partner cannot demote themselves
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
            options={ROLES.map((r) => ({
              value: r,
              label: r.charAt(0).toUpperCase() + r.slice(1),
            }))}
          />

          <Input
            label="Phone Number"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-brand-cream-300">
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={editMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* STATUS TOGGLE CONFIRM MODAL */}
      <Modal
        isOpen={statusConfirmModalOpen}
        onClose={() => setStatusConfirmModalOpen(false)}
        title={selectedUser?.isActive ? 'Deactivate Staff Account' : 'Reactivate Staff Account'}
        description={selectedUser ? `Confirm status update for ${selectedUser.name} (@${selectedUser.username})` : ''}
      >
        <div className="space-y-4 pt-2">
          {selectedUser?.isActive ? (
            <div className="p-3.5 rounded-card-sm bg-semantic-danger-bg border border-semantic-danger/30 text-small text-brand-ink-900 space-y-2">
              <p className="font-semibold text-semantic-danger flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                All active staff sessions will be revoked immediately
              </p>
              <p className="text-caption text-brand-ink-700">
                This user will be prevented from logging in to POS, kitchen terminals, or the staff portal.
              </p>
            </div>
          ) : (
            <p className="text-small text-brand-ink-700">
              Reactivating this account will permit the user to authenticate using their existing credentials.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-brand-cream-300">
            <Button variant="ghost" onClick={() => setStatusConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={selectedUser?.isActive ? 'danger' : 'primary'}
              isLoading={statusMutation.isPending}
              onClick={() => {
                if (selectedUser) {
                  statusMutation.mutate({ id: selectedUser.id, isActive: !selectedUser.isActive });
                }
              }}
            >
              Confirm {selectedUser?.isActive ? 'Deactivation' : 'Reactivation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ONE-TIME TEMPORARY PASSWORD COPY MODAL */}
      <Modal
        isOpen={tempPasswordModalOpen}
        onClose={() => setTempPasswordModalOpen(false)}
        title="Temporary Credentials Issued"
        description="Provide these credentials to the staff member. They will be forced to set their own password upon first sign-in."
      >
        <div className="space-y-5 pt-2">
          <div className="p-4 rounded-card-sm bg-semantic-warning-bg border border-semantic-warning/40 space-y-2">
            <p className="font-semibold text-small text-brand-ink-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-semantic-warning" />
              IMPORTANT: This temporary password will NOT be shown again.
            </p>
            <p className="text-caption text-brand-ink-700">
              Ensure you copy or share this password securely with the staff member before closing this window.
            </p>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-card-sm bg-brand-cream-200/60 border border-brand-cream-300">
            <code className="flex-1 font-mono text-lg font-bold text-brand-green-950 tracking-wider">
              {displayedTempPassword}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyPassword}
              leftIcon={copied ? <Check className="h-4 w-4 text-semantic-success" /> : <Copy className="h-4 w-4" />}
            >
              {copied ? 'Copied!' : 'Copy Password'}
            </Button>
          </div>

          <div className="flex justify-end pt-3 border-t border-brand-cream-300">
            <Button variant="primary" onClick={() => setTempPasswordModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
