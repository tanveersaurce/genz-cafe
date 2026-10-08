import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, Delete, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/authContext';

const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export const IdleLockOverlay: React.FC = () => {
  const { user, isAuthenticated, loginWithPin, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [usePasswordFallback, setUsePasswordFallback] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  const lastActivityRef = useRef<number>(Date.now());

  // Check if current page is exempt from auto-lock (Kitchen display screen)
  const isExempt = location.pathname.startsWith('/app/kitchen');

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isExempt) {
      setIsLocked(false);
      return;
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer();

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    const intervalId = window.setInterval(() => {
      if (!isLocked && !isExempt && isAuthenticated) {
        if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
          setIsLocked(true);
          setPin('');
          setPassword('');
          setErrorMessage(null);
        }
      }
    }, 5000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
    };
  }, [isAuthenticated, isExempt, isLocked, resetTimer]);

  if (!isLocked || !user) return null;

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMessage(null);
      if (nextPin.length === 4) {
        handleUnlock(nextPin);
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

  const handleUnlock = async (pinToSubmit?: string) => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (usePasswordFallback || !loginWithPin) {
        await login(user.username, password);
      } else {
        await loginWithPin(user.id, pinToSubmit || pin);
      }
      setIsLocked(false);
      resetTimer();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      setPassword('');
      setErrorMessage(e?.message || 'Invalid PIN or credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchUser = async () => {
    await logout();
    setIsLocked(false);
    navigate('/app/pin');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-brand-surface/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="max-w-sm w-full bg-brand-surface p-8 rounded-3xl border border-brand-border shadow-2xl flex flex-col items-center text-center">
        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary mb-4 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="font-heading font-bold text-title text-brand-ink-900 mb-1">
          Terminal Locked
        </h2>
        <p className="text-body-sm text-brand-ink-500 mb-6">
          Inactive for 3 minutes. Enter your PIN to continue.
        </p>

        {/* User Card */}
        <div className="flex items-center gap-3 p-3 bg-brand-surface-card rounded-2xl border border-brand-border w-full mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-primary text-brand-ink-900 font-bold flex items-center justify-center text-body-sm shadow-sm">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-left overflow-hidden">
            <h4 className="font-semibold text-body-sm text-brand-ink-900 truncate">{user.name}</h4>
            <span className="text-caption text-brand-ink-500 capitalize">{user.role}</span>
          </div>
        </div>

        {/* PIN Entry or Password Fallback */}
        {!usePasswordFallback ? (
          <div className="w-full">
            {/* PIN Dots */}
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
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-600 text-caption rounded-xl font-medium">
                {errorMessage}
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5 mb-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  disabled={submitting || pin.length >= 4}
                  className="h-12 rounded-xl bg-brand-surface-card border border-brand-border hover:bg-brand-primary/10 active:scale-95 transition-all text-body font-semibold text-brand-ink-800 disabled:opacity-50"
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
                disabled={submitting || pin.length >= 4}
                className="h-12 rounded-xl bg-brand-surface-card border border-brand-border hover:bg-brand-primary/10 active:scale-95 transition-all text-body font-semibold text-brand-ink-800 disabled:opacity-50"
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

            <button
              type="button"
              onClick={() => {
                setUsePasswordFallback(true);
                setErrorMessage(null);
              }}
              className="text-caption text-brand-primary hover:underline font-medium block mb-4"
            >
              Forgot PIN? Unlock with password
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUnlock();
            }}
            className="w-full space-y-4 mb-6"
          >
            <input
              type="password"
              placeholder="Enter your account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-surface-card text-body text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              autoFocus
            />

            {errorMessage && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-caption rounded-xl font-medium">
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={submitting}
              disabled={!password || submitting}
            >
              Unlock Terminal
            </Button>

            <button
              type="button"
              onClick={() => {
                setUsePasswordFallback(false);
                setErrorMessage(null);
              }}
              className="text-caption text-brand-ink-500 hover:underline block mx-auto"
            >
              Back to PIN unlock
            </button>
          </form>
        )}

        {/* Switch user / Logout */}
        <Button variant="ghost" size="sm" onClick={handleSwitchUser} className="text-brand-ink-500">
          <LogOut className="w-4 h-4 mr-1.5" />
          Switch User / Sign Out
        </Button>
      </div>
    </div>
  );
};
