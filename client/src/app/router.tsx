import React, { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { StaffLayout } from '@/components/layout/StaffLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Spinner } from '@/components/ui/Spinner';

// Suspense Fallback Loader
const PageLoader: React.FC = () => (
  <div className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-3">
    <Spinner size="lg" variant="gold" label="Loading page..." />
    <span className="text-caption text-brand-ink-400 font-medium">Loading Gen-Z Cafe...</span>
  </div>
);

// Lazy Loaded Public Pages
const HomePage = React.lazy(() =>
  import('@/pages/public/HomePage').then((m) => ({ default: m.HomePage }))
);
const MenuPage = React.lazy(() =>
  import('@/pages/public/MenuPage').then((m) => ({ default: m.MenuPage }))
);
const GalleryPage = React.lazy(() =>
  import('@/pages/public/GalleryPage').then((m) => ({ default: m.GalleryPage }))
);
const ReservationPage = React.lazy(() =>
  import('@/pages/public/ReservationPage').then((m) => ({ default: m.ReservationPage }))
);
const ContactPage = React.lazy(() =>
  import('@/pages/public/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const NotFoundPage = React.lazy(() =>
  import('@/pages/public/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);
const OrderStatusPage = React.lazy(() =>
  import('@/pages/public/OrderStatusPage').then((m) => ({ default: m.OrderStatusPage }))
);

// Lazy Loaded Staff Pages (Separates staff bundle from public bundle)
const StaffLoginPage = React.lazy(() =>
  import('@/pages/staff/StaffLoginPage').then((m) => ({ default: m.StaffLoginPage }))
);
const StaffDashboardPage = React.lazy(() =>
  import('@/pages/staff/StaffDashboardPage').then((m) => ({ default: m.StaffDashboardPage }))
);
const UsersManagementPage = React.lazy(() =>
  import('@/pages/staff/UsersManagementPage').then((m) => ({ default: m.UsersManagementPage }))
);
const ReservationsPage = React.lazy(() =>
  import('@/pages/staff/ReservationsPage').then((m) => ({ default: m.ReservationsPage }))
);
const TablesPage = React.lazy(() =>
  import('@/pages/staff/TablesPage').then((m) => ({ default: m.TablesPage }))
);
const MenuManagementPage = React.lazy(() =>
  import('@/pages/staff/MenuManagementPage').then((m) => ({ default: m.MenuManagementPage }))
);
const PosPage = React.lazy(() =>
  import('@/pages/staff/PosPage').then((m) => ({ default: m.PosPage }))
);
const OrdersPage = React.lazy(() =>
  import('@/pages/staff/OrdersPage').then((m) => ({ default: m.OrdersPage }))
);
const KitchenPage = React.lazy(() =>
  import('@/pages/staff/KitchenPage').then((m) => ({ default: m.KitchenPage }))
);
const PinLoginPage = React.lazy(() =>
  import('@/pages/staff/PinLoginPage').then((m) => ({ default: m.PinLoginPage }))
);
const DevicesPage = React.lazy(() =>
  import('@/pages/staff/DevicesPage').then((m) => ({ default: m.DevicesPage }))
);
const ProfilePage = React.lazy(() =>
  import('@/pages/staff/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const CashMovementsPage = React.lazy(() =>
  import('@/pages/staff/CashMovementsPage').then((m) => ({ default: m.CashMovementsPage }))
);
const ClosingPage = React.lazy(() =>
  import('@/pages/staff/ClosingPage').then((m) => ({ default: m.ClosingPage }))
);
const ClosingHistoryPage = React.lazy(() =>
  import('@/pages/staff/ClosingHistoryPage').then((m) => ({ default: m.ClosingHistoryPage }))
);
const AuditPage = React.lazy(() =>
  import('@/pages/staff/AuditPage').then((m) => ({ default: m.AuditPage }))
);
const ExpensesPage = React.lazy(() =>
  import('@/pages/staff/ExpensesPage').then((m) => ({ default: m.ExpensesPage }))
);
const PnlPage = React.lazy(() =>
  import('@/pages/staff/PnlPage').then((m) => ({ default: m.PnlPage }))
);
const PartnersPage = React.lazy(() =>
  import('@/pages/staff/PartnersPage').then((m) => ({ default: m.PartnersPage }))
);
const PartnerLedgerPage = React.lazy(() =>
  import('@/pages/staff/PartnerLedgerPage').then((m) => ({ default: m.PartnerLedgerPage }))
);
const StatementsPage = React.lazy(() =>
  import('@/pages/staff/StatementsPage').then((m) => ({ default: m.StatementsPage }))
);

// Dev Showcase
const DesignSystemPage = React.lazy(() =>
  import('@/pages/dev/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage }))
);

export const router = createBrowserRouter([
  // 1. Public Route Group
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'menu',
        element: (
          <Suspense fallback={<PageLoader />}>
            <MenuPage />
          </Suspense>
        ),
      },
      {
        path: 'gallery',
        element: (
          <Suspense fallback={<PageLoader />}>
            <GalleryPage />
          </Suspense>
        ),
      },
      {
        path: 'reservation',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ReservationPage />
          </Suspense>
        ),
      },
      {
        path: 'contact',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ContactPage />
          </Suspense>
        ),
      },
      {
        path: 'order/status/:token',
        element: (
          <Suspense fallback={<PageLoader />}>
            <OrderStatusPage />
          </Suspense>
        ),
      },
      {
        path: 'design-system',
        element: (
          <Suspense fallback={<PageLoader />}>
            <DesignSystemPage />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: (
          <Suspense fallback={<PageLoader />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
    ],
  },

  // 2. Staff Authentication (Standalone layout)
  {
    path: '/app/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <StaffLoginPage />
      </Suspense>
    ),
  },
  {
    path: '/app/pin',
    element: (
      <Suspense fallback={<PageLoader />}>
        <PinLoginPage />
      </Suspense>
    ),
  },

  // 3. Staff Route Group (Protected by ProtectedRoute + Shell with StaffLayout)
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <StaffLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <StaffDashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<PageLoader />}>
            <StaffDashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'reservations',
        element: (
          <PermissionGuard permission="reservations:read">
            <Suspense fallback={<PageLoader />}>
              <ReservationsPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'tables',
        element: (
          <PermissionGuard permission="tables:read">
            <Suspense fallback={<PageLoader />}>
              <TablesPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'menu',
        element: (
          <PermissionGuard permission="menu:read">
            <Suspense fallback={<PageLoader />}>
              <MenuManagementPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'users',
        element: (
          <PermissionGuard permission="users:manage">
            <Suspense fallback={<PageLoader />}>
              <UsersManagementPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'pos',
        element: (
          <PermissionGuard permission="pos:access">
            <Suspense fallback={<PageLoader />}>
              <PosPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'orders',
        element: (
          <PermissionGuard permission="orders:read">
            <Suspense fallback={<PageLoader />}>
              <OrdersPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'kitchen',
        element: (
          <PermissionGuard permission="kitchen:view">
            <Suspense fallback={<PageLoader />}>
              <KitchenPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'cash',
        element: (
          <PermissionGuard permission="cash:record">
            <Suspense fallback={<PageLoader />}>
              <CashMovementsPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'closing',
        element: (
          <PermissionGuard permission="closing:perform">
            <Suspense fallback={<PageLoader />}>
              <ClosingPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'closing/history',
        element: (
          <PermissionGuard permission="closing:view">
            <Suspense fallback={<PageLoader />}>
              <ClosingHistoryPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'devices',
        element: (
          <PermissionGuard permission="devices:manage">
            <Suspense fallback={<PageLoader />}>
              <DevicesPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'audit',
        element: (
          <PermissionGuard permission="audit:view">
            <Suspense fallback={<PageLoader />}>
              <AuditPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'profile',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProfilePage />
          </Suspense>
        ),
      },
      {
        path: 'expenses',
        element: (
          <PermissionGuard permission="expenses:read">
            <Suspense fallback={<PageLoader />}>
              <ExpensesPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'finance/pnl',
        element: (
          <PermissionGuard permission="finance:view">
            <Suspense fallback={<PageLoader />}>
              <PnlPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'finance/partners',
        element: (
          <PermissionGuard permission="partners:manage">
            <Suspense fallback={<PageLoader />}>
              <PartnersPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'finance/ledger/:partnerId',
        element: (
          <PermissionGuard permission="partners:manage">
            <Suspense fallback={<PageLoader />}>
              <PartnerLedgerPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: 'finance/statements',
        element: (
          <PermissionGuard permission="finance:view">
            <Suspense fallback={<PageLoader />}>
              <StatementsPage />
            </Suspense>
          </PermissionGuard>
        ),
      },
      {
        path: '*',
        element: (
          <Suspense fallback={<PageLoader />}>
            <StaffDashboardPage />
          </Suspense>
        ),
      },
    ],
  },
]);
