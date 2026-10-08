import React, { useState, useEffect } from 'react';
import { Tablet, Plus, ShieldAlert, CheckCircle2, Clock, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { deviceService, TrustedDevice } from '@/services/deviceService';

export const DevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>('');
  const [partnerPassword, setPartnerPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await deviceService.listDevices();
      setDevices(data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch authorized devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || !partnerPassword) {
      setErrorMessage('Device name and partner password are required');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await deviceService.registerDevice({
        name: deviceName.trim(),
        password: partnerPassword,
      });

      setSuccessMessage(`Terminal "${deviceName.trim()}" registered successfully! Fast PIN login is now enabled.`);
      setIsModalOpen(false);
      setDeviceName('');
      setPartnerPassword('');
      await fetchDevices();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to authorize device');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke authorization for "${name}"? All active staff sessions on this terminal will be immediately disconnected.`)) {
      return;
    }

    try {
      await deviceService.revokeDevice(id);
      setSuccessMessage(`Authorization for "${name}" has been revoked.`);
      await fetchDevices();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to revoke device authorization');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-headline text-brand-ink-900 tracking-tight">
            Trusted Terminals
          </h1>
          <p className="text-body-sm text-brand-ink-500 mt-1">
            Authorize and manage physical tablets and counter computers allowed for fast 4-digit PIN login.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Authorize This Terminal
        </Button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-body-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-body-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Devices List */}
      <div className="bg-brand-surface rounded-3xl border border-brand-border overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Spinner size="lg" />
            <p className="text-body-sm text-brand-ink-500 mt-3">Loading authorized devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="p-12 text-center">
            <Tablet className="w-12 h-12 text-brand-ink-300 mx-auto mb-3" />
            <h3 className="font-heading font-semibold text-body text-brand-ink-900">
              No Trusted Devices Registered
            </h3>
            <p className="text-body-sm text-brand-ink-500 mt-1 max-w-md mx-auto mb-6">
              To allow staff to use fast 4-digit PIN login on this counter tablet or POS station,
              authorize it as a trusted terminal.
            </p>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Authorize This Device Now
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {devices.map((device) => (
              <div
                key={device._id}
                className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-brand-surface-card/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary flex-shrink-0 mt-0.5">
                    <Tablet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                        {device.name}
                      </h3>
                      <Badge variant="success" size="sm">
                        Authorized
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-caption text-brand-ink-500 mt-1.5">
                      <span>
                        Registered by <strong className="text-brand-ink-700">{device.registeredBy?.name || 'Partner'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Added {new Date(device.registeredAt).toLocaleDateString()}
                      </span>
                      {device.lastUsedAt && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Last active {new Date(device.lastUsedAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(device._id, device.name)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 self-end sm:self-center"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Revoke Access
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-brand-surface rounded-3xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-surface-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                  <Tablet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                    Authorize Device
                  </h3>
                  <p className="text-caption text-brand-ink-500">Register this browser as a trusted terminal</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-brand-ink-400 hover:text-brand-ink-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterDevice} className="p-6 space-y-4">
              <div>
                <label className="block text-body-sm font-medium text-brand-ink-800 mb-1.5">
                  Device / Station Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Counter iPad 1, Main POS Terminal"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-brand-ink-800 mb-1.5">
                  Confirm Partner Password:
                </label>
                <input
                  type="password"
                  placeholder="Enter your partner password"
                  value={partnerPassword}
                  onChange={(e) => setPartnerPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  required
                />
                <span className="block text-caption text-brand-ink-400 mt-1">
                  Only partners can authorize hardware devices for fast login.
                </span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-caption">
                <strong>Important:</strong> Authorization installs a persistent secure cookie on this browser. Do not authorize shared personal devices.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={submitting}>
                  Authorize Terminal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
