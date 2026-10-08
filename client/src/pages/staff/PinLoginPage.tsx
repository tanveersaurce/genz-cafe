import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Tablet, ArrowLeft, Delete, AlertCircle, ShieldAlert, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/authContext';
import { pinAuthService, PinUser } from '@/services/pinAuthService';

export const PinLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithPin } = useAuth();

  const [users, setUsers] = useState<PinUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PinUser | null>(null);
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isUnregistered, setIsUnregistered] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    pinAuthService
      .getPinUsers()
      .then((data) => {
        setUsers(data);
        setIsUnregistered(false);
      })
      .catch((err: unknown) => {
        const errorObj = err as { code?: string; message?: string };
        if (errorObj?.code === 'DEVICE_UNREGISTERED' || errorObj?.code === 'DEVICE_REVOKED') {
          setIsUnregistered(true);
        } else {
          setErrorMessage(errorObj?.message || 'Failed to initialize terminal login');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMessage(null);
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
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

  const submitPin = async (pinToSubmit: string) => {
    if (!selectedUser) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const user = loginWithPin
        ? await loginWithPin(selectedUser.id, pinToSubmit)
        : (await pinAuthService.loginWithPin({ userId: selectedUser.id, pin: pinToSubmit })).user;
      // Route based on role
      if (user.role === 'kitchen') {
        navigate('/app/kitchen');
      } else {
        navigate('/app/pos');
      }
    } catch (err: unknown) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      setErrorMessage(err instanceof Error ? err.message : 'Invalid 4-digit PIN');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-surface-card flex flex-col items-center justify-center p-4">
        <Spinner size="lg" variant="gold" label="Checking terminal authorization..." />
        <p className="text-body-sm text-brand-ink-500 mt-3 font-medium">Verifying trusted device...</p>
      </div>
    );
  }

  if (isUnregistered) {
    return (
      <div className="min-h-screen bg-brand-surface-card flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-brand-surface p-8 rounded-2xl border border-brand-border shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="font-heading font-bold text-title text-brand-ink-900 mb-2">
            Device Not Authorized
          </h2>
          <p className="text-body-sm text-brand-ink-600 mb-6 leading-relaxed">
            This browser terminal is not registered as a trusted device for fast PIN login.
            To authorize this terminal, sign in with a Partner account and register it under Devices.
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/app/login">
              <Button variant="primary" className="w-full">
                <LogIn className="w-4 h-4 mr-2" />
                Sign in with Username & Password
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="w-full">
                Back to Public Website
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface-card flex flex-col">
      {/* Top Bar */}
      <header className="px-6 py-4 bg-brand-surface border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
            <Tablet className="w-5 h-5" />
          </div>
          <div>
            <span className="font-heading font-bold text-body text-brand-ink-900 tracking-tight">
              Gen-Z Cafe
            </span>
            <span className="block text-caption text-brand-ink-500 font-medium">
              Trusted Terminal • Fast Login
            </span>
          </div>
        </div>
        <Link to="/app/login">
          <Button variant="ghost" size="sm">
            <LogIn className="w-4 h-4 mr-1.5" />
            Password Login
          </Button>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        {!selectedUser ? (
          /* Step 1: Staff Selection Grid */
          <div className="max-w-xl w-full">
            <div className="text-center mb-8">
              <h1 className="font-heading font-bold text-title text-brand-ink-900">
                Who is logging in?
              </h1>
              <p className="text-body-sm text-brand-ink-500 mt-1">
                Select your profile to unlock this terminal
              </p>
            </div>

            {users.length === 0 ? (
              <div className="p-8 bg-brand-surface rounded-2xl border border-brand-border text-center">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h3 className="font-medium text-body text-brand-ink-800">No Staff PINs Configured</h3>
                <p className="text-body-sm text-brand-ink-500 mt-1 mb-4">
                  Floor staff must first log in with their password and set a 4-digit PIN in Profile.
                </p>
                <Link to="/app/login">
                  <Button variant="primary">Log in with Password</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {users.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => {
                      setSelectedUser(staff);
                      setPin('');
                      setErrorMessage(null);
                    }}
                    className="p-5 bg-brand-surface rounded-2xl border border-brand-border hover:border-brand-primary hover:shadow-lg transition-all text-center flex flex-col items-center group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-heading font-bold text-lg mb-3 group-hover:scale-105 transition-transform shadow-inner">
                      {staff.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-body text-brand-ink-900 truncate w-full">
                      {staff.name}
                    </span>
                    <Badge variant="cream" size="sm" className="mt-1 capitalize">
                      {staff.role}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Step 2: 4-digit PIN Keypad */
          <div className="max-w-sm w-full bg-brand-surface p-8 rounded-3xl border border-brand-border shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedUser(null)}
              className="text-body-sm text-brand-ink-500 hover:text-brand-ink-800 transition-colors flex items-center gap-1.5 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Switch Staff
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-heading font-bold text-lg mx-auto mb-3 shadow-inner">
                {selectedUser.name.slice(0, 2).toUpperCase()}
              </div>
              <h2 className="font-heading font-bold text-body text-brand-ink-900">
                {selectedUser.name}
              </h2>
              <span className="text-caption text-brand-ink-500 capitalize">
                {selectedUser.role} • Enter 4-Digit PIN
              </span>
            </div>

            {/* PIN Indicator Dots */}
            <div
              className={`flex items-center justify-center gap-4 mb-6 py-2 ${
                shake ? 'animate-shake' : ''
              }`}
            >
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = idx < pin.length;
                return (
                  <div
                    key={idx}
                    className={`w-5 h-5 rounded-full transition-all duration-150 ${
                      isFilled
                        ? 'bg-brand-primary scale-110 shadow-md ring-4 ring-brand-primary/20'
                        : 'bg-brand-ink-100 border border-brand-ink-300'
                    }`}
                  />
                );
              })}
            </div>

            {errorMessage && (
              <div className="mb-5 p-2.5 bg-red-50 border border-red-200 text-red-600 text-caption text-center rounded-xl font-medium">
                {errorMessage}
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  disabled={submitting || pin.length >= 4}
                  className="h-14 rounded-2xl bg-brand-surface-card border border-brand-border hover:bg-brand-primary/10 hover:border-brand-primary/40 active:scale-95 transition-all text-title font-semibold text-brand-ink-800 disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={submitting || pin.length === 0}
                className="h-14 rounded-2xl bg-brand-surface-card border border-brand-border hover:bg-red-50 text-caption font-medium text-brand-ink-500 active:scale-95 transition-all disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={submitting || pin.length >= 4}
                className="h-14 rounded-2xl bg-brand-surface-card border border-brand-border hover:bg-brand-primary/10 hover:border-brand-primary/40 active:scale-95 transition-all text-title font-semibold text-brand-ink-800 disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={submitting || pin.length === 0}
                className="h-14 rounded-2xl bg-brand-surface-card border border-brand-border hover:bg-brand-primary/10 text-brand-ink-600 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
