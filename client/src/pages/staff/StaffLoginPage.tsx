import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/lib/authContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Role } from '@/lib/permissions';

export const StaffLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState('partner_admin');
  const [password, setPassword] = useState('Partner@1234');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getRoleLandingRoute = (role: Role): string => {
    switch (role) {
      case 'partner':
      case 'manager':
        return '/app/dashboard';
      case 'marketing':
        return '/app/menu';
      case 'cashier':
      case 'waiter':
        return '/app/pos';
      case 'kitchen':
        return '/app/kitchen';
      default:
        return '/app/dashboard';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const loggedInUser = await login(username, password);

      // Check if user was navigating to a specific route before auth redirect
      const state = location.state as { from?: { pathname?: string } } | undefined;
      const targetRoute = state?.from?.pathname || getRoleLandingRoute(loggedInUser.role);

      navigate(targetRoute, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-green-950 flex flex-col justify-center items-center p-4 selection:bg-brand-gold-500 selection:text-brand-ink-900 font-sans">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-caption text-brand-cream-100/70 hover:text-brand-gold-500 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Public Website</span>
          </Link>
          <img
            src="/logo.png"
            alt="Gen-Z Cafe Logo"
            className="h-16 w-16 rounded-full mx-auto mb-3 border-2 border-brand-gold-500 shadow-soft object-cover"
          />
          <h1 className="text-h2 font-semibold text-brand-cream-100 tracking-wide font-sans">
            Staff Portal Login
          </h1>
          <p className="text-small text-brand-cream-100/60 mt-1 font-sans">
            Internal Management & Point of Sale
          </p>
        </div>

        <Card variant="cream" className="shadow-dark-card border-brand-cream-300">
          <CardHeader>
            <CardTitle className="font-sans text-h3 font-semibold text-brand-green-950">
              Staff Credentials
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div
                role="alert"
                className="mb-4 p-3.5 rounded-card-sm bg-semantic-danger-bg border border-semantic-danger/30 text-small text-semantic-danger font-medium"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. partner_admin, cashier1"
                required
                autoComplete="username"
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="p-1 text-brand-ink-500 hover:text-brand-ink-900 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="pos"
                  fullWidth
                  isLoading={loading}
                  leftIcon={<Lock className="h-4 w-4" />}
                >
                  Sign In to Staff Workspace
                </Button>
              </div>

              <div className="pt-2 text-center">
                <div className="p-3 rounded-card-sm bg-brand-cream-200/60 border border-brand-cream-300/80 text-[11px] text-brand-ink-700 space-y-1">
                  <p className="font-semibold flex items-center justify-center gap-1.5 text-brand-green-900">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Role-Based Access Control
                  </p>
                  <p>Accounts and sessions are monitored with append-only security logs.</p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
