import React, { createContext, useContext, useState, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (options: { type?: ToastType; title: string; message?: string; duration?: number }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      type = 'info',
      title,
      message,
      duration = 4000,
    }: {
      type?: ToastType;
      title: string;
      message?: string;
      duration?: number;
    }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="true"
            className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
          >
            {toasts.map((item) => (
              <ToastItemView key={item.id} item={item} onDismiss={() => removeToast(item.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastItemView: React.FC<{ item: ToastItem; onDismiss: () => void }> = ({
  item,
  onDismiss,
}) => {
  const labelId = useId();

  const iconMap = {
    success: <CheckCircle2 className="h-5 w-5 text-semantic-success shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-semantic-danger shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-semantic-warning shrink-0" />,
    info: <Info className="h-5 w-5 text-semantic-info shrink-0" />,
  };

  const bgBorderMap = {
    success: 'bg-semantic-success-bg border-semantic-success/30 text-brand-ink-900',
    error: 'bg-semantic-danger-bg border-semantic-danger/30 text-brand-ink-900',
    warning: 'bg-semantic-warning-bg border-semantic-warning/30 text-brand-ink-900',
    info: 'bg-semantic-info-bg border-semantic-info/30 text-brand-ink-900',
  };

  return (
    <div
      role="status"
      aria-labelledby={labelId}
      className={cn(
        'pointer-events-auto flex items-start gap-3 p-4 rounded-card-sm border shadow-soft-lg transition-all duration-base text-left',
        bgBorderMap[item.type]
      )}
    >
      {iconMap[item.type]}

      <div className="flex-1 min-w-0">
        <h4 id={labelId} className="text-small font-semibold leading-tight">
          {item.title}
        </h4>
        {item.message && (
          <p className="mt-1 text-caption text-brand-ink-700 leading-normal">{item.message}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss toast"
        className="p-1 rounded text-brand-ink-400 hover:text-brand-ink-900 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
