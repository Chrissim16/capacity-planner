import { useState, createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;   // ms; defaults to 4000
  action?: ToastAction;
}

interface ToastOptions {
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (message: string, typeOrOptions?: ToastType | ToastOptions) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((
    message: string,
    typeOrOptions: ToastType | ToastOptions = 'info'
  ): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let type: ToastType = 'info';
    let duration = 4000;
    let action: ToastAction | undefined;

    if (typeof typeOrOptions === 'string') {
      type = typeOrOptions;
    } else {
      type     = typeOrOptions.type     ?? 'info';
      duration = typeOrOptions.duration ?? 4000;
      action   = typeOrOptions.action;
    }

    setToasts(prev => [...prev, { id, message, type, duration, action }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);

    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 200);
  };

  const handleAction = () => {
    toast.action?.onClick();
    handleClose();
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />,
    error:   <XCircle     className="w-5 h-5 text-red-500 shrink-0"   />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info:    <Info        className="w-5 h-5 text-blue-500 shrink-0"  />,
  };

  const backgrounds = {
    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    error:   'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    info:    'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border pointer-events-auto max-w-sm',
        'transform transition-all duration-200',
        backgrounds[toast.type],
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slide-in'
      )}
    >
      {icons[toast.type]}
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">
        {toast.message}
      </p>
      {toast.action && (
        <button
          onClick={handleAction}
          className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={handleClose}
        className="ml-1 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}
