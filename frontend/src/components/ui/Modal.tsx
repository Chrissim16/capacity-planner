import { useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-[#1E293B]/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className={clsx(
        'relative w-full mx-4 bg-white rounded-card shadow-lg border border-[#DEDFE3]',
        'max-h-[90vh] flex flex-col animate-fade-in',
        sizes[size]
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DEDFE3]">
          <h2
            className="text-lg font-semibold text-[#1E293B]"
            style={{ fontFamily: "'DM Sans', ui-sans-serif, sans-serif" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#94A3B8] hover:bg-[#F0F2F5] transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-[#DEDFE3] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
