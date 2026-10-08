import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChefHat,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sun,
  History,
  Ban,
  Radio,
  AlertTriangle,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { useRealtime } from '@/lib/realtimeContext';
import { soundAlerts } from '@/lib/soundAlerts';
import { useToast } from '@/components/ui/Toast';
import {
  KitchenTicketCard,
  KitchenKot,
  KitchenBoardApiResponse,
} from '@/components/kitchen/KitchenTicketCard';
import { OutOfStockModal } from '@/components/kitchen/OutOfStockModal';
import { RecallDrawer } from '@/components/kitchen/RecallDrawer';

export const KitchenPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { connectionStatus, isLive, refetchIntervalFallback } = useRealtime();

  // State
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [isMuted, setIsMuted] = useState<boolean>(soundAlerts.isMuted());
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(soundAlerts.isAudioUnlocked());
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const [wakeLockSupported, setWakeLockSupported] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'new' | 'preparing' | 'ready'>('new');
  const [isOutOfStockOpen, setIsOutOfStockOpen] = useState<boolean>(false);
  const [isRecallOpen, setIsRecallOpen] = useState<boolean>(false);

  // Undo tracking (kotId -> { at: number, from: string })
  const [lastActions, setLastActions] = useState<
    Record<string, { at: number; from: 'new' | 'preparing' | 'ready' }>
  >({});

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const canUpdate = hasPermission(user?.permissions, 'kitchen:update');

  // Clock tick every 1000ms for timers
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Screen Wake Lock API
  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      setWakeLockSupported(false);
      return;
    }

    const requestLock = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        setIsWakeLockActive(true);

        sentinel.addEventListener('release', () => {
          setIsWakeLockActive(false);
        });
      } catch {
        setIsWakeLockActive(false);
      }
    };

    void requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Fetch Kitchen Board
  const { data, refetch } = useQuery<KitchenBoardApiResponse>({
    queryKey: ['kitchen', 'board'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: KitchenBoardApiResponse }>(
        '/kitchen/board'
      );
      return res.data;
    },
    refetchInterval: refetchIntervalFallback,
  });

  // Clock skew calculation
  const clockOffsetMs = useMemo(() => {
    if (!data?.serverTime) return 0;
    const serverTimeMs = new Date(data.serverTime).getTime();
    return Date.now() - serverTimeMs;
  }, [data?.serverTime]);

  // Buckets
  const activeKots = useMemo(() => data?.activeKots || [], [data?.activeKots]);
  const recentlyServedKots = useMemo(() => data?.recentlyServedKots || [], [data?.recentlyServedKots]);

  const newKots = useMemo(
    () => activeKots.filter((k) => k.status === 'new'),
    [activeKots]
  );
  const preparingKots = useMemo(
    () => activeKots.filter((k) => k.status === 'preparing'),
    [activeKots]
  );
  const readyKots = useMemo(
    () => activeKots.filter((k) => k.status === 'ready'),
    [activeKots]
  );

  // Status Mutation
  const statusMutation = useMutation({
    mutationFn: async ({
      kotId,
      to,
      expectedFrom,
    }: {
      kotId: string;
      to: 'preparing' | 'ready';
      expectedFrom: 'new' | 'preparing' | 'ready';
    }) => {
      return apiClient.post<{ success: boolean; data: { kot: KitchenKot; idempotent: boolean } }>(
        `/kitchen/kots/${kotId}/status`,
        { to, expectedFrom }
      );
    },
    onSuccess: (_res, vars) => {
      // Record undo state
      setLastActions((prev) => ({
        ...prev,
        [vars.kotId]: { at: Date.now(), from: vars.expectedFrom },
      }));

      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Action Conflict',
        message: err instanceof Error ? err.message : 'KOT was already modified by another station.',
        type: 'error',
      });
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
    },
  });

  const handleStatusChange = (
    kotId: string,
    to: 'preparing' | 'ready',
    expectedFrom: 'new' | 'preparing' | 'ready'
  ) => {
    if (!canUpdate) return;
    statusMutation.mutate({ kotId, to, expectedFrom });
  };

  const toggleSound = async () => {
    if (!isAudioEnabled) {
      const unlocked = await soundAlerts.enableAudio();
      if (unlocked) {
        setIsAudioEnabled(true);
        soundAlerts.setMuted(false);
        setIsMuted(false);
        toast({
          title: 'Audio Enabled',
          message: 'Kitchen chimes and alerts unlocked.',
          type: 'success',
        });
      }
    } else {
      const nextMuted = !isMuted;
      soundAlerts.setMuted(nextMuted);
      setIsMuted(nextMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#03150e] text-stone-100 flex flex-col antialiased selection:bg-amber-500 selection:text-stone-900">
      {/* Top Header / KDS Control Bar */}
      <header className="px-5 py-3.5 bg-[#062419] border-b border-[#0f3c2a] flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>KITCHEN DISPLAY (KDS)</span>
              {!canUpdate && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-700">
                  Read Only
                </span>
              )}
            </h1>
            <p className="text-xs text-stone-400">Live order tickets & prep workflow</p>
          </div>
        </div>

        {/* Status Indicator & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              isLive
                ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-400'
                : connectionStatus === 'reconnecting'
                  ? 'bg-amber-950/60 border-amber-700/80 text-amber-400 animate-pulse'
                  : 'bg-red-950/60 border-red-700/80 text-red-400'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">
              {isLive ? 'LIVE' : connectionStatus === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
            </span>
          </div>

          {/* Screen Wake Lock Status */}
          <div
            className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${
              isWakeLockActive
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
            title={
              wakeLockSupported
                ? isWakeLockActive
                  ? 'Screen Keep-Awake is Active'
                  : 'Screen Keep-Awake is Inactive'
                : 'Wake Lock not supported on this browser'
            }
          >
            <Sun className="w-3.5 h-3.5" />
            <span>{isWakeLockActive ? 'Screen Awake' : 'Awake Off'}</span>
          </div>

          {/* Quick 86 / Out of Stock Control */}
          <button
            type="button"
            onClick={() => setIsOutOfStockOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Ban className="w-4 h-4" />
            <span className="hidden sm:inline">86 Out of Stock</span>
          </button>

          {/* Recall Recently Served */}
          <button
            type="button"
            onClick={() => setIsRecallOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Recall</span>
            {recentlyServedKots.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-stone-800 text-[10px]">
                {recentlyServedKots.length}
              </span>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              !isAudioEnabled
                ? 'bg-amber-500 text-stone-950 border-amber-400 font-black animate-bounce'
                : isMuted
                  ? 'bg-stone-900 text-stone-400 border-stone-800'
                  : 'bg-emerald-950/60 text-emerald-400 border-emerald-700/80'
            }`}
            title={
              !isAudioEnabled
                ? 'Tap to unlock browser audio chimes'
                : isMuted
                  ? 'Unmute sound'
                  : 'Mute sound'
            }
          >
            {!isAudioEnabled ? (
              <span className="text-xs px-1">Enable Sound</span>
            ) : isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Offline Stale-while-error Notice */}
      {!isLive && (
        <div className="bg-red-950/90 border-b border-red-800 px-4 py-2 flex items-center justify-between text-xs text-red-200 font-bold tracking-wide">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Connection offline. Orders may be delayed. Showing cached kitchen board.</span>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="underline hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Sync</span>
          </button>
        </div>
      )}

      {/* Mobile / Narrow Screen Tab Switcher */}
      <div className="lg:hidden px-4 pt-3 pb-1 border-b border-stone-900 flex gap-2 shrink-0 bg-[#041a11]">
        <button
          type="button"
          onClick={() => setSelectedTab('new')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            selectedTab === 'new'
              ? 'bg-amber-500 text-stone-950 shadow'
              : 'bg-stone-900/60 text-stone-400'
          }`}
        >
          <span>NEW</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-stone-950/30 font-mono">
            {newKots.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTab('preparing')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            selectedTab === 'preparing'
              ? 'bg-amber-500 text-stone-950 shadow'
              : 'bg-stone-900/60 text-stone-400'
          }`}
        >
          <span>PREPARING</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-stone-950/30 font-mono">
            {preparingKots.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTab('ready')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            selectedTab === 'ready'
              ? 'bg-emerald-500 text-stone-950 shadow'
              : 'bg-stone-900/60 text-stone-400'
          }`}
        >
          <span>READY</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-stone-950/30 font-mono">
            {readyKots.length}
          </span>
        </button>
      </div>

      {/* 3-Column Board (Landscape / Tablet / Wall TV) */}
      <main className="flex-1 p-4 overflow-x-auto overflow-y-hidden flex gap-4">
        {/* Column 1: NEW TICKETS */}
        <div
          className={`flex-1 flex flex-col min-w-[340px] max-w-[500px] rounded-2xl bg-[#051c14] border border-[#0d3626] overflow-hidden ${
            selectedTab !== 'new' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="px-4 py-3 bg-[#08291d] border-b border-[#0f3c2a] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-base font-black uppercase tracking-wider text-white">NEW ORDERS</h2>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-amber-400 font-mono font-black text-sm">
              {newKots.length}
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {newKots.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-stone-500 text-sm">
                <UtensilsCrossed className="w-10 h-10 text-stone-700 mb-2" />
                <p>No new orders waiting</p>
              </div>
            ) : (
              newKots.map((kot) => (
                <KitchenTicketCard
                  key={kot.kotId}
                  kot={kot}
                  clockOffsetMs={clockOffsetMs}
                  nowMs={nowMs}
                  canUpdate={canUpdate}
                  onStatusChange={handleStatusChange}
                  isPending={statusMutation.isPending}
                  lastActionAt={lastActions[kot.kotId]?.at}
                  lastActionFrom={lastActions[kot.kotId]?.from}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 2: PREPARING */}
        <div
          className={`flex-1 flex flex-col min-w-[340px] max-w-[500px] rounded-2xl bg-[#051c14] border border-[#0d3626] overflow-hidden ${
            selectedTab !== 'preparing' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="px-4 py-3 bg-[#08291d] border-b border-[#0f3c2a] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <h2 className="text-base font-black uppercase tracking-wider text-white">PREPARING</h2>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-amber-400 font-mono font-black text-sm">
              {preparingKots.length}
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {preparingKots.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-stone-500 text-sm">
                <ChefHat className="w-10 h-10 text-stone-700 mb-2" />
                <p>No tickets currently being prepared</p>
              </div>
            ) : (
              preparingKots.map((kot) => (
                <KitchenTicketCard
                  key={kot.kotId}
                  kot={kot}
                  clockOffsetMs={clockOffsetMs}
                  nowMs={nowMs}
                  canUpdate={canUpdate}
                  onStatusChange={handleStatusChange}
                  isPending={statusMutation.isPending}
                  lastActionAt={lastActions[kot.kotId]?.at}
                  lastActionFrom={lastActions[kot.kotId]?.from}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 3: READY TO SERVE */}
        <div
          className={`flex-1 flex flex-col min-w-[340px] max-w-[500px] rounded-2xl bg-[#051c14] border border-[#0d3626] overflow-hidden ${
            selectedTab !== 'ready' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="px-4 py-3 bg-[#08291d] border-b border-[#0f3c2a] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-base font-black uppercase tracking-wider text-white">READY FOR FLOOR</h2>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-emerald-400 font-mono font-black text-sm">
              {readyKots.length}
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {readyKots.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-stone-500 text-sm">
                <UtensilsCrossed className="w-10 h-10 text-stone-700 mb-2" />
                <p>No tickets waiting to be served</p>
              </div>
            ) : (
              readyKots.map((kot) => (
                <KitchenTicketCard
                  key={kot.kotId}
                  kot={kot}
                  clockOffsetMs={clockOffsetMs}
                  nowMs={nowMs}
                  canUpdate={canUpdate}
                  onStatusChange={handleStatusChange}
                  isPending={statusMutation.isPending}
                  lastActionAt={lastActions[kot.kotId]?.at}
                  lastActionFrom={lastActions[kot.kotId]?.from}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Out of Stock Quick Panel Modal */}
      <OutOfStockModal
        isOpen={isOutOfStockOpen}
        onClose={() => setIsOutOfStockOpen(false)}
      />

      {/* Recently Served Recall Drawer */}
      <RecallDrawer
        isOpen={isRecallOpen}
        onClose={() => setIsRecallOpen(false)}
        recentlyServedKots={recentlyServedKots}
        clockOffsetMs={clockOffsetMs}
        nowMs={nowMs}
      />
    </div>
  );
};
