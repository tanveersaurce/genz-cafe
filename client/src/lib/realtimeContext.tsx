import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './authContext';
import { getAccessToken, performTokenRefresh } from './apiClient';
import {
  REALTIME_EVENTS,
  KotCreatedPayload,
  KotStatusChangedPayload,
  KotItemCancelledPayload,
  OrderUpdatedPayload,
  SessionRevokedPayload,
} from './realtimeEvents';
import { soundAlerts } from './soundAlerts';

export type RealtimeConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface RealtimeContextType {
  connectionStatus: RealtimeConnectionStatus;
  connectionState: RealtimeConnectionStatus;
  isLive: boolean;
  refetchIntervalFallback: number;
}

const RealtimeContext = createContext<RealtimeContextType>({
  connectionStatus: 'disconnected',
  connectionState: 'disconnected',
  isLive: false,
  refetchIntervalFallback: 10000,
});

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const isRefreshingTokenRef = useRef<boolean>(false);

  useEffect(() => {
    // Only connect when user is logged in and active
    if (!user || !user.isActive) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnectionStatus('disconnected');
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    // Connect to Socket.io via same origin (proxied in Vite dev, direct in prod)
    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    // Connection Events
    socket.on('connect', () => {
      setConnectionStatus('connected');
      // On every (re)connect, invalidate key queries to sync any state missed while offline
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'ready'] });
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['reservations', 'summary'] });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', async (err) => {
      const isAuthError =
        err.message.includes('Authentication error') ||
        err.message.includes('jwt') ||
        err.message.includes('token') ||
        err.message.includes('expired');

      if (isAuthError && !isRefreshingTokenRef.current) {
        isRefreshingTokenRef.current = true;
        setConnectionStatus('reconnecting');

        try {
          // Perform silent token refresh
          const newToken = await performTokenRefresh();
          if (newToken && socketRef.current) {
            socketRef.current.auth = { token: newToken };
            socketRef.current.connect();
          } else {
            void logout();
          }
        } catch {
          void logout();
        } finally {
          isRefreshingTokenRef.current = false;
        }
      } else {
        setConnectionStatus('reconnecting');
      }
    });

    // Domain Event Listeners -> Targeted TanStack Query Invalidations

    socket.on(REALTIME_EVENTS.ORDER_UPDATED, (payload: OrderUpdatedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'ready'] });
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (payload?.orderId) {
        void queryClient.invalidateQueries({ queryKey: ['order', payload.orderId] });
      }
    });

    socket.on(REALTIME_EVENTS.KOT_CREATED, (payload: KotCreatedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
      if (payload?.orderId) {
        void queryClient.invalidateQueries({ queryKey: ['order', payload.orderId] });
      }

      // Audible alert for kitchen
      if (user.permissions.includes('kitchen:view')) {
        soundAlerts.playNewTicketSound();
      }
    });

    socket.on(REALTIME_EVENTS.ORDER_CUSTOMER_SUBMITTED, () => {
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      void queryClient.invalidateQueries({ queryKey: ['pending-customer-orders'] });

      // Distinct alert sound & vibration for all staff with orders:read or kitchen:view
      if (user.permissions.includes('orders:read') || user.permissions.includes('kitchen:view')) {
        soundAlerts.playCustomerOrderSound();
      }
    });

    socket.on(REALTIME_EVENTS.KOT_STATUS_CHANGED, (payload: KotStatusChangedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'ready'] });
      if (payload?.orderId) {
        void queryClient.invalidateQueries({ queryKey: ['order', payload.orderId] });
      }

      // If food just became ready, alert floor / waitstaff
      if (payload?.status === 'ready' && (user.permissions.includes('orders:serve') || user.permissions.includes('orders:read'))) {
        soundAlerts.playReadyToServeSound();
      }
    });

    socket.on(REALTIME_EVENTS.KOT_ITEM_CANCELLED, (payload: KotItemCancelledPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
      if (payload?.orderId) {
        void queryClient.invalidateQueries({ queryKey: ['order', payload.orderId] });
      }

      // Loud alert for kitchen
      if (user.permissions.includes('kitchen:view')) {
        soundAlerts.playCancelledItemSound();
      }
    });

    socket.on(REALTIME_EVENTS.TABLE_STATE_CHANGED, () => {
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'ready'] });
    });

    socket.on(REALTIME_EVENTS.RESERVATION_CHANGED, () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['reservations', 'summary'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
    });

    socket.on(REALTIME_EVENTS.MENU_AVAILABILITY_CHANGED, () => {
      void queryClient.invalidateQueries({ queryKey: ['menu'] });
      void queryClient.invalidateQueries({ queryKey: ['public-menu'] });
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
    });

    socket.on(REALTIME_EVENTS.SESSION_REVOKED, (_payload: SessionRevokedPayload) => {
      // Disconnect immediately and perform cleanup
      socket.disconnect();
      void logout();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, queryClient, logout]);

  // Window Focus / Tab Visibility Sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        void queryClient.invalidateQueries();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, queryClient]);

  const isLive = connectionStatus === 'connected';
  // When live, fallback polling relaxes to 60s safety refresh; when offline/reconnecting, fast 10s polling resumes
  const refetchIntervalFallback = isLive ? 60000 : 10000;

  return (
    <RealtimeContext.Provider
      value={{
        connectionStatus,
        connectionState: connectionStatus,
        isLive,
        refetchIntervalFallback,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = (): RealtimeContextType => {
  return useContext(RealtimeContext);
};
