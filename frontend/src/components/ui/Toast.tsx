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
  duration?: number;
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
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
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
    success: <CheckCircle  className="w-4 h-4 text-[#22C55E] shrink-0" />,
    error:   <XCircle      className="w-4 h-4 text-[#EF4444] shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-[#F97316] shrink-0" />,
    info:    <Info          className="w-4 h-4 text-[#0ED3CF] shrink-0" />,
  };

  const backgrounds = {
    success: 'bg-white border-[#A7F3D0]',
    error:   'bg-white border-[#FECACA]',
    warning: 'bg-white border-[#FED7AA]',
    info:    'bg-white border-[#99F6E4]',
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-card shadow-md border pointer-events-auto max-w-sm',
        'transition-all duration-200',
        backgrounds[toast.type],
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slide-in'
      )}
    >
      {icons[toast.type]}
      <p className="text-sm font-medium text-[#1A1A1A] flex-1">
        {toast.message}
      </p>
      {toast.action && (
        <button
          onClick={handleAction}
          className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#F5F3F0] border border-[#E5E5E3] text-[#1A1A1A] hover:bg-[#E5E5E3] transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={handleClose}
        className="ml-1 p-1 rounded-lg hover:bg-[#F5F3F0] transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5 text-[#9CA3AF]" />
      </button>
    </div>
  );
}
