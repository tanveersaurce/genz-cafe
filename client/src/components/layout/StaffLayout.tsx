import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ChefHat,
  Receipt,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ExternalLink,
  Bell,
  Coffee,
  BookOpen,
  CalendarCheck,
  LayoutGrid,
  Coins,
  Lock,
  History,
  Smartphone,
  ShieldCheck,
  WalletCards,
  TrendingUp,
  Briefcase,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/authContext';
import { Permission, hasPermission } from '@/lib/permissions';
import { useRealtime } from '@/lib/realtimeContext';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { IdleLockOverlay } from '@/components/auth/IdleLockOverlay';

export interface StaffNavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: Permission;
  badge?: string;
}

// Config-driven navigation filtered dynamically by user permissions
export const staffNavigationConfig: StaffNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/app/dashboard',
    icon: LayoutDashboard,
    // Available to all logged-in staff
  },
  {
    id: 'reservations',
    label: 'Reservations',
    path: '/app/reservations',
    icon: CalendarCheck,
    requiredPermission: 'reservations:read',
  },
  {
    id: 'tables',
    label: 'Tables & QR',
    path: '/app/tables',
    icon: LayoutGrid,
    requiredPermission: 'tables:read',
  },
  {
    id: 'menu',
    label: 'Menu Management',
    path: '/app/menu',
    icon: BookOpen,
    requiredPermission: 'menu:read',
  },
  {
    id: 'users',
    label: 'Staff Management',
    path: '/app/users',
    icon: Users,
    requiredPermission: 'users:manage', // Partner only
  },
  {
    id: 'pos',
    label: 'POS & Billing',
    path: '/app/pos',
    icon: Receipt,
    requiredPermission: 'pos:access',
  },
  {
    id: 'kitchen',
    label: 'Kitchen Display (KDS)',
    path: '/app/kitchen',
    icon: ChefHat,
    requiredPermission: 'kitchen:view',
  },
  {
    id: 'orders',
    label: 'Floor Orders',
    path: '/app/orders',
    icon: UtensilsCrossed,
    requiredPermission: 'orders:read',
  },
  {
    id: 'cash',
    label: 'Cash Drawer',
    path: '/app/cash',
    icon: Coins,
    requiredPermission: 'cash:record',
  },
  {
    id: 'closing',
    label: 'Day Closing',
    path: '/app/closing',
    icon: Lock,
    requiredPermission: 'closing:perform',
  },
  {
    id: 'closing-history',
    label: 'Closing Logs',
    path: '/app/closing/history',
    icon: History,
    requiredPermission: 'closing:view',
  },
  {
    id: 'devices',
    label: 'Terminals / POS',
    path: '/app/devices',
    icon: Smartphone,
    requiredPermission: 'devices:manage',
  },
  {
    id: 'audit',
    label: 'Audit Trail',
    path: '/app/audit',
    icon: ShieldCheck,
    requiredPermission: 'audit:view',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    path: '/app/expenses',
    icon: WalletCards,
    requiredPermission: 'expenses:read',
  },
  {
    id: 'pnl',
    label: 'Profit & Loss',
    path: '/app/finance/pnl',
    icon: TrendingUp,
    requiredPermission: 'finance:view',
  },
  {
    id: 'partners',
    label: 'Partners & Capital',
    path: '/app/finance/partners',
    icon: Briefcase,
    requiredPermission: 'partners:manage',
  },
  {
    id: 'statements',
    label: 'Partner Statements',
    path: '/app/finance/statements',
    icon: FileText,
    requiredPermission: 'finance:view',
  },
];

export const StaffLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connectionState, refetchIntervalFallback } = useRealtime();

  const handleLogout = async () => {
    await logout();
    navigate('/app/login', { replace: true });
  };

  // Redirect kitchen role directly to /app/kitchen
  useEffect(() => {
    if (user?.role === 'kitchen' && (location.pathname === '/app' || location.pathname === '/app/dashboard')) {
      navigate('/app/kitchen', { replace: true });
    }
  }, [user?.role, location.pathname, navigate]);

  const isKitchen = user?.role === 'kitchen';

  const permittedNavItems = staffNavigationConfig.filter((item) => {
    if (isKitchen) {
      return item.id === 'kitchen';
    }
    if (!item.requiredPermission) return true;
    return hasPermission(user?.permissions, item.requiredPermission);
  });

  const canReadReservations = hasPermission(user?.permissions, 'reservations:read');
  const { data: summaryData } = useQuery<{ success: boolean; data: { summary: { pendingCount: number } } }>({
    queryKey: ['reservations-summary-badge'],
    queryFn: async () => apiClient.get('/reservations/summary'),
    enabled: canReadReservations,
    refetchInterval: refetchIntervalFallback,
  });

  const pendingCount = summaryData?.data?.summary?.pendingCount || 0;

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'GZ';

  return (
    <div className="min-h-screen flex bg-brand-cream-50 text-brand-ink-900 font-sans">
      {/* 3-Minute Idle Lock Screen (Preserves drafts in memory, exempt on kitchen station) */}
      <IdleLockOverlay />

      {/* Sidebar */}
      <aside
        aria-label="Staff Navigation Sidebar"
        className={cn(
          'bg-brand-green-950 text-brand-cream-100 border-r border-brand-green-800 flex flex-col transition-all duration-base z-30 shrink-0 sticky top-0 h-screen',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-brand-green-800">
          {!collapsed ? (
            <Link to="/app/dashboard" className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Gen-Z Cafe"
                className="h-9 w-9 rounded-full border border-brand-gold-500 object-cover"
              />
              <div className="flex flex-col text-left">
                <span className="font-semibold text-small tracking-wider text-brand-cream-100">
                  GEN-Z CAFE
                </span>
                <span className="text-[11px] text-brand-gold-500 tracking-wide">
                  Staff Workspace
                </span>
              </div>
            </Link>
          ) : (
            <div className="mx-auto">
              <Coffee className="h-6 w-6 text-brand-gold-500" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded text-brand-cream-100/70 hover:text-brand-gold-500 hover:bg-brand-green-800 transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Items (Filtered by permission) */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {permittedNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.id}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-card-sm text-small font-medium transition-colors group',
                  isActive
                    ? 'bg-brand-green-800 text-brand-gold-500 font-semibold shadow-soft'
                    : 'text-brand-cream-100/80 hover:bg-brand-green-900 hover:text-brand-cream-100'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0 transition-colors',
                    isActive ? 'text-brand-gold-500' : 'text-brand-cream-100/60 group-hover:text-brand-cream-100'
                  )}
                />
                {!collapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {!collapsed && (
                  <>
                    {item.id === 'reservations' && pendingCount > 0 ? (
                      <Badge variant="warning" size="sm" className="text-[10px] py-0 px-1.5 font-bold animate-pulse">
                        {pendingCount}
                      </Badge>
                    ) : (
                      item.badge && (
                        <Badge variant="green" size="sm" className="text-[10px] py-0 px-1.5">
                          {item.badge}
                        </Badge>
                      )
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-brand-green-800 space-y-1.5">
          <Link
            to="/"
            title="Public Website"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-card-sm text-small text-brand-cream-100/70 hover:bg-brand-green-900 hover:text-brand-cream-100 transition-colors'
            )}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="text-left text-caption">Public Site</span>}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-card-sm text-small text-semantic-danger/90 hover:bg-brand-green-900 hover:text-semantic-danger transition-colors'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="text-left text-caption font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-brand-cream-300 px-6 flex items-center justify-between shadow-soft">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-body text-brand-green-950">
              {isKitchen ? 'Kitchen Station' : 'Staff Portal'}
            </h1>
            <span className="text-caption text-brand-ink-400">|</span>
            <span className="text-caption text-brand-ink-500 hidden sm:inline">
              Role: <strong className="text-brand-green-900 uppercase">{user?.role || 'Staff'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Real-time Connection Indicator */}
            <div className="flex items-center">
              {connectionState === 'connected' && (
                <span
                  title="Real-time WebSocket connected"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
              {connectionState === 'reconnecting' && (
                <span
                  title="Reconnecting to real-time server..."
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Reconnecting...
                </span>
              )}
              {connectionState === 'disconnected' && (
                <span
                  title="Offline: Polling fallback active"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Offline
                </span>
              )}
            </div>

            {!isKitchen && (
              <Link to="/design-system">
                <Button variant="outline" size="sm">
                  Dev Design System
                </Button>
              </Link>
            )}

            {!isKitchen && (
              <button
                type="button"
                aria-label="Notifications"
                className="p-2 rounded-full text-brand-ink-700 hover:bg-brand-cream-100 hover:text-brand-green-900 transition-colors relative"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-gold-500" />
              </button>
            )}

            <div className="flex items-center gap-2 pl-2 border-l border-brand-cream-300">
              <Link
                to="/app/profile"
                title="Manage Profile & PINs"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full bg-brand-green-800 text-brand-cream-100 font-semibold text-caption flex items-center justify-center">
                  {userInitials}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-caption font-semibold text-brand-ink-900 leading-tight">
                    {user?.name || 'Staff User'}
                  </span>
                  <span className="text-[10px] text-brand-ink-500 uppercase font-mono">
                    {user?.role}
                  </span>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-semantic-danger hover:bg-semantic-danger-bg ml-1 px-2 py-1 h-8"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Outlet */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
